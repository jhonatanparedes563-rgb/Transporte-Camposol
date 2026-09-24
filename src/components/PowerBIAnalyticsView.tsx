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
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('');
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('');
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
      const matched = detalles.filter(
        (d) => d.requerimientoId === req.id || d.numeroRequerimiento === req.numeroRequerimiento
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

  // Estimación de Flota (Standard 40-pax bus + 15-pax vans)
  const estimatedBuses = Math.ceil(totalPersonal / 40);
  const estimatedVans = Math.ceil(totalPersonal / 15);

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
    setFilterFechaDesde('');
    setFilterFechaHasta('');
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
    !!filterFechaDesde ||
    !!filterFechaHasta;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER EJECUTIVO & ACCIONES GLOBALES                       */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle accent bar on top */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#00843D] via-[#059669] to-[#173B56]" />

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#00843D] font-bold text-[11px] border border-emerald-200/70">
              <span className="w-2 h-2 rounded-full bg-[#00843D] animate-pulse" />
              CAMPOSOL • DATOS OPERATIVOS REALES
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-semibold text-[11px]">
              {distinctReqs} requerimientos activos
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 font-semibold text-[11px]">
              {totalPersonal.toLocaleString()} colaboradores en tránsito
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173B56] tracking-tight">
            Centro de Reportes & Analítica de Transporte
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-normal leading-relaxed">
            Consolidado gerencial de demanda de pasajeros, cálculo de flota requerida y distribución territorial por fundo y paradero.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportExcelDetailed}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#173B56] hover:bg-[#122e44] active:bg-[#0d2232] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer group"
            title="Exportar archivo Excel oficial para gerencia"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Descargar Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportPowerBIDataset}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00843D] hover:bg-[#007034] active:bg-[#005c2b] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer group"
            title="Descargar dataset estructurado para Power BI Desktop"
          >
            <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Dataset Power BI (CSV)</span>
          </button>

          <button
            onClick={refreshData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-[#173B56] rounded-xl transition-all cursor-pointer"
            title="Refrescar datos operativos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00843D] shrink-0" />
            <span>{exportSuccess}</span>
          </div>
          <button
            onClick={() => setExportSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer font-medium"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PANEL DE FILTROS MULTIDIMENSIONALES                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Filtros de Segmentación Operativa
              </h3>
              <p className="text-[11px] text-slate-500">
                Segmenta por zona, fundo, centro de costos o fecha operativa
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick date presets segmented buttons */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  const today = getTodayStr();
                  setFilterFechaDesde(today);
                  setFilterFechaHasta(today);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterFechaDesde === getTodayStr() && filterFechaHasta === getTodayStr()
                    ? 'bg-white text-[#00843D] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterFechaDesde === getYesterdayStr() && filterFechaHasta === getYesterdayStr()
                    ? 'bg-white text-[#00843D] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterFechaDesde === getTomorrowStr() && filterFechaHasta === getTomorrowStr()
                    ? 'bg-white text-[#00843D] shadow-xs'
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
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  !filterFechaDesde && !filterFechaHasta
                    ? 'bg-white text-[#00843D] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial Completo
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors border border-red-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Form controls grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
          {/* Zona */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Zona Operativa
            </label>
            <select
              value={filterZona}
              onChange={(e) => setFilterZona(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer"
            >
              <option value="TODAS">Todas las Zonas</option>
              <option value="SUR">Zona Sur</option>
              <option value="NORTE">Zona Norte</option>
            </select>
          </div>

          {/* Fundo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fundo Destino
            </label>
            <select
              value={filterFundo}
              onChange={(e) => setFilterFundo(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer"
            >
              <option value="TODOS">Todos los Fundos</option>
              {availableFundos.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Área */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Área Solicitante
            </label>
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer"
            >
              <option value="TODAS">Todas las Áreas</option>
              {availableAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Cultivo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Cultivo
            </label>
            <select
              value={filterCultivo}
              onChange={(e) => setFilterCultivo(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer"
            >
              <option value="TODOS">Todos los Cultivos</option>
              {availableCultivos.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Movimiento */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Movimiento
            </label>
            <select
              value={filterMovimiento}
              onChange={(e) => setFilterMovimiento(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer"
            >
              <option value="TODOS">Todos (Ingreso/Salida)</option>
              <option value="INGRESO">Ingreso (A Fundos)</option>
              <option value="SALIDA">Salida (A Paraderos)</option>
            </select>
          </div>

          {/* Fecha Desde */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fecha Desde
            </label>
            <input
              type="date"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer text-xs"
            />
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] transition-all cursor-pointer text-xs"
            />
          </div>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between pt-2 text-xs border-t border-slate-100 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Registros filtrados:
            </span>
            <span className="font-bold text-[#173B56]">
              {filteredRows.length} asignaciones
            </span>
            <span>·</span>
            <span className="font-bold text-[#00843D]">
              {totalPersonal.toLocaleString()} pasajeros
            </span>
          </div>

          {hasActiveFilters && (
            <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
              Filtro activo
            </span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ROW DE 6 KPIS GERENCIALES                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Personas Totales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Personal Total
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#00843D] tracking-tight tabular-nums">
              {totalPersonal.toLocaleString()}
            </div>
            <div className="mt-1.5 space-y-1">
              {/* Dual mini progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#00843D]"
                  style={{ width: `${pctIngreso}%` }}
                  title={`Ingreso: ${pctIngreso}%`}
                />
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${pctSalida}%` }}
                  title={`Salida: ${pctSalida}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>{pctIngreso}% Ing.</span>
                <span>{pctSalida}% Sal.</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Requerimientos */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Requerimientos
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-[#173B56] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#173B56] tracking-tight tabular-nums">
              {distinctReqs}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              {filteredRows.length} paraderos solicitados
            </div>
          </div>
        </div>

        {/* KPI 3: Estimación de Flota */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Flota Sugerida
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bus className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight tabular-nums">
              ~{estimatedBuses}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              Buses (40 pax) ó {estimatedVans} Vans
            </div>
          </div>
        </div>

        {/* KPI 4: Fundos Activos */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Fundos Activos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center">
              <Building className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight tabular-nums">
              {distinctFundos}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1 truncate" title={fundosRanking[0]?.fundo}>
              Top: <strong className="text-slate-700">{fundosRanking[0]?.fundo || 'N/A'}</strong>
            </div>
          </div>
        </div>

        {/* KPI 5: Paraderos con Demanda */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Paraderos Activos
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-sky-700 tracking-tight tabular-nums">
              {distinctParaderos}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1 truncate" title={paraderosRanking[0]?.paradero}>
              Líder: <strong className="text-slate-700">{paraderosRanking[0]?.paradero || 'N/A'}</strong>
            </div>
          </div>
        </div>

        {/* KPI 6: Balance Zonal */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition-all space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Balance Zonal
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Compass className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-800">Norte: {totalZonaNorte}</span>
              <span className="text-amber-800">Sur: {totalZonaSur}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-indigo-600" style={{ width: `${pctNorte}%` }} title={`Norte: ${pctNorte}%`} />
              <div className="h-full bg-amber-500" style={{ width: `${pctSur}%` }} title={`Sur: ${pctSur}%`} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>{pctNorte}% Norte</span>
              <span>{pctSur}% Sur</span>
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
          {/* Gráfico 1: Evolución Diaria (Columnas estilizadas y elegantes) */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Evolución Diaria del Personal
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Demanda de transporte consolidada por fecha operativa
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#00843D] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200/60">
                {timelineData.length} fechas registradas
              </span>
            </div>

            {timelineData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs italic">
                No hay requerimientos en el rango de fechas seleccionado
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Visual Chart with horizontal guides and slender bars */}
                <div className="h-56 flex items-end gap-3 sm:gap-6 px-4 pt-6 pb-2 border-b border-slate-200/80 relative">
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
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 bg-[#173B56] text-white text-[11px] py-1.5 px-3 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-lg border border-slate-700">
                          <div className="font-bold">{dateMeta.dayName ? `${dateMeta.dayName}, ` : ''}{d.date}</div>
                          <div className="text-emerald-300 font-extrabold">{d.personal} personas ({d.reqs} req.)</div>
                        </div>

                        {/* Top count pill */}
                        <div className="mb-1.5 transition-transform group-hover:scale-110">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black text-[#00843D] bg-emerald-50 border border-emerald-200/60 shadow-2xs">
                            {d.personal}
                          </span>
                        </div>

                        {/* Bar column with background track */}
                        <div className="w-full bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-full">
                          <div
                            className="w-full bg-gradient-to-t from-[#00843D] via-[#059669] to-[#10B981] rounded-t-xl transition-all duration-500 group-hover:brightness-110 shadow-xs"
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
                        <div className="text-xs font-bold text-slate-700">
                          {dateMeta.dayMonth}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 2: Picos por Franja Horaria (Turnos Críticos) */}
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Picos de Demanda por Horario
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Despacho de flota por franja operativa
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {totalPersonal} pers.
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {timeSlotsData.map((slot, index) => {
                const pct = totalPersonal > 0 ? Math.round((slot.count / totalPersonal) * 100) : 0;
                const widthPct = Math.round((slot.count / (maxTimeSlotVal || 1)) * 100);
                const busesInSlot = Math.ceil(slot.count / 40);

                // Distinct colors for shifts
                const colors = [
                  { bar: 'from-amber-500 to-amber-600', badge: 'text-amber-700 bg-amber-50' },
                  { bar: 'from-emerald-500 to-emerald-600', badge: 'text-emerald-700 bg-emerald-50' },
                  { bar: 'from-orange-500 to-orange-600', badge: 'text-orange-700 bg-orange-50' },
                  { bar: 'from-sky-500 to-blue-600', badge: 'text-blue-700 bg-blue-50' },
                  { bar: 'from-indigo-500 to-indigo-700', badge: 'text-indigo-700 bg-indigo-50' },
                ];
                const theme = colors[index % colors.length];

                return (
                  <div key={slot.name} className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{slot.name}</span>
                        {slot.count > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${theme.badge}`}>
                            ~{busesInSlot} bus{busesInSlot > 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 text-[11px]">{pct}%</span>
                        <span className="text-slate-900 font-black">{slot.count} pers.</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Demanda por Fundo
                  </h3>
                  <p className="text-[11px] text-slate-500">Destino de cuadrillas</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {fundosRanking.length} fundos
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {fundosRanking.map((f, idx) => (
                <div key={f.fundo} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 truncate pr-2 flex items-center gap-1.5">
                      <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-[#00843D] text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{f.fundo}</span>
                    </span>
                    <span className="text-[#00843D] font-black shrink-0 font-mono">
                      {f.count} <span className="text-[10px] font-normal text-slate-400">({f.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00843D] to-[#10B981] rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((f.count / maxFundoVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico 4: Demanda por Área */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Demanda por Área
                  </h3>
                  <p className="text-[11px] text-slate-500">Centro de costos solicitante</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {areasRanking.length} áreas
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {areasRanking.map((a, idx) => (
                <div key={a.area} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 truncate pr-2 flex items-center gap-1.5">
                      <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{a.area}</span>
                    </span>
                    <span className="text-sky-700 font-black shrink-0 font-mono">
                      {a.count} <span className="text-[10px] font-normal text-slate-400">({a.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((a.count / maxAreaVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico 5: Distribución por Cultivo */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Demanda por Cultivo
                  </h3>
                  <p className="text-[11px] text-slate-500">Líneas de producción agrícola</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {cultivosRanking.length} cultivos
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {cultivosRanking.map((c, idx) => (
                <div key={c.cultivo} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 truncate pr-2 flex items-center gap-1.5">
                      <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold font-mono ${
                        idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{c.cultivo}</span>
                    </span>
                    <span className="text-indigo-700 font-black shrink-0 font-mono">
                      {c.count} <span className="text-[10px] font-normal text-slate-400">({c.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
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
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Distribución por Zona
                </h3>
                <p className="text-[11px] text-slate-500">Rutas Sur vs Rutas Norte</p>
              </div>
            </div>

            {/* High-fidelity Donut representation */}
            <div className="flex items-center justify-center py-3">
              <div className="relative w-44 h-44 rounded-full flex items-center justify-center bg-slate-50 shadow-inner">
                <div
                  className="absolute inset-0 rounded-full transition-all duration-700"
                  style={{
                    background: `conic-gradient(#D97706 0% ${pctSur}%, #0284C7 ${pctSur}% 100%)`,
                  }}
                />
                <div className="w-28 h-28 rounded-full bg-white flex flex-col items-center justify-center z-10 shadow-sm border border-slate-100">
                  <span className="text-2xl font-black text-[#173B56] tabular-nums">{totalPersonal}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pasajeros</span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
                  <span>Zona Sur</span>
                </div>
                <div className="text-lg font-black text-amber-900 font-mono">
                  {totalZonaSur}{' '}
                  <span className="text-xs font-normal text-amber-700">({pctSur}%)</span>
                </div>
                <div className="text-[10px] text-amber-700 font-medium">
                  ~{Math.ceil(totalZonaSur / 40)} buses asignados
                </div>
              </div>

              <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200/70 space-y-1">
                <div className="flex items-center gap-1.5 text-sky-800 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
                  <span>Zona Norte</span>
                </div>
                <div className="text-lg font-black text-sky-900 font-mono">
                  {totalZonaNorte}{' '}
                  <span className="text-xs font-normal text-sky-700">({pctNorte}%)</span>
                </div>
                <div className="text-[10px] text-sky-700 font-medium">
                  ~{Math.ceil(totalZonaNorte / 40)} buses asignados
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico 7: Movimiento (Ingreso vs Salida) */}
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Flujo de Movimiento
                </h3>
                <p className="text-[11px] text-slate-500">Ingreso a labores vs Retorno</p>
              </div>
            </div>

            <div className="space-y-4 py-2">
              {/* Ingreso Card */}
              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-[#00843D]" />
                    <span>INGRESO (Subida a fundos)</span>
                  </span>
                  <span className="text-base font-black text-[#00843D] font-mono">{totalIngreso} pers.</span>
                </div>
                <div className="w-full h-2 bg-emerald-200/70 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00843D] rounded-full" style={{ width: `${pctIngreso}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                  <span>~{Math.ceil(totalIngreso / 40)} unidades de subida</span>
                  <span className="font-bold">{pctIngreso}% del total</span>
                </div>
              </div>

              {/* Salida Card */}
              <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-blue-700" />
                    <span>SALIDA (Retorno a paraderos)</span>
                  </span>
                  <span className="text-base font-black text-blue-800 font-mono">{totalSalida} pers.</span>
                </div>
                <div className="w-full h-2 bg-blue-200/70 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pctSalida}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-700 font-medium">
                  <span>~{Math.ceil(totalSalida / 40)} unidades de retorno</span>
                  <span className="font-bold">{pctSalida}% del total</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-2.5">
              Suma combinada: <strong className="text-slate-800">{totalPersonal} personas en tránsito</strong>
            </div>
          </div>

          {/* Gráfico 8: Demanda por Comedor / Garita */}
          <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Demanda por Comedor
                  </h3>
                  <p className="text-[11px] text-slate-500">Garitas y comedores de campo</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {comedoresRanking.length} comedores
              </span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {comedoresRanking.map((c) => (
                <div key={c.comedor} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 truncate pr-2 font-mono">
                      Comedor {c.comedor}
                    </span>
                    <span className="text-orange-700 font-black shrink-0 font-mono">
                      {c.count} <span className="text-[10px] font-normal text-slate-400">({c.pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((c.count / maxComedorVal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-2.5">
              Control logístico de alimentación y garitas
            </div>
          </div>
        </div>

        {/* FILA D: TOP 15 PARADEROS CRÍTICOS */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Top 15 Paraderos con Mayor Afluencia
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ranking operativo ordenado por volumen de colaboradores transportados
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
              Mostrando {Math.min(paraderosRanking.length, 15)} de {distinctParaderos} paraderos
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paraderosRanking.slice(0, 15).map((p, idx) => {
              const widthPct = Math.round((p.count / maxParaderoVal) * 100);
              return (
                <div
                  key={p.paradero}
                  className="bg-slate-50/70 hover:bg-emerald-50/40 p-3.5 rounded-xl border border-slate-200/70 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate pr-2 flex items-center gap-1.5" title={p.paradero}>
                      <span className="w-4 h-4 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{p.paradero}</span>
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 ${
                        p.zona === 'SUR'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {p.zona}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-base font-extrabold text-[#00843D] font-mono">
                      {p.count}{' '}
                      <span className="text-[10px] font-normal text-slate-400">pasajeros</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">{p.pct}%</span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.zona === 'SUR' ? 'bg-amber-500' : 'bg-[#00843D]'
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
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Estructura de Datos Normalizada (Dataset Fino)
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                Registros individuales preparados para auditoría o exportación a Power BI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Input de Búsqueda */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setTablePage(1);
                }}
                placeholder="Buscar por paradero, fundo, área..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00843D]/20 focus:border-[#00843D] w-56 sm:w-72 transition-all"
              />
            </div>

            <span className="text-xs font-bold text-[#00843D] bg-emerald-50 px-3 py-1.5 rounded-xl shrink-0 border border-emerald-200/60">
              {tableFilteredRows.length} registros
            </span>
          </div>
        </div>

        {/* Tabla Responsive */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3">N° Req</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Hora</th>
                  <th className="py-3 px-3">Área</th>
                  <th className="py-3 px-3">Fundo</th>
                  <th className="py-3 px-3">Cultivo</th>
                  <th className="py-3 px-3">Mov.</th>
                  <th className="py-3 px-3">Zona</th>
                  <th className="py-3 px-3">Paradero</th>
                  <th className="py-3 px-3">Comedor</th>
                  <th className="py-3 px-3">Solicitante</th>
                  <th className="py-3 px-3 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      className={`${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } hover:bg-emerald-50/40 transition-colors`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {row.numeroRequerimiento}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{row.fecha}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{row.hora}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{row.area}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.fundo}</td>
                      <td className="py-2.5 px-3 font-bold text-[#00843D]">{row.cultivo}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            row.movimiento === 'INGRESO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {row.movimiento}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            row.zona === 'SUR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {row.zona}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{row.paradero}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 font-medium">{row.parcela}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">
                        {row.usuario}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-sm text-[#00843D] font-mono">
                        {row.cantidad}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-xs text-slate-800 border-t-2 border-slate-200">
                  <td colSpan={11} className="py-3 px-3 uppercase tracking-tight font-black">
                    TOTAL PERSONAL CONSOLIDADO (FILTRADO)
                  </td>
                  <td className="py-3 px-3 text-right text-base font-black text-[#00843D] font-mono">
                    {totalPersonal.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Paginación de Tabla */}
        {tableFilteredRows.length > pageSize && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <span className="text-slate-500 font-medium">
              Página <strong className="text-slate-900">{tablePage}</strong> de{' '}
              <strong className="text-slate-900">{totalPages}</strong> ({tableFilteredRows.length} registros totales)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={tablePage === 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
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
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#00843D] uppercase tracking-wider block">
            Datos en Tiempo Real
          </span>
          <p className="text-xs font-bold text-slate-900">Captura Móvil 100%</p>
          <span className="text-[11px] text-slate-400 block">
            Registrado por supervisores desde campo
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#00843D] uppercase tracking-wider block">
            Información Normalizada
          </span>
          <p className="text-xs font-bold text-slate-900">Sin duplicidad</p>
          <span className="text-[11px] text-slate-400 block">
            Esquema relacional limpio para BI
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#00843D] uppercase tracking-wider block">
            Compatibilidad Power BI
          </span>
          <p className="text-xs font-bold text-slate-900">Conexión Directa</p>
          <span className="text-[11px] text-slate-400 block">
            Exporta CSV estructurado UTF-8
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#00843D] uppercase tracking-wider block">
            Control de Capacidad
          </span>
          <p className="text-xs font-bold text-slate-900">Cálculo de Flota</p>
          <span className="text-[11px] text-slate-400 block">
            Estimación de buses y optimización de rutas
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#00843D] uppercase tracking-wider block">
            Auditoría Inmediata
          </span>
          <p className="text-xs font-bold text-slate-900">Reportes Excel</p>
          <span className="text-[11px] text-slate-400 block">
            Consolidados listos para gerencia
          </span>
        </div>
      </div>
    </div>
  );
};
