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
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MaestroArea,
  MaestroFundo,
  MaestroZona,
  MaestroParadero,
  MaestroUnidadBus,
} from '../types';
import {
  getStoredAreas,
  saveStoredAreas,
  getStoredFundos,
  saveStoredFundos,
  getStoredZonas,
  saveStoredZonas,
  getStoredParaderos,
  saveStoredParaderos,
  getStoredUnidadesBus,
  saveStoredUnidadesBus,
  resetMasterDataToDefault,
  exportToCSV,
  inferParaderoZona,
  subscribeToDataChanges,
} from '../services/storageService';

type MasterCategory = 'paraderos' | 'zonas' | 'fundos' | 'areas' | 'buses';

interface MasterDataManagementScreenProps {
  onBack: () => void;
  onNavigateToNewRequest?: () => void;
}

interface ParsedMasterImport {
  zonas: {
    zona: string;
    macrozona?: string;
    agrupado?: string;
    zonaOperativa: 'NORTE' | 'SUR';
  }[];
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

const normalizeZoneCompare = (s?: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

export const MasterDataManagementScreen: React.FC<MasterDataManagementScreenProps> = ({
  onBack,
  onNavigateToNewRequest,
}) => {
  const [activeTab, setActiveTab] = useState<MasterCategory>('paraderos');
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded master states
  const [zonas, setZonas] = useState<MaestroZona[]>([]);
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
  const [newParaderoZonaId, setNewParaderoZonaId] = useState<string>('');
  const [newParaderoCodigo, setNewParaderoCodigo] = useState<string>('');
  const [newParaderoAgrupado, setNewParaderoAgrupado] = useState<string>('');
  const [newParaderoReferencia, setNewParaderoReferencia] = useState<string>('');
  const [newZonaMacrozona, setNewZonaMacrozona] = useState<string>('');
  const [newZonaAgrupado, setNewZonaAgrupado] = useState<string>('');
  const [newZonaOperativa, setNewZonaOperativa] = useState<'NORTE' | 'SUR'>('NORTE');
  const [newUnidadCapacidad, setNewUnidadCapacidad] = useState<number>(40);
  const [formError, setFormError] = useState<string | null>(null);

  // Filters
  const [selectedZonaFilter, setSelectedZonaFilter] = useState<'TODOS' | 'NORTE' | 'SUR'>('TODOS');
  const [selectedZonaEspecificaFilter, setSelectedZonaEspecificaFilter] = useState<string>('TODAS');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingZona, setEditingZona] = useState<'NORTE' | 'SUR'>('NORTE');
  const [editingParaderoZonaId, setEditingParaderoZonaId] = useState<string>('');
  const [editingParaderoCodigo, setEditingParaderoCodigo] = useState<string>('');
  const [editingZonaMacrozona, setEditingZonaMacrozona] = useState<string>('');
  const [editingZonaAgrupado, setEditingZonaAgrupado] = useState<string>('');
  const [editingCapacidad, setEditingCapacidad] = useState<number>(40);

  // Zonas card expand / quick-assign paradero state
  const [expandedZonaId, setExpandedZonaId] = useState<string | null>(null);
  const [zonaParaderoSearch, setZonaParaderoSearch] = useState<string>('');
  const [quickNewParaderoName, setQuickNewParaderoName] = useState<string>('');
  const [quickNewParaderoCode, setQuickNewParaderoCode] = useState<string>('');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Confirmation Modal for Deleting or Resetting
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load all master data on mount and subscribe to live updates
  useEffect(() => {
    loadAllData();
    return subscribeToDataChanges(() => {
      loadAllData();
    });
  }, []);

  const loadAllData = () => {
    setZonas(getStoredZonas());
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

  // Helper: Find Zona object associated with a paradero
  const getParaderoMatchedZona = (p: MaestroParadero): MaestroZona | undefined => {
    return zonas.find(
      (z) =>
        (p.zonaId && z.id === p.zonaId) ||
        (p.zonaEspecifica && normalizeZoneCompare(z.zona) === normalizeZoneCompare(p.zonaEspecifica))
    );
  };

  // Helper: Get paraderos assigned to a specific Zona
  const getParaderosForZona = (z: MaestroZona): MaestroParadero[] => {
    const zNorm = normalizeZoneCompare(z.zona);
    return paraderos.filter(
      (p) =>
        p.zonaId === z.id ||
        (p.zonaEspecifica && normalizeZoneCompare(p.zonaEspecifica) === zNorm)
    );
  };

  // Paradero zone counters
  const countNorte = useMemo(() => {
    return paraderos.filter((p) => (p.zona || inferParaderoZona(p.paradero)) === 'NORTE').length;
  }, [paraderos]);

  const countSur = useMemo(() => {
    return paraderos.filter((p) => (p.zona || inferParaderoZona(p.paradero)) === 'SUR').length;
  }, [paraderos]);

  const countZonasNorte = useMemo(() => {
    return zonas.filter((z) => z.zonaOperativa === 'NORTE').length;
  }, [zonas]);

  const countZonasSur = useMemo(() => {
    return zonas.filter((z) => z.zonaOperativa === 'SUR').length;
  }, [zonas]);

  // Filtered lists based on search & zone
  const filteredParaderos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return paraderos.filter((p) => {
      const matchedZ = getParaderoMatchedZona(p);
      const zonaNombre = matchedZ?.zona || p.zonaEspecifica || '';
      const macroNombre = p.macrozona || matchedZ?.macrozona || '';
      const matchesQuery =
        !q ||
        p.paradero.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        macroNombre.toLowerCase().includes(q) ||
        zonaNombre.toLowerCase().includes(q) ||
        (p.agrupador && p.agrupador.toLowerCase().includes(q));
      const paraderoZona = p.zona || matchedZ?.zonaOperativa || inferParaderoZona(p.paradero);
      const matchesZona =
        selectedZonaFilter === 'TODOS' || paraderoZona === selectedZonaFilter;
      const matchesZonaEsp =
        selectedZonaEspecificaFilter === 'TODAS' ||
        (selectedZonaEspecificaFilter === 'SIN_ZONA'
          ? !matchedZ && !p.zonaEspecifica
          : matchedZ?.id === selectedZonaEspecificaFilter ||
            (p.zonaEspecifica &&
              normalizeZoneCompare(p.zonaEspecifica) ===
                normalizeZoneCompare(
                  zonas.find((z) => z.id === selectedZonaEspecificaFilter)?.zona
                )));
      return matchesQuery && matchesZona && matchesZonaEsp;
    });
  }, [paraderos, zonas, searchQuery, selectedZonaFilter, selectedZonaEspecificaFilter]);

