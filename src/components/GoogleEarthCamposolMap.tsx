import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Globe,
  Search,
  Share2,
  Play,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MapPin,
  Bus,
  Utensils,
  Layers,
  Compass,
  Maximize2,
  ExternalLink,
  Info,
  CheckCircle2,
  X,
  Copy,
  Plus,
  MoreVertical,
  RefreshCw,
  Navigation,
  Sliders,
  Shield,
  Building,
  Users,
  Calendar,
  Filter,
  Upload,
  Download,
  Crosshair,
  Check,
  Edit3,
  FileSpreadsheet,
  FileCode,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  GeoPoint,
  FundoFolder,
  GOOGLE_EARTH_PROJECT_URL,
  GOOGLE_EARTH_CAMERA,
  MAPA_CAMPOSOL_CENTER,
  MAPA_CAMPOSOL_ZOOM,
  RUTA_TRANSPORTE_VIRU_CHAO,
  RUTA_COSTERA_CARMELO_MORIN,
  RUTA_INTERIOR_FUNDOS,
  PARADEROS_GEO,
  PUNTOS_GOOGLE_EARTH_PROYECTO,
  FUNDOS_COMEDORES_TREE,
} from '../data/camposolGeoData';
import { normalizeParaderoKey } from '../data/masterData';
import { Requerimiento, DetalleRequerimiento } from '../types';
import { getStoredRequerimientos, getStoredDetalles } from '../services/storageService';
import {
  parseKMLString,
  parseKMZBuffer,
  parseExcelCoordinates,
  parseRawPastedCoordinates,
  getStoredCustomGeoPoints,
  saveCustomGeoPoints,
  clearCustomGeoPoints,
  exportToKML,
  ParsedGeoImportResult,
} from '../services/geoCoordinatesService';

interface GoogleEarthCamposolMapProps {
  onBack?: () => void;
  requerimientos?: Requerimiento[];
  detalles?: DetalleRequerimiento[];
}

