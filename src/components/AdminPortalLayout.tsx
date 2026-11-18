import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Database,
  Radio,
  BarChart2,
  Bell,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Calendar,
  Building,
  MapPin,
  Users,
  Bus,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  CheckCheck,
  Download,
  Eye,
  PlusCircle,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Inbox,
  Cloud,
  CloudCheck,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  History,
  RotateCcw,
  Globe,
  CalendarCheck2,
} from 'lucide-react';
import { Requerimiento, EstadoRequerimiento, UserRole, AppUser } from '../types';
import {
  getStoredAreas,
  getStoredFundos,
  getStoredDetalles,
  getDetallesByRequerimientoId,
  updateRequerimientoEstado,
  deleteRequerimiento,
  deleteBatchRequerimientos,
  exportToCSV,
  syncWithServerNow,
  syncWithServerDetailed,
  getSyncInfo,
  ensureDateRangeLoaded,
  getCloudSyncStatus,
  getRequirementSyncState,
  connectCloudSyncWithGoogle,
  processPendingSyncQueue,
  subscribeToDataChanges,
} from '../services/storageService';
import { consolidarParaderos, exportarRequerimientoIndividualExcel } from '../services/excelExportService';
import { getHorarioDisplay } from '../data/masterData';
import { MasterDataManagementScreen } from './MasterDataManagementScreen';
import { PowerBIAnalyticsView } from './PowerBIAnalyticsView';
import { ScheduleGeneratorScreen } from './ScheduleGeneratorScreen';
import { NewRequirementWizard } from './NewRequirementWizard';
import { UserManagementScreen } from './UserManagementScreen';
import { SupervisorParaderosModal } from './SupervisorParaderosModal';
import { ExportExcelOptionsModal } from './ExportExcelOptionsModal';
import { getPublicAssetUrl } from './CamposolLogo';

interface AdminPortalLayoutProps {
  requerimientos: Requerimiento[];
  onRefreshData: () => void;
  onOpenRequirementDetail: (req: Requerimiento) => void;
  onNewRequirement?: () => void;
  onOpenMasters?: () => void;
  onOpenDatabaseModal: () => void;
  onOpenAnalytics?: () => void;
  onSwitchToUserRole?: () => void;
  userRole?: UserRole;
  currentUser?: AppUser;
  onLogout?: () => void;
  onOpenRoleSwitcher?: () => void;
}

type AdminSection = 'procesos' | 'historial' | 'generador' | 'maestros' | 'reportes' | 'base-datos' | 'nuevo' | 'usuarios';