  const filteredZonas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return zonas.filter((z) => {
      const assigned = getParaderosForZona(z);
      const matchesQuery =
        !q ||
        z.zona.toLowerCase().includes(q) ||
        (z.macrozona && z.macrozona.toLowerCase().includes(q)) ||
        (z.agrupado && z.agrupado.toLowerCase().includes(q)) ||
        assigned.some((p) => p.paradero.toLowerCase().includes(q));
      const matchesOp =
        selectedZonaFilter === 'TODOS' || z.zonaOperativa === selectedZonaFilter;
      return matchesQuery && matchesOp;
    });
  }, [zonas, paraderos, searchQuery, selectedZonaFilter]);

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

  // Tab configurations
  const tabsConfig = [
    {
      id: 'paraderos' as MasterCategory,
      label: 'Paraderos',
      singular: 'Paradero',
      icon: MapPin,
      count: paraderos.length,
      placeholder: 'Nombre del paradero...',
    },
    {
      id: 'zonas' as MasterCategory,
      label: 'Zonas',
      singular: 'Zona',
      icon: Compass,
      count: zonas.length,
      placeholder: 'Nombre de la zona...',
    },
    {
      id: 'fundos' as MasterCategory,
      label: 'Fundos',
      singular: 'Fundo',
      icon: Building,
      count: fundos.length,
      placeholder: 'Nombre del fundo...',
    },
    {
      id: 'areas' as MasterCategory,
      label: 'Áreas',
      singular: 'Área',
      icon: Briefcase,
      count: areas.length,
      placeholder: 'Nombre del área...',
    },
    {
      id: 'buses' as MasterCategory,
      label: 'Flota',
      singular: 'Unidad',
      icon: Bus,
      count: unidades.length,
      placeholder: 'Nombre de unidad...',
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
      const selectedZoneObj = newParaderoZonaId
        ? zonas.find((z) => z.id === newParaderoZonaId)
        : undefined;
      const resolvedZonaOp = selectedZoneObj?.zonaOperativa || newParaderoZona;
      const newParadero: MaestroParadero = {
        id: newId,
        paradero: cleanName,
        zona: resolvedZonaOp,
        ...(selectedZoneObj ? { zonaId: selectedZoneObj.id, zonaEspecifica: selectedZoneObj.zona } : {}),
        ...(selectedZoneObj?.macrozona ? { macrozona: selectedZoneObj.macrozona } : {}),
        ...(newParaderoCodigo.trim() ? { codigo: newParaderoCodigo.trim().toUpperCase() } : {}),
        ...(newParaderoAgrupado.trim() || selectedZoneObj?.agrupado
          ? { agrupador: newParaderoAgrupado.trim() || selectedZoneObj?.agrupado }
          : {}),
        ...(newParaderoReferencia.trim() ? { referencia: newParaderoReferencia.trim() } : {}),
      };
      const updated = [...paraderos, newParadero];
      setParaderos(updated);
      saveStoredParaderos(updated);
      setNewParaderoCodigo('');
      setNewParaderoAgrupado('');
      setNewParaderoReferencia('');
      showNotification(
        `Paradero "${cleanName}" agregado a ${selectedZoneObj ? `${selectedZoneObj.zona} (${resolvedZonaOp})` : `ZONA ${resolvedZonaOp}`}`
      );
    } else if (activeTab === 'zonas') {
      const upperZona = cleanName.toUpperCase();
      if (zonas.some((z) => normalizeZoneCompare(z.zona) === normalizeZoneCompare(upperZona))) {
        setFormError('Ya existe una zona con este nombre.');
        return;
      }
      const newZonaObj: MaestroZona = {
        id: `ZON-${Date.now()}`,
        zona: upperZona,
        macrozona: newZonaMacrozona.trim() || undefined,
        agrupado: newZonaAgrupado.trim() || undefined,
        zonaOperativa: newZonaOperativa,
      };
      const updated = [...zonas, newZonaObj];
      setZonas(updated);
      saveStoredZonas(updated);
      setExpandedZonaId(newZonaObj.id);
      setNewZonaMacrozona('');
      setNewZonaAgrupado('');
      showNotification(`Zona "${upperZona}" (${newZonaOperativa}) agregada con éxito`);
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

  // Assign or unassign a paradero to/from a Zona
  const handleAssignParaderoToZona = (paraderoId: string, targetZona: MaestroZona | null) => {
    const targetP = paraderos.find((p) => p.id === paraderoId);
    if (!targetP) return;
    const updated = paraderos.map((p) => {
      if (p.id !== paraderoId) return p;
      if (!targetZona) {
        const rest = { ...p };
        delete rest.zonaId;
        delete rest.zonaEspecifica;
        return rest;
      }
      return {
        ...p,
        zonaId: targetZona.id,
        zonaEspecifica: targetZona.zona,
        macrozona: targetZona.macrozona || p.macrozona,
        agrupador: targetZona.agrupado || p.agrupador,
        zona: targetZona.zonaOperativa,
      };
    });
    setParaderos(updated);
    saveStoredParaderos(updated);
    showNotification(
      targetZona
        ? `"${targetP.paradero}" asignado a zona "${targetZona.zona}"`
        : `"${targetP.paradero}" desvinculado de su zona`
    );
  };

  // Create new paradero directly inside an expanded Zona
  const handleQuickAddParaderoInZona = (targetZona: MaestroZona) => {
    const clean = quickNewParaderoName.trim();
    if (!clean) return;
    const existing = paraderos.find((p) => p.paradero.toLowerCase() === clean.toLowerCase());
    if (existing) {
      handleAssignParaderoToZona(existing.id, targetZona);
      setQuickNewParaderoName('');
      setQuickNewParaderoCode('');
      return;
    }
    const newPar: MaestroParadero = {
      id: `PAR-${Date.now()}`,
      paradero: clean,
      zona: targetZona.zonaOperativa,
      zonaId: targetZona.id,
      zonaEspecifica: targetZona.zona,
      ...(targetZona.macrozona ? { macrozona: targetZona.macrozona } : {}),
      ...(targetZona.agrupado ? { agrupador: targetZona.agrupado } : {}),
      ...(quickNewParaderoCode.trim() ? { codigo: quickNewParaderoCode.trim().toUpperCase() } : {}),
    };
    const updated = [...paraderos, newPar];
    setParaderos(updated);
    saveStoredParaderos(updated);
    setQuickNewParaderoName('');
    setQuickNewParaderoCode('');
    showNotification(`Paradero "${clean}" creado y asignado a "${targetZona.zona}"`);
  };

  // Toggle Zona operativa (Norte / Sur) and cascade to its assigned paraderos
  const handleToggleZonaOperativa = (zonaId: string) => {
    const target = zonas.find((z) => z.id === zonaId);
    if (!target) return;
    const newOp: 'NORTE' | 'SUR' = target.zonaOperativa === 'SUR' ? 'NORTE' : 'SUR';
    const updatedZonas = zonas.map((z) =>
      z.id === zonaId ? { ...z, zonaOperativa: newOp } : z
    );
    setZonas(updatedZonas);
    saveStoredZonas(updatedZonas);

    // Sincronizar ruta operativa en los paraderos que pertenecen a esta zona
    const zNorm = normalizeZoneCompare(target.zona);
    let touchedParaderos = false;
    const updatedParaderos = paraderos.map((p) => {
      if (p.zonaId === target.id || (p.zonaEspecifica && normalizeZoneCompare(p.zonaEspecifica) === zNorm)) {
        touchedParaderos = true;
        return { ...p, zona: newOp, zonaId: target.id, zonaEspecifica: target.zona };
      }
      return p;
    });
    if (touchedParaderos) {
      setParaderos(updatedParaderos);
      saveStoredParaderos(updatedParaderos);
    }
    showNotification(`Zona "${target.zona}" cambiada a ruta ${newOp}`);
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
      const matchedZ = p ? getParaderoMatchedZona(p) : undefined;
      setEditingZona((p?.zona || matchedZ?.zonaOperativa || inferParaderoZona(name)) as 'NORTE' | 'SUR');
      setEditingParaderoZonaId(matchedZ?.id || p?.zonaId || '');
      setEditingParaderoCodigo(p?.codigo || '');
    } else if (activeTab === 'zonas') {
      const z = zonas.find((item) => item.id === id);
      setEditingZonaMacrozona(z?.macrozona || '');
      setEditingZonaAgrupado(z?.agrupado || '');
      setEditingZona((z?.zonaOperativa || 'NORTE') as 'NORTE' | 'SUR');
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
      const selectedZoneObj = editingParaderoZonaId
        ? zonas.find((z) => z.id === editingParaderoZonaId)
        : undefined;
      const updated = paraderos.map((p) => {
        if (p.id !== id) return p;
        const next: MaestroParadero = {
          ...p,
          paradero: cleanName,
          zona: editingZona,
          codigo: editingParaderoCodigo.trim() ? editingParaderoCodigo.trim().toUpperCase() : p.codigo,
        };
        if (selectedZoneObj) {
          next.zonaId = selectedZoneObj.id;
          next.zonaEspecifica = selectedZoneObj.zona;
          next.macrozona = selectedZoneObj.macrozona || p.macrozona;
          next.agrupador = selectedZoneObj.agrupado || p.agrupador;
        } else {
          delete next.zonaId;
          delete next.zonaEspecifica;
        }
        return next;
      });
      setParaderos(updated);
      saveStoredParaderos(updated);
    } else if (activeTab === 'zonas') {
      const oldZone = zonas.find((z) => z.id === id);
      const upperZona = cleanName.toUpperCase();
      const updatedZonas = zonas.map((z) =>
        z.id === id
          ? {
              ...z,
              zona: upperZona,
              macrozona: editingZonaMacrozona.trim() || undefined,
              agrupado: editingZonaAgrupado.trim() || undefined,
              zonaOperativa: editingZona,
            }
          : z
      );
      setZonas(updatedZonas);
      saveStoredZonas(updatedZonas);

      // Propagar actualización de nombre/macrozona/ruta operativa a los paraderos pertenecientes
      if (oldZone) {
        const oldNorm = normalizeZoneCompare(oldZone.zona);
        let touched = false;
        const updatedParaderos = paraderos.map((p) => {
          if (
            p.zonaId === id ||
            (p.zonaEspecifica && normalizeZoneCompare(p.zonaEspecifica) === oldNorm)
          ) {
            touched = true;
            return {
              ...p,
              zonaId: id,
              zonaEspecifica: upperZona,
              macrozona: editingZonaMacrozona.trim() || p.macrozona,
              agrupador: editingZonaAgrupado.trim() || p.agrupador,
              zona: editingZona,
            };
          }
          return p;
        });
        if (touched) {
          setParaderos(updatedParaderos);
          saveStoredParaderos(updatedParaderos);
        }
      }
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
    } else if (activeTab === 'zonas') {
      const targetZ = zonas.find((z) => z.id === id);
      const updatedZonas = zonas.filter((z) => z.id !== id);
      setZonas(updatedZonas);
      saveStoredZonas(updatedZonas);
      if (targetZ) {
        const zNorm = normalizeZoneCompare(targetZ.zona);
        let touched = false;
        const updatedParaderos = paraderos.map((p) => {
          if (
            p.zonaId === id ||
            (p.zonaEspecifica && normalizeZoneCompare(p.zonaEspecifica) === zNorm)
          ) {
            touched = true;
            const copy = { ...p };
            delete copy.zonaId;
            delete copy.zonaEspecifica;
            return copy;
          }
          return p;
        });
        if (touched) {
          setParaderos(updatedParaderos);
          saveStoredParaderos(updatedParaderos);
        }
      }
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
    setZonas(res.zonas);
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
        paraderos.map((p) => {
          const matchedZ = getParaderoMatchedZona(p);
          return {
            MACROZONA: p.macrozona || matchedZ?.macrozona || '',
            ZONA: matchedZ?.zona || p.zonaEspecifica || p.zona || inferParaderoZona(p.paradero),
            AGRUPADO: p.agrupador || matchedZ?.agrupado || '',
            'CÓDIGO': p.codigo || p.id,
            NOMBRE: p.paradero,
            REFERENCIA: p.referencia || '',
            LATITUD: p.latitud !== undefined ? p.latitud : '',
            LONGITUD: p.longitud !== undefined ? p.longitud : '',
          };
        })
      );
    } else if (activeTab === 'zonas') {
      exportToCSV(
        `Camposol_Maestro_Zonas_${new Date().toISOString().slice(0, 10)}.csv`,
        zonas.map((z) => {
          const assigned = getParaderosForZona(z);
          return {
            ID: z.id,
            MACROZONA: z.macrozona || '',
            ZONA: z.zona,
            AGRUPADO: z.agrupado || '',
            RUTA_OPERATIVA: z.zonaOperativa,
            CANTIDAD_PARADEROS: assigned.length,
            PARADEROS_ASIGNADOS: assigned.map((p) => p.paradero).join(' | '),
          };
        })
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

  // Download official Excel template with Paraderos (CAMPOSOL format), Zonas, Fundos and Áreas
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet: Paraderos with exact CAMPOSOL columns: MACROZONA, ZONA, AGRUPADO, CÓDIGO, NOMBRE, REFERENCIA, LATITUD, LONGITUD
    const paraderosSample = [
      {
        MACROZONA: 'Mcrz 25 San Jose',
        ZONA: 'SAN JOSE',
        AGRUPADO: '',
        'CÓDIGO': 'E27',
        NOMBRE: 'SEMAFORO AGROMAS',
        REFERENCIA: '',
        LATITUD: -8.450491545,
        LONGITUD: -78.73398734,
      },
      {
        MACROZONA: 'Mcrz 25 San Jose',
        ZONA: 'SAN JOSE',
        AGRUPADO: '',
        'CÓDIGO': 'G-FR',
        NOMBRE: 'GAR FRUSOL 1',
        REFERENCIA: '-',
        LATITUD: -8.465203715,
        LONGITUD: -78.71849354,
      },
      {
        MACROZONA: 'Mcrz 21 Victor Raul',
        ZONA: 'VICTOR RAUL',
        AGRUPADO: '',
        'CÓDIGO': 'P580',
        NOMBRE: 'CALIFORNIA',
        REFERENCIA: '',
        LATITUD: -8.411556,
        LONGITUD: -78.803083,
      },
      {
        MACROZONA: 'Mcrz 32 Chao',
        ZONA: 'CHAO',
        AGRUPADO: '',
        'CÓDIGO': 'P436',
        NOMBRE: 'VIVIENDAS MAR VERDE',
        REFERENCIA: '',
        LATITUD: -8.573217,
        LONGITUD: -78.668278,
      },
      {
        MACROZONA: 'Mcrz 31 Nuevo Chao',
        ZONA: 'NUEVO CHAO',
        AGRUPADO: '',
        'CÓDIGO': 'P431',
        NOMBRE: 'LA BOTICA',
        REFERENCIA: '.',
        LATITUD: -8.511456964,
        LONGITUD: -78.67994715,
      },
    ];
    const wsParaderos = XLSX.utils.json_to_sheet(paraderosSample);
    XLSX.utils.book_append_sheet(wb, wsParaderos, 'Paraderos');

    // Sheet: Zonas
    const zonasSample = [
      { MACROZONA: 'Mcrz 25 San Jose', ZONA: 'SAN JOSE', AGRUPADO: '', RUTA_OPERATIVA: 'NORTE' },
      { MACROZONA: 'Mcrz 21 Victor Raul', ZONA: 'VICTOR RAUL', AGRUPADO: '', RUTA_OPERATIVA: 'NORTE' },
      { MACROZONA: 'Mcrz 32 Chao', ZONA: 'CHAO', AGRUPADO: '', RUTA_OPERATIVA: 'SUR' },
      { MACROZONA: 'Mcrz 31 Nuevo Chao', ZONA: 'NUEVO CHAO', AGRUPADO: '', RUTA_OPERATIVA: 'SUR' },
    ];
    const wsZonas = XLSX.utils.json_to_sheet(zonasSample);
    XLSX.utils.book_append_sheet(wb, wsZonas, 'Zonas');

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
        zonas: [],
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
          sampleHeaders.includes('nombre') &&
          (sampleHeaders.includes('codigo') ||
            sampleHeaders.includes('latitud') ||
            sampleHeaders.includes('macrozona') ||
            sampleHeaders.includes('zona'));

        const hasParaderoHeader = sampleHeaders.some((h) =>
          h.includes('paradero') ||
          h.includes('embarque') ||
          h.includes('punto') ||
          h.includes('ruta')
        );
        const hasFundoHeader = sampleHeaders.some((h) => h.includes('fundo'));
        const hasAreaHeader = sampleHeaders.some((h) => h.includes('area') || h.includes('área'));
        const isZonaOnlySheet =
          (sNorm.includes('zona') && !sampleHeaders.includes('nombre') && !hasParaderoHeader) ||
          (activeTab === 'zonas' && sampleHeaders.includes('zona') && !sampleHeaders.includes('nombre') && !hasParaderoHeader);

        const isParaderoSheet =
          !isZonaOnlySheet &&
          (sNorm.includes('paradero') ||
            hasCamposolParaderoFormat ||
            hasParaderoHeader ||
            (activeTab === 'paraderos' && !hasFundoHeader && !hasAreaHeader && !sNorm.includes('fundo') && !sNorm.includes('area')));
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

          const macrozonaVal = getVal('macrozona');
          const zonaVal = getVal('zona');
          const agrupadorVal = getVal('agrupado') || getVal('agrupador');
          const rutaOpRaw = (getVal('ruta_operativa') || getVal('ruta operativa') || getVal('ruta')).toUpperCase();

          if (isZonaOnlySheet) {
            if (zonaVal && !['zona', 'id', 'nombre'].includes(zonaVal.toLowerCase())) {
              const combinedZ = `${zonaVal} ${macrozonaVal} ${rutaOpRaw}`.toUpperCase();
              const op: 'NORTE' | 'SUR' = rutaOpRaw.includes('SUR')
                ? 'SUR'
                : rutaOpRaw.includes('NORTE')
                ? 'NORTE'
                : combinedZ.includes('CHAO') || combinedZ.includes('VALLE DE DIOS')
                ? 'SUR'
                : 'NORTE';
              result.zonas.push({
                zona: zonaVal.toUpperCase(),
                macrozona: macrozonaVal || undefined,
                agrupado: agrupadorVal || undefined,
                zonaOperativa: op,
              });
            }
            return;
          }

          // Paradero detection:
          // Formato CAMPOSOL: MACROZONA, ZONA, AGRUPADO(R), CÓDIGO, NOMBRE, REFERENCIA, LATITUD, LONGITUD
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
          const codigoVal = getVal('codigo') || getVal('cod');
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
                zonaOperativa = 'SUR';
              } else {
                zonaOperativa = inferParaderoZona(nombreVal);
              }

              // Registrar automáticamente la ZONA específica si viene en la columna ZONA
              if (
                zonaVal &&
                zonaVal.toUpperCase() !== 'NORTE' &&
                zonaVal.toUpperCase() !== 'SUR'
              ) {
                result.zonas.push({
                  zona: zonaVal.toUpperCase(),
                  macrozona: macrozonaVal || undefined,
                  agrupado: agrupadorVal || undefined,
                  zonaOperativa,
                });
              }

              result.paraderos.push({
                paradero: nombreVal,
                zona: zonaOperativa,
                codigo: codigoVal || undefined,
                macrozona: macrozonaVal || undefined,
                zonaEspecifica: zonaVal ? zonaVal.toUpperCase() : undefined,
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
              } else if (activeTab === 'zonas') {
                result.zonas.push({
                  zona: firstVal.toUpperCase(),
                  zonaOperativa: firstVal.toUpperCase().includes('CHAO') ? 'SUR' : 'NORTE',
                });
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
      result.zonas = result.zonas.filter(
        (item, idx, self) =>
          idx === self.findIndex((t) => normalizeZoneCompare(t.zona) === normalizeZoneCompare(item.zona))
      );
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

      const totalItems =
        result.zonas.length + result.paraderos.length + result.fundos.length + result.areas.length;
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

    let newZonas = [...zonas];
    let newParaderos = [...paraderos];
    let newFundos = [...fundos];
    let newAreas = [...areas];

    if (importMode === 'replace') {
      if (importData.zonas.length > 0) {
        newZonas = importData.zonas.map((z, idx) => ({
          id: `ZON-${Date.now()}-${idx}`,
          zona: z.zona,
          macrozona: z.macrozona,
          agrupado: z.agrupado,
          zonaOperativa: z.zonaOperativa,
        }));
      }
    } else if (importData.zonas.length > 0) {
      importData.zonas.forEach((z, idx) => {
        const existingIdx = newZonas.findIndex(
          (item) => normalizeZoneCompare(item.zona) === normalizeZoneCompare(z.zona)
        );
        if (existingIdx === -1) {
          newZonas.push({
            id: `ZON-${Date.now()}-${idx}`,
            zona: z.zona,
            macrozona: z.macrozona,
            agrupado: z.agrupado,
            zonaOperativa: z.zonaOperativa,
          });
        } else {
          newZonas[existingIdx] = {
            ...newZonas[existingIdx],
            macrozona: z.macrozona || newZonas[existingIdx].macrozona,
            agrupado: z.agrupado || newZonas[existingIdx].agrupado,
            zonaOperativa: z.zonaOperativa || newZonas[existingIdx].zonaOperativa,
          };
        }
      });
    }

    const resolveZoneIdForParadero = (zonaEsp?: string): string | undefined => {
      if (!zonaEsp) return undefined;
      return newZonas.find((z) => normalizeZoneCompare(z.zona) === normalizeZoneCompare(zonaEsp))?.id;
    };

    if (importMode === 'replace') {
      if (importData.paraderos.length > 0) {
        newParaderos = importData.paraderos.map((p, idx) => ({
          id: p.codigo ? `PAR-${p.codigo}` : `PAR-${Date.now()}-${idx}`,
          paradero: p.paradero,
          zona: p.zona,
          zonaId: resolveZoneIdForParadero(p.zonaEspecifica),
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
      // Merge mode without duplicates (also enriches existing items with code/coords/macrozona/zonaId)
      importData.paraderos.forEach((p, idx) => {
        const linkedZId = resolveZoneIdForParadero(p.zonaEspecifica);
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
            zonaId: linkedZId,
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
            zonaId: linkedZId || newParaderos[existingIdx].zonaId,
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

    if (importData.zonas.length > 0) {
      setZonas(newZonas);
      saveStoredZonas(newZonas);
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
    showNotification('¡Zonas y paraderos guardados y sincronizados en tiempo real!');
  };

  const currentListCount =
    activeTab === 'paraderos'
      ? filteredParaderos.length
      : activeTab === 'zonas'
      ? filteredZonas.length
      : activeTab === 'fundos'
      ? filteredFundos.length
      : activeTab === 'areas'
      ? filteredAreas.length
      : filteredBuses.length;

  return (
    <div className="flex flex-col flex-1 w-full max-w-7xl mx-auto space-y-3.5 pb-14 text-[#1B3A57]">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1B3A57] text-white px-4 py-2 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 border border-[#55A529]/50 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-[#7BD44B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Compact Top Toolbar */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-[#E5ECF2] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-to-home"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#2F7D18] bg-[#EAF7E4] hover:bg-[#d8f1cc] border border-[#C6E9B4] px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>
          <h2 className="text-sm font-bold text-[#1B3A57] whitespace-nowrap">
            Catálogos Maestros
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2F7D18] hover:bg-[#F3F8F0] rounded-full transition-colors cursor-pointer whitespace-nowrap"
            title="Importar Excel (.xlsx, .xls, .csv)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            id="btn-download-master-template"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2F7D18] hover:bg-[#F3F8F0] rounded-full transition-colors cursor-pointer whitespace-nowrap"
            title="Descargar plantilla Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Plantilla</span>
          </button>

          <button
            id="btn-export-master-csv"
            onClick={handleExportCurrentMaster}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2F7D18] hover:bg-[#F3F8F0] rounded-full transition-colors cursor-pointer whitespace-nowrap"
            title="Exportar lista actual a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            id="btn-reset-masters"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors cursor-pointer whitespace-nowrap"
            title="Restablecer valores por defecto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>

          {onNavigateToNewRequest && (
            <button
              onClick={onNavigateToNewRequest}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#22A846] hover:bg-[#1C8E3A] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuevo req.</span>
            </button>
          )}
        </div>
      </div>

      {/* Single Unified Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-[#E5ECF2] shadow-2xs flex items-center gap-1 overflow-x-auto">
        {tabsConfig.map((t) => {
          const Icon = t.icon;
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
              className={`flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isCurrent
                  ? 'bg-[#55A529] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#2F7D18] hover:bg-[#F3F8F0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
              <span
                className={`text-[11px] tabular-nums ${
                  isCurrent ? 'text-white/90' : 'text-slate-400'
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column (4 cols): Clean Add Form */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E5ECF2] shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EAF7E4] flex items-center justify-center text-[#2F7D18] shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-[#1B3A57]">
                {activeTab === 'zonas'
                  ? 'Nueva zona'
                  : activeTab === 'areas'
                  ? 'Nueva área'
                  : activeTab === 'buses'
                  ? 'Nueva unidad'
                  : `Nuevo ${currentTabInfo.singular.toLowerCase()}`}
              </h3>
            </div>

            <form onSubmit={handleAddItem} className="space-y-2.5">
              <input
                id={`input-new-${activeTab}`}
                type="text"
                value={newItemName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewItemName(val);
                  if (activeTab === 'paraderos' && !newParaderoZonaId && val.trim().length >= 3) {
                    setNewParaderoZona(inferParaderoZona(val));
                  }
                  if (activeTab === 'zonas' && val.trim().length >= 3) {
                    const u = val.toUpperCase();
                    if (u.includes('CHAO') || u.includes('VALLE DE DIOS')) {
                      setNewZonaOperativa('SUR');
                    }
                  }
                  if (formError) setFormError(null);
                }}
                placeholder={currentTabInfo.placeholder}
                className="w-full h-9 px-3.5 rounded-xl border border-[#D8E2EA] text-xs text-slate-700 focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
              />

              {/* Fields when adding a new Zona */}
              {activeTab === 'zonas' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newZonaMacrozona}
                      onChange={(e) => setNewZonaMacrozona(e.target.value)}
                      placeholder="Macrozona"
                      className="h-9 px-3 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                    />
                    <input
                      type="text"
                      value={newZonaAgrupado}
                      onChange={(e) => setNewZonaAgrupado(e.target.value)}
                      placeholder="Agrupado"
                      className="h-9 px-3 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex items-center justify-between bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E5ECF2]">
                    <span className="text-xs font-semibold text-slate-600">Ruta</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewZonaOperativa('NORTE')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          newZonaOperativa === 'NORTE'
                            ? 'bg-[#0082B3] text-white'
                            : 'bg-white text-slate-600 border border-[#D8E2EA] hover:bg-slate-50'
                        }`}
                      >
                        Norte
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewZonaOperativa('SUR')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          newZonaOperativa === 'SUR'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600 border border-[#D8E2EA] hover:bg-slate-50'
                        }`}
                      >
                        Sur
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Capacidad selector when adding a new Bus */}
              {activeTab === 'buses' && (
                <div className="flex items-center justify-between bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E5ECF2]">
                  <span className="text-xs font-semibold text-slate-600">Capacidad (pax)</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newUnidadCapacidad}
                    onChange={(e) => setNewUnidadCapacidad(Number(e.target.value) || 0)}
                    className="w-20 h-8 px-2.5 bg-white border border-[#D8E2EA] rounded-lg text-xs font-semibold text-[#1B3A57] text-right tabular-nums focus:outline-none focus:border-[#55A529]"
                  />
                </div>
              )}

              {/* Zona + metadata selectors when adding a new Paradero */}
              {activeTab === 'paraderos' && (
                <div className="space-y-2">
                  <select
                    id="select-new-paradero-zona"
                    value={newParaderoZonaId}
                    onChange={(e) => {
                      const zId = e.target.value;
                      setNewParaderoZonaId(zId);
                      const found = zonas.find((z) => z.id === zId);
                      if (found) {
                        setNewParaderoZona(found.zonaOperativa);
                        if (found.agrupado && !newParaderoAgrupado) {
                          setNewParaderoAgrupado(found.agrupado);
                        }
                      }
                    }}
                    className="w-full h-9 px-3 bg-[#F8FAFC] border border-[#D8E2EA] rounded-xl text-xs font-medium text-[#1B3A57] focus:bg-white focus:outline-none focus:border-[#55A529] cursor-pointer"
                  >
                    <option value="">Zona: Sin asignar</option>
                    {zonas.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.zona} · {z.zonaOperativa}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      value={newParaderoCodigo}
                      onChange={(e) => setNewParaderoCodigo(e.target.value)}
                      placeholder="Código"
                      className="h-8 px-2.5 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-[11px] text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400 uppercase"
                    />
                    <input
                      type="text"
                      value={newParaderoAgrupado}
                      onChange={(e) => setNewParaderoAgrupado(e.target.value)}
                      placeholder="Agrupado"
                      className="h-8 px-2.5 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-[11px] text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                    />
                    <input
                      type="text"
                      value={newParaderoReferencia}
                      onChange={(e) => setNewParaderoReferencia(e.target.value)}
                      placeholder="Referencia"
                      className="h-8 px-2.5 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-[11px] text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex items-center justify-between bg-[#F8FAFC] px-3 py-1.5 rounded-xl border border-[#E5ECF2]">
                    <span className="text-xs font-semibold text-slate-600">Ruta</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        id="btn-select-new-norte"
                        onClick={() => setNewParaderoZona('NORTE')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          newParaderoZona === 'NORTE'
                            ? 'bg-[#0082B3] text-white'
                            : 'bg-white text-slate-600 border border-[#D8E2EA] hover:bg-slate-50'
                        }`}
                      >
                        Norte
                      </button>
                      <button
                        type="button"
                        id="btn-select-new-sur"
                        onClick={() => setNewParaderoZona('SUR')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                          newParaderoZona === 'SUR'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-600 border border-[#D8E2EA] hover:bg-slate-50'
                        }`}
                      >
                        Sur
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {formError && (
                <p className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </p>
              )}

              <button
                type="submit"
                id="btn-submit-add-item"
                className="w-full h-9 bg-[#22A846] hover:bg-[#1C8E3A] text-white rounded-full font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (8 cols): Compact Filter Bar + Clean List */}
        <div className="lg:col-span-8 space-y-3">
          {/* Unified Search + Filter Bar */}
          <div className="bg-white rounded-2xl p-3 border border-[#E5ECF2] shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  id="input-search-master-items"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Buscar ${currentTabInfo.label.toLowerCase()}...`}
                  className="w-full h-9 pl-3.5 pr-9 rounded-xl bg-[#F8FAFC] border border-[#D8E2EA] text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-[#55A529] placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Search className="w-4 h-4 text-[#55A529] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>

              {(activeTab === 'paraderos' || activeTab === 'zonas') && (
                <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E5ECF2]">
                  <button
                    type="button"
                    id="filter-zona-todos"
                    onClick={() => setSelectedZonaFilter('TODOS')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      selectedZonaFilter === 'TODOS'
                        ? 'bg-[#22A846] text-white'
                        : 'text-slate-600 hover:text-[#1B3A57]'
                    }`}
                  >
                    Todos ({activeTab === 'zonas' ? zonas.length : paraderos.length})
                  </button>
                  <button
                    type="button"
                    id="filter-zona-norte"
                    onClick={() => setSelectedZonaFilter('NORTE')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      selectedZonaFilter === 'NORTE'
                        ? 'bg-[#0082B3] text-white'
                        : 'text-[#0082B3] hover:bg-[#E6F3FB]'
                    }`}
                  >
                    Norte ({activeTab === 'zonas' ? countZonasNorte : countNorte})
                  </button>
                  <button
                    type="button"
                    id="filter-zona-sur"
                    onClick={() => setSelectedZonaFilter('SUR')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      selectedZonaFilter === 'SUR'
                        ? 'bg-amber-600 text-white'
                        : 'text-[#B45309] hover:bg-[#FFF6E0]'
                    }`}
                  >
                    Sur ({activeTab === 'zonas' ? countZonasSur : countSur})
                  </button>
                </div>
              )}

              {activeTab === 'paraderos' && zonas.length > 0 && (
                <select
                  value={selectedZonaEspecificaFilter}
                  onChange={(e) => setSelectedZonaEspecificaFilter(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#D8E2EA] bg-[#F8FAFC] text-xs font-medium text-[#1B3A57] focus:bg-white focus:outline-none focus:border-[#55A529] cursor-pointer max-w-[220px]"
                >
                  <option value="TODAS">Todas las zonas</option>
                  {zonas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.zona} ({getParaderosForZona(z).length})
                    </option>
                  ))}
                  <option value="SIN_ZONA">
                    Sin zona ({paraderos.filter((p) => !getParaderoMatchedZona(p) && !p.zonaEspecifica).length})
                  </option>
                </select>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5 tabular-nums">
              <span>
                <strong className="text-[#1B3A57]">{currentListCount}</strong>{' '}
                {currentTabInfo.label.toLowerCase()}
              </span>
              {searchQuery && (
                <span className="text-[#2F7D18] font-semibold">"{searchQuery}"</span>
              )}
            </div>
          </div>

          {/* Master Items List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* PARADEROS LIST */}
            {activeTab === 'paraderos' &&
              (filteredParaderos.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => {
                      setSearchQuery('');
                      setSelectedZonaFilter('TODOS');
                      setSelectedZonaEspecificaFilter('TODAS');
                    }}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredParaderos.map((item, index) => {
                  const matchedZ = getParaderoMatchedZona(item);
                  const itemZona = item.zona || matchedZ?.zonaOperativa || inferParaderoZona(item.paradero);
                  return (
                    <MasterListItem
                      key={item.id}
                      id={item.id}
                      index={index + 1}
                      name={item.paradero}
                      zona={itemZona}
                      codigo={item.codigo}
                      macrozona={item.macrozona || matchedZ?.macrozona}
                      zonaEspecifica={matchedZ?.zona || item.zonaEspecifica}
                      agrupador={item.agrupador || matchedZ?.agrupado}
                      referencia={item.referencia}
                      latitud={item.latitud}
                      longitud={item.longitud}
                      onToggleZona={() => handleToggleParaderoZona(item.id)}
                      isEditing={editingId === item.id}
                      editingValue={editingName}
                      editingZona={editingZona}
                      onChangeEditingZona={setEditingZona}
                      zonasOptions={zonas}
                      editingParaderoZonaId={editingParaderoZonaId}
                      onChangeEditingParaderoZonaId={(zId) => {
                        setEditingParaderoZonaId(zId);
                        const found = zonas.find((z) => z.id === zId);
                        if (found) setEditingZona(found.zonaOperativa);
                      }}
                      editingCodigo={editingParaderoCodigo}
                      onChangeEditingCodigo={setEditingParaderoCodigo}
                      onStartEdit={() => startEditing(item.id, item.paradero)}
                      onChangeEdit={(val) => setEditingName(val)}
                      onSaveEdit={() => saveEditing(item.id)}
                      onCancelEdit={cancelEditing}
                      onDelete={() => setItemToDelete({ id: item.id, name: item.paradero })}
                    />
                  );
                })
              ))}

            {/* ZONAS LIST */}
            {activeTab === 'zonas' &&
              (filteredZonas.length === 0 ? (
                <div className="sm:col-span-2">
                  <EmptyMasterState
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    singular={currentTabInfo.singular}
                  />
                </div>
              ) : (
                filteredZonas.map((z, index) => {
                  const assignedParaderos = getParaderosForZona(z);
                  const isEditing = editingId === z.id;
                  const isExpanded = expandedZonaId === z.id;
                  const unassignedOrOther = paraderos.filter(
                    (p) => !assignedParaderos.some((ap) => ap.id === p.id)
                  );
                  const qP = zonaParaderoSearch.trim().toLowerCase();
                  const filteredAssignPool = unassignedOrOther
                    .filter(
                      (p) =>
                        !qP ||
                        p.paradero.toLowerCase().includes(qP) ||
                        (p.codigo && p.codigo.toLowerCase().includes(qP))
                    )
                    .sort((a, b) => {
                      const aFree = !a.zonaId && !a.zonaEspecifica ? 0 : 1;
                      const bFree = !b.zonaId && !b.zonaEspecifica ? 0 : 1;
                      return aFree - bFree;
                    });

                  return (
                    <div
                      key={z.id}
                      id={`zona-card-${z.id}`}
                      className="sm:col-span-2 bg-white rounded-2xl p-3.5 border border-[#E5ECF2] shadow-2xs hover:border-[#55A529]/50 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-[#EAF7E4] text-[#2F7D18] text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                            {index + 1}
                          </span>

                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                autoFocus
                                placeholder="Zona"
                                className="flex-1 min-w-[120px] px-3 py-1.5 rounded-xl border border-[#55A529] text-xs font-semibold focus:outline-none uppercase"
                              />
                              <input
                                type="text"
                                value={editingZonaMacrozona}
                                onChange={(e) => setEditingZonaMacrozona(e.target.value)}
                                placeholder="Macrozona"
                                className="w-36 px-3 py-1.5 rounded-xl border border-[#D8E2EA] text-xs focus:outline-none focus:border-[#55A529]"
                              />
                              <input
                                type="text"
                                value={editingZonaAgrupado}
                                onChange={(e) => setEditingZonaAgrupado(e.target.value)}
                                placeholder="Agrupado"
                                className="w-28 px-3 py-1.5 rounded-xl border border-[#D8E2EA] text-xs focus:outline-none focus:border-[#55A529]"
                              />
                              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-[#D8E2EA]">
                                <button
                                  type="button"
                                  onClick={() => setEditingZona('NORTE')}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                                    editingZona === 'NORTE' ? 'bg-[#0082B3] text-white' : 'text-slate-500'
                                  }`}
                                >
                                  Norte
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingZona('SUR')}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                                    editingZona === 'SUR' ? 'bg-amber-600 text-white' : 'text-slate-500'
                                  }`}
                                >
                                  Sur
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => saveEditing(z.id)}
                                className="p-1.5 bg-[#22A846] text-white rounded-full hover:bg-[#1C8E3A] cursor-pointer"
                                title="Guardar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="p-1.5 bg-[#F1F5F9] text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[#1B3A57] truncate">
                                {z.zona}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5 tabular-nums">
                                {[
                                  z.macrozona,
                                  z.agrupado ? `Agrup: ${z.agrupado}` : '',
                                  `${assignedParaderos.length} paraderos`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedZonaId(isExpanded ? null : z.id);
                                setZonaParaderoSearch('');
                                setQuickNewParaderoName('');
                                setQuickNewParaderoCode('');
                              }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer tabular-nums whitespace-nowrap ${
                                isExpanded
                                  ? 'bg-[#22A846] text-white border-[#22A846]'
                                  : 'bg-[#EAF7E4] text-[#2F7D18] border-[#C6E9B4] hover:bg-[#d8f1cc]'
                              }`}
                            >
                              <span>Paraderos ({assignedParaderos.length})</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleZonaOperativa(z.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap ${
                                z.zonaOperativa === 'SUR'
                                  ? 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A]'
                                  : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                              }`}
                              title="Cambiar ruta Norte / Sur"
                            >
                              <span>{z.zonaOperativa}</span>
                              <ArrowLeftRight className="w-2.5 h-2.5 opacity-60" />
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditing(z.id, z.zona)}
                              className="p-1.5 text-[#3D8B1C] hover:bg-[#EAF7E4] rounded-full transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete({ id: z.id, name: z.zona })}
                              className="p-1.5 text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] rounded-full transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Drawer: Paraderos pertenecientes a esta Zona + Asignar */}
                      {isExpanded && (
                        <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                          {assignedParaderos.length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              Sin paraderos asignados.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {assignedParaderos.map((ap) => (
                                <span
                                  key={ap.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8FAFC] border border-[#D8E2EA] text-[11px] font-medium text-[#1B3A57]"
                                >
                                  {ap.codigo && (
                                    <span className="text-[10px] font-mono font-bold text-[#2F7D18]">
                                      {ap.codigo}
                                    </span>
                                  )}
                                  <span>{ap.paradero}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignParaderoToZona(ap.id, null)}
                                    className="text-slate-400 hover:text-[#DC2626] cursor-pointer"
                                    title="Quitar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Asignar paraderos existentes o crear nuevo */}
                          <div className="bg-[#F8FAFC] rounded-xl p-2.5 border border-[#E5ECF2] space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-[#1B3A57]">
                                Agregar paradero
                              </span>
                              <input
                                type="text"
                                value={zonaParaderoSearch}
                                onChange={(e) => setZonaParaderoSearch(e.target.value)}
                                placeholder="Buscar..."
                                className="h-7 px-3 rounded-lg border border-[#D8E2EA] bg-white text-[11px] text-slate-700 focus:outline-none focus:border-[#55A529] w-48"
                              />
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                              {filteredAssignPool.length === 0 ? (
                                <span className="text-[11px] text-slate-400">
                                  Sin coincidencias.
                                </span>
                              ) : (
                                filteredAssignPool.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleAssignParaderoToZona(p.id, z)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white hover:bg-[#EAF7E4] border border-[#D8E2EA] hover:border-[#55A529] text-[10px] font-medium text-[#1B3A57] transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 text-[#22A846]" />
                                    {p.codigo && <span className="font-mono text-[#2F7D18]">{p.codigo}</span>}
                                    <span>{p.paradero}</span>
                                  </button>
                                ))
                              )}
                            </div>

                            <div className="pt-2 border-t border-[#E5ECF2] flex flex-wrap items-center gap-1.5">
                              <input
                                type="text"
                                value={quickNewParaderoCode}
                                onChange={(e) => setQuickNewParaderoCode(e.target.value)}
                                placeholder="Cód."
                                className="w-16 h-8 px-2.5 rounded-lg border border-[#D8E2EA] bg-white text-[11px] uppercase focus:outline-none focus:border-[#55A529]"
                              />
                              <input
                                type="text"
                                value={quickNewParaderoName}
                                onChange={(e) => setQuickNewParaderoName(e.target.value)}
                                placeholder="Nuevo paradero..."
                                className="flex-1 min-w-[140px] h-8 px-3 rounded-lg border border-[#D8E2EA] bg-white text-[11px] focus:outline-none focus:border-[#55A529]"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickAddParaderoInZona(z)}
                                disabled={!quickNewParaderoName.trim()}
                                className="h-8 px-3 rounded-lg bg-[#22A846] hover:bg-[#1C8E3A] disabled:opacity-40 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Crear</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
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
                      className="bg-white rounded-2xl p-3 border border-[#E5ECF2] shadow-2xs flex items-center justify-between gap-2.5 hover:border-[#55A529]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#EAF7E4] text-[#2F7D18] text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {index + 1}
                        </span>

                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              placeholder="Unidad"
                              className="flex-1 min-w-[110px] px-3 py-1.5 rounded-xl border border-[#55A529] text-xs font-semibold focus:outline-none"
                            />
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={editingCapacidad}
                              onChange={(e) => setEditingCapacidad(Number(e.target.value) || 0)}
                              className="w-16 px-2 py-1.5 text-xs font-semibold text-right bg-white border border-[#D8E2EA] rounded-xl tabular-nums"
                            />
                            <button
                              onClick={() => saveEditing(item.id)}
                              className="p-1.5 bg-[#22A846] text-white rounded-full hover:bg-[#1C8E3A] cursor-pointer"
                              title="Guardar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1.5 bg-[#F1F5F9] text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#1B3A57] truncate">
                                {item.nombre}
                              </div>
                              <div className="text-[11px] text-slate-500 tabular-nums">
                                {item.capacidad} pax
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleUnidadActivo(item.id)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer border ${
                                item.activo
                                  ? 'bg-[#EAF7E4] text-[#2F7D18] border-[#C6E9B4]'
                                  : 'bg-[#F1F5F9] text-slate-500 border-slate-200'
                              }`}
                            >
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => {
                              startEditing(item.id, item.nombre);
                              setEditingCapacidad(item.capacidad);
                            }}
                            className="p-1.5 text-[#3D8B1C] hover:bg-[#EAF7E4] rounded-full transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setItemToDelete({ id: item.id, name: item.nombre })}
                            className="p-1.5 text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] rounded-full transition-colors cursor-pointer"
                            title="Eliminar"
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
            <div className="w-11 h-11 rounded-2xl bg-[#FDECEC] text-[#DC2626] border border-[#FECACA] flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-center text-[#1B3A57]">
              Eliminar {currentTabInfo.singular.toLowerCase()}
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              ¿Quitar <strong className="text-slate-800">{itemToDelete.name}</strong> del catálogo?
            </p>

            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-full bg-[#DC2626] hover:bg-red-700 font-semibold text-xs text-white shadow-xs cursor-pointer transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-[#E5ECF2] animate-in fade-in zoom-in duration-150">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF6E0] text-[#B45309] border border-[#FDE68A] flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-center text-[#1B3A57]">
              Restablecer catálogos
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Volverán a los valores iniciales del sistema.
            </p>

            <div className="flex gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="flex-1 py-2 rounded-full bg-amber-600 hover:bg-amber-700 font-semibold text-xs text-white shadow-xs cursor-pointer transition-colors"
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && importData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-[#E5ECF2] animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-xl bg-[#EAF7E4] text-[#2F7D18] border border-[#C6E9B4] flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#1B3A57] truncate">
                  Importar Excel
                </h3>
                <p className="text-xs text-slate-500 truncate">{importFileName}</p>
              </div>
            </div>

            <div className="py-3.5 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#EAF7E4] p-2.5 rounded-xl text-center border border-[#C6E9B4]">
                  <div className="text-lg font-bold text-[#2F7D18] tabular-nums">{importData.paraderos.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57]">Paraderos</div>
                </div>
                <div className="bg-[#F3F8F0] p-2.5 rounded-xl text-center border border-[#C6E9B4]">
                  <div className="text-lg font-bold text-[#3D8B1C] tabular-nums">{importData.zonas.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57]">Zonas</div>
                </div>
                <div className="bg-[#E6F3FB] p-2.5 rounded-xl text-center border border-[#D4E9F7]">
                  <div className="text-lg font-bold text-[#0082B3] tabular-nums">{importData.fundos.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57]">Fundos</div>
                </div>
                <div className="bg-[#FFF6E0] p-2.5 rounded-xl text-center border border-[#FDE68A]">
                  <div className="text-lg font-bold text-[#B45309] tabular-nums">{importData.areas.length}</div>
                  <div className="text-[11px] font-semibold text-[#1B3A57]">Áreas</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    importMode === 'merge'
                      ? 'border-[#55A529] bg-[#F3F8F0] ring-1 ring-[#55A529]'
                      : 'border-[#E5ECF2] hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-[#1B3A57] flex items-center justify-between">
                    <span>Combinar</span>
                    {importMode === 'merge' && <Check className="w-3.5 h-3.5 text-[#55A529]" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Agrega sin borrar existentes
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    importMode === 'replace'
                      ? 'border-amber-500 bg-[#FFF6E0] ring-1 ring-amber-500'
                      : 'border-[#E5ECF2] hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold text-[#1B3A57] flex items-center justify-between">
                    <span>Reemplazar</span>
                    {importMode === 'replace' && <Check className="w-3.5 h-3.5 text-[#B45309]" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Sustituye listas del archivo
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportData(null);
                }}
                className="flex-1 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 font-semibold text-xs text-slate-600 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="flex-1 py-2 rounded-full bg-[#22A846] hover:bg-[#1C8E3A] font-semibold text-xs text-white shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar</span>
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
  zona?: 'NORTE' | 'SUR';
  onToggleZona?: () => void;
  editingZona?: 'NORTE' | 'SUR';
  onChangeEditingZona?: (z: 'NORTE' | 'SUR') => void;
  zonasOptions?: MaestroZona[];
  editingParaderoZonaId?: string;
  onChangeEditingParaderoZonaId?: (zId: string) => void;
  editingCodigo?: string;
  onChangeEditingCodigo?: (cod: string) => void;
  codigo?: string;
  macrozona?: string;
  zonaEspecifica?: string;
  agrupador?: string;
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
  zonasOptions,
  editingParaderoZonaId,
  onChangeEditingParaderoZonaId,
  editingCodigo,
  onChangeEditingCodigo,
  codigo,
  macrozona,
  zonaEspecifica,
  agrupador,
  referencia,
}) => {
  const metaText = [
    zonaEspecifica && zonaEspecifica !== zona ? zonaEspecifica : '',
    macrozona || '',
    agrupador ? `Agrup: ${agrupador}` : '',
    referencia && referencia !== '.' && referencia !== '-' ? referencia : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      id={`item-card-${id}`}
      className="bg-white rounded-2xl p-3 border border-[#E5ECF2] shadow-2xs flex items-center justify-between gap-2.5 hover:border-[#55A529]/50 transition-colors"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="w-7 h-7 rounded-lg bg-[#EAF7E4] text-[#2F7D18] text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
          {index}
        </span>

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {onChangeEditingCodigo && (
              <input
                type="text"
                value={editingCodigo || ''}
                onChange={(e) => onChangeEditingCodigo(e.target.value)}
                placeholder="Cód."
                className="w-16 px-2 py-1 rounded-lg border border-[#D8E2EA] text-[11px] font-mono uppercase focus:outline-none focus:border-[#55A529]"
              />
            )}
            <input
              type="text"
              value={editingValue}
              onChange={(e) => onChangeEdit(e.target.value)}
              autoFocus
              className="flex-1 min-w-[110px] px-2.5 py-1 rounded-lg border border-[#55A529] text-xs font-semibold focus:outline-none"
            />
            {zonasOptions && onChangeEditingParaderoZonaId && (
              <select
                value={editingParaderoZonaId || ''}
                onChange={(e) => onChangeEditingParaderoZonaId(e.target.value)}
                className="max-w-[150px] px-2 py-1 rounded-lg border border-[#D8E2EA] bg-white text-[10px] font-medium text-[#1B3A57] focus:outline-none focus:border-[#55A529]"
              >
                <option value="">Sin zona</option>
                {zonasOptions.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zona}
                  </option>
                ))}
              </select>
            )}
            {editingZona && onChangeEditingZona && (
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-[#D8E2EA] shrink-0">
                <button
                  type="button"
                  onClick={() => onChangeEditingZona('NORTE')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                    editingZona === 'NORTE' ? 'bg-[#0082B3] text-white' : 'text-slate-500'
                  }`}
                >
                  Norte
                </button>
                <button
                  type="button"
                  onClick={() => onChangeEditingZona('SUR')}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                    editingZona === 'SUR' ? 'bg-amber-600 text-white' : 'text-slate-500'
                  }`}
                >
                  Sur
                </button>
              </div>
            )}
            <button
              onClick={onSaveEdit}
              className="p-1.5 bg-[#22A846] text-white rounded-full hover:bg-[#1C8E3A] cursor-pointer"
              title="Guardar"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1.5 bg-[#F1F5F9] text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                {codigo && (
                  <span className="text-[10px] font-mono font-bold text-[#2F7D18] shrink-0">
                    {codigo}
                  </span>
                )}
                <span className="text-xs font-bold text-[#1B3A57] truncate" title={name}>
                  {name}
                </span>
              </div>
              {metaText && (
                <div className="text-[11px] text-slate-500 truncate mt-0.5" title={metaText}>
                  {metaText}
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
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1 shrink-0 transition-colors border cursor-pointer ${
                  zona === 'SUR'
                    ? 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A]'
                    : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                }`}
                title="Cambiar ruta Norte / Sur"
              >
                <span>{zona}</span>
                <ArrowLeftRight className="w-2.5 h-2.5 opacity-60" />
              </button>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            id={`btn-edit-${id}`}
            onClick={onStartEdit}
            className="p-1.5 text-[#3D8B1C] hover:bg-[#EAF7E4] rounded-full transition-colors cursor-pointer"
            title="Editar"
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
      <div className="w-10 h-10 rounded-xl bg-[#EEF3F7] text-slate-400 flex items-center justify-center mx-auto">
        <Search className="w-5 h-5" />
      </div>
      <div className="text-xs font-bold text-[#1B3A57]">
        {searchQuery ? `Sin resultados para "${searchQuery}"` : `Sin ${singular.toLowerCase()}s`}
      </div>
      {searchQuery && (
        <button
          onClick={onClearSearch}
          className="text-xs font-semibold text-[#2F7D18] hover:underline cursor-pointer"
        >
          Limpiar filtro
        </button>
      )}
    </div>
  );
};