export const GoogleEarthCamposolMap: React.FC<GoogleEarthCamposolMapProps> = ({
  onBack,
  requerimientos = [],
  detalles = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados de interfaz y vista
  const [activeTab, setActiveTab] = useState<'interactive' | 'earth-web'>('interactive');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [isTouring, setIsTouring] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalTab, setImportModalTab] = useState<'upload' | 'paste' | 'table'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filterOnlyActiveDemands, setFilterOnlyActiveDemands] = useState(false);

  // Modo de edición manual de coordenadas en mapa (Crosshair / Pin Fixer)
  const [isFixingMode, setIsFixingMode] = useState(false);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [tempLatInput, setTempLatInput] = useState<string>('');
  const [tempLngInput, setTempLngInput] = useState<string>('');

  // Configuración de escala visual de figuras y letras (Original Google Earth)
  const [markerSize, setMarkerSize] = useState<'micro' | 'small' | 'normal'>('small');
  const [showLabels, setShowLabels] = useState<boolean>(true);

  // Escala dimensional según el tamaño seleccionado
  const sizeConfig = useMemo(() => {
    if (markerSize === 'micro') {
      return {
        paraderoSize: 13,
        busIconSize: 7.5,
        comedorSize: 13,
        costaSize: 11,
        fontSize: 7.5,
        paxFontSize: 6.5,
        anchor: [6.5, 6.5] as [number, number],
        padding: '0px 2px',
        gap: '2px',
      };
    }
    if (markerSize === 'normal') {
      return {
        paraderoSize: 20,
        busIconSize: 11,
        comedorSize: 20,
        costaSize: 16,
        fontSize: 9.5,
        paxFontSize: 8,
        anchor: [10, 10] as [number, number],
        padding: '1px 4px',
        gap: '4px',
      };
    }
    // 'small' (Defecto: figuras pequeñas nítidas y letras sutiles según la imagen original)
    return {
      paraderoSize: 15,
      busIconSize: 8.5,
      comedorSize: 15,
      costaSize: 13,
      fontSize: 8,
      paxFontSize: 7,
      anchor: [7.5, 7.5] as [number, number],
      padding: '0.5px 3px',
      gap: '3px',
    };
  }, [markerSize]);

  const [cameraCoordinates, setCameraCoordinates] = useState({
    lat: GOOGLE_EARTH_CAMERA.lat,
    lng: GOOGLE_EARTH_CAMERA.lng,
    zoom: GOOGLE_EARTH_CAMERA.zoom,
  });

  // Árbol de carpetas y puntos con persistencia de personalización
  const [fundosTree, setFundosTree] = useState<FundoFolder[]>(() => {
    const saved = getStoredCustomGeoPoints();
    if (!saved) return FUNDOS_COMEDORES_TREE;

    // Actualizar puntos de fundosTree con los guardados
    const savedMap = new Map(saved.map((p) => [p.id, p]));
    return FUNDOS_COMEDORES_TREE.map((f) => ({
      ...f,
      puntos: f.puntos.map((p) => savedMap.get(p.id) || p),
    }));
  });

  const [paraderosList, setParaderosList] = useState<GeoPoint[]>(() => {
    const saved = getStoredCustomGeoPoints();
    if (!saved) return PARADEROS_GEO;
    const savedMap = new Map(saved.map((p) => [p.id, p]));
    return PARADEROS_GEO.map((p) => savedMap.get(p.id) || p);
  });

  const [puntosCostaList, setPuntosCostaList] = useState<GeoPoint[]>(() => {
    const saved = getStoredCustomGeoPoints();
    if (!saved) return PUNTOS_GOOGLE_EARTH_PROYECTO;
    const savedMap = new Map(saved.map((p) => [p.id, p]));
    return PUNTOS_GOOGLE_EARTH_PROYECTO.map((p) => savedMap.get(p.id) || p);
  });

  const [showPuntosCosta, setShowPuntosCosta] = useState(true);
  const [showParaderos, setShowParaderos] = useState(true);
  const [showRutas, setShowRutas] = useState(true);

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'root-project': true,
    'folder-costa': true,
    'folder-fundos': true,
    'fundo-agricultor-1': true,
    'fundo-agricultor-2': false,
    'fundo-mar-verde': true,
    'fundo-gloria': false,
    'fundo-arenal': false,
    'fundo-chao': false,
    'fundo-yakuy-minka': false,
    'fundo-compostera': false,
    'folder-paraderos': true,
    'folder-rutas': false,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Requerimientos y detalles reales en vivo desde "Procesos"
  const liveReqs = useMemo(() => {
    return requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
  }, [requerimientos]);

  const liveDets = useMemo(() => {
    return detalles.length > 0 ? detalles : getStoredDetalles();
  }, [detalles]);

  // Demanda real de pasajeros por paradero según requerimientos vigentes
  const demandaPorParadero = useMemo(() => {
    const map = new Map<string, { total: number; reqIds: Set<string>; fundos: Set<string> }>();
    const activeReqs = liveReqs.filter((r) => r.estado !== 'ANULADO' && r.estado !== 'RECHAZADO');
    const activeReqIds = new Set(activeReqs.map((r) => r.id));

    liveDets.forEach((d) => {
      if (!activeReqIds.has(d.requerimientoId)) return;
      const req = activeReqs.find((r) => r.id === d.requerimientoId);
      const paraderoNorm = normalizeParaderoKey(d.paradero);
      const current = map.get(paraderoNorm) || {
        total: 0,
        reqIds: new Set<string>(),
        fundos: new Set<string>(),
      };
      current.total += d.cantidad || 0;
      if (req) {
        current.reqIds.add(req.numeroRequerimiento || req.id);
        current.fundos.add(req.fundo);
      }
      map.set(paraderoNorm, current);
    });

    return map;
  }, [liveReqs, liveDets]);

  // Demanda real de pasajeros asignada a cada comedor según "Procesos"
  const demandaPorComedor = useMemo(() => {
    const map = new Map<string, { total: number; paraderos: Set<string>; reqIds: Set<string> }>();
    const activeReqs = liveReqs.filter((r) => r.estado !== 'ANULADO' && r.estado !== 'RECHAZADO');
    const activeReqIds = new Set(activeReqs.map((r) => r.id));

    liveDets.forEach((d) => {
      if (!activeReqIds.has(d.requerimientoId)) return;
      const req = activeReqs.find((r) => r.id === d.requerimientoId);
      const comedorKey = (d.comedor || '').trim().toUpperCase();
      if (!comedorKey) return;

      const current = map.get(comedorKey) || {
        total: 0,
        paraderos: new Set<string>(),
        reqIds: new Set<string>(),
      };
      current.total += d.cantidad || 0;
      current.paraderos.add(d.paradero);
      if (req) {
        current.reqIds.add(req.numeroRequerimiento || req.id);
      }
      map.set(comedorKey, current);
    });

    return map;
  }, [liveReqs, liveDets]);

  // Total de pasajeros con solicitud activa
  const totalPasajerosDemanda = useMemo(() => {
    let total = 0;
    demandaPorParadero.forEach((val) => {
      total += val.total;
    });
    return total;
  }, [demandaPorParadero]);

  // Total de puntos registrados en el mapa
  const totalComedores = useMemo(() => {
    return fundosTree.reduce((sum, f) => sum + f.puntos.length, 0);
  }, [fundosTree]);

  // Lista unificada de todos los puntos actuales
  const todosLosPuntos = useMemo(() => {
    return [
      ...puntosCostaList,
      ...paraderosList,
      ...fundosTree.flatMap((f) => f.puntos),
    ];
  }, [puntosCostaList, paraderosList, fundosTree]);

  // Puntos filtrados por búsqueda
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return todosLosPuntos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo && p.codigo.toLowerCase().includes(q)) ||
          p.fundo.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, todosLosPuntos]);

  // Actualizar coordenadas de un punto específico y persistir
  const handleUpdatePointCoordinates = (pointId: string, newLat: number, newLng: number) => {
    let updatedPoint: GeoPoint | null = null;

    // 1. En paraderos
    setParaderosList((prev) =>
      prev.map((p) => {
        if (p.id === pointId) {
          updatedPoint = { ...p, lat: newLat, lng: newLng };
          return updatedPoint;
        }
        return p;
      })
    );

    // 2. En fundos y comedores
    setFundosTree((prev) =>
      prev.map((f) => ({
        ...f,
        puntos: f.puntos.map((p) => {
          if (p.id === pointId) {
            updatedPoint = { ...p, lat: newLat, lng: newLng };
            return updatedPoint;
          }
          return p;
        }),
      }))
    );

    // 3. En sector costa
    setPuntosCostaList((prev) =>
      prev.map((p) => {
        if (p.id === pointId) {
          updatedPoint = { ...p, lat: newLat, lng: newLng };
          return updatedPoint;
        }
        return p;
      })
    );

    if (selectedPoint && selectedPoint.id === pointId) {
      setSelectedPoint({ ...selectedPoint, lat: newLat, lng: newLng });
    }

    // Persistir en LocalStorage
    setTimeout(() => {
      const allUpdated = [
        ...puntosCostaList.map((p) => (p.id === pointId ? { ...p, lat: newLat, lng: newLng } : p)),
        ...paraderosList.map((p) => (p.id === pointId ? { ...p, lat: newLat, lng: newLng } : p)),
        ...fundosTree.flatMap((f) =>
          f.puntos.map((p) => (p.id === pointId ? { ...p, lat: newLat, lng: newLng } : p))
        ),
      ];
      saveCustomGeoPoints(allUpdated);
    }, 50);

    showToast(`Coordenada fijada exitosamente: [${newLat.toFixed(6)}, ${newLng.toFixed(6)}]`);
  };

  // Aplicar resultado de importación (KML, KMZ, Excel o texto)
  const aplicarImportacion = (result: ParsedGeoImportResult) => {
    if (result.puntos.length === 0) {
      setImportError('No se encontraron puntos con coordenadas válidas.');
      return;
    }

    const nuevosParaderos: GeoPoint[] = [];
    const nuevosCosta: GeoPoint[] = [];
    const fundosMap = new Map<string, GeoPoint[]>();

    result.puntos.forEach((p) => {
      if (p.tipo === 'PARADERO') {
        nuevosParaderos.push(p);
      } else if (p.tipo === 'SECTOR_COSTA') {
        nuevosCosta.push(p);
      } else {
        const list = fundosMap.get(p.fundo) || [];
        list.push(p);
        fundosMap.set(p.fundo, list);
      }
    });

    if (nuevosParaderos.length > 0) {
      setParaderosList(nuevosParaderos);
    }
    if (nuevosCosta.length > 0) {
      setPuntosCostaList(nuevosCosta);
    }

    if (fundosMap.size > 0) {
      const colores = ['#0284c7', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0d9488', '#84cc16'];
      let idx = 0;
      const nuevasCarpetas: FundoFolder[] = [];
      fundosMap.forEach((pts, fundoName) => {
        nuevasCarpetas.push({
          id: `folder-imported-${idx}`,
          nombre: fundoName,
          cultivo: pts[0]?.cultivo || 'ARÁNDANO',
          visible: true,
          color: colores[idx % colores.length],
          puntos: pts,
        });
        idx++;
      });
      setFundosTree(nuevasCarpetas);
    }

    saveCustomGeoPoints(result.puntos);

    // Centrar mapa en el primer punto importado
    if (result.puntos.length > 0) {
      flyToPoint(result.puntos[0].lat, result.puntos[0].lng, 13);
      setSelectedPoint(result.puntos[0]);
    }

    setShowImportModal(false);
    showToast(result.mensaje);
  };

  // Manejo de carga de archivos (KML, KMZ, Excel)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.kmz')) {
        const buffer = await file.arrayBuffer();
        const result = await parseKMZBuffer(buffer);
        aplicarImportacion(result);
      } else if (fileName.endsWith('.kml')) {
        const text = await file.text();
        const result = parseKMLString(text);
        aplicarImportacion(result);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const buffer = await file.arrayBuffer();
        const result = parseExcelCoordinates(buffer);
        aplicarImportacion(result);
      } else {
        setImportError('Formato no soportado. Por favor sube un archivo .kml, .kmz o .xlsx con coordenadas.');
      }
    } catch (err: unknown) {
      console.error('Error al procesar archivo de coordenadas:', err);
      setImportError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
    }
  };

  // Manejo de pegado de texto
  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setImportError('Ingresa o pega las coordenadas antes de procesar.');
      return;
    }
    setImportError(null);
    try {
      const result = parseRawPastedCoordinates(pastedText);
      aplicarImportacion(result);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Error al interpretar las coordenadas pegadas.');
    }
  };

  // Exportar archivo KML oficial
  const handleExportKML = () => {
    const kmlContent = exportToKML(todosLosPuntos, 'Comedores Camposol 2025');
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Comedores_Camposol_2025_Oficial_${new Date().toISOString().slice(0, 10)}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo KML oficial descargado exitosamente para Google Earth.');
  };

  // Restablecer a coordenadas de fábrica
  const handleResetToDefaultCoordinates = () => {
    clearCustomGeoPoints();
    setFundosTree(FUNDOS_COMEDORES_TREE);
    setParaderosList(PARADEROS_GEO);
    setPuntosCostaList(PUNTOS_GOOGLE_EARTH_PROYECTO);
    flyToPoint(GOOGLE_EARTH_CAMERA.lat, GOOGLE_EARTH_CAMERA.lng, GOOGLE_EARTH_CAMERA.zoom);
    showToast('Coordenadas restablecidas a los valores oficiales de referencia.');
  };

  // Inicialización del Mapa Satelital Leaflet
  useEffect(() => {
    if (activeTab !== 'interactive' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: MAPA_CAMPOSOL_CENTER,
        zoom: MAPA_CAMPOSOL_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      // Capa Satelital Esri World Imagery (alta resolución)
      const esriSatellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; CAMPOSOL GIS',
        }
      );

      // Etiquetas y nombres de lugares oficiales sobre el satélite
      const esriLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.8,
        }
      );

      esriSatellite.addTo(map);
      esriLabels.addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      const routesLayer = L.layerGroup().addTo(map);

      markersLayerGroupRef.current = markersLayer;
      routesLayerGroupRef.current = routesLayer;
      mapInstanceRef.current = map;

      // Evento de movimiento para barra de coordenadas inferior
      map.on('move', () => {
        const c = map.getCenter();
        setCameraCoordinates({
          lat: c.lat,
          lng: c.lng,
          zoom: map.getZoom(),
        });
      });

      // Evento de click para fijar coordenada en modo Crosshair
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (editingPointId) {
          const { lat, lng } = e.latlng;
          handleUpdatePointCoordinates(editingPointId, lat, lng);
          setEditingPointId(null);
          setIsFixingMode(false);
        }
      });
    }

    return () => {
      // Cleanup
    };
  }, [activeTab, editingPointId]);

  // Dibujar Rutas y Polilíneas
  useEffect(() => {
    if (!routesLayerGroupRef.current) return;
    const routesLayer = routesLayerGroupRef.current;
    routesLayer.clearLayers();

    if (!showRutas) return;

    // 1. Ruta Principal Troncal Panamericana (Línea Azul con halo rojo visible en la imagen)
    const polylineMainRedHalo = L.polyline(RUTA_TRANSPORTE_VIRU_CHAO, {
      color: '#ef4444',
      weight: 8,
      opacity: 0.35,
    });
    const polylineMainBlue = L.polyline(RUTA_TRANSPORTE_VIRU_CHAO, {
      color: '#1d4ed8',
      weight: 5,
      opacity: 0.9,
    });

    // 2. Ruta Costera: Puerto Morín - El Carmelo - Huancaquito
    const polylineCostera = L.polyline(RUTA_COSTERA_CARMELO_MORIN, {
      color: '#0284c7',
      weight: 4,
      dashArray: '5, 5',
      opacity: 0.85,
    });

    // 3. Ruta Interior Fundos
    const polylineInterior = L.polyline(RUTA_INTERIOR_FUNDOS, {
      color: '#10b981',
      weight: 3.5,
      dashArray: '6, 6',
      opacity: 0.8,
    });

    polylineMainRedHalo.addTo(routesLayer);
    polylineMainBlue.addTo(routesLayer);
    polylineCostera.addTo(routesLayer);
    polylineInterior.addTo(routesLayer);
  }, [showRutas, activeTab]);

  // Renderizar Marcadores de Paraderos, Comedores y Puntos del Proyecto Earth
  useEffect(() => {
    if (!markersLayerGroupRef.current) return;
    const markersLayer = markersLayerGroupRef.current;
    markersLayer.clearLayers();

    // 1. Puntos del Sector Costa / El Carmelo / Puerto Morín (Tal cual Google Earth)
    if (showPuntosCosta) {
      puntosCostaList.forEach((pto) => {
        const isEditing = editingPointId === pto.id;
        const figW = isEditing ? sizeConfig.costaSize + 6 : sizeConfig.costaSize;

        const pinIcon = L.divIcon({
          className: 'camposol-earth-divicon',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: ${sizeConfig.gap};
              cursor: pointer;
            ">
              <div style="
                width: ${figW}px;
                height: ${figW}px;
                background: ${isEditing ? '#ef4444' : '#f59e0b'};
                border: 1.2px solid #ffffff;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.6);
                flex-shrink: 0;
                ${isEditing ? 'animation: pulse 1s infinite;' : ''}
              ">
                <span style="color: #ffffff; font-size: ${sizeConfig.fontSize}px; font-weight: 900; line-height: 1;">★</span>
              </div>
              ${
                showLabels
                  ? `<span style="
                      background: rgba(15, 23, 42, 0.75);
                      color: #ffffff;
                      font-size: ${sizeConfig.fontSize}px;
                      font-weight: 600;
                      padding: ${sizeConfig.padding};
                      border-radius: 3px;
                      border: 0.5px solid rgba(245, 158, 11, 0.5);
                      white-space: nowrap;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.9);
                      line-height: 1.15;
                      pointer-events: none;
                    ">
                      ${pto.nombre}
                    </span>`
                  : ''
              }
            </div>
          `,
          iconAnchor: sizeConfig.anchor,
        });

        const marker = L.marker([pto.lat, pto.lng], {
          icon: pinIcon,
          draggable: isEditing || isFixingMode,
        });

        marker.bindTooltip(
          `<strong>${pto.nombre}</strong><br/><span style="color:#f59e0b;font-size:11px;">Sector Costa • [${pto.lat.toFixed(5)}, ${pto.lng.toFixed(5)}]</span>`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', () => {
          setSelectedPoint(pto);
          setTempLatInput(pto.lat.toString());
          setTempLngInput(pto.lng.toString());
        });

        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          handleUpdatePointCoordinates(pto.id, latlng.lat, latlng.lng);
        });

        marker.addTo(markersLayer);
      });
    }

    // 2. Marcadores de Paraderos Oficiales (Figura Original: Círculo Azul con Bus Blanco)
    if (showParaderos) {
      paraderosList.forEach((paradero) => {
        const parKey = normalizeParaderoKey(paradero.nombre);
        const demanda = demandaPorParadero.get(parKey);
        const paxCount = demanda?.total || 0;

        if (filterOnlyActiveDemands && paxCount === 0) {
          return;
        }

        const hasActivePax = paxCount > 0;
        const isEditing = editingPointId === paradero.id;
        const figW = isEditing ? sizeConfig.paraderoSize + 6 : sizeConfig.paraderoSize;
        const iconW = isEditing ? sizeConfig.busIconSize + 3 : sizeConfig.busIconSize;

        const busIcon = L.divIcon({
          className: 'camposol-earth-divicon',
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: ${sizeConfig.gap};
              cursor: pointer;
            ">
              <div style="
                width: ${figW}px;
                height: ${figW}px;
                background: ${isEditing ? '#ef4444' : '#1a73e8'};
                border: 1.2px solid #ffffff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.6);
                position: relative;
                flex-shrink: 0;
                ${isEditing ? 'animation: bounce 1s infinite;' : ''}
              ">
                <svg width="${iconW}" height="${iconW}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 6v6"></path>
                  <path d="M15 6v6"></path>
                  <path d="M2 12h19.6"></path>
                  <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-3.3-2.7-6-6-6H8c-3.3 0-6 2.7-6 6 0 .4.1.8.2 1.2l.8 2.8h3"></path>
                  <circle cx="7" cy="18" r="2"></circle>
                  <circle cx="17" cy="18" r="2"></circle>
                </svg>
                ${
                  hasActivePax
                    ? `<span style="
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #16a34a;
                        color: #ffffff;
                        font-size: ${sizeConfig.paxFontSize}px;
                        font-weight: 900;
                        padding: 0 2px;
                        border-radius: 6px;
                        border: 0.8px solid #ffffff;
                        line-height: 1.1;
                      ">${paxCount}</span>`
                    : ''
                }
              </div>
              ${
                showLabels
                  ? `<span style="
                      background: rgba(15, 23, 42, 0.75);
                      color: #ffffff;
                      font-size: ${sizeConfig.fontSize}px;
                      font-weight: 600;
                      padding: ${sizeConfig.padding};
                      border-radius: 3px;
                      border: 0.5px solid ${isEditing ? '#ef4444' : hasActivePax ? 'rgba(74, 222, 128, 0.6)' : 'rgba(255,255,255,0.22)'};
                      white-space: nowrap;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.9);
                      line-height: 1.15;
                      pointer-events: none;
                    ">
                      ${paradero.nombre} ${hasActivePax ? `<span style="color:#4ade80;font-weight:800;">(${paxCount}p)</span>` : ''}
                    </span>`
                  : ''
              }
            </div>
          `,
          iconAnchor: sizeConfig.anchor,
        });

        const marker = L.marker([paradero.lat, paradero.lng], {
          icon: busIcon,
          draggable: isEditing || isFixingMode,
        });

        marker.bindTooltip(
          `<strong>${paradero.nombre}</strong><br/>
           <span style="color:#0284c7;font-size:11px;">Paradero Oficial • [${paradero.lat.toFixed(5)}, ${paradero.lng.toFixed(5)}]</span>
           ${
             hasActivePax
               ? `<br/><span style="color:#10b981;font-weight:bold;">⚡ ${paxCount} pasajeros solicitados en Procesos</span>`
               : ''
           }`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', () => {
          setSelectedPoint(paradero);
          setTempLatInput(paradero.lat.toString());
          setTempLngInput(paradero.lng.toString());
        });

        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          handleUpdatePointCoordinates(paradero.id, latlng.lat, latlng.lng);
        });

        marker.addTo(markersLayer);
      });
    }

    // 3. Marcadores de Comedores por Fundo Real (Figura Original: Casita Naranja/Roja)
    fundosTree.forEach((fundo) => {
      if (!fundo.visible) return;

      fundo.puntos.forEach((comedor) => {
        const isGarita = comedor.tipo === 'GARITA';
        const isAcopio = comedor.tipo === 'ACOPIO';
        const isPlat = comedor.tipo === 'PLATAFORMA';
        const isEditing = editingPointId === comedor.id;

        const comKey = (comedor.codigo || comedor.nombre).toUpperCase();
        const demanda = demandaPorComedor.get(comKey);
        const paxCount = demanda?.total || 0;

        if (filterOnlyActiveDemands && paxCount === 0 && !isGarita) {
          return;
        }

        const hasActivePax = paxCount > 0;
        const figW = isEditing ? sizeConfig.comedorSize + 6 : sizeConfig.comedorSize;

        // Figura original: Casita naranja/roja para Comedores; insignia compacta para Garitas/Acopio
        let figureHtml = '';
        if (isGarita) {
          figureHtml = `
            <div style="
              width: ${figW}px;
              height: ${figW}px;
              background: ${isEditing ? '#ef4444' : '#334155'};
              border: 1.2px solid #ffffff;
              border-radius: 3px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.6);
              position: relative;
              flex-shrink: 0;
            ">
              <span style="color: #ffffff; font-size: ${sizeConfig.fontSize}px; font-weight: 900; line-height: 1;">G</span>
            </div>
          `;
        } else if (isAcopio || isPlat) {
          figureHtml = `
            <div style="
              width: ${figW}px;
              height: ${figW}px;
              background: ${isEditing ? '#ef4444' : '#0d9488'};
              border: 1.2px solid #ffffff;
              border-radius: 3px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.6);
              position: relative;
              flex-shrink: 0;
            ">
              <span style="color: #ffffff; font-size: ${sizeConfig.fontSize}px; font-weight: 900; line-height: 1;">${isAcopio ? 'A' : 'P'}</span>
            </div>
          `;
        } else {
          // Figura original Comedor: Casita / Comedor con techo a dos aguas y relleno naranja/rojo
          figureHtml = `
            <div style="
              width: ${figW}px;
              height: ${figW}px;
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));
              ${isEditing ? 'animation: bounce 1s infinite;' : ''}
            ">
              <svg width="${figW}" height="${figW}" viewBox="0 0 24 24" fill="${isEditing ? '#ef4444' : '#ea580c'}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z" />
                <path d="M10 21v-7h4v7" fill="#ffffff" stroke="none" opacity="0.95" />
              </svg>
              ${
                hasActivePax
                  ? `<span style="
                      position: absolute;
                      top: -5px;
                      right: -5px;
                      background: #16a34a;
                      color: #ffffff;
                      font-size: ${sizeConfig.paxFontSize}px;
                      font-weight: 900;
                      padding: 0 2px;
                      border-radius: 6px;
                      border: 0.8px solid #ffffff;
                      line-height: 1.1;
                    ">${paxCount}</span>`
                  : ''
              }
            </div>
          `;
        }

        const markerHtml = `
          <div style="
            display: flex;
            align-items: center;
            gap: ${sizeConfig.gap};
            cursor: pointer;
          ">
            ${figureHtml}
            ${
              showLabels
                ? `<span style="
                    background: rgba(15, 23, 42, 0.75);
                    color: #ffffff;
                    font-size: ${sizeConfig.fontSize}px;
                    font-weight: 600;
                    padding: ${sizeConfig.padding};
                    border-radius: 3px;
                    border: 0.5px solid ${isEditing ? '#ef4444' : 'rgba(255,255,255,0.22)'};
                    white-space: nowrap;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.9);
                    line-height: 1.15;
                    pointer-events: none;
                  ">
                    ${comedor.codigo || comedor.nombre} ${hasActivePax ? `<span style="color:#4ade80;font-weight:800;">(${paxCount}p)</span>` : ''}
                  </span>`
                : ''
            }
          </div>
        `;

        const comedorIcon = L.divIcon({
          className: 'camposol-earth-divicon',
          html: markerHtml,
          iconAnchor: sizeConfig.anchor,
        });

        const marker = L.marker([comedor.lat, comedor.lng], {
          icon: comedorIcon,
          draggable: isEditing || isFixingMode,
        });

        marker.bindTooltip(
          `<strong>${comedor.nombre}</strong><br/>Fundo ${comedor.fundo} • [${comedor.lat.toFixed(5)}, ${comedor.lng.toFixed(5)}]${
            paxCount > 0 ? `<br/><span style="color:#10b981;font-weight:bold;">⚡ ${paxCount} pax programados</span>` : ''
          }`,
          { direction: 'top', offset: [0, -6] }
        );

        marker.on('click', () => {
          setSelectedPoint(comedor);
          setTempLatInput(comedor.lat.toString());
          setTempLngInput(comedor.lng.toString());
        });

        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          handleUpdatePointCoordinates(comedor.id, latlng.lat, latlng.lng);
        });

        marker.addTo(markersLayer);
      });
    });
  }, [
    fundosTree,
    paraderosList,
    puntosCostaList,
    showPuntosCosta,
    showParaderos,
    showLabels,
    markerSize,
    sizeConfig,
    filterOnlyActiveDemands,
    demandaPorParadero,
    demandaPorComedor,
    editingPointId,
    isFixingMode,
    activeTab,
  ]);

  // Centrar y volar a un punto en el mapa
  const flyToPoint = (lat: number, lng: number, zoomLevel = 15) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoomLevel, {
        duration: 1.2,
      });
    }
  };

  // Toggle de visibilidad de carpeta de fundo
  const toggleFundoVisibility = (fundoId: string) => {
    setFundosTree((prev) =>
      prev.map((f) => (f.id === fundoId ? { ...f, visible: !f.visible } : f))
    );
  };

  // Toggle de apertura de subcarpeta
  const toggleFolderExpanded = (key: string) => {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Tour guiado por los puntos reales de CAMPOSOL y Google Earth
  const startTour = () => {
    if (isTouring) {
      setIsTouring(false);
      return;
    }

    setIsTouring(true);
    showToast('Iniciando presentación de diapositivas por los fundos y comedores reales...');

    const stops: Array<{ lat: number; lng: number; zoom: number; msg: string }> = [
      { lat: -8.3970, lng: -78.8960, zoom: 14, msg: 'Sector Costa: Puerto Morín, CISA Santorín y Agrícola Alpamayo' },
      { lat: -8.4350, lng: -78.8250, zoom: 14, msg: 'Sector El Carmelo: Campo Santo, Las Gaviotas y Peñacerro' },
      { lat: -8.4120, lng: -78.7950, zoom: 14, msg: 'Fundo Compostera / Danper: Acopio y Operaciones' },
      { lat: -8.4220, lng: -78.7500, zoom: 13, msg: 'Ruta Troncal Virú: Red de 19 Paraderos Panamericana Norte' },
      { lat: -8.4410, lng: -78.7020, zoom: 14, msg: 'Fundo Mar Verde: Comedor MV, Biofábrica 4 y Viviendas' },
      { lat: -8.4720, lng: -78.6920, zoom: 14, msg: 'Fundo Gloria: Áreas de Palto y Arándano (Comedores C198, C197)' },
      { lat: -8.4610, lng: -78.7250, zoom: 14, msg: 'Fundo Arenal: Comedor y Garita Arenal' },
      { lat: -8.5200, lng: -78.6750, zoom: 14, msg: 'Fundo Chao 1 y 2: Comedores y Garita Central' },
      { lat: -8.5410, lng: -78.6820, zoom: 14, msg: 'Fundo Agricultor 1: Comedor Central 57, Garita 1 y Comedor 521' },
      { lat: -8.5480, lng: -78.6865, zoom: 14, msg: 'Fundo Agricultor 2: Comedores 556, 557, 561 y 766' },
      { lat: -8.5250, lng: -78.6920, zoom: 14, msg: 'Fundo Yakuy Minka: Embalse y Plataforma Agroindustrial' },
      { lat: GOOGLE_EARTH_CAMERA.lat, lng: GOOGLE_EARTH_CAMERA.lng, zoom: 12, msg: 'Vista General Oficial: Comedores Camposol 2025' },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current >= stops.length) {
        clearInterval(interval);
        setIsTouring(false);
        showToast('Presentación finalizada.');
        return;
      }
      const s = stops[current];
      flyToPoint(s.lat, s.lng, s.zoom);
      showToast(s.msg);
      current++;
    }, 4500);
  };

  // Convertir lat/lng a formato Grados, Minutos y Segundos
  const formatDMS = (coord: number, isLat: boolean): string => {
    const absolute = Math.abs(coord);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
    const direction = isLat ? (coord >= 0 ? 'N' : 'S') : coord >= 0 ? 'E' : 'W';
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] bg-[#0f172a] rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-8 z-50 bg-[#173B56] text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hidden File Input for KML/KMZ/Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".kml,.kmz,.xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER - GOOGLE EARTH PROJECT BANNER                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#1e293b] border-b border-gray-700/80 px-4 py-2 flex items-center justify-between text-white text-xs z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-sky-400 to-emerald-500 flex items-center justify-center text-white shadow-md">
            <Globe className="w-4 h-4 animate-spin-slow" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                Comedores Camposol 2025
              </h1>
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Google Drive
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="hover:text-white transition-colors cursor-pointer text-sky-400 font-bold"
              >
                Cargar Coordenadas
              </button>
              <button
                type="button"
                onClick={handleExportKML}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Exportar KML
              </button>
              <button
                type="button"
                onClick={handleResetToDefaultCoordinates}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                Restablecer
              </button>
              <span>Herramientas</span>
            </div>
          </div>
        </div>

        {/* Search Bar matching Google Earth */}
        <div className="relative w-72 hidden md:block">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar fundo, paradero, comedor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] text-white pl-9 pr-3 py-1.5 rounded-full border border-gray-600 focus:outline-none focus:border-sky-400 text-xs placeholder:text-gray-500 font-medium"
          />

          {/* Autocomplete dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e293b] border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-gray-700">
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    flyToPoint(p.lat, p.lng, 16);
                    setSelectedPoint(p);
                    setTempLatInput(p.lat.toString());
                    setTempLngInput(p.lng.toString());
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 hover:bg-sky-600/30 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {p.tipo === 'PARADERO' ? (
                      <Bus className="w-3.5 h-3.5 text-sky-400" />
                    ) : (
                      <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="font-bold text-white">{p.nombre}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold">{p.fundo}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* BOTÓN PROMINENTE: CARGAR COORDENADAS (KML / KMZ / EXCEL) */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00843D] hover:bg-emerald-600 text-white rounded-full font-black text-xs shadow-md transition-all cursor-pointer border border-emerald-400/50"
            title="Cargar y leer coordenadas desde KML, KMZ de Google Earth o Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Cargar Mis Coordenadas</span>
          </button>

          {/* MODO FIJAR EN MAPA */}
          <button
            type="button"
            onClick={() => {
              setIsFixingMode(!isFixingMode);
              if (!isFixingMode) {
                showToast('Modo fijar activo: Haz clic en cualquier punto del mapa o arrastra el marcador para fijar su coordenada.');
              } else {
                setEditingPointId(null);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
              isFixingMode
                ? 'bg-amber-600 border-amber-400 text-white shadow-md animate-pulse'
                : 'bg-[#0f172a] border-gray-600 text-gray-300 hover:text-white'
            }`}
            title="Activar modo para arrastrar o hacer clic en el mapa y fijar coordenadas"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Fijar en Mapa</span>
          </button>

          {/* Selector de Filtro en Vivo desde Procesos */}
          <button
            type="button"
            onClick={() => {
              setFilterOnlyActiveDemands(!filterOnlyActiveDemands);
              showToast(
                filterOnlyActiveDemands
                  ? 'Mostrando todos los paraderos y comedores del catálogo.'
                  : `Filtrando solo puntos con requerimientos activos en Procesos (${totalPasajerosDemanda} pax).`
              );
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
              filterOnlyActiveDemands
                ? 'bg-sky-600 border-sky-400 text-white shadow-md'
                : 'bg-[#0f172a] border-gray-600 text-gray-300 hover:text-white'
            }`}
            title="Filtrar solo paraderos y comedores que tienen solicitudes activas en Procesos"
          >
            <Users className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden sm:inline">Activos Procesos</span>
            {totalPasajerosDemanda > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-sky-800 rounded-full font-black text-[10px]">
                {totalPasajerosDemanda}p
              </span>
            )}
          </button>

          {/* Selector de Tamaño de Letras y Figuras */}
          <div className="bg-[#0f172a] p-0.5 rounded-xl border border-gray-600 flex items-center text-[11px] font-bold">
            <span className="text-gray-400 px-2 text-[10px] hidden xl:inline">Figuras:</span>
            <button
              type="button"
              onClick={() => {
                setMarkerSize('micro');
                showToast('Figuras y letras en tamaño MICRO (mínimo).');
              }}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-[10px] ${
                markerSize === 'micro'
                  ? 'bg-amber-600 text-white font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Figuras y letras tamaño Micro (mínimo)"
            >
              Micro
            </button>
            <button
              type="button"
              onClick={() => {
                setMarkerSize('small');
                showToast('Figuras y letras en tamaño PEQUEÑO (original).');
              }}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-[10px] ${
                markerSize === 'small'
                  ? 'bg-sky-600 text-white font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Figuras y letras tamaño Pequeño (original)"
            >
              Pequeño
            </button>
            <button
              type="button"
              onClick={() => {
                setMarkerSize('normal');
                showToast('Figuras y letras en tamaño NORMAL.');
              }}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-[10px] ${
                markerSize === 'normal'
                  ? 'bg-gray-700 text-white font-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Figuras y letras tamaño Normal"
            >
              Medio
            </button>
          </div>

          {/* Toggle de Letras / Nombres */}
          <button
            type="button"
            onClick={() => {
              setShowLabels(!showLabels);
              showToast(showLabels ? 'Ocultando letras (solo figuras visibles).' : 'Mostrando letras y nombres.');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
              showLabels
                ? 'bg-[#0f172a] border-emerald-500/50 text-emerald-300 hover:text-white'
                : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
            }`}
            title="Alternar visibilidad de las etiquetas de texto"
          >
            {showLabels ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
            <span className="hidden md:inline">{showLabels ? 'Letras ON' : 'Solo Figuras'}</span>
          </button>

          {/* Selector de Modo: Visor Satelital vs Google Earth Web */}
          <div className="bg-[#0f172a] p-0.5 rounded-xl border border-gray-600 flex items-center text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('interactive')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'interactive'
                  ? 'bg-sky-600 text-white font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Visor Satelital
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('earth-web')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'earth-web'
                  ? 'bg-sky-600 text-white font-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Google Earth Web
            </button>
          </div>

          <button
            type="button"
            onClick={startTour}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer ${
              isTouring
                ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse'
                : 'bg-transparent border-gray-500 text-white hover:bg-gray-700'
            }`}
            title="Recorrido guiado de presentación por todos los fundos"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Presentación</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0066da] hover:bg-blue-600 text-white rounded-full font-bold transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir</span>
          </button>

          <a
            href={GOOGLE_EARTH_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 p-2 bg-[#0f172a] hover:bg-gray-700 text-gray-300 rounded-full border border-gray-600 transition-all cursor-pointer"
            title="Abrir directamente en Google Earth Web Oficial"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold"
            >
              Volver
            </button>
          )}
        </div>
      </div>

      {/* Banner de Modo Fijar Coordenadas */}
      {isFixingMode && (
        <div className="bg-amber-600 text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 animate-spin-slow" />
            <span>
              MODO FIJAR COORDENADAS ACTIVO:{' '}
              {editingPointId
                ? `Haz clic en el mapa satelital para fijar la posición de "${
                    todosLosPuntos.find((p) => p.id === editingPointId)?.nombre
                  }"`
                : 'Selecciona un comedor o paradero y arrastra su marcador en el mapa para ubicarlo con precisión.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsFixingMode(false);
              setEditingPointId(null);
            }}
            className="px-3 py-0.5 bg-white text-amber-900 rounded-full text-[11px] font-black hover:bg-amber-50 cursor-pointer"
          >
            Finalizar Edición
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN BODY: LEFT SIDEBAR + MAP CONTAINER                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Tree Sidebar: "Contenido del mapa" */}
        <div
          className={`${
            sidebarOpen ? 'w-80' : 'w-0'
          } transition-all duration-300 bg-[#1e293b] border-r border-gray-700/80 flex flex-col shrink-0 text-white text-xs overflow-hidden z-20`}
        >
          {/* Sidebar Header */}
          <div className="p-3 border-b border-gray-700/70 flex items-center justify-between">
            <span className="font-bold text-gray-200">Contenido del mapa</span>
            <div className="flex items-center gap-1.5 text-gray-400">
              <button
                type="button"
                onClick={() => {
                  flyToPoint(MAPA_CAMPOSOL_CENTER[0], MAPA_CAMPOSOL_CENTER[1], MAPA_CAMPOSOL_ZOOM);
                  showToast('Vista restablecida a la posición oficial de Google Earth.');
                }}
                className="p-1 hover:text-white transition-colors cursor-pointer"
                title="Restablecer vista a coordenadas oficiales"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="p-1 hover:text-white transition-colors cursor-pointer text-emerald-400"
                title="Cargar archivo KML/KMZ o Excel con mis coordenadas"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleExportKML}
                className="p-1 hover:text-white transition-colors cursor-pointer text-sky-400"
                title="Descargar KML de las coordenadas actuales"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section: Capas del Proyecto Google Earth */}
          <div className="px-3 py-2 bg-[#0f172a]/60 border-b border-gray-700/50 flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold">Capas y Coordenadas</span>
            </div>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="text-[10px] text-sky-400 font-bold hover:underline cursor-pointer"
            >
              + Importar KML
            </button>
          </div>

          {/* Folder Hierarchy Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {/* 1. Root: Comedores Camposol 2025 */}
            <div>
              <div
                className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-gray-700/50 cursor-pointer font-bold"
                onClick={() => toggleFolderExpanded('root-project')}
              >
                <div className="flex items-center gap-1.5">
                  {expandedFolders['root-project'] ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  {expandedFolders['root-project'] ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="text-gray-100 font-black">Comedores Camposol 2025</span>
                </div>
              </div>

              {expandedFolders['root-project'] && (
                <div className="pl-3 mt-1 space-y-1 border-l border-gray-700 ml-2">
                  {/* CARPETA 1: Sector Costa / El Carmelo / Puerto Morín */}
                  <div className="space-y-0.5">
                    <div className="py-1 px-1.5 flex items-center justify-between hover:bg-gray-700/60 rounded-md cursor-pointer group">
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={() => toggleFolderExpanded('folder-costa')}
                      >
                        {expandedFolders['folder-costa'] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-amber-300" />
                        <span className="font-bold truncate text-gray-200">
                          Sector Costa / El Carmelo ({puntosCostaList.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPuntosCosta(!showPuntosCosta)}
                        className="p-0.5 text-gray-400 hover:text-white"
                      >
                        {showPuntosCosta ? (
                          <Eye className="w-3 h-3 text-amber-400" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {expandedFolders['folder-costa'] && (
                      <div className="pl-4 space-y-0.5 border-l border-gray-700/80 ml-2">
                        {puntosCostaList.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              flyToPoint(p.lat, p.lng, 15);
                              setSelectedPoint(p);
                              setTempLatInput(p.lat.toString());
                              setTempLngInput(p.lng.toString());
                            }}
                            className={`py-0.5 px-1.5 flex items-center justify-between rounded hover:bg-sky-900/40 cursor-pointer text-[11px] ${
                              selectedPoint?.id === p.id ? 'bg-sky-600/30 text-amber-300 font-black' : 'text-gray-300'
                            }`}
                          >
                            <span className="truncate">{p.nombre}</span>
                            <span className="text-[9px] text-gray-500 font-mono">Costa</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CARPETA 2: Fundos y Comedores CAMPOSOL */}
                  <div className="space-y-0.5">
                    <div className="py-1 px-1.5 flex items-center justify-between hover:bg-gray-700/60 rounded-md cursor-pointer group">
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={() => toggleFolderExpanded('folder-fundos')}
                      >
                        {expandedFolders['folder-fundos'] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <Folder className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-bold truncate text-gray-200">
                          Fundos y Comedores ({fundosTree.length} Fundos)
                        </span>
                      </div>
                    </div>

                    {expandedFolders['folder-fundos'] && (
                      <div className="pl-3 space-y-1 border-l border-gray-700 ml-2">
                        {fundosTree.map((fundo) => {
                          const isExpanded = expandedFolders[fundo.id];
                          return (
                            <div key={fundo.id} className="space-y-0.5">
                              <div className="py-1 px-1.5 flex items-center justify-between hover:bg-gray-700/60 rounded-md cursor-pointer group">
                                <div
                                  className="flex items-center gap-1.5 flex-1 min-w-0"
                                  onClick={() => {
                                    toggleFolderExpanded(fundo.id);
                                    if (fundo.puntos.length > 0) {
                                      flyToPoint(fundo.puntos[0].lat, fundo.puntos[0].lng, 14);
                                    }
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-gray-400" />
                                  )}
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: fundo.color }}
                                  />
                                  <span className="font-bold truncate text-gray-200">{fundo.nombre}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-gray-400 font-bold px-1 bg-gray-800 rounded">
                                    {fundo.puntos.length}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleFundoVisibility(fundo.id);
                                    }}
                                    className="p-0.5 text-gray-400 hover:text-white"
                                    title={fundo.visible ? 'Ocultar capa' : 'Mostrar capa'}
                                  >
                                    {fundo.visible ? (
                                      <Eye className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <EyeOff className="w-3 h-3 text-gray-500" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Puntos del fundo */}
                              {isExpanded && (
                                <div className="pl-4 space-y-0.5 border-l border-gray-700/80 ml-2">
                                  {fundo.puntos.map((p) => {
                                    const comKey = (p.codigo || p.nombre).toUpperCase();
                                    const demanda = demandaPorComedor.get(comKey);
                                    const pax = demanda?.total || 0;
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => {
                                          flyToPoint(p.lat, p.lng, 16);
                                          setSelectedPoint(p);
                                          setTempLatInput(p.lat.toString());
                                          setTempLngInput(p.lng.toString());
                                        }}
                                        className={`py-0.5 px-1.5 flex items-center justify-between rounded hover:bg-sky-900/40 cursor-pointer text-[11px] ${
                                          selectedPoint?.id === p.id
                                            ? 'bg-sky-600/30 text-sky-300 font-black'
                                            : 'text-gray-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          {p.tipo === 'GARITA' ? (
                                            <span className="w-3.5 h-3.5 rounded bg-slate-700 text-[8px] font-black text-white flex items-center justify-center shrink-0">G</span>
                                          ) : (
                                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" strokeWidth="1.6">
                                              <path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z" />
                                            </svg>
                                          )}
                                          <span className="truncate">{p.nombre}</span>
                                        </div>
                                        {pax > 0 && (
                                          <span className="text-[9px] bg-emerald-900/80 text-emerald-300 px-1 rounded font-black shrink-0">
                                            {pax}p
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* CARPETA 3: Red Oficial de Paraderos de Transporte */}
                  <div className="space-y-0.5">
                    <div className="py-1 px-1.5 flex items-center justify-between hover:bg-gray-700/60 rounded-md cursor-pointer group">
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={() => toggleFolderExpanded('folder-paraderos')}
                      >
                        {expandedFolders['folder-paraderos'] ? (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        )}
                        <Bus className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-bold truncate text-gray-200">
                          Red de Paraderos ({paraderosList.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowParaderos(!showParaderos)}
                        className="p-0.5 text-gray-400 hover:text-white"
                      >
                        {showParaderos ? (
                          <Eye className="w-3 h-3 text-sky-400" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {expandedFolders['folder-paraderos'] && (
                      <div className="pl-4 space-y-0.5 border-l border-gray-700/80 ml-2">
                        {paraderosList.map((p) => {
                          const norm = normalizeParaderoKey(p.nombre);
                          const dem = demandaPorParadero.get(norm);
                          const pax = dem?.total || 0;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                flyToPoint(p.lat, p.lng, 16);
                                setSelectedPoint(p);
                                setTempLatInput(p.lat.toString());
                                setTempLngInput(p.lng.toString());
                              }}
                              className={`py-0.5 px-1.5 flex items-center justify-between rounded hover:bg-sky-900/40 cursor-pointer text-[11px] ${
                                selectedPoint?.id === p.id
                                  ? 'bg-sky-600/30 text-sky-300 font-black'
                                  : 'text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="w-3.5 h-3.5 rounded-full bg-[#1a73e8] border border-white flex items-center justify-center text-[7px] text-white shrink-0 shadow-xs">
                                  🚌
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {p.zona === 'NORTE' ? 'VIR' : 'CHAO'}
                                </span>
                                <span className="truncate">{p.nombre}</span>
                              </div>
                              {pax > 0 ? (
                                <span className="text-[9px] bg-emerald-600 text-white px-1.5 rounded-full font-black shrink-0">
                                  {pax}p
                                </span>
                              ) : (
                                <span className="text-[9px] text-gray-500 font-mono shrink-0">
                                  {p.codigo}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* CARPETA 4: Rutas y Vías Operativas */}
                  <div className="space-y-0.5">
                    <div className="py-1 px-1.5 flex items-center justify-between hover:bg-gray-700/60 rounded-md cursor-pointer group">
                      <div
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        onClick={() => setShowRutas(!showRutas)}
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-bold truncate text-gray-200">Rutas Troncal y Costa</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRutas(!showRutas)}
                        className="p-0.5 text-gray-400 hover:text-white"
                      >
                        {showRutas ? (
                          <Eye className="w-3 h-3 text-blue-400" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 bg-[#0f172a] border-t border-gray-700 text-[11px] text-gray-400 flex items-center justify-between">
            <span>
              {totalComedores} comedores • {paraderosList.length} paraderos
            </span>
            <span className="font-bold text-emerald-400">CAMPOSOL GIS</span>
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-3 z-30 bg-[#1e293b] hover:bg-[#334155] text-white p-1.5 rounded-r-xl border-y border-r border-gray-600 shadow-xl transition-all cursor-pointer"
          style={{ left: sidebarOpen ? '320px' : '0' }}
          title={sidebarOpen ? 'Ocultar panel' : 'Mostrar panel'}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4 rotate-180" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* ----------------------------------------------------------- */}
        {/* TAB 1: VISOR SATELITAL INTERACTIVO NATIVO                   */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'interactive' && (
          <div className="flex-1 h-full relative overflow-hidden bg-black">
            {/* Map Canvas Container */}
            <div
              ref={mapContainerRef}
              className={`w-full h-full z-10 ${isFixingMode ? 'cursor-crosshair' : ''}`}
            />

            {/* Floating Map Controls (Top Right) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
                }}
                className="w-9 h-9 bg-[#1e293b]/90 hover:bg-[#334155] text-white rounded-xl border border-gray-600 flex items-center justify-center font-black shadow-xl cursor-pointer"
                title="Acercar zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
                }}
                className="w-9 h-9 bg-[#1e293b]/90 hover:bg-[#334155] text-white rounded-xl border border-gray-600 flex items-center justify-center font-black shadow-xl cursor-pointer"
                title="Alejar zoom"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  flyToPoint(MAPA_CAMPOSOL_CENTER[0], MAPA_CAMPOSOL_CENTER[1], MAPA_CAMPOSOL_ZOOM);
                  showToast('Cámara orientada a las coordenadas oficiales de Google Earth.');
                }}
                className="w-9 h-9 bg-[#1e293b]/90 hover:bg-[#334155] text-white rounded-xl border border-gray-600 flex items-center justify-center shadow-xl cursor-pointer"
                title="Restablecer coordenadas oficiales del enlace (-8.4289, -78.7358)"
              >
                <Compass className="w-4 h-4 text-rose-400" />
              </button>
              <button
                type="button"
                onClick={() => setShowRutas(!showRutas)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-xl cursor-pointer ${
                  showRutas
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-[#1e293b]/90 border-gray-600 text-gray-400'
                }`}
                title="Mostrar/Ocultar rutas principales"
              >
                <Navigation className="w-4 h-4" />
              </button>
            </div>

            {/* Modal / Card de Punto Seleccionado con Editor de Coordenadas */}
            {selectedPoint && (
              <div className="absolute bottom-10 left-6 z-30 max-w-sm w-88 bg-[#1e293b]/95 backdrop-blur-md border border-gray-600 text-white p-4 rounded-2xl shadow-2xl animate-fade-in text-xs space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
                      style={{
                        backgroundColor:
                          selectedPoint.tipo === 'PARADERO'
                            ? '#0284c7'
                            : selectedPoint.tipo === 'SECTOR_COSTA'
                            ? '#f59e0b'
                            : '#00843D',
                      }}
                    >
                      {selectedPoint.tipo === 'PARADERO' ? (
                        <Bus className="w-4 h-4" />
                      ) : selectedPoint.tipo === 'SECTOR_COSTA' ? (
                        <Globe className="w-4 h-4" />
                      ) : (
                        <Utensils className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">
                        {selectedPoint.tipo} • {selectedPoint.fundo}
                      </span>
                      <h3 className="text-sm font-black text-white leading-tight">
                        {selectedPoint.nombre}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPoint(null);
                      setEditingPointId(null);
                    }}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 py-1 border-y border-gray-700/80 text-[11px]">
                  <div>
                    <span className="text-gray-400 block font-bold">Cultivo:</span>
                    <span className="font-bold text-gray-200">{selectedPoint.cultivo}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold">Zona Operativa:</span>
                    <span className="font-bold text-gray-200">{selectedPoint.zona}</span>
                  </div>
                  {selectedPoint.capacidad && (
                    <div>
                      <span className="text-gray-400 block font-bold">Capacidad:</span>
                      <span className="font-bold text-emerald-400">{selectedPoint.capacidad} pax</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 block font-bold">Código Oficial:</span>
                    <span className="font-mono font-bold text-sky-300">{selectedPoint.codigo || '-'}</span>
                  </div>
                </div>

                {/* Demanda en vivo desde "Procesos" si aplica */}
                {selectedPoint.tipo === 'PARADERO' && (() => {
                  const norm = normalizeParaderoKey(selectedPoint.nombre);
                  const dem = demandaPorParadero.get(norm);
                  if (dem && dem.total > 0) {
                    return (
                      <div className="bg-emerald-950/60 border border-emerald-500/40 p-2 rounded-xl text-[11px] text-emerald-200 space-y-1">
                        <div className="flex items-center justify-between font-black text-emerald-300">
                          <span>⚡ Demanda en Vivo (Procesos):</span>
                          <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                            {dem.total} pasajeros
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-300">
                          <span>Requerimientos: </span>
                          <span className="font-mono text-emerald-400">{Array.from(dem.reqIds).join(', ')}</span>
                        </div>
                        <div className="text-[10px] text-gray-300">
                          <span>Destinos: </span>
                          <span className="font-bold text-white">{Array.from(dem.fundos).join(', ')}</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-[10px] text-gray-400 italic">
                      Sin requerimientos activos de personal para la fecha.
                    </div>
                  );
                })()}

                {/* Editor manual de Coordenadas Latitud / Longitud */}
                <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
                    <span className="flex items-center gap-1.5 text-sky-400">
                      <Crosshair className="w-3.5 h-3.5" />
                      Coordenadas GPS Exactas:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPointId(selectedPoint.id);
                        setIsFixingMode(true);
                        showToast(`Haz clic en el mapa satelital para fijar la ubicación de "${selectedPoint.nombre}".`);
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
                    >
                      Fijar con Clic en Mapa
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Latitud (Decimal)</span>
                      <input
                        type="text"
                        value={tempLatInput}
                        onChange={(e) => setTempLatInput(e.target.value)}
                        placeholder="-8.4289"
                        className="w-full bg-[#1e293b] border border-gray-600 rounded px-2 py-1 text-white text-[11px]"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Longitud (Decimal)</span>
                      <input
                        type="text"
                        value={tempLngInput}
                        onChange={(e) => setTempLngInput(e.target.value)}
                        placeholder="-78.7358"
                        className="w-full bg-[#1e293b] border border-gray-600 rounded px-2 py-1 text-white text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-gray-400">
                      {formatDMS(selectedPoint.lat, true)} {formatDMS(selectedPoint.lng, false)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newLat = parseFloat(tempLatInput);
                        const newLng = parseFloat(tempLngInput);
                        if (!isNaN(newLat) && !isNaN(newLng)) {
                          handleUpdatePointCoordinates(selectedPoint.id, newLat, newLng);
                          flyToPoint(newLat, newLng, 16);
                        } else {
                          showToast('Valores de latitud o longitud inválidos.');
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black cursor-pointer"
                    >
                      Guardar Coordenadas
                    </button>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`https://earth.google.com/web/@${selectedPoint.lat},${selectedPoint.lng},100a,2500d,35y,0h,0t,0r`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#00843D] hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-[11px]"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Ver en Google Earth</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => flyToPoint(selectedPoint.lat, selectedPoint.lng, 17)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-[11px]"
                  >
                    Centrar
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Status Bar matching Google Earth with Figure Legend */}
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#1e293b]/95 backdrop-blur-xs border-t border-gray-700/80 px-4 py-1 text-[11px] text-gray-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white hidden sm:inline">Google Earth • Comedores Camposol 2025</span>

                {/* Leyenda de Figuras Originales */}
                <div className="flex items-center gap-3 text-[10px] bg-[#0f172a]/80 px-2.5 py-0.5 rounded-full border border-gray-700">
                  <span className="flex items-center gap-1 text-orange-400 font-bold">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#ea580c" stroke="#ffffff" stroke-width="1.8">
                      <path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z" />
                    </svg>
                    Comedores
                  </span>
                  <span className="flex items-center gap-1 text-sky-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1a73e8] border border-white inline-flex items-center justify-center text-[7px] text-white">🚌</span>
                    Paraderos
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold hidden md:inline-flex">
                    <span className="w-2 h-2 rounded-xs bg-[#f59e0b] border border-white inline-block"></span>
                    Costa
                  </span>
                </div>

                <span className="text-emerald-400 font-bold hidden lg:inline">Coordenadas Reales</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-gray-300 text-[10px]">
                <span className="hidden md:inline">Cámara: {GOOGLE_EARTH_CAMERA.altitudeMeters.toLocaleString()} m</span>
                <span>
                  {formatDMS(cameraCoordinates.lat, true)} {formatDMS(cameraCoordinates.lng, false)}
                </span>
                <span className="hidden sm:inline">Elev: {GOOGLE_EARTH_CAMERA.elevationMeters} m</span>
                <div className="flex items-center gap-1 pl-2 border-l border-gray-600">
                  <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[9px] font-bold">3D</span>
                  <span className="px-1.5 py-0.5 bg-sky-600 text-white rounded text-[9px] font-bold">2D</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 2: GOOGLE EARTH WEB OFICIAL (ENLACE DIRECTO)            */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'earth-web' && (
          <div className="flex-1 h-full flex flex-col items-center justify-center bg-[#0b0f19] p-8 text-center text-white relative">
            <div className="max-w-xl bg-[#1e293b] p-8 rounded-3xl border border-gray-700 shadow-2xl space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 via-sky-400 to-emerald-500 mx-auto flex items-center justify-center shadow-lg">
                <Globe className="w-8 h-8 text-white animate-pulse" />
              </div>

              <div>
                <span className="text-xs font-black uppercase text-sky-400 tracking-wider">
                  Google Earth Web • Proyecto Oficial CAMPOSOL
                </span>
                <h2 className="text-xl font-black text-white mt-1">Comedores Camposol 2025</h2>
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                  Para visualizar el proyecto completo con renderizado 3D volumétrico, inclinación de cámara a 17.65° y
                  aceleración WebGL nativa de Google Earth:
                </p>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-2xl border border-gray-700 font-mono text-[11px] text-gray-300 break-all text-left">
                {GOOGLE_EARTH_PROJECT_URL}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <a
                  href={GOOGLE_EARTH_PROJECT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 bg-[#00843D] hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg transition-all text-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Proyecto en Google Earth Web</span>
                </a>

                <button
                  type="button"
                  onClick={() => setActiveTab('interactive')}
                  className="px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold text-xs transition-all"
                >
                  Volver al Visor Satelital
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MODAL: CARGAR COORDENADAS (KML / KMZ / EXCEL / TEXTO)      */}
      {/* ------------------------------------------------------------- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-gray-700 text-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-[#0f172a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Cargar y Fijar Mis Coordenadas Exactas</h3>
                  <p className="text-[11px] text-gray-400">
                    Importa tu archivo de Google Earth (.kml / .kmz), Excel o pega tus coordenadas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center border-b border-gray-700 bg-[#162032] px-4 pt-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setImportModalTab('upload')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all cursor-pointer ${
                  importModalTab === 'upload'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Subir Archivo (.kml / .kmz / .xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => setImportModalTab('paste')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all cursor-pointer ${
                  importModalTab === 'paste'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Pegar Coordenadas o KML</span>
              </button>

              <button
                type="button"
                onClick={() => setImportModalTab('table')}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all cursor-pointer ${
                  importModalTab === 'table'
                    ? 'border-emerald-400 text-emerald-300'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Tabla de Coordenadas ({todosLosPuntos.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {importError && (
                <div className="p-3 bg-rose-950/70 border border-rose-600/50 rounded-xl text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{importError}</span>
                </div>
              )}

              {/* TAB 1: SUBIR ARCHIVO */}
              {importModalTab === 'upload' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-2xl p-8 text-center bg-[#0f172a]/60 hover:bg-[#0f172a] transition-all cursor-pointer space-y-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">
                        Haz clic aquí para seleccionar tu archivo de Google Earth
                      </h4>
                      <p className="text-gray-400 text-xs mt-1">
                        Soporta archivos <strong>.kml</strong>, <strong>.kmz</strong> (Google Earth), o{' '}
                        <strong>.xlsx</strong> (Excel con columnas Nombre, Latitud, Longitud).
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-[11px] font-mono">
                      Exportado de Google Earth: "Exportar como KML"
                    </span>
                  </div>

                  <div className="bg-[#0f172a] p-3 rounded-xl border border-gray-700 space-y-1.5 text-gray-300">
                    <span className="font-bold text-sky-400 block">¿Cómo obtener tu KML de Google Earth?</span>
                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-400">
                      <li>Abre tu proyecto "Comedores Camposol 2025" en Google Earth Web.</li>
                      <li>Haz clic en el menú de 3 puntos (...) en el panel izquierdo.</li>
                      <li>Selecciona "Exportar como archivo KML".</li>
                      <li>Sube ese archivo aquí para que el sistema fije automáticamente todas tus coordenadas.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* TAB 2: PEGAR TEXTO */}
              {importModalTab === 'paste' && (
                <div className="space-y-3">
                  <p className="text-gray-300">
                    Pega aquí el contenido KML o una lista de coordenadas separadas por coma, tabulación o salto de línea:
                  </p>
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Ejemplo CSV / Excel:
Comedor 57, -8.5410, -78.6820
Comedor 521, -8.5380, -78.6850
La Brasil, -8.4220, -78.7680

O pega el XML completo del archivo KML con los <Placemark>...`}
                    className="w-full bg-[#0f172a] border border-gray-700 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPastedText('')}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer"
                    >
                      Procesar y Fijar Coordenadas
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: TABLA DE COORDENADAS */}
              {importModalTab === 'table' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Edita directamente las coordenadas de cualquier punto:</span>
                    <button
                      type="button"
                      onClick={handleExportKML}
                      className="text-sky-400 hover:underline font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar KML
                    </button>
                  </div>

                  <div className="border border-gray-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left divide-y divide-gray-700">
                      <thead className="bg-[#0f172a] text-gray-400 text-[10px] uppercase font-bold sticky top-0">
                        <tr>
                          <th className="p-2">Punto / Nombre</th>
                          <th className="p-2">Fundo / Tipo</th>
                          <th className="p-2">Latitud</th>
                          <th className="p-2">Longitud</th>
                          <th className="p-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 text-[11px]">
                        {todosLosPuntos.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-800/60">
                            <td className="p-2 font-bold text-white truncate max-w-[140px]">{p.nombre}</td>
                            <td className="p-2 text-gray-400">{p.fundo}</td>
                            <td className="p-2 font-mono text-emerald-400">{p.lat.toFixed(6)}</td>
                            <td className="p-2 font-mono text-sky-400">{p.lng.toFixed(6)}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPoint(p);
                                  setTempLatInput(p.lat.toString());
                                  setTempLngInput(p.lng.toString());
                                  flyToPoint(p.lat, p.lng, 16);
                                  setShowImportModal(false);
                                  showToast(`Ubicando ${p.nombre} en el mapa.`);
                                }}
                                className="px-2 py-0.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-[10px] cursor-pointer"
                              >
                                Ver / Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0f172a] border-t border-gray-700 flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Total registrado: <strong>{todosLosPuntos.length}</strong> puntos fijados
              </span>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MODAL DE COMPARTIR                                         */}
      {/* ------------------------------------------------------------- */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-gray-700 text-white p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-black text-sm">Compartir Proyecto Comedores Camposol 2025</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Copia el enlace oficial de Google Earth para compartir la visualización de los comedores, fundos y
              paraderos de CAMPOSOL:
            </p>

            <div className="bg-[#0f172a] p-2.5 rounded-xl border border-gray-700 flex items-center justify-between gap-2">
              <input
                type="text"
                readOnly
                value={GOOGLE_EARTH_PROJECT_URL}
                className="bg-transparent text-xs text-gray-300 font-mono w-full focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_EARTH_PROJECT_URL);
                  showToast('Enlace de Google Earth copiado al portapapeles.');
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              >
                Copiar
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
