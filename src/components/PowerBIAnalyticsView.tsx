import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart2,
  BarChart3,
  Download,
  Users,
  Compass,
  Building,
  Utensils,
  MapPin,
  RefreshCw,
  Table,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Sparkles,
  PieChart,
  Clock,
  Calendar,
  Sprout,
  ShieldCheck,
  TrendingUp,
  Bus,
  Briefcase,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  AlertCircle,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  X,
  Radio,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Requerimiento, DetalleRequerimiento } from '../types';
import { formatHoraRegistro } from '../services/excelExportService';
import {
  getStoredRequerimientos,
  getStoredDetalles,
  exportToCSV,
  inferParaderoZona,
  subscribeToDataChanges,
} from '../services/storageService';

interface PowerBIAnalyticsViewProps {
  requerimientos?: Requerimiento[];
  onBack: () => void;
  onRefreshParent: () => void;
}

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

const formatTimelineLabel = (dateStr: string) => {
  if (!dateStr) return { dayName: '', dayMonth: 'Sin fecha' };
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return {
          dayName: days[date.getDay()],
          dayMonth: `${day} ${months[month]}`,
        };
      }
    }
  } catch (e) {
    // fallback
  }
  return { dayName: '', dayMonth: dateStr };
};

export const PowerBIAnalyticsView: React.FC<PowerBIAnalyticsViewProps> = ({
  requerimientos: propRequerimientos,
  onBack,
  onRefreshParent,
}) => {
  const [requerimientos, setRequerimientos] = useState<Requerimiento[]>(
    () => (propRequerimientos && propRequerimientos.length > 0 ? propRequerimientos : getStoredRequerimientos())
  );
  const [detalles, setDetalles] = useState<DetalleRequerimiento[]>(() => getStoredDetalles());
  const [exportSuccess, setExportSuccess] = useState<string>('');

  // Sincronización en tiempo real con la base de datos persistente (Firestore / Storage)
  useEffect(() => {
    if (propRequerimientos && propRequerimientos.length > 0) {
      setRequerimientos(propRequerimientos);
    }
  }, [propRequerimientos]);

  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setRequerimientos(getStoredRequerimientos());
      setDetalles(getStoredDetalles());
    });
    return () => unsub();
  }, []);

  // Interactive filters
  const [filterZona, setFilterZona] = useState<string>('TODAS');
  const [filterFundo, setFilterFundo] = useState<string>('TODOS');
  const [filterArea, setFilterArea] = useState<string>('TODAS');
  const [filterCultivo, setFilterCultivo] = useState<string>('TODOS');
  const [filterMovimiento, setFilterMovimiento] = useState<string>('TODOS');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>(() => getTodayStr());
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>(() => getTodayStr());
  const [tableSearch, setTableSearch] = useState<string>('');

  // Table pagination
  const [tablePage, setTablePage] = useState<number>(1);
  const pageSize = 15;

  const refreshData = () => {
    setRequerimientos(getStoredRequerimientos());
    setDetalles(getStoredDetalles());
    onRefreshParent();
  };

  // Enriched normalized data rows: EXCLUSIVAMENTE CON DATOS REALES DE REQUERIMIENTOS EXISTENTES
  const enrichedRows = useMemo(() => {
    const rows: {
      id: string;
      requerimientoId: string;
      numeroRequerimiento: string;
      fecha: string;
      hora: string;
      horaSalida: string;
      fundo: string;
      area: string;
      cultivo: string;
      movimiento: string;
      estado: string;
      usuario: string;
      zona: 'SUR' | 'NORTE';
      paradero: string;
      parcela: string;
      cantidad: number;
      fechaRegistro?: string;
    }[] = [];

    // Recorrer únicamente requerimientos reales existentes en la base de datos
    requerimientos.forEach((req) => {
      // Ignorar cualquier requerimiento demo o ficticio
      if (req.id?.startsWith('req-uuid-')) return;

      const matched = detalles.filter(
        (d) =>
          (d.requerimientoId === req.id || d.numeroRequerimiento === req.numeroRequerimiento) &&
          !d.id?.startsWith('det-001-') &&
          !d.id?.startsWith('det-002-') &&
          !d.id?.startsWith('det-003-')
      );

      if (matched.length > 0) {
        matched.forEach((d) => {
          const rawZona = d.zona || inferParaderoZona(d.paradero) || 'NORTE';
          const zona: 'SUR' | 'NORTE' = rawZona === 'SUR' || rawZona === 'NORTE' ? rawZona : 'NORTE';
          rows.push({
            id: d.id,
            requerimientoId: req.id,
            numeroRequerimiento: req.numeroRequerimiento,
            fecha: req.fecha,
            hora: req.horaRecojo,
            horaSalida: req.horaSalida || req.horaRecojo,
            fundo: req.fundo,
            area: req.area,
            cultivo: req.cultivo || d.cultivo || 'Sin cultivo',
            movimiento: req.movimiento,
            estado: req.estado,
            usuario: req.usuario || 'No especificado',
            zona,
            paradero: d.paradero,
            parcela: d.parcela || d.comedor || (req.parcelas && req.parcelas.length > 0 ? req.parcelas.join(', ') : 'Comedor'),
            cantidad: Number(d.cantidad) || 0,
            fechaRegistro: req.fechaRegistro,
          });
        });
      } else if (Number(req.totalPersonas) > 0) {
        rows.push({
          id: `req-row-${req.id}`,
          requerimientoId: req.id,
          numeroRequerimiento: req.numeroRequerimiento,
          fecha: req.fecha,
          hora: req.horaRecojo,
          horaSalida: req.horaSalida || req.horaRecojo,
          fundo: req.fundo,
          area: req.area,
          cultivo: req.cultivo || 'Sin cultivo',
          movimiento: req.movimiento,
          estado: req.estado,
          usuario: req.usuario || 'No especificado',
          zona: 'NORTE',
          paradero: 'Sin desglose',
          parcela: req.parcelas && req.parcelas.length > 0 ? req.parcelas.join(', ') : 'General',
          cantidad: Number(req.totalPersonas) || 0,
          fechaRegistro: req.fechaRegistro,
        });
      }
    });

    return rows;
  }, [detalles, requerimientos]);

  // Unique filter option sets
  const availableFundos = useMemo(() => {
    return Array.from(new Set(enrichedRows.map((r) => r.fundo))).filter(Boolean).sort();
  }, [enrichedRows]);

  const availableAreas = useMemo(() => {
    return Array.from(new Set(enrichedRows.map((r) => r.area))).filter(Boolean).sort();
  }, [enrichedRows]);

  const availableCultivos = useMemo(() => {
    return Array.from(new Set(enrichedRows.map((r) => r.cultivo))).filter(Boolean).sort();
  }, [enrichedRows]);

  // Filtered rows based on selected filters
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
      if (filterZona !== 'TODAS' && row.zona !== filterZona) return false;
      if (filterFundo !== 'TODOS' && row.fundo !== filterFundo) return false;
      if (filterArea !== 'TODAS' && row.area !== filterArea) return false;
      if (filterCultivo !== 'TODOS' && row.cultivo !== filterCultivo) return false;
      if (filterMovimiento !== 'TODOS' && row.movimiento !== filterMovimiento) return false;
      if (filterEstado !== 'TODOS' && row.estado !== filterEstado) return false;
      if (filterFechaDesde && row.fecha < filterFechaDesde) return false;
      if (filterFechaHasta && row.fecha > filterFechaHasta) return false;
      return true;
    });
  }, [
    enrichedRows,
    filterZona,
    filterFundo,
    filterArea,
    filterCultivo,
    filterMovimiento,
    filterEstado,
    filterFechaDesde,
    filterFechaHasta,
  ]);

  // Table search filtering
  const tableFilteredRows = useMemo(() => {
    if (!tableSearch.trim()) return filteredRows;
    const q = tableSearch.toLowerCase().trim();
    return filteredRows.filter(
      (r) =>
        r.paradero.toLowerCase().includes(q) ||
        r.fundo.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.cultivo.toLowerCase().includes(q) ||
        r.numeroRequerimiento.toLowerCase().includes(q) ||
        r.usuario.toLowerCase().includes(q) ||
        r.parcela.toLowerCase().includes(q)
    );
  }, [filteredRows, tableSearch]);

  // Table pagination calculation
  const totalPages = Math.ceil(tableFilteredRows.length / pageSize) || 1;
  const pagedRows = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return tableFilteredRows.slice(start, start + pageSize);
  }, [tableFilteredRows, tablePage, pageSize]);

  // -------------------------------------------------------------
  // CALCULATED METRICS & AGGREGATIONS FOR CHARTS
  // -------------------------------------------------------------
  const totalPersonal = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + r.cantidad, 0);
  }, [filteredRows]);

  const distinctReqs = useMemo(() => {
    return new Set(filteredRows.map((r) => r.numeroRequerimiento)).size;
  }, [filteredRows]);

  const distinctFundos = useMemo(() => {
    return new Set(filteredRows.map((r) => r.fundo)).size;
  }, [filteredRows]);

  const distinctParaderos = useMemo(() => {
    return new Set(filteredRows.map((r) => r.paradero)).size;
  }, [filteredRows]);

  // Zona Sur vs Norte
  const totalZonaSur = useMemo(() => {
    return filteredRows.filter((r) => r.zona === 'SUR').reduce((sum, r) => sum + r.cantidad, 0);
  }, [filteredRows]);

  const totalZonaNorte = useMemo(() => {
    return filteredRows.filter((r) => r.zona === 'NORTE').reduce((sum, r) => sum + r.cantidad, 0);
  }, [filteredRows]);

  const pctSur = totalPersonal > 0 ? Math.round((totalZonaSur / totalPersonal) * 100) : 0;
  const pctNorte = totalPersonal > 0 ? 100 - pctSur : 0;

  // Movimiento: Ingreso vs Salida
  const totalIngreso = useMemo(() => {
    return filteredRows.filter((r) => r.movimiento === 'INGRESO').reduce((sum, r) => sum + r.cantidad, 0);
  }, [filteredRows]);

  const totalSalida = useMemo(() => {
    return filteredRows.filter((r) => r.movimiento === 'SALIDA').reduce((sum, r) => sum + r.cantidad, 0);
  }, [filteredRows]);

  const pctIngreso = totalPersonal > 0 ? Math.round((totalIngreso / totalPersonal) * 100) : 0;
  const pctSalida = totalPersonal > 0 ? 100 - pctIngreso : 0;

  // Estados breakdown
  const estadosBreakdown = useMemo(() => {
    const map: Record<string, { count: number; personal: number }> = {};
    filteredRows.forEach((r) => {
      if (!map[r.estado]) map[r.estado] = { count: 0, personal: 0 };
      map[r.estado].personal += r.cantidad;
    });
    // Distinct reqs count per status
    const reqEstadoMap: Record<string, Set<string>> = {};
    filteredRows.forEach((r) => {
      if (!reqEstadoMap[r.estado]) reqEstadoMap[r.estado] = new Set();
      reqEstadoMap[r.estado].add(r.numeroRequerimiento);
    });
    Object.keys(map).forEach((st) => {
      map[st].count = reqEstadoMap[st]?.size || 0;
    });
    return map;
  }, [filteredRows]);

  // Chart 1: Evolución por Fecha (cronológica)
  const timelineData = useMemo(() => {
    const map: Record<string, { personal: number; reqCount: Set<string> }> = {};
    filteredRows.forEach((r) => {
      const dateKey = r.fecha || 'Sin fecha';
      if (!map[dateKey]) map[dateKey] = { personal: 0, reqCount: new Set() };
      map[dateKey].personal += r.cantidad;
      map[dateKey].reqCount.add(r.numeroRequerimiento);
    });
    return Object.entries(map)
      .map(([date, data]) => ({
        date,
        personal: data.personal,
        reqs: data.reqCount.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRows]);

  const maxTimelineVal = Math.max(...timelineData.map((d) => d.personal), 1);

  // Chart 2: Picos por Franjas Horarias
  const timeSlotsData = useMemo(() => {
    const slots = [
      { name: 'Madrugada (03:00 - 05:59)', min: '03:00', max: '05:59', count: 0 },
      { name: 'Mañana (06:00 - 11:59)', min: '06:00', max: '11:59', count: 0 },
      { name: 'Mediodía (12:00 - 14:59)', min: '12:00', max: '14:59', count: 0 },
      { name: 'Tarde / Salida (15:00 - 18:59)', min: '15:00', max: '18:59', count: 0 },
      { name: 'Noche (19:00+)', min: '19:00', max: '23:59', count: 0 },
    ];

    filteredRows.forEach((r) => {
      if (!r.hora) return;
      const parts = r.hora.split(':');
      const hour = parseInt(parts[0], 10);
      if (isNaN(hour)) return;

      if (hour >= 3 && hour <= 5) slots[0].count += r.cantidad;
      else if (hour >= 6 && hour <= 11) slots[1].count += r.cantidad;
      else if (hour >= 12 && hour <= 14) slots[2].count += r.cantidad;
      else if (hour >= 15 && hour <= 18) slots[3].count += r.cantidad;
      else slots[4].count += r.cantidad;
    });

    return slots;
  }, [filteredRows]);

  const maxTimeSlotVal = Math.max(...timeSlotsData.map((s) => s.count), 1);

  // Chart 3: Distribución por Fundo Destino (Ranking)
  const fundosRanking = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      map[r.fundo] = (map[r.fundo] || 0) + r.cantidad;
    });
    return Object.entries(map)
      .map(([fundo, count]) => ({ fundo, count, pct: totalPersonal > 0 ? Math.round((count / totalPersonal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, totalPersonal]);

  const maxFundoVal = fundosRanking.length > 0 ? fundosRanking[0].count : 1;

  // Chart 4: Distribución por Área Operativa
  const areasRanking = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      map[r.area] = (map[r.area] || 0) + r.cantidad;
    });
    return Object.entries(map)
      .map(([area, count]) => ({ area, count, pct: totalPersonal > 0 ? Math.round((count / totalPersonal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, totalPersonal]);

  const maxAreaVal = areasRanking.length > 0 ? areasRanking[0].count : 1;

  // Chart 5: Distribución por Cultivo
  const cultivosRanking = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      map[r.cultivo] = (map[r.cultivo] || 0) + r.cantidad;
    });
    return Object.entries(map)
      .map(([cultivo, count]) => ({ cultivo, count, pct: totalPersonal > 0 ? Math.round((count / totalPersonal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, totalPersonal]);

  const maxCultivoVal = cultivosRanking.length > 0 ? cultivosRanking[0].count : 1;

  // Chart 6: Top Paraderos Críticos
  const paraderosRanking = useMemo(() => {
    const map: Record<string, { count: number; zona: 'NORTE' | 'SUR' }> = {};
    filteredRows.forEach((r) => {
      if (!map[r.paradero]) {
        map[r.paradero] = { count: 0, zona: r.zona };
      }
      map[r.paradero].count += r.cantidad;
    });
    return Object.entries(map)
      .map(([paradero, data]) => ({
        paradero,
        count: data.count,
        zona: data.zona,
        pct: totalPersonal > 0 ? Math.round((data.count / totalPersonal) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, totalPersonal]);

  const maxParaderoVal = paraderosRanking.length > 0 ? paraderosRanking[0].count : 1;

  // Chart 7: Demanda por Comedor / Garita
  const comedoresRanking = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      const com = r.parcela || 'Comedor Principal';
      map[com] = (map[com] || 0) + r.cantidad;
    });
    return Object.entries(map)
      .map(([comedor, count]) => ({ comedor, count, pct: totalPersonal > 0 ? Math.round((count / totalPersonal) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows, totalPersonal]);

  const maxComedorVal = comedoresRanking.length > 0 ? comedoresRanking[0].count : 1;

  // Export CSV handler
  const handleExportPowerBIDataset = () => {
    const exportRows = filteredRows.map((r) => ({
      Fecha: r.fecha,
      Hora_Registro: formatHoraRegistro(r.fechaRegistro) || '',
      Hora_Recojo: r.hora,
      Hora_Salida: r.horaSalida,
      Requerimiento: r.numeroRequerimiento,
      Area: r.area,
      Fundo: r.fundo,
      Cultivo: r.cultivo,
      Movimiento: r.movimiento,
      Zona: r.zona,
      Paradero: r.paradero,
      Comedor_Parcela: r.parcela,
      Cantidad_Personal: r.cantidad,
      Supervisor: r.usuario,
      Estado: r.estado,
    }));

    exportToCSV('CAMPOSOL_DATASET_POWERBI.csv', exportRows);
    setExportSuccess('¡Dataset CAMPOSOL_DATASET_POWERBI.csv exportado exitosamente!');
    setTimeout(() => setExportSuccess(''), 4500);
  };

  // Export Excel (.xlsx) handler
  const handleExportExcelDetailed = () => {
    const rows = filteredRows.map((r) => ({
      'N° REQUERIMIENTO': r.numeroRequerimiento,
      'FECHA': r.fecha,
      'HORA REGISTRO': formatHoraRegistro(r.fechaRegistro) || '',
      'HORA RECOJO': r.hora,
      'HORA SALIDA': r.horaSalida,
      'ÁREA': r.area,
      'FUNDO DESTINO': r.fundo,
      'CULTIVO': r.cultivo,
      'MOVIMIENTO': r.movimiento,
      'ZONA': r.zona,
      'PARADERO': r.paradero,
      'COMEDOR / PARCELA': r.parcela,
      'CANTIDAD PERSONAS': r.cantidad,
      'SOLICITANTE': r.usuario,
      'ESTADO': r.estado,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte_Operativo');
    XLSX.writeFile(workbook, `CAMPOSOL_REPORTE_TRANSPORTE_${new Date().toISOString().slice(0, 10)}.xlsx`);

    setExportSuccess('¡Reporte en formato Excel (.xlsx) descargado con éxito!');
    setTimeout(() => setExportSuccess(''), 4500);
  };

  const clearAllFilters = () => {
    setFilterZona('TODAS');
    setFilterFundo('TODOS');
    setFilterArea('TODAS');
    setFilterCultivo('TODOS');
    setFilterMovimiento('TODOS');
    setFilterEstado('TODOS');
    const today = getTodayStr();
    setFilterFechaDesde(today);
    setFilterFechaHasta(today);
    setTableSearch('');
    setTablePage(1);
  };

  const hasActiveFilters =
    filterZona !== 'TODAS' ||
    filterFundo !== 'TODOS' ||
    filterArea !== 'TODAS' ||
    filterCultivo !== 'TODOS' ||
    filterMovimiento !== 'TODOS' ||
    filterEstado !== 'TODOS' ||
    filterFechaDesde !== getTodayStr() ||
    filterFechaHasta !== getTodayStr() ||
    !!tableSearch;

  return (
    <div className="space-y-4 pb-16 text-[#1B3A57]">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER EJECUTIVO & ACCIONES GLOBALES                       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF7E4] text-[#2F7D18] font-semibold text-[11px] border border-[#C6E9B4]">
              <span className="w-2 h-2 rounded-full bg-[#55A529]" />
              Datos operativos reales
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-medium text-[11px]">
              {distinctReqs} requerimientos activos
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-medium text-[11px]">
              {totalPersonal.toLocaleString()} colaboradores en tránsito
            </span>
          </div>

          <h2 className="text-lg font-bold text-[#1B3A57] tracking-tight">
            Reportes & Analítica Operativa
          </h2>
          <p className="text-xs text-slate-500 font-normal">
            Demanda de pasajeros, distribución territorial y trazabilidad de paraderos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleExportExcelDetailed}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Exportar archivo Excel oficial para gerencia"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[10px] font-medium">Excel</span>
          </button>

          <button
            onClick={handleExportPowerBIDataset}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Descargar dataset estructurado para Power BI Desktop"
          >
            <Download className="w-4 h-4" />
            <span className="text-[10px] font-medium">Power BI</span>
          </button>

          <button
            onClick={refreshData}
            className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#3D8B1C] hover:text-[#2F7D18] hover:bg-[#F3F8F0] rounded-lg transition-colors cursor-pointer"
            title="Refrescar datos operativos"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-[10px] font-medium">Actualizar</span>
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="bg-[#EAF7E4] border border-[#C6E9B4] text-[#2F7D18] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2F7D18] shrink-0" />
            <span>{exportSuccess}</span>
          </div>
          <button
            onClick={() => setExportSuccess('')}
            className="text-[#2F7D18] hover:opacity-75 text-xs cursor-pointer font-medium"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PANEL DE FILTROS MULTIDIMENSIONALES                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5ECF2] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                Filtros de análisis
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const today = getTodayStr();
                setFilterFechaDesde(today);
                setFilterFechaHasta(today);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                  ? 'bg-[#22A846] text-white border-[#22A846]'
                  : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const y = getYesterdayStr();
                setFilterFechaDesde(y);
                setFilterFechaHasta(y);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filterFechaDesde === getYesterdayStr() && filterFechaHasta === getYesterdayStr()
                  ? 'bg-[#22A846] text-white border-[#22A846]'
                  : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
              }`}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => {
                const t = getTomorrowStr();
                setFilterFechaDesde(t);
                setFilterFechaHasta(t);
              }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                filterFechaDesde === getTomorrowStr() && filterFechaHasta === getTomorrowStr()
                  ? 'bg-[#22A846] text-white border-[#22A846]'
                  : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
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
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                !filterFechaDesde && !filterFechaHasta
                  ? 'bg-[#1B3A57] text-white border-[#1B3A57]'
                  : 'bg-white text-slate-600 border-[#D8E2EA] hover:bg-slate-50'
              }`}
            >
              Historial completo
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-3.5 py-1.5 rounded-full bg-[#F1F5F9] hover:bg-slate-200 text-[11px] font-medium text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Form controls grid con píldoras y etiqueta flotante */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs pt-1">
          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Zona operativa
            </label>
            <select
              value={filterZona}
              onChange={(e) => setFilterZona(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            >
              <option value="TODAS">Todas las zonas</option>
              <option value="SUR">Zona Sur</option>
              <option value="NORTE">Zona Norte</option>
            </select>
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Fundo destino
            </label>
            <select
              value={filterFundo}
              onChange={(e) => setFilterFundo(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos los fundos</option>
              {availableFundos.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Área solicitante
            </label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            >
              <option value="TODAS">Todas las áreas</option>
              {availableAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Cultivo
            </label>
            <select
              value={filterCultivo}
              onChange={(e) => setFilterCultivo(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos los cultivos</option>
              {availableCultivos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Movimiento
            </label>
            <select
              value={filterMovimiento}
              onChange={(e) => setFilterMovimiento(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos (Ingreso/Salida)</option>
              <option value="INGRESO">Ingreso (A Fundos)</option>
              <option value="SALIDA">Salida (A Paraderos)</option>
            </select>
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Fecha desde
            </label>
            <input
              type="date"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            />
          </div>

          <div className="relative">
            <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-slate-500 font-medium z-10 pointer-events-none">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              className="w-full h-10 px-4 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 focus:outline-none focus:border-[#55A529] transition-colors cursor-pointer"
            />
          </div>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-600">
              Registros filtrados:
            </span>
            <span className="font-semibold text-[#1B3A57]">
              {filteredRows.length} asignaciones
            </span>
            <span>·</span>
            <span className="font-semibold text-[#2F7D18]">
              {totalPersonal.toLocaleString()} pasajeros
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-[10px] text-[#B45309] font-semibold bg-[#FFF6E0] px-2.5 py-0.5 rounded-full border border-[#FDE68A]">
              Filtro activo
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ROW DE 5 KPIS GERENCIALES                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Personas Totales */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] border-l-4 border-l-[#55A529] shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Personal Total
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#2F7D18] tracking-tight tabular-nums">
              {totalPersonal.toLocaleString()}
            </div>
            <div className="mt-2 space-y-1">
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#55A529]"
                  style={{ width: `${pctIngreso}%` }}
                  title={`Ingreso: ${pctIngreso}%`}
                />
                <div
                  className="h-full bg-[#0082B3]"
                  style={{ width: `${pctSalida}%` }}
                  title={`Salida: ${pctSalida}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
                <span>{pctIngreso}% Ingreso</span>
                <span>{pctSalida}% Salida</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Requerimientos */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Requerimientos
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#F1F5F9] text-[#1B3A57] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3A57] tracking-tight tabular-nums">
              {distinctReqs}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1.5">
              {filteredRows.length} paraderos activos
            </div>
          </div>
        </div>

        {/* KPI 3: Fundos Activos */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Fundos Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3A57] tracking-tight tabular-nums">
              {distinctFundos}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1.5 truncate" title={fundosRanking[0]?.fundo}>
              Top: <span className="text-[#2F7D18] font-semibold">{fundosRanking[0]?.fundo || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Paraderos con Demanda */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] border-l-4 border-l-[#0082B3] shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Paraderos Activos
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#E6F3FB] text-[#0082B3] flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#0082B3] tracking-tight tabular-nums">
              {distinctParaderos}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1.5 truncate" title={paraderosRanking[0]?.paradero}>
              Top: <span className="text-[#0082B3] font-semibold">{paraderosRanking[0]?.paradero || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* KPI 5: Balance Zonal */}
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              Balance Zonal
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#E6F3FB] text-[#0082B3] flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-[#0082B3]">Norte: {totalZonaNorte}</span>
              <span className="text-[#B45309]">Sur: {totalZonaSur}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-[#0082B3]" style={{ width: `${pctNorte}%` }} title={`Norte: ${pctNorte}%`} />
              <div className="h-full bg-amber-500" style={{ width: `${pctSur}%` }} title={`Sur: ${pctSur}%`} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
              <span>{pctNorte}%</span>
              <span>{pctSur}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. BLOQUE PRINCIPAL DE GRÁFICOS ANALÍTICOS                     */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-6">
        {/* FILA A: GRÁFICO DE TENDENCIA TEMPORAL + PICOS HORARIOS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Gráfico 1: Evolución Diaria */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Evolución Diaria
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#2F7D18] bg-[#EAF7E4] px-3 py-1 rounded-full border border-[#C6E9B4]">
                {timelineData.length} fechas
              </span>
            </div>

            {timelineData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs italic">
                No hay requerimientos en el rango de fechas seleccionado
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Visual Chart with horizontal guides and slender bars */}
                <div className="h-56 flex items-end gap-3 sm:gap-6 px-4 pt-6 pb-2 border-b border-[#E5ECF2] relative">
                  {/* Dotted horizontal guides */}
                  <div className="absolute inset-x-0 top-6 border-b border-dashed border-slate-200/70 pointer-events-none" />
                  <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-200/70 pointer-events-none" />

                  {timelineData.map((d) => {
                    const heightPct = Math.max(Math.round((d.personal / maxTimelineVal) * 100), 12);
                    const dateMeta = formatTimelineLabel(d.date);

                    return (
                      <div
                        key={d.date}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative max-w-[80px] mx-auto"
                      >
                        {/* Hover Tooltip */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 bg-[#1B3A57] text-white text-[11px] py-1.5 px-3 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg border border-slate-700">
                          <div className="font-bold">{dateMeta.dayName ? `${dateMeta.dayName}, ` : ''}{d.date}</div>
                          <div className="text-[#8CE062] font-extrabold">{d.personal} personas ({d.reqs} req.)</div>
                        </div>

                        {/* Top count pill */}
                        <div className="mb-1.5 transition-transform group-hover:scale-110">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-[#2F7D18] bg-[#EAF7E4] border border-[#C6E9B4] shadow-2xs">
                            {d.personal}
                          </span>
                        </div>

                        {/* Bar column with background track */}
                        <div className="w-full bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-full">
                          <div
                            className="w-full bg-gradient-to-t from-[#22A846] via-[#55A529] to-[#74C043] rounded-t-xl transition-all duration-500 group-hover:brightness-110 shadow-xs"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Date labels below */}
                <div className="flex items-center justify-between text-xs px-2 pt-1">
                  {timelineData.map((d) => {
                    const dateMeta = formatTimelineLabel(d.date);
                    return (
                      <div key={d.date} className="flex-1 text-center max-w-[80px] mx-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {dateMeta.dayName || 'Día'}
                        </div>
                        <div className="text-xs font-bold text-[#1B3A57]">
                          {dateMeta.dayMonth}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 2: Picos por Franja Horaria */}
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF6E0] text-[#B45309] flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Demanda por Horario
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
                {totalPersonal} personas
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {timeSlotsData.map((slot, index) => {
                const pct = totalPersonal > 0 ? Math.round((slot.count / totalPersonal) * 100) : 0;
                const widthPct = Math.round((slot.count / (maxTimeSlotVal || 1)) * 100);

                // Distinct colors for shifts
                const colors = [
                  { bar: 'from-amber-500 to-amber-600', badge: 'text-[#B45309] bg-[#FFF6E0]' },
                  { bar: 'from-[#22A846] to-[#55A529]', badge: 'text-[#2F7D18] bg-[#EAF7E4]' },
                  { bar: 'from-orange-500 to-orange-600', badge: 'text-orange-700 bg-orange-50' },
                  { bar: 'from-sky-500 to-[#0082B3]', badge: 'text-[#0082B3] bg-[#E6F3FB]' },
                  { bar: 'from-[#1B3A57] to-[#2B5278]', badge: 'text-[#1B3A57] bg-[#EDF2FA]' },
                ];
                const theme = colors[index % colors.length];

                return (
                  <div key={slot.name} className={`p-2.5 rounded-xl hover:bg-[#F7FBFE] transition-colors space-y-1.5 ${slot.count === 0 ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1B3A57]">{slot.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{pct}%</span>
                        <span className="text-[#1B3A57] font-bold">{slot.count} pers.</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${theme.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FILA B: FUNDOS DESTINO + ÁREAS SOLICITANTES + CULTIVOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Gráfico 3: Demanda por Fundo */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Demanda por Fundo
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
                {fundosRanking.length} fundos
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {fundosRanking.map((f, idx) => (
                <div key={f.fundo} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#1B3A57] truncate pr-2 flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-[#55A529] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{f.fundo}</span>
                    </span>
                    <span className="text-[#2F7D18] font-bold shrink-0 font-mono">
                      {f.count} <span className="text-[11px] font-normal text-slate-400">({f.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#22A846] to-[#74C043] rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((f.count / maxFundoVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico 4: Demanda por Área */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E6F3FB] text-[#0082B3] flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Demanda por Área
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
                {areasRanking.length} áreas
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {areasRanking.map((a, idx) => (
                <div key={a.area} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#1B3A57] truncate pr-2 flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-[#0082B3] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{a.area}</span>
                    </span>
                    <span className="text-[#0082B3] font-bold shrink-0 font-mono">
                      {a.count} <span className="text-[11px] font-normal text-slate-400">({a.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0EA5E9] to-[#0082B3] rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((a.count / maxAreaVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico 5: Distribución por Cultivo */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EDF2FA] text-[#1B3A57] flex items-center justify-center font-bold">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Demanda por Cultivo
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
                {cultivosRanking.length} cultivos
              </span>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {cultivosRanking.map((c, idx) => (
                <div key={c.cultivo} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#1B3A57] truncate pr-2 flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-[#1B3A57] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{c.cultivo}</span>
                    </span>
                    <span className="text-[#1B3A57] font-bold shrink-0 font-mono">
                      {c.count} <span className="text-[11px] font-normal text-slate-400">({c.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#3B82F6] to-[#1B3A57] rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((c.count / maxCultivoVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FILA C: DISTRIBUCIÓN ZONAL (DONUT) + MOVIMIENTO INGRESO/SALIDA + COMEDORES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Gráfico 6: Distribución Zonal (Donut Sur vs Norte) */}
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E5ECF2] shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                  Distribución por Zona
                </h3>
              </div>
            </div>

            {/* High-fidelity Donut representation */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-40 h-40 rounded-full flex items-center justify-center bg-slate-50 shadow-inner">
                <div
                  className="absolute inset-0 rounded-full transition-all duration-700"
                  style={{
                    background: `conic-gradient(#D97706 0% ${pctSur}%, #0082B3 ${pctSur}% 100%)`,
                  }}
                />
                <div className="w-26 h-26 rounded-full bg-white flex flex-col items-center justify-center z-10 shadow-xs border border-[#E5ECF2]">
                  <span className="text-2xl font-bold text-[#1B3A57] tabular-nums">{totalPersonal}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasajeros</span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#FFF6E0] p-3 rounded-xl border border-[#FDE68A] space-y-1">
                <div className="flex items-center gap-1.5 text-[#B45309] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                  <span>Zona Sur</span>
                </div>
                <div className="text-lg font-bold text-[#92400E] font-mono">
                  {totalZonaSur}{' '}
                  <span className="text-xs font-normal text-[#B45309]">({pctSur}%)</span>
                </div>
              </div>

              <div className="bg-[#E6F3FB] p-3 rounded-xl border border-[#D4E9F7] space-y-1">
                <div className="flex items-center gap-1.5 text-[#0082B3] font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0082B3] shrink-0" />
                  <span>Zona Norte</span>
                </div>
                <div className="text-lg font-bold text-[#1B3A57] font-mono">
                  {totalZonaNorte}{' '}
                  <span className="text-xs font-normal text-[#0082B3]">({pctNorte}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico 7: Movimiento (Ingreso vs Salida) */}
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E5ECF2] shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-[#EDF2FA] text-[#1B3A57] flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                  Flujo de Movimiento
                </h3>
              </div>
            </div>

            <div className="space-y-3.5 py-1">
              {/* Ingreso Card */}
              <div className="p-3.5 bg-[#EAF7E4]/70 rounded-xl border border-[#C6E9B4] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1B3A57]">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-[#2F7D18]" />
                    <span>Ingreso</span>
                  </span>
                  <span className="text-base font-bold text-[#2F7D18] font-mono">
                    {totalIngreso} <span className="text-xs font-normal text-[#55A529]">({pctIngreso}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-[#C6E9B4]/60 rounded-full overflow-hidden">
                  <div className="h-full bg-[#55A529] rounded-full" style={{ width: `${pctIngreso}%` }} />
                </div>
              </div>

              {/* Salida Card */}
              <div className="p-3.5 bg-[#E6F3FB]/70 rounded-xl border border-[#D4E9F7] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1B3A57]">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-[#0082B3]" />
                    <span>Salida</span>
                  </span>
                  <span className="text-base font-bold text-[#0082B3] font-mono">
                    {totalSalida} <span className="text-xs font-normal text-[#0082B3]/80">({pctSalida}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-[#D4E9F7] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0082B3] rounded-full" style={{ width: `${pctSalida}%` }} />
                </div>
              </div>
            </div>

            <div className="text-xs font-bold text-[#1B3A57] bg-[#F8FAFC] p-2.5 rounded-xl text-center border border-[#E5ECF2]">
              Total: <span className="text-[#2F7D18] font-extrabold">{totalPersonal}</span> personas
            </div>
          </div>

          {/* Gráfico 8: Demanda por Comedor / Garita */}
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#E5ECF2] shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF6E0] text-[#B45309] flex items-center justify-center font-bold">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                    Demanda por Comedor
                  </h3>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
                {comedoresRanking.length} comedores
              </span>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {comedoresRanking.map((c) => (
                <div key={c.comedor} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#1B3A57] truncate pr-2 font-mono">
                      Comedor {c.comedor}
                    </span>
                    <span className="text-[#B45309] font-bold shrink-0 font-mono">
                      {c.count} <span className="text-[11px] font-normal text-slate-400">({c.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((c.count / maxComedorVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-400 text-center pt-1 font-medium">
              Garitas y comedores de campo
            </div>
          </div>
        </div>

        {/* FILA D: TOP 15 PARADEROS CRÍTICOS */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E5ECF2] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                  Top Paraderos
                </h3>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-[#F1F5F9] px-3 py-1 rounded-full">
              Top {Math.min(paraderosRanking.length, 15)} de {distinctParaderos}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paraderosRanking.slice(0, 15).map((p, idx) => {
              const widthPct = Math.round((p.count / maxParaderoVal) * 100);
              return (
                <div
                  key={p.paradero}
                  className="bg-[#F8FAFC] hover:bg-[#F3F8F0] p-3.5 rounded-xl border border-[#E5ECF2] transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1B3A57] truncate pr-2 flex items-center gap-1.5" title={p.paradero}>
                      <span className="w-4 h-4 rounded-full text-[10px] font-mono font-bold bg-[#E5ECF2] text-[#1B3A57] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{p.paradero}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                        p.zona === 'SUR'
                          ? 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A]'
                          : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                      }`}
                    >
                      {p.zona}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-base font-bold text-[#2F7D18] font-mono">
                      {p.count}{' '}
                      <span className="text-[10px] font-normal text-slate-400">pasajeros</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">{p.pct}%</span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.zona === 'SUR' ? 'bg-amber-500' : 'bg-[#55A529]'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. TABLA RELACIONAL DETALLADA                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-[#E5ECF2] shadow-xs overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF7E4] text-[#2F7D18] flex items-center justify-center font-bold">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B3A57] tracking-tight">
                Estructura de datos normalizada
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                Registros individuales preparados para auditoría o exportación a Power BI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Input de Búsqueda píldora */}
            <div className="relative">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                placeholder="Buscar paradero, fundo, área..."
                className="pl-4 pr-9 h-9 bg-white border border-[#D8E2EA] rounded-full text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#55A529] w-56 sm:w-64 transition-colors"
              />
              <Search className="w-4 h-4 text-[#55A529] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <span className="text-[11px] font-semibold text-[#2F7D18] bg-[#EAF7E4] px-3 py-1 rounded-full shrink-0 border border-[#C6E9B4]">
              {tableFilteredRows.length} registros
            </span>
          </div>
        </div>

        {/* Tabla Responsive con cabecera celeste corporativa */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="bg-[#E6F3FB] text-[#0082B3] font-semibold border-y border-[#D4E9F7] text-[11px]">
                <th className="py-2.5 px-3 whitespace-nowrap">N° Req</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Hora</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Área</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Fundo</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Cultivo</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Mov.</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Zona</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Paradero</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Comedor</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Solicitante</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Cantidad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-slate-700">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400 italic">
                    No hay registros para mostrar con los filtros aplicados
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-[#F7FBFE] transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#1B3A57]">
                      {row.numeroRequerimiento}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{row.fecha}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#1B3A57]">{row.hora}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{row.area}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#1B3A57]">{row.fundo}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#2F7D18]">{row.cultivo}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          row.movimiento === 'INGRESO'
                            ? 'bg-[#EAF7E4] text-[#2F7D18] border-[#C6E9B4]'
                            : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                        }`}
                      >
                        {row.movimiento}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          row.zona === 'SUR'
                            ? 'bg-[#FFF6E0] text-[#B45309] border-[#FDE68A]'
                            : 'bg-[#E6F3FB] text-[#0082B3] border-[#D4E9F7]'
                        }`}
                      >
                        {row.zona}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#1B3A57]">{row.paradero}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 font-medium">{row.parcela}</td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">
                      {row.usuario}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-xs text-[#2F7D18] font-mono">
                      {row.cantidad}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8FAFC] font-bold text-xs text-[#1B3A57] border-t border-[#E5ECF2]">
                <td colSpan={11} className="py-2.5 px-3">
                  Total personal consolidado (filtrado)
                </td>
                <td className="py-2.5 px-3 text-right text-sm font-bold text-[#2F7D18] font-mono">
                  {totalPersonal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Paginación de Tabla */}
        {tableFilteredRows.length > pageSize && (
          <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">
              Página <strong className="text-[#1B3A57]">{tablePage}</strong> de{' '}
              <strong className="text-[#1B3A57]">{totalPages}</strong> ({tableFilteredRows.length} registros)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={tablePage === 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-[#D8E2EA] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-white border border-[#D8E2EA] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-full font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. PILARES OPERATIVOS DE CAMPOSOL                             */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#55A529] uppercase tracking-wider block">
            Datos en Tiempo Real
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">Captura Móvil 100%</p>
          <span className="text-[11px] text-slate-400 block">
            Registrado por supervisores desde campo
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#55A529] uppercase tracking-wider block">
            Información Normalizada
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">Sin duplicidad</p>
          <span className="text-[11px] text-slate-400 block">
            Esquema relacional limpio para BI
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#55A529] uppercase tracking-wider block">
            Compatibilidad Power BI
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">Conexión Directa</p>
          <span className="text-[11px] text-slate-400 block">
            Exporta CSV estructurado UTF-8
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#55A529] uppercase tracking-wider block">
            Demanda Operativa
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">Total Pasajeros</p>
          <span className="text-[11px] text-slate-400 block">
            Consolidado exacto por turno y paradero
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E5ECF2] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#55A529] uppercase tracking-wider block">
            Auditoría Inmediata
          </span>
          <p className="text-xs font-bold text-[#1B3A57]">Reportes Excel</p>
          <span className="text-[11px] text-slate-400 block">
            Consolidados listos para gerencia
          </span>
        </div>
      </div>
    </div>
  );
};