// Helper date functions for daily operational filtering (YYYY-MM-DD)
const getTodayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Formatear hora de registro de solicitud (ej. 02:30:15 p. m.)
const formatHoraRegistro = (fechaIso?: string): string => {
  if (!fechaIso) return '';
  try {
    const hasTimePart = fechaIso.includes('T') || fechaIso.includes(':');
    if (!hasTimePart) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

// Formato de hora limpio y compacto para la tabla (ej. 11:15 AM)
const formatHoraSimple = (fechaIso?: string): string => {
  if (!fechaIso) return '';
  try {
    const hasTimePart = fechaIso.includes('T') || fechaIso.includes(':');
    if (!hasTimePart) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  } catch {
    return '';
  }
};

export const AdminPortalLayout: React.FC<AdminPortalLayoutProps> = ({
  requerimientos,
  onRefreshData,
  onOpenRequirementDetail,
  onNewRequirement,
  onOpenMasters,
  onOpenDatabaseModal,
  onOpenAnalytics,
  onSwitchToUserRole,
  userRole = 'admin',
  currentUser,
  onLogout,
  onOpenRoleSwitcher,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSection, setCurrentSection] = useState<AdminSection>('procesos');

  // Operational Filters State: Default to TODAY ("del día")
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>(getTodayStr);
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>(getTodayStr);
  const [filterArea, setFilterArea] = useState<string>('TODAS');
  const [filterFundo, setFilterFundo] = useState<string>('TODOS');
  const [filterSupervisor, setFilterSupervisor] = useState<string>('TODOS');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [filterMovimiento, setFilterMovimiento] = useState<string>('TODOS');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Paginación de alto rendimiento para soportar 200+ registros diarios
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50); // 25, 50, 100, 200, -1 (Todos)

  // Reset page whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filterFechaDesde,
    filterFechaHasta,
    filterArea,
    filterFundo,
    filterSupervisor,
    filterEstado,
    filterMovimiento,
    searchKeyword,
    pageSize,
  ]);

  // Cargar fechas históricas bajo demanda (SQLite / Firestore) cuando se consultan días anteriores o "Todo"
  useEffect(() => {
    void ensureDateRangeLoaded(filterFechaDesde || undefined, filterFechaHasta || undefined);
  }, [filterFechaDesde, filterFechaHasta]);

  // Selected row IDs for batch actions
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(() => getCloudSyncStatus());
  const [reqToDelete, setReqToDelete] = useState<Requerimiento | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Estados para resumen de paraderos y exportación a Excel
  const [expandedReqIds, setExpandedReqIds] = useState<string[]>([]);
  const [supervisorModalReq, setSupervisorModalReq] = useState<Requerimiento | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedReqId, setCopiedReqId] = useState<string | null>(null);
  const [showFiltersBar, setShowFiltersBar] = useState<boolean>(true);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    const refreshCloud = () => setCloudStatus(getCloudSyncStatus());
    refreshCloud();
    return subscribeToDataChanges(refreshCloud);
  }, []);

  const areas = useMemo(() => getStoredAreas(), []);
  const fundos = useMemo(() => getStoredFundos(), []);

  // Distinct supervisors from actual requirements, sorted alphabetically
  const supervisoresList = useMemo(() => {
    const set = new Set<string>();
    requerimientos.forEach((r) => {
      if (r.id?.startsWith('req-uuid-')) return;
      if (r.usuario) set.add(r.usuario);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requerimientos]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const toggleExpandReq = (id: string) => {
    setExpandedReqIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCopyReqSummary = (req: Requerimiento) => {
    const details = getDetallesByRequerimientoId(req.id);
    const agrupados = consolidarParaderos(details);
    const surList = agrupados.filter((p) => p.zona === 'SUR');
    const norteList = agrupados.filter((p) => p.zona === 'NORTE');
    const totalSur = surList.reduce((acc, p) => acc + p.totalPersonas, 0);
    const totalNorte = norteList.reduce((acc, p) => acc + p.totalPersonas, 0);
    const totalGen = agrupados.reduce((acc, p) => acc + p.totalPersonas, 0);
    const horarioReq = getHorarioDisplay(req);

    let text = `🚌 *RESUMEN DE TRANSPORTE - CAMPOSOL*\n`;
    text += `📋 *Requerimiento:* ${req.numeroRequerimiento}\n`;
    text += `👤 *Supervisor:* ${req.usuario || 'Supervisor'}\n`;
    text += `📅 *Fecha:* ${req.fecha} | *Turno:* ${horarioReq.textoTurnoHeader}\n`;
    text += `🏢 *Área:* ${req.area} | *Fundo:* ${req.fundo}\n`;
    text += `🔄 *Movimiento:* ${req.movimiento}\n`;
    text += `👥 *Total Solicitado:* ${totalGen} personas\n\n`;

    if (totalSur > 0) {
      text += `🟡 *ZONA SUR (${totalSur} personas - ${surList.length} paraderos${horarioReq.isIngreso && horarioReq.horaSur ? ` - Hora: ${horarioReq.horaSur}` : ''}):*\n`;
      surList.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.paradero}*: ${p.totalPersonas} pers.`;
        if (p.comedoresDetalle.length > 1) {
          text += ` [${p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}]`;
        }
        text += `\n`;
      });
      text += `  👉 *Subtotal Zona Sur: ${totalSur} personas*\n\n`;
    }

    if (totalNorte > 0) {
      text += `🔵 *ZONA NORTE (${totalNorte} personas - ${norteList.length} paraderos):*\n`;
      norteList.forEach((p, idx) => {
        text += `  ${idx + 1}. *${p.paradero}*: ${p.totalPersonas} pers.`;
        if (p.comedoresDetalle.length > 1) {
          text += ` [${p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}]`;
        }
        text += `\n`;
      });
      text += `  👉 *Subtotal Zona Norte: ${totalNorte} personas*\n\n`;
    }

    text += `📊 *TOTAL CONSOLIDADO:*\n`;
    text += `• Total Zona Sur: *${totalSur} personas* (${surList.length} paraderos)\n`;
    text += `• Total Zona Norte: *${totalNorte} personas* (${norteList.length} paraderos)\n`;
    text += `• Gran Total: *${totalGen} personas*\n`;

    if (req.observaciones) {
      text += `\n📝 *Observaciones:* ${req.observaciones}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedReqId(req.id);
    setTimeout(() => setCopiedReqId(null), 2500);
    showToast('¡Resumen de paraderos con subtotales Norte y Sur copiado para WhatsApp!');
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await processPendingSyncQueue(true);
      await syncWithServerDetailed(true);
      onRefreshData();
      const after = getCloudSyncStatus();
      setCloudStatus(after);
      if (after.state === 'Sincronizado') {
        showToast('Datos actualizados');
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleConnectGoogleCloud = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await connectCloudSyncWithGoogle();
      if (res.success) {
        await processPendingSyncQueue(true);
        onRefreshData();
        const after = getCloudSyncStatus();
        setCloudStatus(after);
        showToast(`Conectado a Firebase (${after.projectId}) como ${res.email}`);
      } else if (res.error) {
        showToast(res.error);
      }
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Filtered requirements calculation
  const filteredRequerimientos = useMemo(() => {
    return requerimientos.filter((r) => {
      // Ignorar requerimientos mock o ficticios
      if (r.id?.startsWith('req-uuid-')) return false;

      // Date range filter
      if (filterFechaDesde && r.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && r.fecha > filterFechaHasta) return false;

      // Dropdown filters
      if (filterArea !== 'TODAS' && r.area !== filterArea) return false;
      if (filterFundo !== 'TODOS' && r.fundo !== filterFundo) return false;
      if (filterSupervisor !== 'TODOS' && r.usuario !== filterSupervisor) return false;
      if (filterEstado === 'TODOS') {
        // En la bandeja de procesos activa, no mezclar los requerimientos anulados
        if (r.estado === 'ANULADO') return false;
      } else if (r.estado !== filterEstado) {
        return false;
      }
      if (filterMovimiento !== 'TODOS' && r.movimiento !== filterMovimiento) return false;

      // Keyword search (code, notes, user)
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchCode = r.numeroRequerimiento.toLowerCase().includes(q);
        const matchArea = r.area.toLowerCase().includes(q);
        const matchFundo = r.fundo.toLowerCase().includes(q);
        const matchUser = r.usuario.toLowerCase().includes(q);
        const matchObs = (r.observaciones || '').toLowerCase().includes(q);
        if (!matchCode && !matchArea && !matchFundo && !matchUser && !matchObs) {
          return false;
        }
      }

      return true;
    });
  }, [
    requerimientos,
    filterFechaDesde,
    filterFechaHasta,
    filterArea,
    filterFundo,
    filterSupervisor,
    filterEstado,
    filterMovimiento,
    searchKeyword,
  ]);

  // Requerimientos en el apartado exclusivo de Historial & Trazabilidad
  const historialRequerimientos = useMemo(() => {
    return requerimientos.filter((r) => {
      // Ignorar requerimientos mock o ficticios
      if (r.id?.startsWith('req-uuid-')) return false;

      // En este apartado se visualizan todos los requerimientos anulados o dados de baja
      if (r.estado !== 'ANULADO') return false;

      if (filterFechaDesde && r.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && r.fecha > filterFechaHasta) return false;
      if (filterArea !== 'TODAS' && r.area !== filterArea) return false;
      if (filterFundo !== 'TODOS' && r.fundo !== filterFundo) return false;
      if (filterSupervisor !== 'TODOS' && r.usuario !== filterSupervisor) return false;

      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchCode = r.numeroRequerimiento.toLowerCase().includes(q);
        const matchArea = r.area.toLowerCase().includes(q);
        const matchFundo = r.fundo.toLowerCase().includes(q);
        const matchUser = r.usuario.toLowerCase().includes(q);
        const matchMotivo = (r.motivoAnulacion || '').toLowerCase().includes(q);
        const matchObs = (r.observaciones || '').toLowerCase().includes(q);
        if (!matchCode && !matchArea && !matchFundo && !matchUser && !matchMotivo && !matchObs) {
          return false;
        }
      }
      return true;
    });
  }, [
    requerimientos,
    filterFechaDesde,
    filterFechaHasta,
    filterArea,
    filterFundo,
    filterSupervisor,
    searchKeyword,
  ]);

  const totalAnuladosCount = useMemo(() => {
    return requerimientos.filter((r) => r.estado === 'ANULADO').length;
  }, [requerimientos]);

  const handleRestoreFromHistory = (req: Requerimiento) => {
    updateRequerimientoEstado(
      req.id,
      'PENDIENTE',
      currentUser?.nombre || 'Administrador',
      'Restaurado a activo desde sección Historial & Trazabilidad'
    );
    showToast(`Requerimiento ${req.numeroRequerimiento} restaurado con éxito a la bandeja activa`);
    onRefreshData();
  };

  // Operational metrics for Torre de Control and KPI Cards
  const metrics = useMemo(() => {
    const total = filteredRequerimientos.length;
    const pendientes = filteredRequerimientos.filter((r) => r.estado === 'PENDIENTE').length;
    const aprobados = filteredRequerimientos.filter((r) => r.estado === 'APROBADO').length;
    const atendidos = filteredRequerimientos.filter((r) => r.estado === 'ATENDIDO').length;
    const rechazados = filteredRequerimientos.filter((r) => r.estado === 'RECHAZADO').length;
    const totalPasajeros = filteredRequerimientos.reduce((acc, curr) => acc + (curr.totalPersonas || 0), 0);

    return {
      total,
      pendientes,
      aprobados,
      atendidos,
      rechazados,
      totalPasajeros,
    };
  }, [filteredRequerimientos]);

  // Cálculos de Paginación para tabla de requerimientos
  const totalPages = useMemo(() => {
    if (pageSize === -1) return 1;
    return Math.ceil(filteredRequerimientos.length / pageSize) || 1;
  }, [filteredRequerimientos.length, pageSize]);

  // Asegurar que currentPage se mantenga dentro del rango válido
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRequerimientos = useMemo(() => {
    if (pageSize === -1) return filteredRequerimientos;
    const start = (currentPage - 1) * pageSize;
    return filteredRequerimientos.slice(start, start + pageSize);
  }, [filteredRequerimientos, currentPage, pageSize]);

  // Status label styling helper (Tipografía limpia con indicador sutil, sin cápsulas recargadas)
  const renderEstadoBadge = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B45309] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            PENDIENTE
          </span>
        );
      case 'APROBADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2F7D18] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#55A529] shrink-0" />
            APROBADO
          </span>
        );
      case 'ATENDIDO':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0082B3] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0082B3] shrink-0" />
            ATENDIDO
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#DC2626] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            RECHAZADO
          </span>
        );
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#DC2626] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            ANULADO
          </span>
        );
      case 'EN REVISIÓN':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
            EN REVISIÓN
          </span>
        );
    }
  };

  // Quick single-click status action
  const handleQuickStatusChange = (id: string, newEstado: EstadoRequerimiento) => {
    updateRequerimientoEstado(id, newEstado, currentUser?.nombre || 'Administrador');
    onRefreshData();
    showToast(`Requerimiento actualizado a ${newEstado}`);
  };

  // Batch action: Approve all selected
  const handleBatchApprove = () => {
    if (!selectedReqIds.length) return;
    selectedReqIds.forEach((id) => {
      updateRequerimientoEstado(id, 'APROBADO', currentUser?.nombre || 'Administrador');
    });
    setSelectedReqIds([]);
    onRefreshData();
    showToast(`${selectedReqIds.length} requerimientos aprobados con éxito`);
  };

  // Batch action: Mark all selected as Atendidos
  const handleBatchAtender = () => {
    if (!selectedReqIds.length) return;
    selectedReqIds.forEach((id) => {
      updateRequerimientoEstado(id, 'ATENDIDO', currentUser?.nombre || 'Administrador');
    });
    setSelectedReqIds([]);
    onRefreshData();
    showToast(`${selectedReqIds.length} requerimientos atendidos con éxito`);
  };

  // Single delete action
  const handleConfirmDelete = () => {
    if (!reqToDelete) return;
    const num = reqToDelete.numeroRequerimiento;
    deleteRequerimiento(reqToDelete.id, currentUser?.nombre || 'Administrador', 'Anulado desde la bandeja de transporte');
    setReqToDelete(null);
    onRefreshData();
    showToast(`Requerimiento ${num} anulado y guardado en historial para trazabilidad`);
  };

  // Batch action: Delete selected
  const handleBatchDelete = () => {
    if (!selectedReqIds.length) return;
    setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = () => {
    if (!selectedReqIds.length) return;
    const count = selectedReqIds.length;
    selectedReqIds.forEach((id) => {
      deleteRequerimiento(id, currentUser?.nombre || 'Administrador', 'Anulado en lote desde bandeja de transporte');
    });
    setSelectedReqIds([]);
    setShowBatchDeleteConfirm(false);
    onRefreshData();
    showToast(`${count} requerimientos anulados y guardados en el historial para trazabilidad`);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Si la página actual está paginada, seleccionamos los visibles de la página
      const pageIds = paginatedRequerimientos.map((r) => r.id);
      setSelectedReqIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      // Deseleccionamos los de la página actual
      const pageIds = new Set(paginatedRequerimientos.map((r) => r.id));
      setSelectedReqIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedReqIds(filteredRequerimientos.map((r) => r.id));
  };

  const handleClearSelection = () => {
    setSelectedReqIds([]);
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedReqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleResetFilters = () => {
    setFilterFechaDesde(getTodayStr());
    setFilterFechaHasta(getTodayStr());
    setFilterArea('TODAS');
    setFilterFundo('TODOS');
    setFilterSupervisor('TODOS');
    setFilterEstado('TODOS');
    setFilterMovimiento('TODOS');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  // Export current filtered table to CSV
  const handleExportFilteredCSV = () => {
    const data = filteredRequerimientos.map((r) => {
      const details = getDetallesByRequerimientoId(r.id);
      const paraderosSummary = details
        .map((d) => `${d.paradero} (${d.cantidad})`)
        .join(' | ');

      return {
        Codigo: r.numeroRequerimiento,
        Fecha: r.fecha,
        Area: r.area,
        Fundo: r.fundo,
        Movimiento: r.movimiento,
        Hora_Recojo: r.horaRecojo,
        Hora_Salida: r.horaSalida,
        Total_Personas: r.totalPersonas,
        Estado: r.estado,
        Supervisor_Usuario: r.usuario,
        Observaciones: r.observaciones,
        Paraderos_Detalle: paraderosSummary,
        Fecha_Registro: r.fechaRegistro,
        Hora_Registro: formatHoraRegistro(r.fechaRegistro) || '',
      };
    });

    exportToCSV(`CAMPOSOL_Reporte_Transporte_${new Date().toISOString().slice(0, 10)}.csv`, data);
    showToast('Reporte exportado exitosamente a CSV');
  };

  // SEGURIDAD: Impedir acceso de rol USUARIO a la interfaz administrativa
  if (userRole === 'usuario') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-3 py-1 rounded-full">
            Seguridad CAMPOSOL
          </span>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">ACCESO NO AUTORIZADO</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Su perfil actual es <strong>USUARIO / SOLICITANTE</strong>. No cuenta con permisos para acceder al sistema administrativo.
          </p>
          <button
            onClick={onSwitchToUserRole}
            className="w-full py-3 bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] text-white font-black rounded-2xl text-xs uppercase shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Regresar a mi pantalla principal</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white text-[#1E293B] overflow-hidden font-sans">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-[#1B3A57] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border border-[#459712]/50 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#7CD64B] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TOP CORPORATE HEADER BAR (Camposol | TDP – Transporte de Personal) */}
      {/* ------------------------------------------------------------- */}
      <header className="h-14 bg-white border-b-2 border-[#3E8E11] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setCurrentSection('procesos')}
            className="flex items-center gap-2 focus:outline-none cursor-pointer shrink-0"
            title="Ir a Requerimientos"
          >
            <img
              src={getPublicAssetUrl('camposol-emblem.png')}
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('.svg')) {
                  target.src = getPublicAssetUrl('camposol-emblem.svg');
                }
              }}
              alt="Camposol"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-contain shrink-0"
            />
            <span className="text-lg font-extrabold tracking-tight text-[#156C22] leading-none">
              Camposol<sup className="text-[10px] font-bold ml-0.5">®</sup>
            </span>
          </button>

          <div className="h-6 w-px bg-slate-300 hidden sm:block shrink-0" aria-hidden="true" />

          <span className="text-sm sm:text-base font-semibold text-[#1E293B] tracking-tight truncate hidden sm:block">
            TDP – Transporte de Personal
          </span>
        </div>

        {/* Right Header Controls: Cloud, Sync, Notifications & User Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="header-cloud-status-btn"
            type="button"
            onClick={() => {
              if (!cloudStatus.firebaseConnected) {
                void handleConnectGoogleCloud();
              } else {
                void handleManualSync();
              }
            }}
            disabled={isConnectingGoogle || isManualSyncing}
            title={
              cloudStatus.lastError ||
              (cloudStatus.firebaseConnected
                ? `Sincronizado (${cloudStatus.projectId})`
                : `Conectar con Google Cloud Firestore (${cloudStatus.projectId})`)
            }
            aria-label={cloudStatus.state === 'Sincronizado' ? 'En línea' : 'Sin sincronizar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-60"
          >
            <span
              className={`w-2.5 h-2.5 rounded-full block ${
                isConnectingGoogle || isManualSyncing
                  ? 'animate-pulse bg-amber-500'
                  : cloudStatus.state === 'Sincronizado'
                  ? 'bg-[#459712]'
                  : 'bg-[#DC2626]'
              }`}
            />
          </button>

          <button
            id="header-sync-btn"
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#3E8E11] hover:bg-slate-100 transition-colors cursor-pointer ${
              isManualSyncing ? 'animate-spin text-[#3E8E11]' : ''
            }`}
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            id="header-notification-btn"
            type="button"
            onClick={() => {
              setFilterEstado('PENDIENTE');
              setCurrentSection('procesos');
              showToast(`Filtrando ${metrics.pendientes} requerimientos pendientes`);
            }}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-[#1E293B] hover:bg-slate-100 transition-colors cursor-pointer"
            title={`${metrics.pendientes} requerimientos pendientes de atención`}
            aria-label="Notificaciones pendientes"
          >
            <Bell className="w-4.5 h-4.5" />
            {metrics.pendientes > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" aria-hidden="true" />

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              aria-expanded={userMenuOpen}
            >
              <div className="w-8 h-8 rounded-full bg-[#E9F5E1] text-[#3E8E11] flex items-center justify-center shrink-0 border border-[#C6E5B1]">
                {userRole === 'receptor' ? (
                  <Inbox className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#1E293B] hidden sm:block max-w-[190px] truncate">
                {currentUser?.nombre ||
                  (userRole === 'receptor' ? 'Receptor Operativo' : 'Administrador')}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-11 w-56 bg-white rounded-xl border border-[#DCE2E8] shadow-xl py-2 z-50">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-[#1E293B] truncate">
                    {currentUser?.nombre || 'Administrador'}
                  </div>
                  <div className="text-[11px] text-[#3E8E11] font-medium">
                    @{currentUser?.usuario || (userRole === 'receptor' ? 'receptor' : 'admin')} ·{' '}
                    {userRole === 'receptor' ? 'RECEPTOR' : 'ADMIN'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    void handleManualSync();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-[#F7FBF3] hover:text-[#2F7D18] flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sincronizar ahora</span>
                </button>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* SHELL BODY: LEFT SIDEBAR + WORKSPACE                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside
          className={`bg-[#F7F8FA] border-r border-[#E2E8F0] flex flex-col justify-between transition-all duration-200 shrink-0 z-30 ${
            sidebarCollapsed ? 'w-16' : 'w-56'
          }`}
        >
          <div className="flex flex-col min-h-0">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between px-4'} pt-3 pb-1`}>
              {!sidebarCollapsed && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Menú
                </span>
              )}
              <button
                id="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#1E293B] hover:bg-white transition-colors cursor-pointer"
                title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
                aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <nav className="px-2.5 py-2 space-y-1 text-[13px] font-medium">
              {/* Requerimientos (Procesos) */}
              <button
                id="menu-procesos"
                onClick={() => setCurrentSection('procesos')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  currentSection === 'procesos'
                    ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                    : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                }`}
                title="Recepción de Requerimientos"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Requerimientos</span>}
                </div>
                {!sidebarCollapsed && metrics.pendientes > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
                      currentSection === 'procesos'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#FFF6E0] text-[#B45309]'
                    }`}
                  >
                    {metrics.pendientes}
                  </span>
                )}
              </button>

              {/* Programación */}
              <button
                id="menu-generador-programacion"
                onClick={() => setCurrentSection('generador')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left cursor-pointer ${
                  currentSection === 'generador'
                    ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                    : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                }`}
                title="Generador de programación por paraderos y zonas"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Bus className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Programación</span>}
                </div>
              </button>

              {/* Reportes */}
              <button
                id="menu-reportes"
                onClick={() => {
                  setCurrentSection('reportes');
                  if (onOpenAnalytics) onOpenAnalytics();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  currentSection === 'reportes'
                    ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                    : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                }`}
                title="Reportes y Analítica"
              >
                <BarChart2 className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Reportes</span>}
              </button>

              {/* Maestros */}
              {userRole === 'admin' && (
                <button
                  id="menu-datos-maestros"
                  onClick={() => {
                    setCurrentSection('maestros');
                    if (onOpenMasters) onOpenMasters();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    currentSection === 'maestros'
                      ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                      : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                  }`}
                  title="Datos maestros (Paraderos, Fundos, Áreas)"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Maestros</span>}
                </button>
              )}

              {/* Usuarios */}
              {userRole === 'admin' && (
                <button
                  id="menu-gestion-usuarios"
                  onClick={() => setCurrentSection('usuarios')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    currentSection === 'usuarios'
                      ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                      : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                  }`}
                  title="Gestión de Usuarios, Roles y Permisos"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Usuarios</span>}
                </button>
              )}

              {/* Historial */}
              <button
                id="menu-historial-trazabilidad"
                onClick={() => setCurrentSection('historial')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left cursor-pointer ${
                  currentSection === 'historial'
                    ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                    : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                }`}
                title="Historial de Requerimientos & Auditoría de Anulaciones"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <History className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Historial</span>}
                </div>
                {!sidebarCollapsed && totalAnuladosCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
                      currentSection === 'historial'
                        ? 'bg-white/20 text-white'
                        : 'bg-[#FDECEC] text-[#DC2626]'
                    }`}
                  >
                    {totalAnuladosCount}
                  </span>
                )}
              </button>

              {/* Base de datos */}
              {userRole === 'admin' && (
                <button
                  id="menu-base-datos"
                  onClick={() => {
                    onOpenDatabaseModal();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    currentSection === 'base-datos'
                      ? 'bg-gradient-to-r from-[#50A01B] to-[#3A840D] text-white font-semibold shadow-xs'
                      : 'text-[#1E293B] hover:bg-white hover:text-[#2F7D18]'
                  }`}
                  title="Base de datos y respaldos JSON/CSV"
                >
                  <Database className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">Base de datos</span>}
                </button>
              )}
            </nav>
          </div>

          {/* Sidebar Bottom Actions: Nuevo Requerimiento + Cerrar Sesión */}
          <div className="p-2.5 border-t border-[#E2E8F0] space-y-1">
            <button
              id="menu-nuevo-requerimiento"
              onClick={() => setCurrentSection('nuevo')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                currentSection === 'nuevo'
                  ? 'bg-[#459712] text-white'
                  : 'text-[#2F7D18] hover:bg-white'
              }`}
              title="Registrar nuevo requerimiento"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Nuevo Req.</span>}
            </button>

            {onLogout && (
              <button
                id="sidebar-logout-btn"
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[#1E293B] hover:text-red-600 hover:bg-red-50/70 transition-colors cursor-pointer"
                title="Cerrar sesión actual"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Cerrar Sesión</span>}
              </button>
            )}
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-white px-5 sm:px-8 py-6 space-y-5">
          {/* Page Title & Primary CTA Row */}
          {currentSection !== 'maestros' && currentSection !== 'reportes' && currentSection !== 'usuarios' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[#1A1F24] tracking-tight leading-tight">
                  {currentSection === 'procesos' && 'Recepción de Requerimientos'}
                  {currentSection === 'historial' && 'Historial de Requerimientos'}
                  {currentSection === 'generador' && 'Generación de Programación'}
                  {currentSection === 'base-datos' && 'Base de datos'}
                  {currentSection === 'nuevo' && 'Nuevo Requerimiento'}
                </h1>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {currentSection === 'procesos' && (
                  <>
                    <button
                      id="btn-export-excel-header"
                      type="button"
                      onClick={() => setShowExportModal(true)}
                      className="h-10 px-3.5 bg-white hover:bg-[#F7FBF3] border border-[#CBD5E1] text-[#2F7D18] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Exportar a Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Exportar Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={onNewRequirement}
                      className="h-10 px-4 bg-[#459712] hover:bg-[#387D0E] text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Nuevo Requerimiento</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Sub-view: Historial & Trazabilidad (Otro apartado para bajas y auditoría) */}
          {currentSection === 'historial' && (
            <div className="space-y-4">
              {/* Header Banner del Historial */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#FDECEC] text-[#DC2626] flex items-center justify-center shrink-0 border border-[#FECACA]">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-bold text-[#1E293B] tracking-tight">
                        Trazabilidad & Auditoría de Bajas
                      </h2>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#FDECEC] text-[#DC2626] border border-[#FECACA]">
                        Apartado de bajas & días
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                      En este apartado se almacenan de forma permanente los requerimientos cancelados o eliminados. Los datos de personas, fundos y paraderos se preservan intactos para auditoría histórica y trazabilidad operativa.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCurrentSection('procesos')}
                    className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Volver a Requerimientos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportToCSV(
                        'historial_trazabilidad_camposol.csv',
                        historialRequerimientos as unknown as Record<string, unknown>[]
                      )
                    }
                    disabled={historialRequerimientos.length === 0}
                    className="h-9 px-4 rounded-lg bg-[#459712] hover:bg-[#387D0E] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar historial</span>
                  </button>
                </div>
              </div>

              {/* KPI Strip del Historial */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Total en Historial</span>
                    <History className="w-4 h-4 text-[#DC2626]" />
                  </div>
                  <div className="text-xl font-bold text-[#DC2626] mt-1 tabular-nums">
                    {historialRequerimientos.length}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Requerimientos dados de baja</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Personas Preservadas</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-[#1E293B] mt-1 tabular-nums">
                    {historialRequerimientos.reduce((a, b) => a + (b.totalPersonas || 0), 0)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Pasajeros registrados en historial</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Días de Servicio</span>
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xl font-bold text-[#1E293B] mt-1 tabular-nums">
                    {new Set(historialRequerimientos.map((r) => r.fecha)).size}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Días con registros históricos</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                    <span>Trazabilidad</span>
                    <ShieldCheck className="w-4 h-4 text-[#2F7D18]" />
                  </div>
                  <div className="text-xl font-bold text-[#2F7D18] mt-1 tabular-nums">
                    100%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Auditoría activa y sincronizada</div>
                </div>
              </div>

              {/* Filtros para el Historial */}
              <div className="bg-white rounded-xl p-4 border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs items-end">
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1.5">
                      Fecha desde
                    </label>
                    <input
                      type="date"
                      value={filterFechaDesde}
                      onChange={(e) => setFilterFechaDesde(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1.5">
                      Fecha hasta
                    </label>
                    <input
                      type="date"
                      value={filterFechaHasta}
                      onChange={(e) => setFilterFechaHasta(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1.5">
                      Fundo
                    </label>
                    <select
                      value={filterFundo}
                      onChange={(e) => setFilterFundo(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="TODOS">Todos</option>
                      {fundos.map((f) => (
                        <option key={f.fundo} value={f.fundo}>
                          {f.fundo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1.5">
                      Área
                    </label>
                    <select
                      value={filterArea}
                      onChange={(e) => setFilterArea(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="TODAS">Todas</option>
                      {areas.map((a) => (
                        <option key={a.area} value={a.area}>
                          {a.area}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-1.5">
                      Buscar
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Palabra clave"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full h-10 pl-3 pr-9 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] placeholder-slate-400 focus:border-[#459712] focus:outline-none transition-colors"
                      />
                      <Search className="w-4 h-4 text-[#459712] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        exportToCSV(
                          'historial_trazabilidad_camposol.csv',
                          historialRequerimientos as unknown as Record<string, unknown>[]
                        )
                      }
                      disabled={historialRequerimientos.length === 0}
                      className="h-10 px-3 rounded-lg bg-[#459712] hover:bg-[#387D0E] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Exportar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFechaDesde('');
                        setFilterFechaHasta('');
                        setFilterArea('TODAS');
                        setFilterFundo('TODOS');
                        setFilterSupervisor('TODOS');
                        setSearchKeyword('');
                      }}
                      className="h-10 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors cursor-pointer"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de Registros en Historial */}
              <div className="bg-white rounded-xl border border-[#DCE2E8] overflow-hidden">
                {historialRequerimientos.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#FDECEC] text-[#DC2626] flex items-center justify-center mx-auto">
                      <History className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#1E293B]">
                      No hay requerimientos en el historial con estos filtros
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Cuando un usuario o administrador anule un requerimiento de la programación diaria, quedará almacenado en este apartado con todos sus datos y trazabilidad.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#E3F1D8] text-[#1E293B] font-semibold text-xs border-b border-[#CFE3C0]">
                        <tr>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Código</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Fecha Servicio</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Fundo / Área</th>
                          <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Personas</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Solicitante</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Estado</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Baja / Auditoría</th>
                          <th className="py-2.5 px-3.5 whitespace-nowrap">Motivo Anulación</th>
                          <th className="py-2.5 px-3.5 text-center whitespace-nowrap border-l border-[#D4E9F7]/70">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historialRequerimientos.map((req) => (
                          <tr key={req.id} className="hover:bg-[#F7FBFE] transition-colors">
                            <td className="py-2.5 px-3.5 font-semibold text-[#1B3A57] whitespace-nowrap">
                              <span className="bg-slate-100 text-[#1B3A57] px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                                {req.numeroRequerimiento}
                              </span>
                              {formatHoraSimple(req.fechaRegistro) && (
                                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1 whitespace-nowrap">
                                  <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>{formatHoraSimple(req.fechaRegistro)}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                              {req.fecha}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-[#1B3A57]">{req.fundo}</div>
                              <div className="text-[10px] text-slate-500">{req.area}</div>
                            </td>
                            <td className="py-2.5 px-3.5 text-center font-semibold text-[#DC2626] whitespace-nowrap">
                              {req.totalPersonas} pax
                            </td>
                            <td className="py-2.5 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                              {req.usuario}
                            </td>
                            <td className="py-2.5 px-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDECEC] text-[#DC2626] border border-[#FECACA]">
                                <XCircle className="w-3 h-3 text-[#DC2626]" />
                                <span>Anulado</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-[11px] whitespace-nowrap text-slate-600">
                              {req.fechaAnulacion ? (
                                <div>
                                  <div className="font-semibold text-[#DC2626]">
                                    {new Date(req.fechaAnulacion).toLocaleString('es-PE')}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Por: {req.usuarioAnulacion || 'Administrador'}
                                  </div>
                                </div>
                              ) : (
                                <span className="italic text-slate-400">Registrado en histórico</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-[11px] text-slate-600 max-w-[200px] truncate" title={req.motivoAnulacion || ''}>
                              {req.motivoAnulacion || 'Anulado de la programación diaria'}
                            </td>
                            <td className="py-2.5 px-3.5 text-center border-l border-slate-100 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenRequirementDetail(req)}
                                  className="p-1.5 rounded-full text-[#3D8B1C] hover:bg-[#EAF7E4] transition-colors cursor-pointer"
                                  title="Ver detalle completo de paraderos y trazabilidad"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreFromHistory(req)}
                                  className="px-2.5 py-1 rounded-full bg-[#EAF7E4] hover:bg-[#d8f1cc] text-[#2F7D18] border border-[#C6E9B4] text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Restaurar este requerimiento a la bandeja activa de procesos"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Restaurar</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-view: Maestros (Solo Administrador) */}
          {currentSection === 'maestros' && (
            userRole !== 'admin' ? (
              <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-xs text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-red-600 uppercase">ACCESO NO AUTORIZADO</h3>
                <p className="text-xs text-gray-600 max-w-md mx-auto">
                  La configuración de datos maestros está reservada exclusivamente para el Administrador del Sistema.
                </p>
                <button
                  onClick={() => setCurrentSection('procesos')}
                  className="px-4 py-2 bg-[#00843D] text-white rounded-xl text-xs font-bold uppercase hover:bg-[#006e33]"
                >
                  Volver a Procesos
                </button>
              </div>
            ) : (
              <div>
                <MasterDataManagementScreen
                  onBack={() => setCurrentSection('procesos')}
                  onNavigateToNewRequest={() => setCurrentSection('nuevo')}
                />
              </div>
            )
          )}

          {/* Sub-view: Reportes */}
          {currentSection === 'reportes' && (
            <div>
              <PowerBIAnalyticsView
                requerimientos={requerimientos}
                onBack={() => setCurrentSection('procesos')}
                onRefreshParent={onRefreshData}
              />
            </div>
          )}

          {/* Sub-view: Generador de Programación */}
          {currentSection === 'generador' && (
            <div>
              <ScheduleGeneratorScreen
                requerimientos={requerimientos}
                onRefreshData={onRefreshData}
                currentUser={currentUser}
              />
            </div>
          )}

          {/* Sub-view: Nuevo Requerimiento */}
          {currentSection === 'nuevo' && (
            <div className="bg-white rounded-2xl p-6 border border-[#E5ECF2] shadow-xs">
              <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  onClick={() => setCurrentSection('procesos')}
                  className="text-xs font-semibold text-slate-600 hover:text-[#2F7D18] flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#F3F8F0] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Volver a Procesos</span>
                </button>
                <span className="text-xs font-bold text-[#1B3A57]">
                  Nuevo Requerimiento (Gestión Central)
                </span>
              </div>
              <NewRequirementWizard
                onCancel={() => setCurrentSection('procesos')}
                currentUser={currentUser}
                onSuccess={() => {
                  onRefreshData();
                  showToast('¡Requerimiento registrado con éxito en la web!');
                  setCurrentSection('procesos');
                }}
                onViewRequirement={(req) => {
                  onOpenRequirementDetail(req);
                  setCurrentSection('procesos');
                }}
              />
            </div>
          )}

          {/* Sub-view: Gestión de Usuarios (Solo Administrador) */}
          {currentSection === 'usuarios' && (
            userRole !== 'admin' ? (
              <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-xs text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-red-600 uppercase">ACCESO NO AUTORIZADO</h3>
                <p className="text-xs text-gray-600 max-w-md mx-auto">
                  La gestión de usuarios y asignación de permisos está reservada exclusivamente para el Administrador del Sistema.
                </p>
                <button
                  onClick={() => setCurrentSection('procesos')}
                  className="px-4 py-2 bg-[#00843D] text-white rounded-xl text-xs font-bold uppercase hover:bg-[#006e33]"
                >
                  Volver a Procesos
                </button>
              </div>
            ) : (
              <div>
                {currentUser && (
                  <UserManagementScreen currentAdminUser={currentUser} />
                )}
              </div>
            )
          )}

          {/* Sub-view: Procesos (Table + KPIs + Filters) */}
          {currentSection === 'procesos' && (
            <>
          {/* Top KPI Metrics Strip */}
          <div className="bg-white rounded-xl border border-[#DCE2E8] shadow-[0_1px_2px_rgba(15,23,42,0.03)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#EEF2F6]">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Solicitudes</div>
                <div className="text-lg font-bold text-[#1E293B] tabular-nums leading-tight mt-0.5">{metrics.total}</div>
              </div>
              <Layers className="w-4 h-4 text-slate-300 shrink-0" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Pendientes</div>
                <div className="text-lg font-bold text-[#B45309] tabular-nums leading-tight mt-0.5">{metrics.pendientes}</div>
              </div>
              <Clock className="w-4 h-4 text-amber-400/70 shrink-0" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Aprobados</div>
                <div className="text-lg font-bold text-[#2F7D18] tabular-nums leading-tight mt-0.5">{metrics.aprobados}</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#459712]/70 shrink-0" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Atendidos</div>
                <div className="text-lg font-bold text-[#0F766E] tabular-nums leading-tight mt-0.5">{metrics.atendidos}</div>
              </div>
              <CheckCheck className="w-4 h-4 text-[#0F766E]/70 shrink-0" />
            </div>

            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Total Personal</div>
                <div className="text-lg font-bold text-[#1E293B] tabular-nums leading-tight mt-0.5">{metrics.totalPasajeros}</div>
              </div>
              <Users className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* PANEL DE FILTROS ESTILO CORPORATIVO CAMPOSOL                  */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-xl border border-[#DCE2E8] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* Fecha Desde */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#334155] mb-1.5">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={filterFechaDesde}
                  onChange={(e) => setFilterFechaDesde(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors"
                />
              </div>

              {/* Fecha Hasta */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#334155] mb-1.5">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={filterFechaHasta}
                  onChange={(e) => setFilterFechaHasta(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors"
                />
              </div>

              {/* Área */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#334155] mb-1.5">
                  Área
                </label>
                <select
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="TODAS">Todas</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.area}>
                      {a.area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fundo */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#334155] mb-1.5">
                  Fundo
                </label>
                <select
                  value={filterFundo}
                  onChange={(e) => setFilterFundo(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  {fundos.map((f) => (
                    <option key={f.id} value={f.fundo}>
                      {f.fundo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-[#334155] mb-1.5">
                  Estado
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="EN REVISIÓN">EN REVISIÓN</option>
                  <option value="APROBADO">APROBADO</option>
                  <option value="ATENDIDO">ATENDIDO</option>
                  <option value="RECHAZADO">RECHAZADO</option>
                  <option value="ANULADO">ANULADO (Historial)</option>
                </select>
              </div>

              {/* Botón Buscar Verde Principal */}
              <div className="lg:col-span-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void ensureDateRangeLoaded(
                      filterFechaDesde || undefined,
                      filterFechaHasta || undefined
                    );
                    onRefreshData();
                  }}
                  className="w-full h-10 px-4 bg-[#459712] hover:bg-[#387D0E] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </button>
              </div>
            </div>

            {/* Fila Secundaria Compacta: Solicitante, Palabra clave + Presets rápidos */}
            {showFiltersBar && (
              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={filterSupervisor}
                    onChange={(e) => setFilterSupervisor(e.target.value)}
                    aria-label="Filtrar por solicitante"
                    className="h-9 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] focus:border-[#459712] focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="TODOS">Solicitante: Todos</option>
                    {supervisoresList.map((sup) => (
                      <option key={sup} value={sup}>
                        {sup}
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="Buscar código, paradero..."
                      className="w-52 sm:w-60 h-9 pl-3 pr-8 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#1E293B] placeholder-slate-400 focus:border-[#459712] focus:outline-none transition-colors"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-0.5 bg-[#F4F6F8] border border-[#DCE2E8] rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        const hoy = getTodayStr();
                        setFilterFechaDesde(hoy);
                        setFilterFechaHasta(hoy);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                          ? 'bg-[#459712] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ayer = getYesterdayStr();
                        setFilterFechaDesde(ayer);
                        setFilterFechaHasta(ayer);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        filterFechaDesde === getYesterdayStr() && filterFechaHasta === getYesterdayStr()
                          ? 'bg-[#459712] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ayer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const manana = getTomorrowStr();
                        setFilterFechaDesde(manana);
                        setFilterFechaHasta(manana);
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        filterFechaDesde === getTomorrowStr() && filterFechaHasta === getTomorrowStr()
                          ? 'bg-[#459712] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterFechaDesde('');
                        setFilterFechaHasta('');
                      }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        !filterFechaDesde && !filterFechaHasta
                          ? 'bg-[#1E293B] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Todo
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition-colors cursor-pointer"
                  >
                    Restablecer
                  </button>
                </div>
              </div>
            )}

            {selectedReqIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                <span className="text-xs font-semibold text-[#2F7D18]">
                  {selectedReqIds.length} requerimiento{selectedReqIds.length !== 1 ? 's' : ''} seleccionado{selectedReqIds.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBatchApprove}
                    className="px-3.5 py-1.5 bg-[#459712] hover:bg-[#387D0E] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchAtender}
                    className="px-3.5 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Atender</span>
                  </button>
                  <button
                    id="btn-batch-delete"
                    type="button"
                    onClick={handleBatchDelete}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Anular</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* TABLA CORPORATIVA CON CABECERA VERDE SUAVE CAMPOSOL (#E3F1D8) */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-xl border border-[#DCE2E8] overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-330px)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#E3F1D8] text-[#1E293B] font-semibold text-xs border-b border-[#CFE3C0]">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={
                          paginatedRequerimientos.length > 0 &&
                          paginatedRequerimientos.every((r) => selectedReqIds.includes(r.id))
                        }
                        className="rounded-sm border-slate-300 text-[#459712] focus:ring-[#459712]"
                      />
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">N° Req.</th>
                    <th className="py-3 px-3 whitespace-nowrap">Fecha</th>
                    <th className="py-3 px-3 whitespace-nowrap">Paraderos</th>
                    <th className="py-3 px-3 whitespace-nowrap">Área</th>
                    <th className="py-3 px-3 whitespace-nowrap">Fundo</th>
                    <th className="py-3 px-3 whitespace-nowrap">Movimiento</th>
                    <th className="py-3 px-3 whitespace-nowrap">Horas</th>
                    <th className="py-3 px-3 whitespace-nowrap">Personal</th>
                    <th className="py-3 px-3 whitespace-nowrap">Solicitante</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Estado</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap border-l border-[#CFE3C0]/70">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[#EEF2F6] text-xs font-normal text-[#334155]">
                  {filteredRequerimientos.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-gray-500">
                        <Inbox className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <span className="block font-semibold text-[#1E293B] text-xs">
                          {filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                            ? `No hay requerimientos programados para el día de hoy (${getTodayStr()})`
                            : 'No se encontraron requerimientos con los filtros seleccionados'}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-1 block max-w-md mx-auto">
                          {filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                            ? 'Los registros de ayer o de otras fechas no se muestran por defecto a menos que se filtren específicamente.'
                            : 'Prueba cambiando o limpiando los filtros seleccionados.'}
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              const ayer = getYesterdayStr();
                              setFilterFechaDesde(ayer);
                              setFilterFechaHasta(ayer);
                            }}
                            className="px-3.5 py-1.5 bg-white text-[#009A44] hover:bg-emerald-50 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer border border-emerald-300"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Ver Requerimientos de Ayer ({getYesterdayStr()})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterFechaDesde('');
                              setFilterFechaHasta('');
                            }}
                            className="px-3.5 py-1.5 bg-white text-gray-600 hover:bg-gray-50 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer border border-gray-300"
                          >
                            <span>Ver Todo el Historial</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequerimientos.map((req) => {
                      const isSelected = selectedReqIds.includes(req.id);
                      const detalles = getDetallesByRequerimientoId(req.id);
                      const paraderosCount = detalles.length;
                      const reqSync = getRequirementSyncState(req.id);

                      return (
                        <React.Fragment key={req.id}>
                          <tr
                            className={`hover:bg-[#F7FBF3] transition-colors ${
                              isSelected ? 'bg-[#E3F1D8]/40' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(req.id)}
                                className="rounded-sm border-slate-300 text-[#55A529] focus:ring-[#55A529]"
                              />
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onOpenRequirementDetail(req)}
                                  className="text-[12px] font-medium text-[#1B3A57] hover:text-[#2F7D18] hover:underline transition-colors text-left whitespace-nowrap cursor-pointer"
                                  title={req.fechaRegistro ? `Registrado: ${req.fechaRegistro.slice(0, 10)} ${formatHoraSimple(req.fechaRegistro)}` : 'Ver detalle del requerimiento'}
                                >
                                  {req.numeroRequerimiento}
                                </button>
                                {formatHoraSimple(req.fechaRegistro) && (
                                  <span className="text-[11px] text-slate-400 tabular-nums">
                                    · {formatHoraSimple(req.fechaRegistro)}
                                  </span>
                                )}
                                <span
                                  title={reqSync.error || (reqSync.status === 'Sincronizado' ? 'En línea' : 'Sin sincronizar')}
                                  className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                                    reqSync.status === 'Sincronizado' ? 'bg-[#22A846]' : 'bg-[#DC2626]'
                                  }`}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                              <span className="text-[12px] font-normal text-[#334155]">{req.fecha}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => toggleExpandReq(req.id)}
                                className="text-[12px] font-normal text-[#334155] hover:text-[#2F7D18] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                title="Desplegar resumen por paradero"
                              >
                                <span>{paraderosCount} paradero{paraderosCount !== 1 ? 's' : ''}</span>
                                {expandedReqIds.includes(req.id) ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-[12px] font-normal text-[#334155]">{req.area}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-[12px] font-normal text-[#334155]">{req.fundo}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-[12px] font-normal text-[#334155] uppercase">
                                {req.movimiento}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                              <span className="text-[12px] font-normal text-[#334155]">
                                {(() => {
                                  const h = getHorarioDisplay(req);
                                  if (h.isIngreso) {
                                    return `N: ${h.horaNorte} | S: ${h.horaSur}`;
                                  }
                                  return h.horaNormal;
                                })()}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                              <span className="text-[12px] font-normal text-[#334155]">
                                {req.totalPersonas} pers.
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className="text-[12px] font-normal text-[#334155] block truncate max-w-[190px]"
                                title={req.observaciones ? `${req.usuario || 'Solicitante'} — ${req.observaciones}` : (req.usuario || 'Solicitante')}
                              >
                                {req.usuario || 'Solicitante'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {renderEstadoBadge(req.estado)}
                            </td>
                            <td className="py-3 px-3 border-l border-slate-100 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {/* Ver Detalle */}
                                <button
                                  onClick={() => onOpenRequirementDetail(req)}
                                  className="p-1.5 rounded-full text-[#3D8B1C] hover:bg-[#EAF7E4] transition-colors cursor-pointer"
                                  title="Ver detalles y desglose de paraderos"
                                  aria-label="Ver detalles"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Aprobar rápido */}
                                {req.estado !== 'APROBADO' && req.estado !== 'ATENDIDO' && (
                                  <button
                                    onClick={() => handleQuickStatusChange(req.id, 'APROBADO')}
                                    className="p-1.5 rounded-full text-[#2F7D18] hover:bg-[#EAF7E4] transition-colors cursor-pointer"
                                    title="Aprobar requerimiento"
                                    aria-label="Aprobar requerimiento"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Atender rápido */}
                                {req.estado === 'APROBADO' && (
                                  <button
                                    onClick={() => handleQuickStatusChange(req.id, 'ATENDIDO')}
                                    className="p-1.5 rounded-full text-[#0082B3] hover:bg-[#E6F3FB] transition-colors cursor-pointer"
                                    title="Marcar como atendido"
                                    aria-label="Marcar como atendido"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Eliminar / Anular requerimiento */}
                                <button
                                  id={`btn-eliminar-req-${req.id}`}
                                  onClick={() => setReqToDelete(req)}
                                  className="p-1.5 rounded-full text-amber-600 hover:text-[#DC2626] hover:bg-[#FDECEC] transition-colors cursor-pointer"
                                  title="Anular requerimiento"
                                  aria-label="Anular requerimiento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Fila expandible con resumen de paraderos para suma rápida */}
                          {expandedReqIds.includes(req.id) && (
                            <tr key={`expand-${req.id}`} className="bg-emerald-50/40 border-b-2 border-emerald-200 animate-in fade-in duration-150">
                              <td colSpan={12} className="p-3 sm:p-4">
                                <div className="bg-white rounded-2xl border border-emerald-200 shadow-xs p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#00843D] flex items-center justify-center font-bold">
                                        <User className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="text-xs font-black text-[#173B56] flex items-center gap-2">
                                          <span>Resumen por Paradero: {req.usuario || 'Supervisor'}</span>
                                          <span className="font-mono text-[#00843D] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                            {req.numeroRequerimiento}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-gray-500">
                                          {req.area} • {req.fundo} • {getHorarioDisplay(req).textoTurnoHeader} • Total: <strong className="text-[#00843D] font-black">{req.totalPersonas} personas</strong>
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyReqSummary(req)}
                                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                                        title="Copiar resumen para WhatsApp"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>{copiedReqId === req.id ? '¡Copiado!' : 'Copiar WhatsApp'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => exportarRequerimientoIndividualExcel(req, detalles)}
                                        className="px-2.5 py-1.5 bg-[#00843D] hover:bg-[#006e33] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                                        title="Descargar este requerimiento a Excel con números listos para sumar"
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        <span>Descargar en Excel</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSupervisorModalReq(req)}
                                        className="px-2.5 py-1.5 bg-[#173B56] hover:bg-[#122e43] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir resumen completo en ventana emergente"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Ver Detalle</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Grid de paraderos sumados con Subtotales por Zona */}
                                  {(() => {
                                    const agrupados = consolidarParaderos(detalles);
                                    if (agrupados.length === 0) {
                                      return (
                                        <p className="text-xs text-gray-400 italic py-2">
                                          No hay desglose de paraderos registrado para este requerimiento.
                                        </p>
                                      );
                                    }

                                    const surList = agrupados.filter((p) => p.zona === 'SUR');
                                    const norteList = agrupados.filter((p) => p.zona === 'NORTE');
                                    const totalSur = surList.reduce((acc, p) => acc + p.totalPersonas, 0);
                                    const totalNorte = norteList.reduce((acc, p) => acc + p.totalPersonas, 0);
                                    const totalGen = agrupados.reduce((acc, p) => acc + p.totalPersonas, 0);

                                    return (
                                      <div className="space-y-3">
                                         {/* Barra de Subtotales por Zona Limpia */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                                            <div className="flex items-center gap-1.5 font-bold">
                                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                                              <span>Zona Sur:</span>
                                            </div>
                                            <div className="font-mono">
                                              <strong className="text-sm font-black text-amber-950">{totalSur}</strong>{' '}
                                              <span className="text-[10px] text-amber-800">({surList.length} paraderos)</span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#E6F3FB] border border-[#D4E9F7] text-[#0082B3]">
                                            <div className="flex items-center gap-1.5 font-semibold">
                                              <span className="w-2 h-2 rounded-full bg-[#0082B3]" />
                                              <span>Zona Norte:</span>
                                            </div>
                                            <div className="font-mono">
                                              <strong className="text-sm font-bold text-[#1B3A57]">{totalNorte}</strong>{' '}
                                              <span className="text-[10px] text-[#0082B3]">({norteList.length} paraderos)</span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#EAF7E4] border border-[#C6E9B4] text-[#2F7D18]">
                                            <div className="flex items-center gap-1.5 font-semibold">
                                              <span className="w-2 h-2 rounded-full bg-[#55A529]" />
                                              <span>Total:</span>
                                            </div>
                                            <div className="font-mono">
                                              <strong className="text-sm font-bold text-[#2F7D18]">{totalGen}</strong>{' '}
                                              <span className="text-[10px] text-[#2F7D18]">({agrupados.length} paraderos)</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                          {agrupados.map((p, pIdx) => (
                                            <div
                                              key={pIdx}
                                              className={`p-2.5 rounded-xl border transition-colors ${
                                                p.zona === 'SUR'
                                                  ? 'bg-[#FFF6E0]/50 border-[#FDE68A] hover:border-amber-400'
                                                  : 'bg-[#E6F3FB]/50 border-[#D4E9F7] hover:border-[#0082B3]/40'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                                                <span className="font-semibold truncate max-w-[85px]" title={p.paradero}>
                                                  {p.paradero}
                                                </span>
                                                <span
                                                  className={`px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase ${
                                                    p.zona === 'SUR'
                                                      ? 'bg-[#FFF6E0] text-[#B45309] border border-[#FDE68A]'
                                                      : 'bg-[#E6F3FB] text-[#0082B3] border border-[#D4E9F7]'
                                                  }`}
                                                >
                                                  {p.zona}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between">
                                                <span className="text-base font-mono font-bold text-[#2F7D18]">
                                                  {p.totalPersonas}
                                                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">pers.</span>
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-500">{p.porcentaje}%</span>
                                              </div>
                                              {p.comedoresDetalle.length > 1 && (
                                                <div
                                                  className="text-[9px] text-slate-400 mt-1 truncate"
                                                  title={p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}
                                                >
                                                  {p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-100">
                                          <span>Totales agrupados de todos los comedores (clasificados por zona según catálogo maestro)</span>
                                          <div className="flex items-center gap-3">
                                            <span className="text-[#B45309] font-semibold">
                                              Sur: <strong>{totalSur}</strong> pers.
                                            </span>
                                            <span className="text-[#0082B3] font-semibold">
                                              Norte: <strong>{totalNorte}</strong> pers.
                                            </span>
                                            <span className="font-semibold text-[#1B3A57]">
                                              Suma Total:{' '}
                                              <strong className="text-[#2F7D18] font-bold text-xs">
                                                {totalGen} personas
                                              </strong>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra de Paginación de Requerimientos */}
            {filteredRequerimientos.length > 0 && (
              <div className="bg-white px-5 py-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                {/* Contador de registros */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-medium">
                    Mostrando{' '}
                    <strong className="text-[#1E293B] font-semibold">
                      {pageSize === -1 ? 1 : (currentPage - 1) * pageSize + 1}
                    </strong>{' '}
                    a{' '}
                    <strong className="text-[#1E293B] font-semibold">
                      {pageSize === -1
                        ? filteredRequerimientos.length
                        : Math.min(currentPage * pageSize, filteredRequerimientos.length)}
                    </strong>{' '}
                    de <strong className="text-[#2F7D18] font-semibold">{filteredRequerimientos.length}</strong> requerimientos
                    {selectedReqIds.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-md bg-[#E3F1D8] text-[#2F7D18] font-semibold text-[10px]">
                        {selectedReqIds.length} seleccionados
                      </span>
                    )}
                  </span>
                </div>

                {/* Controles de Paginación */}
                <div className="flex items-center gap-3">
                  {/* Selector de registros por página */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-2.5 py-1 bg-white border border-[#CBD5E1] rounded-lg font-medium text-[#1E293B] focus:outline-hidden focus:border-[#459712] text-[11px] cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={-1}>Todos ({filteredRequerimientos.length})</option>
                    </select>
                  </div>

                  {/* Botones de navegación */}
                  {pageSize !== -1 && totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Primera página"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                      </button>

                      <span className="px-3 py-1 font-semibold text-[#1E293B] bg-white rounded-lg border border-[#CBD5E1] text-[11px]">
                        Pág. {currentPage} de {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Página siguiente"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Última página"
                      >
                        <ChevronsRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal de confirmación de eliminación individual */}
          {reqToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5ECF2] p-6 overflow-hidden">
                <div className="flex items-center gap-3 text-[#DC2626] mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FDECEC] flex items-center justify-center shrink-0 border border-[#FECACA]">
                    <Trash2 className="w-6 h-6 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1B3A57]">
                      ¿Eliminar Requerimiento?
                    </h3>
                    <p className="text-xs text-[#DC2626] font-semibold">
                      {reqToDelete.numeroRequerimiento}
                    </p>
                  </div>
                </div>

                <div className="bg-[#EEF3F7] rounded-2xl p-3.5 mb-4 border border-[#E5ECF2] text-xs space-y-2 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Fecha:</span>
                    <span className="font-semibold text-[#1B3A57]">{reqToDelete.fecha}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Área / Fundo:</span>
                    <span className="font-semibold text-[#1B3A57]">{reqToDelete.area} - {reqToDelete.fundo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Personal:</span>
                    <span className="font-semibold text-[#1B3A57]">{reqToDelete.totalPersonas} personas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Supervisor:</span>
                    <span className="font-semibold text-[#1B3A57]">{reqToDelete.usuario}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-[#EAF7E4] p-3.5 rounded-xl border border-[#C6E9B4] text-xs text-[#2F7D18] mb-5">
                  <ShieldCheck className="w-4 h-4 text-[#55A529] shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Trazabilidad Garantizada:</strong> Al anular este requerimiento, quedará guardado permanentemente en el <strong>historial de los días</strong> con todos sus paraderos, cantidades y auditoría para que nunca se pierda el registro de la operación.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReqToDelete(null)}
                    className="px-4 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirm-delete-req"
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-full bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Anular y Guardar en Historial</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de confirmación de eliminación múltiple (Batch) */}
          {showBatchDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5ECF2] p-6 overflow-hidden">
                <div className="flex items-center gap-3 text-[#DC2626] mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FDECEC] flex items-center justify-center shrink-0 border border-[#FECACA]">
                    <Trash2 className="w-6 h-6 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1B3A57]">
                      ¿Anular {selectedReqIds.length} Requerimientos?
                    </h3>
                    <p className="text-xs text-[#DC2626] font-semibold">
                      Acción masiva conservando trazabilidad
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Estás a punto de anular los <strong>{selectedReqIds.length}</strong> requerimientos seleccionados.
                </p>

                <div className="flex items-start gap-2 bg-[#EAF7E4] p-3.5 rounded-xl border border-[#C6E9B4] text-xs text-[#2F7D18] mb-5">
                  <ShieldCheck className="w-4 h-4 text-[#55A529] shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Trazabilidad Operativa:</strong> Todos los requerimientos se conservarán en el historial como <strong>ANULADOS</strong>, preservando los datos de paraderos, personas y fechas para control y auditoría.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowBatchDeleteConfirm(false)}
                    className="px-4 py-2 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBatchDelete}
                    className="px-4 py-2 rounded-full bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Anular y Guardar en Historial</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Resumen de Paraderos por Solicitante / Supervisor */}
          <SupervisorParaderosModal
            isOpen={!!supervisorModalReq}
            requerimiento={supervisorModalReq}
            detalles={supervisorModalReq ? getDetallesByRequerimientoId(supervisorModalReq.id) : []}
            onClose={() => setSupervisorModalReq(null)}
            onOpenFullDetail={(req) => {
              setSupervisorModalReq(null);
              onOpenRequirementDetail(req);
            }}
          />

          {/* Modal de Exportación Optimizada para Sumas en Excel */}
          <ExportExcelOptionsModal
            isOpen={showExportModal}
            requerimientos={filteredRequerimientos}
            detalles={getStoredDetalles()}
            onClose={() => setShowExportModal(false)}
            onSuccessToast={showToast}
          />
        </>
      )}
    </main>
      </div>
    </div>
  );
};
