import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Building,
  Briefcase,
  Utensils,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowLeftRight,
  Compass,
  Upload,
  FileSpreadsheet,
  Bus,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MaestroArea,
  MaestroFundo,
  MaestroParadero,
  MaestroUnidadBus,
} from '../types';
import {
  getStoredAreas,
  saveStoredAreas,
  getStoredFundos,
  saveStoredFundos,
  getStoredParaderos,
  saveStoredParaderos,
  getStoredUnidadesBus,
  saveStoredUnidadesBus,
  resetMasterDataToDefault,
  exportToCSV,
  inferParaderoZona,
} from '../services/storageService';

type MasterCategory = 'paraderos' | 'fundos' | 'areas' | 'buses';

interface MasterDataManagementScreenProps {
  onBack: () => void;
  onNavigateToNewRequest?: () => void;
}

interface ParsedMasterImport {
  paraderos: {
    paradero: string;
    zona: 'NORTE' | 'SUR';
    codigo?: string;
    macrozona?: string;
    zonaEspecifica?: string;
    agrupador?: string;
    referencia?: string;
    latitud?: number;
    longitud?: number;
  }[];
  fundos: { fundo: string }[];
  areas: { area: string }[];
}

export const MasterDataManagementScreen: React.FC<MasterDataManagementScreenProps> = ({
  onBack,
  onNavigateToNewRequest,
}) => {
  const [activeTab, setActiveTab] = useState<MasterCategory>('paraderos');
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded master states
  const [paraderos, setParaderos] = useState<MaestroParadero[]>([]);
  const [fundos, setFundos] = useState<MaestroFundo[]>([]);
  const [areas, setAreas] = useState<MaestroArea[]>([]);
  const [unidades, setUnidades] = useState<MaestroUnidadBus[]>([]);

  // Excel Import state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importData, setImportData] = useState<ParsedMasterImport | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Creation state
  const [newItemName, setNewItemName] = useState('');
  const [newParaderoZona, setNewParaderoZona] = useState<'NORTE' | 'SUR'>('NORTE');
  const [newUnidadCapacidad, setNewUnidadCapacidad] = useState<number>(40);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter for Paraderos: 'TODOS' | 'NORTE' | 'SUR'
  const [selectedZonaFilter, setSelectedZonaFilter] = useState<'TODOS' | 'NORTE' | 'SUR'>('TODOS');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingZona, setEditingZona] = useState<'NORTE' | 'SUR'>('NORTE');
  const [editingCapacidad, setEditingCapacidad] = useState<number>(40);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Confirmation Modal for Deleting or Resetting
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load all master data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    setParaderos(getStoredParaderos());
    setFundos(getStoredFundos());
    setAreas(getStoredAreas());
    setUnidades(getStoredUnidadesBus());
  };

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Paradero zone counters
  const countNorte = useMemo(() => {
    return paraderos.filter((p) => (p.zona || inferParaderoZona(p.paradero)) === 'NORTE').length;
  }, [paraderos]);

  const countSur = useMemo(() => {
    return paraderos.filter((p) => (p.zona || inferParaderoZona(p.paradero)) === 'SUR').length;
  }, [paraderos]);

  // Filtered lists based on search & zone
  const filteredParaderos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return paraderos.filter((p) => {
      const matchesQuery =
        !q ||
        p.paradero.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.macrozona && p.macrozona.toLowerCase().includes(q)) ||
        (p.zonaEspecifica && p.zonaEspecifica.toLowerCase().includes(q));
      const paraderoZona = p.zona || inferParaderoZona(p.paradero);
      const matchesZona =
        selectedZonaFilter === 'TODOS' || paraderoZona === selectedZonaFilter;
      return matchesQuery && matchesZona;
    });
  }, [paraderos, searchQuery, selectedZonaFilter]);

  const filteredFundos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q ? fundos.filter((f) => f.fundo.toLowerCase().includes(q)) : fundos;
  }, [fundos, searchQuery]);

  const filteredAreas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q ? areas.filter((a) => a.area.toLowerCase().includes(q)) : areas;
  }, [areas, searchQuery]);

  const filteredBuses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q
      ? unidades.filter(
          (u) =>
            u.nombre.toLowerCase().includes(q) ||
            u.capacidad.toString().includes(q) ||
            (u.descripcion && u.descripcion.toLowerCase().includes(q))
        )
      : unidades;
  }, [unidades, searchQuery]);

  // Tab configurations (Comedores removed)
  const tabsConfig = [
    {
      id: 'paraderos' as MasterCategory,
      label: 'Paraderos',
      singular: 'Paradero',
      icon: MapPin,
      count: paraderos.length,
      placeholder: 'Ej. Paradero Nuevo Chao, Virú Km 524...',
    },
    {
      id: 'fundos' as MasterCategory,
      label: 'Fundos',
      singular: 'Fundo',
      icon: Building,
      count: fundos.length,
      placeholder: 'Ej. Fundo El Rocio, Fundo Esperanza...',
    },
    {
      id: 'areas' as MasterCategory,
      label: 'Áreas',
      singular: 'Área',
      icon: Briefcase,
      count: areas.length,
      placeholder: 'Ej. Cosecha Palto, Mantenimiento...',
    },
    {
      id: 'buses' as MasterCategory,
      label: 'Flota Buses',
      singular: 'Unidad de Bus',
      icon: Bus,
      count: unidades.length,
      placeholder: 'Ej. 2 PISOS, BUS LARGE, MINIBUS...',
    },
  ];

  const currentTabInfo = tabsConfig.find((t) => t.id === activeTab)!;

  // Add new item
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newItemName.trim();
    if (!cleanName) {
      setFormError(`El nombre del ${currentTabInfo.singular.toLowerCase()} no puede estar vacío.`);
      return;
    }

    setFormError(null);
    const newId = `${activeTab.slice(0, 3)}-${Date.now()}`;

    if (activeTab === 'paraderos') {
      if (paraderos.some((p) => p.paradero.toLowerCase() === cleanName.toLowerCase())) {
        setFormError('Ya existe un paradero con este nombre.');
        return;
      }
      const updated = [...paraderos, { id: newId, paradero: cleanName, zona: newParaderoZona }];
      setParaderos(updated);
      saveStoredParaderos(updated);
      showNotification(`Paradero "${cleanName}" agregado a ZONA ${newParaderoZona}`);
    } else if (activeTab === 'fundos') {
      if (fundos.some((f) => f.fundo.toLowerCase() === cleanName.toLowerCase())) {
        setFormError('Ya existe un fundo con este nombre.');
        return;
      }
      const updated = [...fundos, { id: newId, fundo: cleanName }];
      setFundos(updated);
      saveStoredFundos(updated);
      showNotification(`Fundo "${cleanName}" agregado con éxito`);
    } else if (activeTab === 'areas') {
      if (areas.some((a) => a.area.toLowerCase() === cleanName.toLowerCase())) {
        setFormError('Ya existe un área con este nombre.');
        return;
      }
      const updated = [...areas, { id: newId, area: cleanName }];
      setAreas(updated);
      saveStoredAreas(updated);
      showNotification(`Área "${cleanName}" agregada con éxito`);
    } else if (activeTab === 'buses') {
      if (unidades.some((u) => u.nombre.toLowerCase() === cleanName.toLowerCase())) {
        setFormError('Ya existe una unidad con este nombre.');
        return;
      }
      const cap = Number(newUnidadCapacidad) || 40;
      const updated = [
        ...unidades,
        {
          id: newId,
          nombre: cleanName.toUpperCase(),
          capacidad: cap,
          descripcion: `Unidad de transporte (${cap} pax)`,
          activo: true,
        },
      ];
      setUnidades(updated);
      saveStoredUnidadesBus(updated);
      showNotification(`Unidad "${cleanName.toUpperCase()}" (${cap} pax) agregada`);
      setNewUnidadCapacidad(40);
    }

    setNewItemName('');
  };

  // Toggle paradero zone directly from the card
  const handleToggleParaderoZona = (id: string) => {
    const target = paraderos.find((p) => p.id === id);
    if (!target) return;
    const currentZona = target.zona || inferParaderoZona(target.paradero);
    const newZona: 'NORTE' | 'SUR' = currentZona === 'SUR' ? 'NORTE' : 'SUR';
    const updated = paraderos.map((p) =>
      p.id === id ? { ...p, zona: newZona } : p
    );
    setParaderos(updated);
    saveStoredParaderos(updated);
    showNotification(`"${target.paradero}" ahora pertenece a ZONA ${newZona}`);
  };

  // Start inline editing
  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
    if (activeTab === 'paraderos') {
      const p = paraderos.find((item) => item.id === id);
      setEditingZona((p?.zona || inferParaderoZona(name)) as 'NORTE' | 'SUR');
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  // Save inline edit
  const saveEditing = (id: string) => {
    const cleanName = editingName.trim();
    if (!cleanName) return;

    if (activeTab === 'paraderos') {
      const updated = paraderos.map((p) =>
        p.id === id ? { ...p, paradero: cleanName, zona: editingZona } : p
      );
      setParaderos(updated);
      saveStoredParaderos(updated);
    } else if (activeTab === 'fundos') {
      const updated = fundos.map((f) => (f.id === id ? { ...f, fundo: cleanName } : f));
      setFundos(updated);
      saveStoredFundos(updated);
    } else if (activeTab === 'areas') {
      const updated = areas.map((a) => (a.id === id ? { ...a, area: cleanName } : a));
      setAreas(updated);
      saveStoredAreas(updated);
    } else if (activeTab === 'buses') {
      const cap = Number(editingCapacidad) || 40;
      const updated = unidades.map((u) =>
        u.id === id ? { ...u, nombre: cleanName.toUpperCase(), capacidad: cap, descripcion: `Capacidad ${cap} pax` } : u
      );
      setUnidades(updated);
      saveStoredUnidadesBus(updated);
    }

    showNotification(`${currentTabInfo.singular} actualizado`);
    setEditingId(null);
    setEditingName('');
  };

  const handleToggleUnidadActivo = (id: string) => {
    const updated = unidades.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u));
    setUnidades(updated);
    saveStoredUnidadesBus(updated);
    showNotification('Estado de unidad actualizado');
  };

  // Trigger Delete confirmation
  const confirmDelete = () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;

    if (activeTab === 'paraderos') {
      const updated = paraderos.filter((p) => p.id !== id);
      setParaderos(updated);
      saveStoredParaderos(updated);
    } else if (activeTab === 'fundos') {
      const updated = fundos.filter((f) => f.id !== id);
      setFundos(updated);
      saveStoredFundos(updated);
    } else if (activeTab === 'areas') {
      const updated = areas.filter((a) => a.id !== id);
      setAreas(updated);
      saveStoredAreas(updated);
    } else if (activeTab === 'buses') {
      const updated = unidades.filter((u) => u.id !== id);
      setUnidades(updated);
      saveStoredUnidadesBus(updated);
    }

    showNotification(`Eliminado: "${name}"`);
    setItemToDelete(null);
  };

  // Reset to original defaults
  const handleResetDefaults = () => {
    const res = resetMasterDataToDefault();
    setParaderos(res.paraderos);
    setFundos(res.fundos);
    setAreas(res.areas);
    if (res.unidadesBus) setUnidades(res.unidadesBus);
    setShowResetConfirm(false);
    showNotification('Maestros restablecidos a los valores por defecto');
  };

  // Export current master list to CSV
  const handleExportCurrentMaster = () => {
    if (activeTab === 'paraderos') {
      exportToCSV(
        `Camposol_Maestro_Paraderos_${new Date().toISOString().slice(0, 10)}.csv`,
        paraderos.map((p) => ({
          MACROZONA: p.macrozona || '',
          ZONA: p.zonaEspecifica || p.zona || inferParaderoZona(p.paradero),
          AGRUPADOR: p.agrupador || '',
          'CÓDIGO': p.codigo || p.id,
          NOMBRE: p.paradero,
          REFERENCIA: p.referencia || '',
          LATITUD: p.latitud !== undefined ? p.latitud : '',
          LONGITUD: p.longitud !== undefined ? p.longitud : '',
        }))
      );
    } else if (activeTab === 'fundos') {
      exportToCSV(
        `Camposol_Maestro_Fundos_${new Date().toISOString().slice(0, 10)}.csv`,
        fundos.map((f) => ({ ID: f.id, Fundo: f.fundo }))
      );
    } else if (activeTab === 'areas') {
      exportToCSV(
        `Camposol_Maestro_Areas_${new Date().toISOString().slice(0, 10)}.csv`,
        areas.map((a) => ({ ID: a.id, Area: a.area }))
      );
    }
  };

  // Download official Excel template with Paraderos (CAMPOSOL format), Fundos and Áreas
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet: Paraderos with the exact CAMPOSOL format: MACROZONA, ZONA, AGRUPADOR, CÓDIGO, NOMBRE, REFERENCIA, LATITUD, LONGITUD
    const paraderosSample = [
      {
        MACROZONA: 'Mcrz 25 San Jose',
        ZONA: 'SAN JOSE',
        AGRUPADOR: '',
        'CÓDIGO': 'E27',
        NOMBRE: 'SEMAFORO AGROMAS',
        REFERENCIA: '',
        LATITUD: -8.450491545,
        LONGITUD: -78.73398734,
      },
      {
        MACROZONA: 'Mcrz 25 San Jose',
        ZONA: 'SAN JOSE',
        AGRUPADOR: '',
        'CÓDIGO': 'G-FR',
        NOMBRE: 'GAR FRUSOL 1',
        REFERENCIA: '-',
        LATITUD: -8.465203715,
        LONGITUD: -78.71849354,
      },
      {
        MACROZONA: 'Mcrz 9 La Rinconada',
        ZONA: 'RINCONADA',
        AGRUPADOR: '',
        'CÓDIGO': 'P206',
        NOMBRE: 'EL CHACARERO (METRO)',
        REFERENCIA: '',
        LATITUD: -8.11974,
        LONGITUD: -79.0411,
      },
      {
        MACROZONA: 'Mcrz 9 La Rinconada',
        ZONA: 'RINCONADA',
        AGRUPADOR: '',
        'CÓDIGO': 'P184',
        NOMBRE: 'ASILO DE ANCIANOS "SAN JOSE"',
        REFERENCIA: '.',
        LATITUD: -8.103361727,
        LONGITUD: -79.00225642,
      },
      {
        MACROZONA: 'Mcrz 9 La Rinconada',
        ZONA: 'RINCONADA',
        AGRUPADOR: '',
        'CÓDIGO': 'P183',
        NOMBRE: 'AV.AMERICA Y VALLEJO (COMISARIA NORIA)',
        REFERENCIA: '.',
        LATITUD: -8.103445226,
        LONGITUD: -79.01093636,
      },
      {
        MACROZONA: 'Mcrz 9 La Rinconada',
        ZONA: 'RINCONADA',
        AGRUPADOR: '',
        'CÓDIGO': 'P182',
        NOMBRE: 'HOSPITAL LAZARTE (AV.AMERICA Y AV.UNION)',
        REFERENCIA: '',
        LATITUD: -8.09957,
        LONGITUD: -79.0121,
      },
    ];
    const wsParaderos = XLSX.utils.json_to_sheet(paraderosSample);
    XLSX.utils.book_append_sheet(wb, wsParaderos, 'Paraderos');

    // Sheet: Fundos
    const fundosSample = [
      { Fundo: 'Fundo El Rocio' },
      { Fundo: 'Fundo Sandra' },
      { Fundo: 'Fundo Gloria' },
    ];
    const wsFundos = XLSX.utils.json_to_sheet(fundosSample);
    XLSX.utils.book_append_sheet(wb, wsFundos, 'Fundos');

    // Sheet: Áreas
    const areasSample = [
      { Área: 'Cosecha Palto' },
      { Área: 'Cosecha Arándano' },
      { Área: 'Sanidad Vegetal' },
    ];
    const wsAreas = XLSX.utils.json_to_sheet(areasSample);
    XLSX.utils.book_append_sheet(wb, wsAreas, 'Áreas');

    XLSX.writeFile(wb, 'CAMPOSOL_Plantilla_Maestros.xlsx');
    showNotification('Plantilla Excel descargada con éxito');
  };

  // Parse Excel file (.xlsx, .xls, .csv)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const result: ParsedMasterImport = {
        paraderos: [],
        fundos: [],
        areas: [],
      };

      const normalizeStr = (s: unknown) => (s ? String(s).trim() : '');
      const normalizeHeader = (s: string) =>
        normalizeStr(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      workbook.SheetNames.forEach((sheetName) => {
        const sNorm = normalizeHeader(sheetName);
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        if (jsonRows.length === 0) return;

        // Check columns in the first row
        const firstRow = jsonRows[0] || {};
        const sampleHeaders = Object.keys(firstRow).map((k) => normalizeHeader(k));

        const hasCamposolParaderoFormat =
          sampleHeaders.includes('macrozona') ||
          (sampleHeaders.includes('nombre') &&
            (sampleHeaders.includes('codigo') ||
              sampleHeaders.includes('latitud') ||
              sampleHeaders.includes('zona')));

        const hasParaderoHeader = sampleHeaders.some((h) =>
          h.includes('paradero') ||
          h.includes('embarque') ||
          h.includes('punto') ||
          h.includes('ruta')
        );
        const hasFundoHeader = sampleHeaders.some((h) => h.includes('fundo'));
        const hasAreaHeader = sampleHeaders.some((h) => h.includes('area') || h.includes('área'));

        const isParaderoSheet =
          sNorm.includes('paradero') ||
          hasCamposolParaderoFormat ||
          hasParaderoHeader ||
          (activeTab === 'paraderos' && !hasFundoHeader && !hasAreaHeader && !sNorm.includes('fundo') && !sNorm.includes('area'));
        const isFundoSheet =
          (sNorm.includes('fundo') || hasFundoHeader || (activeTab === 'fundos' && !hasParaderoHeader && !hasAreaHeader)) &&
          !hasCamposolParaderoFormat;
        const isAreaSheet =
          (sNorm.includes('area') || hasAreaHeader || (activeTab === 'areas' && !hasParaderoHeader && !hasFundoHeader)) &&
          !hasCamposolParaderoFormat;

        jsonRows.forEach((row) => {
          const keys = Object.keys(row);
          if (keys.length === 0) return;

          // Map normalized header to original key
          const keyMap: Record<string, string> = {};
          keys.forEach((k) => {
            keyMap[normalizeHeader(k)] = k;
          });

          const getVal = (normKey: string) => {
            const realKey = keyMap[normKey];
            return realKey !== undefined ? normalizeStr(row[realKey]) : '';
          };

          const getRaw = (normKey: string) => {
            const realKey = keyMap[normKey];
            return realKey !== undefined ? row[realKey] : undefined;
          };

          // Paradero detection:
          // CAMPOSOL format: MACROZONA, ZONA, AGRUPADOR, CÓDIGO, NOMBRE, REFERENCIA, LATITUD, LONGITUD
          // O formato simple de lista: PARADERO, NOMBRE, PUNTO DE EMBARQUE
          const matchedParaderoKey = keys.find((k) => {
            const kn = normalizeHeader(k);
            return (
              kn === 'paradero' ||
              kn === 'paraderos' ||
              kn === 'nombre' ||
              kn.includes('paradero') ||
              kn.includes('embarque') ||
              kn.includes('punto')
            );
          });

          const nombreVal =
            getVal('paradero') ||
            getVal('paraderos') ||
            getVal('nombre') ||
            getVal('punto') ||
            getVal('punto de embarque') ||
            getVal('ruta') ||
            (matchedParaderoKey ? normalizeStr(row[matchedParaderoKey]) : '') ||
            (isParaderoSheet && !isFundoSheet && !isAreaSheet ? normalizeStr(row[keys[0]]) : '');
          const macrozonaVal = getVal('macrozona');
          const zonaVal = getVal('zona');
          const codigoVal = getVal('codigo') || getVal('cod');
          const agrupadorVal = getVal('agrupador');
          const referenciaVal = getVal('referencia');
          const latRaw = getRaw('latitud');
          const lngRaw = getRaw('longitud');

          const latVal =
            latRaw !== undefined && latRaw !== '' && !isNaN(Number(latRaw))
              ? Number(latRaw)
              : undefined;
          const lngVal =
            lngRaw !== undefined && lngRaw !== '' && !isNaN(Number(lngRaw))
              ? Number(lngRaw)
              : undefined;

          if (hasCamposolParaderoFormat || isParaderoSheet) {
            if (
              nombreVal &&
              !['nombre', 'paradero', 'id', 'item'].includes(nombreVal.toLowerCase())
            ) {
              let zonaOperativa: 'NORTE' | 'SUR' = 'NORTE';

              const combined = `${zonaVal} ${macrozonaVal} ${nombreVal}`.toUpperCase();
              if (zonaVal.toUpperCase() === 'SUR') {
                zonaOperativa = 'SUR';
              } else if (zonaVal.toUpperCase() === 'NORTE') {
                zonaOperativa = 'NORTE';
              } else if (
                combined.includes('CHAO') ||
                combined.includes('VALLE DE DIOS')
              ) {
                zonaOperativa = 'SUR';
              } else if (latVal !== undefined && latVal <= -8.50) {
                // Latitude <= -8.50 corresponds to Chao / Valle de Dios valley (SUR)
                zonaOperativa = 'SUR';
              } else {
                zonaOperativa = inferParaderoZona(nombreVal);
              }

              result.paraderos.push({
                paradero: nombreVal,
                zona: zonaOperativa,
                codigo: codigoVal || undefined,
                macrozona: macrozonaVal || undefined,
                zonaEspecifica: zonaVal || undefined,
                agrupador: agrupadorVal || undefined,
                referencia: referenciaVal || undefined,
                latitud: latVal,
                longitud: lngVal,
              });
            }
          } else if (isFundoSheet || (!isAreaSheet && getVal('fundo'))) {
            const val = getVal('fundo') || normalizeStr(row[keys[0]]);
            if (val && !['fundo', 'nombre', 'id'].includes(val.toLowerCase())) {
              result.fundos.push({ fundo: val });
            }
          } else if (isAreaSheet || (!isFundoSheet && getVal('area'))) {
            const val = getVal('area') || normalizeStr(row[keys[0]]);
            if (val && !['area', 'área', 'nombre', 'id'].includes(val.toLowerCase())) {
              result.areas.push({ area: val });
            }
          } else {
            // General fallback routed to activeTab
            const firstVal = normalizeStr(row[keys[0]]);
            if (firstVal && !['id', 'item', 'nombre'].includes(firstVal.toLowerCase())) {
              if (activeTab === 'paraderos') {
                const zonaCol = keys.length > 1 ? normalizeStr(row[keys[1]]).toUpperCase() : '';
                const zonaOperativa = zonaCol.includes('SUR')
                  ? 'SUR'
                  : zonaCol.includes('NORTE')
                  ? 'NORTE'
                  : inferParaderoZona(firstVal);
                result.paraderos.push({ paradero: firstVal, zona: zonaOperativa });
              } else if (activeTab === 'fundos') {
                result.fundos.push({ fundo: firstVal });
              } else if (activeTab === 'areas') {
                result.areas.push({ area: firstVal });
              }
            }
          }
        });
      });

      // Filter duplicates in import
      result.paraderos = result.paraderos.filter(
        (item, idx, self) =>
          idx ===
          self.findIndex(
            (t) =>
              t.paradero.toLowerCase() === item.paradero.toLowerCase() ||
              (t.codigo && item.codigo && t.codigo.toLowerCase() === item.codigo.toLowerCase())
          )
      );
      result.fundos = result.fundos.filter(
        (item, idx, self) =>
          idx === self.findIndex((t) => t.fundo.toLowerCase() === item.fundo.toLowerCase())
      );
      result.areas = result.areas.filter(
        (item, idx, self) =>
          idx === self.findIndex((t) => t.area.toLowerCase() === item.area.toLowerCase())
      );

      const totalItems = result.paraderos.length + result.fundos.length + result.areas.length;
      if (totalItems === 0) {
        showNotification('No se encontraron datos válidos en el archivo Excel.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setImportData(result);
      setImportFileName(file.name);
      setShowImportModal(true);
    } catch (err) {
      console.error('Error importando Excel:', err);
      showNotification('Error al procesar el archivo Excel. Verifica el formato.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Execute import confirmation
  const handleExecuteImport = () => {
    if (!importData) return;

    let newParaderos = [...paraderos];
    let newFundos = [...fundos];
    let newAreas = [...areas];

    if (importMode === 'replace') {
      if (importData.paraderos.length > 0) {
        newParaderos = importData.paraderos.map((p, idx) => ({
          id: p.codigo ? `PAR-${p.codigo}` : `PAR-${Date.now()}-${idx}`,
          paradero: p.paradero,
          zona: p.zona,
          codigo: p.codigo,
          macrozona: p.macrozona,
          zonaEspecifica: p.zonaEspecifica,
          agrupador: p.agrupador,
          referencia: p.referencia,
          latitud: p.latitud,
          longitud: p.longitud,
        }));
      }
      if (importData.fundos.length > 0) {
        newFundos = importData.fundos.map((f, idx) => ({
          id: `FUN-${Date.now()}-${idx}`,
          fundo: f.fundo,
        }));
      }
      if (importData.areas.length > 0) {
        newAreas = importData.areas.map((a, idx) => ({
          id: `ARE-${Date.now()}-${idx}`,
          area: a.area,
        }));
      }
    } else {
      // Merge mode without duplicates (also enriches existing items with code/coords/macrozona)
      importData.paraderos.forEach((p, idx) => {
        const existingIdx = newParaderos.findIndex(
          (item) =>
            item.paradero.toLowerCase() === p.paradero.toLowerCase() ||
            (p.codigo && item.codigo && item.codigo.toLowerCase() === p.codigo.toLowerCase())
        );
        if (existingIdx === -1) {
          newParaderos.push({
            id: p.codigo ? `PAR-${p.codigo}` : `PAR-${Date.now()}-${idx}`,
            paradero: p.paradero,
            zona: p.zona,
            codigo: p.codigo,
            macrozona: p.macrozona,
            zonaEspecifica: p.zonaEspecifica,
            agrupador: p.agrupador,
            referencia: p.referencia,
            latitud: p.latitud,
            longitud: p.longitud,
          });
        } else {
          // Enrich existing with metadata
          newParaderos[existingIdx] = {
            ...newParaderos[existingIdx],
            codigo: p.codigo || newParaderos[existingIdx].codigo,
            macrozona: p.macrozona || newParaderos[existingIdx].macrozona,
            zonaEspecifica: p.zonaEspecifica || newParaderos[existingIdx].zonaEspecifica,
            agrupador: p.agrupador || newParaderos[existingIdx].agrupador,
            referencia: p.referencia || newParaderos[existingIdx].referencia,
            latitud: p.latitud !== undefined ? p.latitud : newParaderos[existingIdx].latitud,
            longitud: p.longitud !== undefined ? p.longitud : newParaderos[existingIdx].longitud,
            zona: p.zona || newParaderos[existingIdx].zona,
          };
        }
      });

      importData.fundos.forEach((f, idx) => {
        const exists = newFundos.some((item) => item.fundo.toLowerCase() === f.fundo.toLowerCase());
        if (!exists) {
          newFundos.push({
            id: `FUN-${Date.now()}-${idx}`,
            fundo: f.fundo,
          });
        }
      });

      importData.areas.forEach((a, idx) => {
        const exists = newAreas.some((item) => item.area.toLowerCase() === a.area.toLowerCase());
        if (!exists) {
          newAreas.push({
            id: `ARE-${Date.now()}-${idx}`,
            area: a.area,
          });
        }
      });
    }

    if (importData.paraderos.length > 0) {
      setParaderos(newParaderos);
      saveStoredParaderos(newParaderos);
    }
    if (importData.fundos.length > 0) {
      setFundos(newFundos);
      saveStoredFundos(newFundos);
    }
    if (importData.areas.length > 0) {
      setAreas(newAreas);
      saveStoredAreas(newAreas);
    }

    setShowImportModal(false);
    setImportData(null);
    showNotification('¡Paraderos guardados y sincronizados con la publicación y la nube con éxito!');
  };

  return (
    <div className="flex flex-col flex-1 w-full max-w-7xl mx-auto space-y-4 pb-16 text-[#1B3A57]">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1B3A57] text-white px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 border border-[#55A529]/50 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-[#7BD44B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Toolbar Card matching corporate reference */}
      <div className="bg-white rounded-2xl px-5 py-3.5 border border-[#E5ECF2] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-home"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#2F7D18] bg-[#EAF7E4] hover:bg-[#d8f1cc] border border-[#C6E9B4] px-3.5 py-2 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>
          <div>
            <h2 className="text-sm font-bold text-[#1B3A57] leading-tight">
              Datos maestros del sistema
            </h2>
            <p className="text-[11px] text-slate-500">
              Administra paraderos, fundos, áreas y flota de buses en tiempo real
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Hidden file input for Excel upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            id="btn-upload-master-excel"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Subir archivo Excel (.xlsx, .xls, .csv) con paraderos, fundos y áreas"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-medium">Subir Excel</span>
          </button>

          <button
            id="btn-download-master-template"
            onClick={handleDownloadTemplate}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Descargar plantilla Excel con formato oficial para Paraderos, Fundos y Áreas"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[10px] font-medium">Plantilla</span>
          </button>

          <button
            id="btn-export-master-csv"
            onClick={handleExportCurrentMaster}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
            <span className="text-[10px] font-medium">Descarga CSV</span>
          </button>

          <button
            id="btn-reset-masters"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-1.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-[11px] font-medium text-slate-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restablecer a valores iniciales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      {/* Responsive Grid: 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (Desktop: 5 cols): Category & Add Item */}
        <div className="lg:col-span-5 space-y-4">
          {/* Hero card explaining the section */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#EAF7E4] border border-[#C6E9B4] flex items-center justify-center text-[#2F7D18] shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-[#55A529] uppercase">
                  Administración operativa
                </span>
                <h1 className="text-lg font-bold text-[#1B3A57] leading-tight">
                  Maestros y Paraderos
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personaliza paraderos, fundos, áreas y flota de servicio.
                </p>
              </div>
            </div>

            {/* Quick KPI Count Summary - 4 items */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
              {tabsConfig.map((t) => {
                const Icon = t.icon;
                const isCurrent = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    id={`kpi-tab-${t.id}`}
                    onClick={() => {
                      setActiveTab(t.id);
                      setSearchQuery('');
                      setFormError(null);
                      cancelEditing();
                    }}
                    className={`p-2.5 rounded-xl text-center transition-all cursor-pointer border ${
                      isCurrent
                        ? 'bg-[#55A529] text-white border-[#55A529] shadow-xs font-semibold'
                        : 'bg-[#F8FAFC] hover:bg-[#F3F8F0] text-[#1B3A57] border-[#E5ECF2]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${isCurrent ? 'text-white' : 'text-[#55A529]'}`} />
                    <div className="text-sm font-bold leading-none tabular-nums">{t.count}</div>
                    <div className={`text-[10px] font-medium leading-tight mt-1 truncate ${isCurrent ? 'text-white/90' : 'text-slate-500'}`}>
                      {t.label}
                    </div>
                    {t.id === 'paraderos' && (
                      <div className={`text-[9px] font-semibold mt-1 tracking-tight ${isCurrent ? 'text-white/90' : 'text-slate-400'}`}>
                        {countNorte}N • {countSur}S
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add New Item Card */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] flex items-center justify-center text-[#2F7D18]">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#1B3A57]">
                  Agregar nuevo {currentTabInfo.singular.toLowerCase()}
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-[#2F7D18] bg-[#EAF7E4] border border-[#C6E9B4] px-2.5 py-0.5 rounded-full">
                Tiempo real
              </span>
            </div>

            <form onSubmit={handleAddItem} className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  id={`input-new-${activeTab}`}
                  type="text"
                  value={newItemName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewItemName(val);
                    if (activeTab === 'paraderos' && val.trim().length >= 3) {
                      setNewParaderoZona(inferParaderoZona(val));
                    }
                    if (formError) setFormError(null);
                  }}
                  placeholder={currentTabInfo.placeholder}
                  className="flex-1 h-10 px-4 rounded-full border border-[#D8E2EA] text-xs text-slate-700 focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  id="btn-submit-add-item"
                  className="bg-[#22A846] hover:bg-[#1C8E3A] text-white px-4 h-10 rounded-full font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Capacidad selector when adding a new Bus */}
              {activeTab === 'buses' && (
                <div className="flex items-center justify-between bg-[#F8FAFC] px-3.5 py-2 rounded-xl border border-[#E5ECF2]">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Bus className="w-3.5 h-3.5 text-[#55A529]" />
                    <span>Capacidad (Pasajeros):</span>
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newUnidadCapacidad}
                    onChange={(e) => setNewUnidadCapacidad(Number(e.target.value) || 0)}
                    className="w-24 p-1.5 bg-white border border-[#D8E2EA] rounded-full text-xs font-semibold text-[#1B3A57] text-right focus:outline-none focus:border-[#55A529]"
                  />
                </div>
              )}

              {/* Zona selector when adding a new Paradero */}
              {activeTab === 'paraderos' && (
                <div className="flex items-center justify-between bg-[#F8FAFC] px-3.5 py-2 rounded-xl border border-[#E5ECF2]">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#55A529]" />
                    <span>Zona asignada:</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="btn-select-new-norte"
                      onClick={() => setNewParaderoZona('NORTE')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                        newParaderoZona === 'NORTE'
                          ? 'bg-[#0082B3] text-white border-[#0082B3]'
                          : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${newParaderoZona === 'NORTE' ? 'bg-white' : 'bg-[#0082B3]'}`} />
                      <span>Norte</span>
                    </button>
                    <button
                      type="button"
                      id="btn-select-new-sur"
                      onClick={() => setNewParaderoZona('SUR')}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                        newParaderoZona === 'SUR'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${newParaderoZona === 'SUR' ? 'bg-white' : 'bg-amber-500'}`} />
                      <span>Sur</span>
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formError}
                </p>
              )}
            </form>
          </div>

          {/* Quick link to create a new requirement with the updated master */}
          {onNavigateToNewRequest && (
            <div className="pt-1">
              <button
                onClick={onNavigateToNewRequest}
                className="w-full py-3 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full font-semibold text-xs shadow-2xs active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Crear requerimiento con estos datos</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column (Desktop: 7 cols): Tabs, Search & List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main Tabs Navigation */}
          <div className="flex bg-white p-1.5 rounded-full border border-[#E5ECF2] shadow-2xs gap-1 overflow-x-auto">
            {tabsConfig.map((t) => {
              const isCurrent = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  id={`tab-btn-${t.id}`}
                  onClick={() => {
                    setActiveTab(t.id);
                    setSearchQuery('');
                    setFormError(null);
                    cancelEditing();
                  }}
                  className={`flex-1 min-w-[70px] py-2 px-3 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? 'bg-[#55A529] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-[#2F7D18] hover:bg-[#F3F8F0]'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              );
            })}
          </div>

          {/* Quick Zone Distribution & Filter when on Paraderos */}
          {activeTab === 'paraderos' && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#E5ECF2] shadow-xs flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1B3A57]">
                    Distribución por zona
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Total: <strong className="text-[#1B3A57]">{paraderos.length}</strong> • Norte:{' '}
                    <strong className="text-[#0082B3] font-semibold">{countNorte}</strong> • Sur:{' '}
                    <strong className="text-[#B45309] font-semibold">{countSur}</strong>
                  </div>
                </div>
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="filter-zona-todos"
                  onClick={() => setSelectedZonaFilter('TODOS')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-colors cursor-pointer border ${
                    selectedZonaFilter === 'TODOS'
                      ? 'bg-[#22A846] text-white border-[#22A846]'
                      : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
                  }`}
                >
                  Todos ({paraderos.length})
                </button>
                <button
                  type="button"
                  id="filter-zona-norte"
                  onClick={() => setSelectedZonaFilter('NORTE')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-colors flex items-center gap-1 cursor-pointer border ${
                    selectedZonaFilter === 'NORTE'
                      ? 'bg-[#0082B3] text-white border-[#0082B3]'
                      : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7] hover:bg-[#d5ecfa]'
                  }`}
                >
                  <span>Norte ({countNorte})</span>
                </button>
                <button
                  type="button"
                  id="filter-zona-sur"
                  onClick={() => setSelectedZonaFilter('SUR')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-full transition-colors flex items-center gap-1 cursor-pointer border ${
                    selectedZonaFilter === 'SUR'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A] hover:bg-[#fef0cc]'
                  }`}
                >
                  <span>Sur ({countSur})</span>
                </button>
              </div>
            </div>
          )}

          {/* Search and List Header */}
          <div className="space-y-2">
            <div className="relative">
              <input
                id="input-search-master-items"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar ${currentTabInfo.label.toLowerCase()}...`}
                className="w-full h-10 pl-4 pr-10 rounded-full bg-white border border-[#D8E2EA] text-xs text-slate-700 focus:outline-none focus:border-[#55A529] placeholder:text-slate-400 shadow-2xs"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Search className="w-4 h-4 text-[#55A529] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 px-1 gap-1">
              <span>
                Mostrando <strong className="text-[#1B3A57]">
                  {activeTab === 'paraderos'
                    ? filteredParaderos.length
                    : activeTab === 'fundos'
                    ? filteredFundos.length
                    : activeTab === 'areas'
                    ? filteredAreas.length
                    : filteredBuses.length}
                </strong> {currentTabInfo.label.toLowerCase()}
                {activeTab === 'paraderos' && (
                  <span className="ml-1 text-[11px] text-slate-500">
                    (<strong className="text-[#0082B3]">{countNorte} Norte</strong>,{' '}
                    <strong className="text-[#B45309]">{countSur} Sur</strong>)
                  </span>
                )}
              </span>
              {searchQuery && (
                <span className="text-[#2F7D18] font-semibold">
                  Filtro: "{searchQuery}"
                </span>
              )}
            </div>
          </div>

          {/* Master Items List: 2-column on wider screens, 1 on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* PARADEROS LIST */}
            {activeTab === 'paraderos' &&
              (filteredParaderos.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredParaderos.map((item, index) => {
                  const itemZona = item.zona || inferParaderoZona(item.paradero);
                  return (
                    <MasterListItem
                      key={item.id}
                      id={item.id}
                      index={index + 1}
                      name={item.paradero}
                      zona={itemZona}
                      codigo={item.codigo}
                      macrozona={item.macrozona}
                      zonaEspecifica={item.zonaEspecifica}
                      referencia={item.referencia}
                      latitud={item.latitud}
                      longitud={item.longitud}
                      onToggleZona={() => handleToggleParaderoZona(item.id)}
                      isEditing={editingId === item.id}
                      editingValue={editingName}
                      editingZona={editingZona}
                      onChangeEditingZona={setEditingZona}
                      onStartEdit={() => startEditing(item.id, item.paradero)}
                      onChangeEdit={(val) => setEditingName(val)}
                      onSaveEdit={() => saveEditing(item.id)}
                      onCancelEdit={cancelEditing}
                      onDelete={() => setItemToDelete({ id: item.id, name: item.paradero })}
                    />
                  );
                })
              ))}

            {/* FUNDOS LIST */}
            {activeTab === 'fundos' &&
              (filteredFundos.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredFundos.map((item, index) => (
                  <MasterListItem
                    key={item.id}
                    id={item.id}
                    index={index + 1}
                    name={item.fundo}
                    isEditing={editingId === item.id}
                    editingValue={editingName}
                    onStartEdit={() => startEditing(item.id, item.fundo)}
                    onChangeEdit={(val) => setEditingName(val)}
                    onSaveEdit={() => saveEditing(item.id)}
                    onCancelEdit={cancelEditing}
                    onDelete={() => setItemToDelete({ id: item.id, name: item.fundo })}
                  />
                ))
              ))}

            {/* AREAS LIST */}
            {activeTab === 'areas' &&
              (filteredAreas.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredAreas.map((item, index) => (
                  <MasterListItem
                    key={item.id}
                    id={item.id}
                    index={index + 1}
                    name={item.area}
                    isEditing={editingId === item.id}
                    editingValue={editingName}
                    onStartEdit={() => startEditing(item.id, item.area)}
                    onChangeEdit={(val) => setEditingName(val)}
                    onSaveEdit={() => saveEditing(item.id)}
                    onCancelEdit={cancelEditing}
                    onDelete={() => setItemToDelete({ id: item.id, name: item.area })}
                  />
                ))
              ))}

            {/* BUSES LIST */}
            {activeTab === 'buses' &&
              (filteredBuses.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredBuses.map((item, index) => {
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-3 border border-[#E5ECF2] shadow-2xs flex items-center justify-between gap-3 hover:border-[#55A529]/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#EAF7E4] text-[#2F7D18] text-xs font-bold flex items-center justify-center shrink-0 border border-[#C6E9B4]">
                          {index + 1}
                        </span>

                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              placeholder="Nombre de unidad..."
                              className="flex-1 min-w-[120px] px-3 py-1.5 rounded-full border border-[#55A529] text-xs font-semibold focus:outline-none"
                            />
                            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-full border border-[#D8E2EA]">
                              <span className="text-[10px] text-slate-500 font-semibold">Cap:</span>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={editingCapacidad}
                                onChange={(e) => setEditingCapacidad(Number(e.target.value) || 0)}
                                className="w-12 text-xs font-semibold text-right bg-white border border-[#D8E2EA] rounded px-1"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => saveEditing(item.id)}
                                className="p-1.5 bg-[#22A846] text-white rounded-full hover:bg-[#1C8E3A] transition-colors cursor-pointer"
                                title="Guardar cambios"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1.5 bg-[#F1F5F9] text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2 pr-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#1B3A57]">
                                  {item.nombre}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-[#EAF7E4] border border-[#C6E9B4] text-[10px] font-semibold text-[#2F7D18]">
                                  {item.capacidad} PAX
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                {item.descripcion || `Capacidad ${item.capacidad} pasajeros`}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleUnidadActivo(item.id)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer border ${
                                item.activo
                                  ? 'bg-[#EAF7E4] text-[#2F7D18] border-[#C6E9B4]'
                                  : 'bg-[#F1F5F9] text-slate-500 border-slate-200'
                              }`}
                              title={item.activo ? 'Unidad activa para optimización' : 'Unidad inactiva'}
                            >
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              startEditing(item.id, item.nombre);
                              setEditingCapacidad(item.capacidad);
                            }}
                            className="p-1.5 text-[#3D8B1C] hover:bg-[#EAF7E4] rounded-full transition-colors cursor-pointer"
                            title="Editar nombre y capacidad"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setItemToDelete({ id: item.id, name: item.nombre })}
                            className="p-1.5 text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] rounded-full transition-colors cursor-pointer"
                            title="Eliminar unidad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ))}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5ECF2] animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-[#FDECEC] text-[#DC2626] border border-[#FECACA] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-center text-[#1B3A57] uppercase">
              ¿Eliminar {currentTabInfo.singular}?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Estás a punto de quitar{' '}
              <strong className="text-slate-800">"{itemToDelete.name}"</strong> del maestro. Esta
              acción no afectará requerimientos ya guardados históricamente.
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-full bg-[#DC2626] hover:bg-red-700 font-semibold text-xs text-white shadow-xs cursor-pointer transition-colors"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5ECF2] animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF6E0] text-[#B45309] border border-[#FDE68A] flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-center text-[#1B3A57] uppercase">
              ¿Restablecer Maestros?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Se restablecerán todos los paraderos, fundos y áreas a la lista oficial
              inicial de CAMPOSOL.
            </p>

            <div className="flex gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex-1 py-2.5 rounded-full bg-amber-600 hover:bg-amber-700 font-semibold text-xs text-white shadow-xs cursor-pointer transition-colors"
              >
                Sí, Restablecer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && importData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#E5ECF2] animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#1B3A57] uppercase leading-tight truncate">
                  Importar Datos desde Excel
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  Archivo: <span className="font-semibold text-slate-700">{importFileName}</span>
                </p>
              </div>
            </div>

            {/* Content summary */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-[#EAF7E4] p-3 rounded-xl text-center border border-[#C6E9B4]">
                  <div className="text-xl font-bold text-[#2F7D18]">{importData.paraderos.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57] mt-0.5">Paraderos</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {importData.paraderos.filter(p => p.zona === 'NORTE').length} Norte • {importData.paraderos.filter(p => p.zona === 'SUR').length} Sur
                  </div>
                </div>

                <div className="bg-[#E6F3FB] p-3 rounded-xl text-center border border-[#D4E9F7]">
                  <div className="text-xl font-bold text-[#0082B3]">{importData.fundos.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57] mt-0.5">Fundos</div>
                </div>

                <div className="bg-[#FFF6E0] p-3 rounded-xl text-center border border-[#FDE68A]">
                  <div className="text-xl font-bold text-[#B45309]">{importData.areas.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57] mt-0.5">Áreas</div>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-[#1B3A57] uppercase tracking-wide">
                  Modo de Importación:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'merge'
                        ? 'border-[#55A529] bg-[#F3F8F0] ring-1 ring-[#55A529]'
                        : 'border-[#E5ECF2] hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#1B3A57] flex items-center justify-between">
                      <span>Combinar / Agregar</span>
                      {importMode === 'merge' && <Check className="w-4 h-4 text-[#55A529]" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Agrega nuevos registros sin tocar los ya existentes y evitando duplicados. (Recomendado)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      importMode === 'replace'
                        ? 'border-amber-500 bg-[#FFF6E0] ring-1 ring-amber-500'
                        : 'border-[#E5ECF2] hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-[#1B3A57] flex items-center justify-between">
                      <span>Reemplazar Lista</span>
                      {importMode === 'replace' && <Check className="w-4 h-4 text-[#B45309]" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Sustituye completamente la lista de las categorías presentes en el Excel.
                    </div>
                  </button>
                </div>
              </div>

              {/* Preview samples */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-600 uppercase">
                  Vista previa de datos detectados:
                </div>
                <div className="max-h-36 overflow-y-auto bg-[#EEF3F7] rounded-xl p-2.5 border border-[#E5ECF2] text-xs space-y-1">
                  {importData.paraderos.length > 0 && (
                    <div className="text-[11px]">
                      <strong className="text-[#2F7D18]">Paraderos ({importData.paraderos.length}):</strong>{' '}
                      <span className="text-slate-600">
                        {importData.paraderos.slice(0, 5).map(p => `${p.codigo ? `[${p.codigo}] ` : ''}${p.paradero} (${p.zona}${p.macrozona ? ` - ${p.macrozona}` : ''})`).join(', ')}
                        {importData.paraderos.length > 5 ? ` y ${importData.paraderos.length - 5} más...` : ''}
                      </span>
                    </div>
                  )}
                  {importData.fundos.length > 0 && (
                    <div className="text-[11px]">
                      <strong className="text-[#0082B3]">Fundos ({importData.fundos.length}):</strong>{' '}
                      <span className="text-slate-600">
                        {importData.fundos.slice(0, 5).map(f => f.fundo).join(', ')}
                        {importData.fundos.length > 5 ? ` y ${importData.fundos.length - 5} más...` : ''}
                      </span>
                    </div>
                  )}
                  {importData.areas.length > 0 && (
                    <div className="text-[11px]">
                      <strong className="text-[#B45309]">Áreas ({importData.areas.length}):</strong>{' '}
                      <span className="text-slate-600">
                        {importData.areas.slice(0, 5).map(a => a.area).join(', ')}
                        {importData.areas.length > 5 ? ` y ${importData.areas.length - 5} más...` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportData(null);
                }}
                className="flex-1 py-2.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="flex-1 py-2.5 rounded-full bg-[#22A846] hover:bg-[#1C8E3A] font-semibold text-xs text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Importar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual item row
interface MasterListItemProps {
  id: string;
  index: number;
  name: string;
  isEditing: boolean;
  editingValue: string;
  onStartEdit: () => void;
  onChangeEdit: (val: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  // Paradero metadata & zone support
  zona?: 'NORTE' | 'SUR';
  onToggleZona?: () => void;
  editingZona?: 'NORTE' | 'SUR';
  onChangeEditingZona?: (z: 'NORTE' | 'SUR') => void;
  codigo?: string;
  macrozona?: string;
  zonaEspecifica?: string;
  referencia?: string;
  latitud?: number;
  longitud?: number;
}

const MasterListItem: React.FC<MasterListItemProps> = ({
  id,
  index,
  name,
  isEditing,
  editingValue,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  zona,
  onToggleZona,
  editingZona,
  onChangeEditingZona,
  codigo,
  macrozona,
  zonaEspecifica,
  referencia,
}) => {
  return (
    <div
      id={`item-card-${id}`}
      className="bg-white rounded-2xl p-3 border border-[#E5ECF2] shadow-2xs flex items-center justify-between gap-3 hover:border-[#55A529]/50 transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-[#EAF7E4] text-[#2F7D18] text-xs font-bold flex items-center justify-center shrink-0 border border-[#C6E9B4]">
          {index}
        </span>

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <input
              type="text"
              value={editingValue}
              onChange={(e) => onChangeEdit(e.target.value)}
              autoFocus
              className="flex-1 min-w-[120px] px-3 py-1.5 rounded-full border border-[#55A529] text-xs font-semibold focus:outline-none"
            />
            {editingZona && onChangeEditingZona && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-full border border-[#D8E2EA] shrink-0">
                <button
                  type="button"
                  onClick={() => onChangeEditingZona('NORTE')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase transition-colors cursor-pointer ${
                    editingZona === 'NORTE'
                      ? 'bg-[#0082B3] text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Norte
                </button>
                <button
                  type="button"
                  onClick={() => onChangeEditingZona('SUR')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase transition-colors cursor-pointer ${
                    editingZona === 'SUR'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sur
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onSaveEdit}
                className="p-1.5 bg-[#22A846] text-white rounded-full hover:bg-[#1C8E3A] transition-colors cursor-pointer"
                title="Guardar cambios"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-1.5 bg-[#F1F5F9] text-slate-600 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2 pr-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {codigo && (
                  <span className="px-1.5 py-0.5 rounded bg-[#EAF7E4] border border-[#C6E9B4] text-[10px] font-mono font-semibold text-[#2F7D18]">
                    {codigo}
                  </span>
                )}
                <span className="text-xs font-bold text-[#1B3A57] break-words leading-snug" title={name}>
                  {name}
                </span>
              </div>
              {(macrozona || (zonaEspecifica && zonaEspecifica !== zona) || (referencia && referencia !== '.' && referencia !== '-')) && (
                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                  {macrozona && <span className="font-semibold text-slate-700">{macrozona}</span>}
                  {zonaEspecifica && zonaEspecifica !== zona && <span>• {zonaEspecifica}</span>}
                  {referencia && referencia !== '.' && referencia !== '-' && <span>• Ref: {referencia}</span>}
                </div>
              )}
            </div>
            {zona && (
              <button
                type="button"
                id={`btn-toggle-zona-${id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleZona?.();
                }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1 shrink-0 transition-all border hover:scale-105 active:scale-95 cursor-pointer ${
                  zona === 'SUR'
                    ? 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A]'
                    : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                }`}
                title={`Zona: ${zona}. Haz clic para cambiar a ${zona === 'SUR' ? 'NORTE' : 'SUR'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${zona === 'SUR' ? 'bg-amber-500' : 'bg-[#0082B3]'}`} />
                <span>{zona}</span>
                <ArrowLeftRight className="w-2.5 h-2.5 opacity-60 ml-0.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            id={`btn-edit-${id}`}
            onClick={onStartEdit}
            className="p-1.5 text-[#3D8B1C] hover:bg-[#EAF7E4] rounded-full transition-colors cursor-pointer"
            title="Editar nombre"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            id={`btn-delete-${id}`}
            onClick={onDelete}
            className="p-1.5 text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] rounded-full transition-colors cursor-pointer"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// Empty state sub-component
const EmptyMasterState: React.FC<{
  searchQuery: string;
  onClearSearch: () => void;
  singular: string;
}> = ({ searchQuery, onClearSearch, singular }) => {
  return (
    <div className="bg-white rounded-2xl p-8 border border-[#E5ECF2] text-center space-y-2">
      <div className="w-12 h-12 rounded-2xl bg-[#EEF3F7] text-slate-400 flex items-center justify-center mx-auto">
        <Search className="w-6 h-6" />
      </div>
      <div className="text-sm font-bold text-[#1B3A57]">
        {searchQuery ? `Sin resultados para "${searchQuery}"` : `No hay ${singular.toLowerCase()}s registrados`}
      </div>
      <p className="text-xs text-slate-400 max-w-xs mx-auto">
        {searchQuery
          ? 'Intenta con otro término o limpia el buscador.'
          : `Utiliza el formulario superior para registrar el primer ${singular.toLowerCase()}.`}
      </p>
      {searchQuery && (
        <button
          onClick={onClearSearch}
          className="text-xs font-semibold text-[#2F7D18] hover:underline pt-1 cursor-pointer"
        >
          Limpiar búsqueda
        </button>
      )}
    </div>
  );
};
