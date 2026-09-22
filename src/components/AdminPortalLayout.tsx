import React, { useState, useMemo, useEffect } from 'react';
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
  getSyncInfo,
} from '../services/storageService';
import { consolidarParaderos, exportarRequerimientoIndividualExcel } from '../services/excelExportService';
import { MasterDataManagementScreen } from './MasterDataManagementScreen';
import { PowerBIAnalyticsView } from './PowerBIAnalyticsView';
import { NewRequirementWizard } from './NewRequirementWizard';
import { UserManagementScreen } from './UserManagementScreen';
import { SupervisorParaderosModal } from './SupervisorParaderosModal';
import { ExportExcelOptionsModal } from './ExportExcelOptionsModal';

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

type AdminSection = 'procesos' | 'maestros' | 'reportes' | 'base-datos' | 'nuevo' | 'usuarios';

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

  // Selected row IDs for batch actions
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [reqToDelete, setReqToDelete] = useState<Requerimiento | null>(null);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  // Estados para resumen de paraderos y exportación a Excel
  const [expandedReqIds, setExpandedReqIds] = useState<string[]>([]);
  const [supervisorModalReq, setSupervisorModalReq] = useState<Requerimiento | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedReqId, setCopiedReqId] = useState<string | null>(null);

  const areas = useMemo(() => getStoredAreas(), []);
  const fundos = useMemo(() => getStoredFundos(), []);

  // Distinct supervisors from actual requirements, sorted alphabetically
  const supervisoresList = useMemo(() => {
    const set = new Set<string>();
    requerimientos.forEach((r) => {
      if (r.usuario) set.add(r.usuario);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requerimientos]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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

    let text = `🚌 *RESUMEN DE TRANSPORTE - CAMPOSOL*\n`;
    text += `📋 *Requerimiento:* ${req.numeroRequerimiento}\n`;
    text += `👤 *Supervisor:* ${req.usuario || 'Supervisor'}\n`;
    text += `📅 *Fecha:* ${req.fecha} | *Turno:* ${req.horaRecojo} - ${req.horaSalida}\n`;
    text += `🏢 *Área:* ${req.area} | *Fundo:* ${req.fundo}\n`;
    text += `🔄 *Movimiento:* ${req.movimiento}\n`;
    text += `👥 *Total Solicitado:* ${totalGen} personas\n\n`;

    if (totalSur > 0) {
      text += `🟡 *ZONA SUR (${totalSur} personas - ${surList.length} paraderos):*\n`;
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
    const success = await syncWithServerNow();
    onRefreshData();
    setIsManualSyncing(false);
    if (success) {
      showToast('¡Datos sincronizados exitosamente con la web!');
    } else {
      showToast('Servidor web activo (datos cargados localmente)');
    }
  };

  // Filtered requirements calculation
  const filteredRequerimientos = useMemo(() => {
    return requerimientos.filter((r) => {
      // Date range filter
      if (filterFechaDesde && r.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && r.fecha > filterFechaHasta) return false;

      // Dropdown filters
      if (filterArea !== 'TODAS' && r.area !== filterArea) return false;
      if (filterFundo !== 'TODOS' && r.fundo !== filterFundo) return false;
      if (filterSupervisor !== 'TODOS' && r.usuario !== filterSupervisor) return false;
      if (filterEstado !== 'TODOS' && r.estado !== filterEstado) return false;
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

  // Operational metrics for Torre de Control and KPI Cards
  const metrics = useMemo(() => {
    const total = filteredRequerimientos.length;
    const pendientes = filteredRequerimientos.filter((r) => r.estado === 'PENDIENTE').length;
    const aprobados = filteredRequerimientos.filter((r) => r.estado === 'APROBADO').length;
    const atendidos = filteredRequerimientos.filter((r) => r.estado === 'ATENDIDO').length;
    const rechazados = filteredRequerimientos.filter((r) => r.estado === 'RECHAZADO').length;
    const totalPasajeros = filteredRequerimientos.reduce((acc, curr) => acc + (curr.totalPersonas || 0), 0);
    // Estimated 40-passenger buses
    const busesEstimados = Math.ceil(totalPasajeros / 40);

    return {
      total,
      pendientes,
      aprobados,
      atendidos,
      rechazados,
      totalPasajeros,
      busesEstimados,
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

  // Status badge styling helper
  const renderEstadoBadge = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            PENDIENTE
          </span>
        );
      case 'APROBADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            APROBADO
          </span>
        );
      case 'ATENDIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <CheckCheck className="w-3 h-3 text-blue-600" />
            ATENDIDO
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            RECHAZADO
          </span>
        );
      case 'EN REVISIÓN':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <AlertCircle className="w-3 h-3 text-purple-600" />
            EN REVISIÓN
          </span>
        );
    }
  };

  // Quick single-click status action
  const handleQuickStatusChange = (id: string, newEstado: EstadoRequerimiento) => {
    updateRequerimientoEstado(id, newEstado);
    onRefreshData();
    showToast(`Requerimiento actualizado a ${newEstado}`);
  };

  // Batch action: Approve all selected
  const handleBatchApprove = () => {
    if (!selectedReqIds.length) return;
    selectedReqIds.forEach((id) => {
      updateRequerimientoEstado(id, 'APROBADO');
    });
    setSelectedReqIds([]);
    onRefreshData();
    showToast(`${selectedReqIds.length} requerimientos aprobados con éxito`);
  };

  // Batch action: Mark all selected as Atendidos
  const handleBatchAtender = () => {
    if (!selectedReqIds.length) return;
    selectedReqIds.forEach((id) => {
      updateRequerimientoEstado(id, 'ATENDIDO');
    });
    setSelectedReqIds([]);
    onRefreshData();
    showToast(`${selectedReqIds.length} requerimientos atendidos con éxito`);
  };

  // Single delete action
  const handleConfirmDelete = () => {
    if (!reqToDelete) return;
    const num = reqToDelete.numeroRequerimiento;
    deleteRequerimiento(reqToDelete.id);
    setReqToDelete(null);
    onRefreshData();
    showToast(`Requerimiento ${num} eliminado correctamente`);
  };

  // Batch action: Delete selected
  const handleBatchDelete = () => {
    if (!selectedReqIds.length) return;
    setShowBatchDeleteConfirm(true);
  };

  const handleConfirmBatchDelete = () => {
    if (!selectedReqIds.length) return;
    const count = selectedReqIds.length;
    deleteBatchRequerimientos(selectedReqIds);
    setSelectedReqIds([]);
    setShowBatchDeleteConfirm(false);
    onRefreshData();
    showToast(`${count} requerimientos eliminados correctamente`);
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
    <div className="flex h-screen w-full bg-[#F3F4F6] text-[#173B56] overflow-hidden font-sans">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-4 right-6 z-50 bg-[#173B56] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-500/40 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDEBAR (Identical to user's Camposol web layout)          */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-200 shrink-0 z-30 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Top: Logo & Collapse Button */}
        <div>
          <div className="h-20 px-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Camposol Corporate Badge */}
              <div className="w-12 h-12 rounded-full overflow-hidden shadow-xs shrink-0 border-2 border-[#B89F67]/60 bg-[#58A33E] flex items-center justify-center">
                <img
                  src="/camposol-emblem.svg"
                  alt="CAMPOSOL"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="text-sm font-black text-[#00843D] tracking-tight leading-none uppercase">
                    CAMPOSOL
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 tracking-wider uppercase mt-0.5">
                    Transporte Agrícola
                  </div>
                </div>
              )}
            </div>

            {/* Collapse toggle button « » */}
            <button
              id="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Sidebar Navigation Items */}
          <nav className="p-3 space-y-1 text-xs font-semibold">
            {/* + Nuevo Requerimiento Action */}
            <button
              id="menu-nuevo-requerimiento"
              onClick={() => setCurrentSection('nuevo')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                currentSection === 'nuevo'
                  ? 'bg-[#00843D] text-white font-black shadow-xs'
                  : 'text-[#00843D] hover:bg-[#E8F5EF] font-extrabold'
              }`}
              title="Registrar nuevo requerimiento de bus"
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>+ Nuevo Requerimiento</span>}
            </button>

            {/* 1. Procesos (Bandeja principal) */}
            <button
              id="menu-procesos"
              onClick={() => setCurrentSection('procesos')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                currentSection === 'procesos'
                  ? 'bg-[#E8F5EF] text-[#00843D] font-black'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-[#173B56]'
              }`}
              title="Procesos (Recepción y programación de buses)"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>Procesos</span>}
              </div>
              {!sidebarCollapsed && metrics.pendientes > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 rounded-full">
                  {metrics.pendientes}
                </span>
              )}
            </button>

            {/* 2. Datos Maestros (Solo Administrador) */}
            {userRole === 'admin' && (
              <button
                id="menu-datos-maestros"
                onClick={() => {
                  setCurrentSection('maestros');
                  if (onOpenMasters) onOpenMasters();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  currentSection === 'maestros'
                    ? 'bg-[#E8F5EF] text-[#00843D] font-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#173B56]'
                }`}
                title="Datos maestros (Paraderos, Fundos, Áreas)"
              >
                <FileText className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>Datos maestros</span>}
              </button>
            )}

            {/* 3. Reportes */}
            <button
              id="menu-reportes"
              onClick={() => {
                setCurrentSection('reportes');
                if (onOpenAnalytics) onOpenAnalytics();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                currentSection === 'reportes'
                  ? 'bg-[#E8F5EF] text-[#00843D] font-black'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-[#173B56]'
              }`}
              title="Reportes y Analítica Power BI"
            >
              <BarChart2 className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>Reportes</span>}
            </button>

            {/* 4. Base de datos & Respaldos (Solo Administrador) */}
            {userRole === 'admin' && (
              <button
                id="menu-base-datos"
                onClick={() => {
                  onOpenDatabaseModal();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  currentSection === 'base-datos'
                    ? 'bg-[#E8F5EF] text-[#00843D] font-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#173B56]'
                }`}
                title="Base de datos y respaldos JSON/CSV"
              >
                <Database className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>Base de datos</span>}
              </button>
            )}

            {/* 5. Gestión de Usuarios (Solo Administrador) */}
            {userRole === 'admin' && (
              <button
                id="menu-gestion-usuarios"
                onClick={() => setCurrentSection('usuarios')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  currentSection === 'usuarios'
                    ? 'bg-[#E8F5EF] text-[#00843D] font-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#173B56]'
                }`}
                title="Gestión de Usuarios, Roles y Permisos"
              >
                <Users className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && <span>Maestro de Usuarios</span>}
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Bottom Actions: Cerrar Sesión */}
        <div className="p-3 border-t border-gray-100 space-y-1">
          {onLogout && (
            <button
              id="sidebar-logout-btn"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
              title="Cerrar sesión actual"
            >
              <LogOut className="w-5 h-5 shrink-0 text-red-600" />
              {!sidebarCollapsed && <span>Cerrar Sesión</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTAINER: Top Header + Content Area                     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP BAR: Page Title + User Profile Pill (as in user's image) */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-[#173B56] tracking-tight">
              {currentSection === 'procesos' && 'Procesos / Recepción de Requerimientos'}
              {currentSection === 'maestros' && 'Datos Maestros / Catálogos Operativos'}
              {currentSection === 'reportes' && 'Reportes & Exportaciones Power BI'}
              {currentSection === 'base-datos' && 'Base de Datos Local & Respaldos'}
              {currentSection === 'nuevo' && 'Nuevo Requerimiento de Transporte'}
              {currentSection === 'usuarios' && 'Maestro de Usuarios / Gestión y Control de Acceso'}
            </h1>
          </div>

          {/* Top Right Header Elements */}
          <div className="flex items-center gap-2.5">
            {/* Live Web Sync Badge */}
            <div
              id="header-cloud-sync-badge"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold"
              title="Base de datos en la nube (Firestore) activa. Los requerimientos se sincronizan automáticamente en tiempo real entre todos los usuarios."
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00843D]"></span>
              </span>
              <span className="text-[11px] font-extrabold text-[#00843D]">Base Cloud Firestore Activa</span>
            </div>

            {/* Manual Sync Button */}
            <button
              id="header-sync-btn"
              type="button"
              onClick={handleManualSync}
              disabled={isManualSyncing}
              className={`p-2 rounded-xl text-gray-600 hover:text-[#00843D] hover:bg-emerald-50 border border-gray-200 transition-all ${
                isManualSyncing ? 'animate-spin text-[#00843D]' : ''
              }`}
              title="Sincronizar ahora con el servidor web"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Bell Notification Button */}
            <button
              id="header-notification-btn"
              onClick={() => {
                setFilterEstado('PENDIENTE');
                setCurrentSection('procesos');
                showToast(`Filtrando ${metrics.pendientes} requerimientos pendientes`);
              }}
              className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-[#173B56] transition-colors"
              title={`${metrics.pendientes} requerimientos pendientes de atención`}
            >
              <Bell className="w-5 h-5" />
              {metrics.pendientes > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"></span>
              )}
            </button>

            {/* Official Camposol User Profile Pill */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                  userRole === 'receptor'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-[#E8F5EF] text-[#00843D] border-emerald-300'
                }`}
              >
                {userRole === 'receptor' ? (
                  <Inbox className="w-4 h-4" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
              </div>
              <div className="text-left hidden sm:block leading-tight">
                <span className="text-xs font-black text-[#173B56] tracking-tight block uppercase">
                  {currentUser?.nombre ||
                    (userRole === 'receptor'
                      ? 'Roberto Gonzáles'
                      : 'Administrador del Sistema')}
                </span>
                <span className="text-[10px] font-extrabold text-[#00843D]">
                  @{currentUser?.usuario || (userRole === 'receptor' ? 'receptor' : 'admin')}{' '}
                  • {userRole === 'receptor' ? 'RECEPTOR' : 'ADMINISTRADOR'} • {currentUser?.area || 'OPERACIONES'}
                </span>
              </div>
            </div>

            {/* Cerrar Sesión Button in Header */}
            {onLogout && (
              <button
                id="header-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Cerrar Sesión</span>
              </button>
            )}
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* MAIN BODY VIEW (Procesos, Torre de Control, Maestros, etc.)   */}
        {/* ------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
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
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs">
                <MasterDataManagementScreen
                  onBack={() => setCurrentSection('procesos')}
                  onNavigateToNewRequest={() => setCurrentSection('nuevo')}
                />
              </div>
            )
          )}

          {/* Sub-view: Reportes */}
          {currentSection === 'reportes' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs">
              <PowerBIAnalyticsView
                onBack={() => setCurrentSection('procesos')}
                onRefreshParent={onRefreshData}
              />
            </div>
          )}

          {/* Sub-view: Nuevo Requerimiento */}
          {currentSection === 'nuevo' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs">
              <div className="mb-4 flex items-center justify-between pb-3 border-b border-gray-150">
                <button
                  onClick={() => setCurrentSection('procesos')}
                  className="text-xs font-bold text-gray-500 hover:text-[#00843D] flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Volver a Procesos</span>
                </button>
                <span className="text-xs font-black text-[#173B56] uppercase tracking-wide">
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
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs">
                <UserManagementScreen
                  currentAdminUser={
                    currentUser || {
                      id: 'usr-admin-01',
                      nombre: 'Administrador del Sistema',
                      usuario: 'admin',
                      passwordHash: '',
                      salt: '',
                      rol: 'admin',
                      area: 'OPERACIONES AGRÍCOLAS',
                      fundo: 'SEDE CENTRAL',
                      estado: 'ACTIVO',
                    }
                  }
                />
              </div>
            )
          )}

          {/* Sub-view: Procesos (Table + KPIs + Filters) */}
          {currentSection === 'procesos' && (
            <>
          {/* Top KPI Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold">Solicitudes</span>
                <Layers className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-black text-[#173B56] mt-1">{metrics.total}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Total filtrado</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs bg-gradient-to-br from-white to-amber-50/40">
              <div className="flex items-center justify-between text-xs text-amber-800">
                <span className="font-bold">Pendientes</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">{metrics.pendientes}</div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">Requieren atención</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-xs bg-gradient-to-br from-white to-emerald-50/40">
              <div className="flex items-center justify-between text-xs text-emerald-800">
                <span className="font-bold">Aprobados</span>
                <CheckCircle2 className="w-4 h-4 text-[#00843D]" />
              </div>
              <div className="text-2xl font-black text-[#00843D] mt-1">{metrics.aprobados}</div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">Programados</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-blue-200/80 shadow-xs bg-gradient-to-br from-white to-blue-50/40">
              <div className="flex items-center justify-between text-xs text-blue-800">
                <span className="font-bold">Atendidos</span>
                <CheckCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-600 mt-1">{metrics.atendidos}</div>
              <div className="text-[10px] text-blue-700/80 mt-0.5">Servicio cumplido</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold">Total Personal</span>
                <Users className="w-4 h-4 text-[#173B56]" />
              </div>
              <div className="text-2xl font-black text-[#173B56] mt-1">{metrics.totalPasajeros}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Pasajeros a movilizar</div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-semibold">Buses Estimados</span>
                <Bus className="w-4 h-4 text-[#00843D]" />
              </div>
              <div className="text-2xl font-black text-[#00843D] mt-1">{metrics.busesEstimados}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Capacidad base (40p)</div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* HIGH-PRECISION STRUCTURED FILTERS PANEL                      */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E8F5EF] text-[#00843D] flex items-center justify-center">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#173B56] uppercase tracking-wide">
                    Filtros
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-[#173B56] hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
                <button
                  id="btn-export-excel-header"
                  onClick={() => setShowExportModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#00843D] hover:bg-[#006e33] active:bg-[#005728] rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                  title="Descargar en Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar a Excel</span>
                </button>
                <button
                  onClick={onNewRequirement}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#00843D] hover:bg-[#006e33] rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Nuevo Requerimiento</span>
                </button>
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-1 text-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#00843D]" />
                Rápido:
              </span>
              <button
                type="button"
                onClick={() => {
                  const hoy = getTodayStr();
                  setFilterFechaDesde(hoy);
                  setFilterFechaHasta(hoy);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                    ? 'bg-[#00843D] text-white border-[#00843D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  filterFechaDesde === getYesterdayStr() && filterFechaHasta === getYesterdayStr()
                    ? 'bg-[#00843D] text-white border-[#00843D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  filterFechaDesde === getTomorrowStr() && filterFechaHasta === getTomorrowStr()
                    ? 'bg-[#00843D] text-white border-[#00843D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  !filterFechaDesde && !filterFechaHasta
                    ? 'bg-[#173B56] text-white border-[#173B56] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Todo el historial
              </button>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* Fecha Desde */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#00843D]" />
                  <span>Desde</span>
                </label>
                <input
                  type="date"
                  value={filterFechaDesde}
                  onChange={(e) => setFilterFechaDesde(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56]"
                />
              </div>

              {/* Fecha Hasta */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#00843D]" />
                  <span>Hasta</span>
                </label>
                <input
                  type="date"
                  value={filterFechaHasta}
                  onChange={(e) => setFilterFechaHasta(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56]"
                />
              </div>

              {/* Área */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-[#00843D]" />
                  <span>Área</span>
                </label>
                <select
                  value={filterArea}
                  onChange={(e) => setFilterArea(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56]"
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
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#00843D]" />
                  <span>Fundo</span>
                </label>
                <select
                  value={filterFundo}
                  onChange={(e) => setFilterFundo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56]"
                >
                  <option value="TODOS">Todos</option>
                  {fundos.map((f) => (
                    <option key={f.id} value={f.fundo}>
                      {f.fundo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supervisor / Solicitante */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-[#00843D]" />
                  <span>Supervisor</span>
                </label>
                <select
                  value={filterSupervisor}
                  onChange={(e) => setFilterSupervisor(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56]"
                >
                  <option value="TODOS">Todos</option>
                  {supervisoresList.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#00843D]" />
                  <span>Estado</span>
                </label>
                <select
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D] text-[#173B56] font-bold"
                >
                  <option value="TODOS">Todos</option>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="EN REVISIÓN">EN REVISIÓN</option>
                  <option value="APROBADO">APROBADO</option>
                  <option value="ATENDIDO">ATENDIDO</option>
                  <option value="RECHAZADO">RECHAZADO</option>
                </select>
              </div>
            </div>

            {/* Keyword search input */}
            <div className="relative pt-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Buscar por código, fundo, área o supervisor..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#173B56] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#00843D]"
              />
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* OPERATIONAL DATA TABLE (ERP / Intranet Camposol Style)         */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            {/* Table Action Bar */}
            <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#173B56] flex items-center gap-1.5 flex-wrap">
                  <span>Mostrando {filteredRequerimientos.length} de {requerimientos.length} requerimientos</span>
                  {filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr() && (
                    <span className="px-2 py-0.5 text-[10px] font-black bg-[#E8F5EF] text-[#00843D] rounded-md border border-[#00843D]/20">
                      DEL DÍA ({getTodayStr()})
                    </span>
                  )}
                  {filterFechaDesde === getYesterdayStr() && filterFechaHasta === getYesterdayStr() && (
                    <span className="px-2 py-0.5 text-[10px] font-black bg-amber-50 text-amber-800 rounded-md border border-amber-200">
                      DE AYER ({getYesterdayStr()})
                    </span>
                  )}
                  {filterFechaDesde === getTomorrowStr() && filterFechaHasta === getTomorrowStr() && (
                    <span className="px-2 py-0.5 text-[10px] font-black bg-blue-50 text-blue-800 rounded-md border border-blue-200">
                      DE MAÑANA ({getTomorrowStr()})
                    </span>
                  )}
                </span>
                {selectedReqIds.length > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-[#E8F5EF] text-[#00843D] rounded-full">
                    {selectedReqIds.length} seleccionados
                  </span>
                )}
              </div>

              {/* Batch Actions for Admin */}
              {selectedReqIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBatchApprove}
                    className="px-3 py-1.5 bg-[#00843D] hover:bg-[#006e33] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprobar Seleccionados ({selectedReqIds.length})</span>
                  </button>
                  <button
                    onClick={handleBatchAtender}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Marcar Atendidos ({selectedReqIds.length})</span>
                  </button>
                  <button
                    id="btn-batch-delete"
                    onClick={handleBatchDelete}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    title="Eliminar requerimientos seleccionados"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar ({selectedReqIds.length})</span>
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[calc(100vh-340px)]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700 uppercase font-black tracking-wider text-[10px] border-b border-gray-200 shadow-2xs">
                  <tr>
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={
                          paginatedRequerimientos.length > 0 &&
                          paginatedRequerimientos.every((r) => selectedReqIds.includes(r.id))
                        }
                        className="rounded-sm border-gray-300 text-[#00843D] focus:ring-[#00843D]"
                      />
                    </th>
                    <th className="py-3.5 px-4">Código Requerimiento</th>
                    <th className="py-3.5 px-4">Fecha & Turno</th>
                    <th className="py-3.5 px-4">Área / Fundo</th>
                    <th className="py-3.5 px-4">Movimiento & Horas</th>
                    <th className="py-3.5 px-4">Personal Solicitado</th>
                    <th className="py-3.5 px-4">Supervisor</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-center">Acciones Receptor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {filteredRequerimientos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        <Inbox className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <span className="block font-bold text-[#173B56] text-sm">
                          {filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                            ? `No hay requerimientos programados para el día de hoy (${getTodayStr()})`
                            : 'No se encontraron requerimientos con los filtros seleccionados'}
                        </span>
                        <span className="text-xs text-gray-400 mt-1 block max-w-md mx-auto">
                          {filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                            ? 'Los registros de ayer o de otras fechas no se muestran por defecto a menos que se filtren específicamente.'
                            : 'Prueba cambiando o limpiando los filtros seleccionados.'}
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              const ayer = getYesterdayStr();
                              setFilterFechaDesde(ayer);
                              setFilterFechaHasta(ayer);
                            }}
                            className="px-3.5 py-1.5 bg-[#E8F5EF] text-[#00843D] hover:bg-[#d4ede0] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-[#00843D]/20 shadow-2xs"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Ver Requerimientos de Ayer ({getYesterdayStr()})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterFechaDesde('');
                              setFilterFechaHasta('');
                            }}
                            className="px-3.5 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-gray-200"
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

                      return (
                        <React.Fragment key={req.id}>
                          <tr
                            className={`hover:bg-emerald-50/30 transition-colors ${
                              isSelected ? 'bg-[#E8F5EF]/40' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectRow(req.id)}
                                className="rounded-sm border-gray-300 text-[#00843D] focus:ring-[#00843D]"
                              />
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#00843D]">
                              <button
                                onClick={() => onOpenRequirementDetail(req)}
                                className="hover:underline flex items-center gap-1 text-left"
                              >
                                <span>{req.numeroRequerimiento}</span>
                              </button>
                              <span className="text-[10px] text-gray-400 block font-sans font-normal">
                                Reg: {req.fechaRegistro.slice(0, 10)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#173B56]">{req.fecha}</div>
                              <button
                                type="button"
                                onClick={() => toggleExpandReq(req.id)}
                                className="text-[10px] font-bold text-[#00843D] hover:underline flex items-center gap-0.5 cursor-pointer mt-0.5"
                                title="Haz clic para desplegar el resumen de paraderos"
                              >
                                <span>{paraderosCount} paradero{paraderosCount !== 1 ? 's' : ''}</span>
                                {expandedReqIds.includes(req.id) ? (
                                  <ChevronUp className="w-3 h-3 text-[#00843D]" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-[#00843D]" />
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#173B56]">{req.area}</div>
                              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span>{req.fundo}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  req.movimiento === 'INGRESO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {req.movimiento}
                              </span>
                              <div className="text-[10px] text-gray-500 mt-1">
                                Recojo: {req.horaRecojo} | Salida: {req.horaSalida}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-black text-base text-[#173B56]">
                                {req.totalPersonas}{' '}
                                <span className="text-xs font-normal text-gray-500">pers.</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSupervisorModalReq(req);
                                }}
                                className="group flex items-center gap-1.5 text-left p-1 -m-1 rounded-xl hover:bg-emerald-50 text-[#173B56] hover:text-[#00843D] transition-all cursor-pointer"
                                title="Haz clic aquí para ver el resumen de paraderos solicitados por este usuario"
                              >
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#00843D] group-hover:bg-[#00843D] group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs font-black text-xs">
                                  {(req.usuario || 'S').slice(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-gray-800 group-hover:text-[#00843D] block truncate max-w-[125px]">
                                    {req.usuario || 'Supervisor'}
                                  </span>
                                  <span className="text-[10px] text-[#00843D] font-extrabold flex items-center gap-0.5">
                                    <span>Ver paraderos</span>
                                    <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                                  </span>
                                </div>
                              </button>
                              {req.observaciones && (
                                <span
                                  className="text-[10px] text-gray-400 italic block truncate max-w-[125px] mt-0.5"
                                  title={req.observaciones}
                                >
                                  {req.observaciones}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {renderEstadoBadge(req.estado)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1">
                                {/* Ver Detalle */}
                                <button
                                  onClick={() => onOpenRequirementDetail(req)}
                                  className="p-1.5 text-gray-500 hover:text-[#00843D] hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Ver detalles y desglose de paraderos"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {/* Aprobar rápido */}
                                {req.estado !== 'APROBADO' && req.estado !== 'ATENDIDO' && (
                                  <button
                                    onClick={() => handleQuickStatusChange(req.id, 'APROBADO')}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00843D] border border-emerald-300 rounded-lg text-[10px] font-black transition-colors"
                                    title="Aprobar requerimiento"
                                  >
                                    Aprobar
                                  </button>
                                )}

                                {/* Atender rápido */}
                                {req.estado === 'APROBADO' && (
                                  <button
                                    onClick={() => handleQuickStatusChange(req.id, 'ATENDIDO')}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[10px] font-black transition-colors"
                                    title="Marcar como atendido"
                                  >
                                    Atender
                                  </button>
                                )}

                                {/* Eliminar requerimiento (Botón solicitado explícitamente en la tabla con icono circular rojo) */}
                                <button
                                  id={`btn-eliminar-req-${req.id}`}
                                  onClick={() => setReqToDelete(req)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                  title="Eliminar requerimiento"
                                  aria-label="Eliminar requerimiento"
                                >
                                  <XCircle className="w-4 h-4 text-red-500 hover:text-red-700" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Fila expandible con resumen de paraderos para suma rápida */}
                          {expandedReqIds.includes(req.id) && (
                            <tr key={`expand-${req.id}`} className="bg-emerald-50/40 border-b-2 border-emerald-200 animate-in fade-in duration-150">
                              <td colSpan={9} className="p-3 sm:p-4">
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
                                          {req.area} • {req.fundo} • Turno {req.horaRecojo}-{req.horaSalida} • Total: <strong className="text-[#00843D] font-black">{req.totalPersonas} personas</strong>
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
                                    const busesSur = Math.ceil(totalSur / 40);
                                    const busesNorte = Math.ceil(totalNorte / 40);
                                    const busesTot = Math.ceil(totalGen / 40);

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

                                          <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900">
                                            <div className="flex items-center gap-1.5 font-bold">
                                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                              <span>Zona Norte:</span>
                                            </div>
                                            <div className="font-mono">
                                              <strong className="text-sm font-black text-indigo-950">{totalNorte}</strong>{' '}
                                              <span className="text-[10px] text-indigo-800">({norteList.length} paraderos)</span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900">
                                            <div className="flex items-center gap-1.5 font-bold">
                                              <span className="w-2 h-2 rounded-full bg-[#00843D]" />
                                              <span>Total:</span>
                                            </div>
                                            <div className="font-mono">
                                              <strong className="text-sm font-black text-[#00843D]">{totalGen}</strong>{' '}
                                              <span className="text-[10px] text-emerald-800">({agrupados.length} paraderos)</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                          {agrupados.map((p, pIdx) => (
                                            <div
                                              key={pIdx}
                                              className={`p-2.5 rounded-xl border transition-colors ${
                                                p.zona === 'SUR'
                                                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                                                  : 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-400'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between text-[10px] text-gray-600 mb-1">
                                                <span className="font-bold truncate max-w-[85px]" title={p.paradero}>
                                                  {p.paradero}
                                                </span>
                                                <span
                                                  className={`px-1 py-0.2 rounded text-[8px] font-black uppercase ${
                                                    p.zona === 'SUR'
                                                      ? 'bg-amber-100 text-amber-800'
                                                      : 'bg-indigo-100 text-indigo-800'
                                                  }`}
                                                >
                                                  {p.zona}
                                                </span>
                                              </div>
                                              <div className="flex items-baseline justify-between">
                                                <span className="text-base font-mono font-black text-[#00843D]">
                                                  {p.totalPersonas}
                                                  <span className="text-[10px] font-normal text-gray-400 ml-0.5">pers.</span>
                                                </span>
                                                <span className="text-[10px] font-mono text-gray-500">{p.porcentaje}%</span>
                                              </div>
                                              {p.comedoresDetalle.length > 1 && (
                                                <div
                                                  className="text-[9px] text-gray-400 mt-1 truncate"
                                                  title={p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}
                                                >
                                                  {p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(', ')}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-gray-500 border-t border-gray-100">
                                          <span>Totales agrupados de todos los comedores (clasificados por zona según catálogo maestro)</span>
                                          <div className="flex items-center gap-3">
                                            <span className="text-amber-800 font-bold">
                                              Sur: <strong>{totalSur}</strong> pers.
                                            </span>
                                            <span className="text-indigo-800 font-bold">
                                              Norte: <strong>{totalNorte}</strong> pers.
                                            </span>
                                            <span className="font-bold text-[#173B56]">
                                              Suma Total:{' '}
                                              <strong className="text-[#00843D] font-black text-xs">
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

            {/* Barra de Paginación de Requerimientos (Soporte para 200+ registros diarios) */}
            {filteredRequerimientos.length > 0 && (
              <div className="bg-gray-50/90 px-6 py-3.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                {/* Contador de registros */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-medium">
                    Mostrando{' '}
                    <strong className="text-[#173B56]">
                      {pageSize === -1 ? 1 : (currentPage - 1) * pageSize + 1}
                    </strong>{' '}
                    a{' '}
                    <strong className="text-[#173B56]">
                      {pageSize === -1
                        ? filteredRequerimientos.length
                        : Math.min(currentPage * pageSize, filteredRequerimientos.length)}
                    </strong>{' '}
                    de <strong className="text-[#00843D]">{filteredRequerimientos.length}</strong> requerimientos
                    {selectedReqIds.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-[#E8F5EF] text-[#00843D] font-bold text-[11px] border border-[#00843D]/20">
                        {selectedReqIds.length} seleccionados
                      </span>
                    )}
                  </span>
                </div>

                {/* Controles de Paginación */}
                <div className="flex items-center gap-4">
                  {/* Selector de registros por página */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="px-2.5 py-1 bg-white border border-gray-200 rounded-xl font-bold text-[#173B56] focus:outline-none focus:ring-2 focus:ring-[#00843D] text-xs cursor-pointer shadow-2xs"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50 (Recomendado)</option>
                      <option value={100}>100</option>
                      <option value={200}>200 (Día Completo)</option>
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
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                        title="Primera página"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                      </button>

                      <span className="px-3 py-1 font-bold text-[#173B56] bg-white rounded-lg border border-gray-200 shadow-2xs text-[11px]">
                        Pág. {currentPage} de {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                        title="Página siguiente"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                        title="Última página"
                      >
                        <ChevronsRight className="w-3.5 h-3.5 text-gray-600" />
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
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-100 p-6 overflow-hidden">
                <div className="flex items-center gap-3 text-red-600 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#173B56]">
                      ¿Eliminar Requerimiento?
                    </h3>
                    <p className="text-xs text-red-600 font-bold">
                      {reqToDelete.numeroRequerimiento}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-3.5 mb-4 border border-gray-200 text-xs space-y-2 text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Fecha:</span>
                    <span className="font-bold text-[#173B56]">{reqToDelete.fecha}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Área / Fundo:</span>
                    <span className="font-bold text-[#173B56]">{reqToDelete.area} - {reqToDelete.fundo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Personal:</span>
                    <span className="font-bold text-[#173B56]">{reqToDelete.totalPersonas} personas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Supervisor:</span>
                    <span className="font-bold text-[#173B56]">{reqToDelete.usuario}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 mb-5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Esta acción eliminará permanentemente este requerimiento de la base de datos web y del sistema operativo. No se podrá recuperar.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReqToDelete(null)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    id="btn-confirm-delete-req"
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar Requerimiento</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de confirmación de eliminación múltiple (Batch) */}
          {showBatchDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-100 p-6 overflow-hidden">
                <div className="flex items-center gap-3 text-red-600 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#173B56]">
                      ¿Eliminar {selectedReqIds.length} Requerimientos?
                    </h3>
                    <p className="text-xs text-red-600 font-bold">
                      Acción masiva en lote
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Estás a punto de eliminar permanentemente los <strong>{selectedReqIds.length}</strong> requerimientos seleccionados de la lista de recepción y de la base de datos web central.
                </p>

                <div className="flex items-start gap-2 bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-800 mb-5">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    Esta operación no se puede deshacer. Se borrarán los requerimientos y todos sus desgloses de paraderos asociados.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowBatchDeleteConfirm(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBatchDelete}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar Todo</span>
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
