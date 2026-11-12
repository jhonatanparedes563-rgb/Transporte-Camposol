import React, { useState, useMemo, useEffect } from 'react';
import {
  Bus,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Sliders,
  Users,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Printer,
  Compass,
  Search,
  Filter,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  Requerimiento,
  DetalleRequerimiento,
  MaestroUnidadBus,
  ProgramacionViajesDia,
  ViajeProgramado,
  MovimientoType,
} from '../types';
import {
  getStoredUnidadesBus,
  getStoredProgramacionesViajes,
  saveStoredProgramacionViaje,
  getStoredRequerimientos,
  getStoredDetalles,
} from '../services/storageService';
import {
  optimizarViajes,
  exportarPlanViajesExcel,
  getWeekNumber,
  formatDateDDMMYYYY,
  FLOTA_REFERENCIAL,
} from '../services/tripOptimizationService';

interface TripOptimizationScreenProps {
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  onBack?: () => void;
}

const getTodayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const TripOptimizationScreen: React.FC<TripOptimizationScreenProps> = ({
  requerimientos,
  detalles,
  onBack,
}) => {
  // Filtros de optimización
  const [selectedFecha, setSelectedFecha] = useState<string>(() => {
    // Si hay requerimientos, seleccionar la fecha del primer requerimiento activo más reciente o hoy
    const allReqs = requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
    const activeReqs = allReqs.filter((r) => r.estado !== 'ANULADO' && r.estado !== 'RECHAZADO');
    const today = getTodayStr();
    if (activeReqs.some((r) => r.fecha === today)) {
      return today;
    }
    const dates = Array.from(new Set(activeReqs.map((r) => r.fecha))).sort().reverse();
    return dates[0] || today;
  });

  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoType | 'TODOS'>('TODOS');
  const [selectedTurno, setSelectedTurno] = useState<string>('TODOS');
  const [permitirJuntarFundos, setPermitirJuntarFundos] = useState<boolean>(true);
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  // Unidades disponibles
  const [unidades, setUnidades] = useState<MaestroUnidadBus[]>(() => getStoredUnidadesBus());

  // Plan actual generado
  const [planActual, setPlanActual] = useState<ProgramacionViajesDia | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  // Edición rápida de celda activa
  const [editingCell, setEditingCell] = useState<{
    viajeId: string;
    field: 'placa' | 'conductor' | 'dni' | 'proveedor' | 'sayta' | 'observaciones' | 'plan';
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cargar unidades guardadas
  useEffect(() => {
    setUnidades(getStoredUnidadesBus());
  }, []);

  // Detectar fechas que tienen requerimientos activos en Procesos
  const fechasConDemanda = useMemo(() => {
    const map = new Map<string, { count: number; pax: number }>();
    const allReqs = requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
    allReqs
      .filter((r) => r.estado !== 'ANULADO' && r.estado !== 'RECHAZADO')
      .forEach((r) => {
        const cur = map.get(r.fecha) || { count: 0, pax: 0 };
        map.set(r.fecha, { count: cur.count + 1, pax: cur.pax + (r.totalPersonas || 0) });
      });
    return Array.from(map.entries())
      .map(([fecha, data]) => ({ fecha, ...data }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [requerimientos]);

  // Generar o cargar automáticamente el plan inicial al cambiar requerimientos o fecha
  useEffect(() => {
    const liveReqs = requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
    const liveDets = detalles.length > 0 ? detalles : getStoredDetalles();
    const storedPlans = getStoredProgramacionesViajes();
    const existing = storedPlans.find((p) => p.fecha === selectedFecha);
    if (existing && existing.viajes && existing.viajes.length > 0) {
      setPlanActual(existing);
    } else {
      // Auto-generar a partir de los requerimientos reales de Procesos
      const plan = optimizarViajes(liveReqs, liveDets, {
        fecha: selectedFecha,
        movimiento: selectedMovimiento,
        turno: selectedTurno,
        permitirJuntarFundos,
        unidadesDisponibles: unidades,
      });
      if (plan.viajes.length > 0) {
        setPlanActual(plan);
      }
    }
  }, [selectedFecha, requerimientos, detalles, selectedMovimiento, selectedTurno, permitirJuntarFundos]);

  // Turnos disponibles en la fecha seleccionada
  const turnosDisponibles = useMemo(() => {
    const set = new Set<string>();
    const allReqs = requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
    allReqs
      .filter((r) => (selectedFecha === 'TODOS' || r.fecha === selectedFecha) && r.estado !== 'ANULADO' && r.estado !== 'RECHAZADO')
      .forEach((r) => {
        if (r.horaRecojo) set.add(r.horaRecojo);
        if (r.horaSalida) set.add(r.horaSalida);
      });
    return Array.from(set).sort();
  }, [requerimientos, selectedFecha]);

  // Demanda bruta en Procesos para la fecha
  const demandaProcesos = useMemo(() => {
    const allReqs = requerimientos.length > 0 ? requerimientos : getStoredRequerimientos();
    const reqs = allReqs.filter((r) => {
      if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') return false;
      if (selectedFecha !== 'TODOS' && r.fecha !== selectedFecha) return false;
      if (selectedMovimiento !== 'TODOS' && r.movimiento !== selectedMovimiento) return false;
      if (selectedTurno !== 'TODOS' && r.horaRecojo !== selectedTurno && r.horaSalida !== selectedTurno) return false;
      return true;
    });

    const totalPasajeros = reqs.reduce((sum, r) => sum + (r.totalPersonas || 0), 0);
    const fundos = Array.from(new Set(reqs.map((r) => r.fundo))).filter(Boolean);
    const areas = Array.from(new Set(reqs.map((r) => r.area))).filter(Boolean);

    return {
      reqsCount: reqs.length,
      totalPasajeros,
      fundos,
      areas,
    };
  }, [requerimientos, selectedFecha, selectedMovimiento, selectedTurno]);

  // Función principal: Jalar datos de Procesos y re-optimizar directamente
  const handleJalarDatosProcesos = () => {
    const liveReqs = getStoredRequerimientos();
    const liveDets = getStoredDetalles();

    const activeReqs = liveReqs.filter((r) => {
      if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') return false;
      if (selectedFecha !== 'TODOS' && r.fecha !== selectedFecha) return false;
      if (selectedMovimiento !== 'TODOS' && r.movimiento !== selectedMovimiento) return false;
      if (selectedTurno !== 'TODOS' && r.horaRecojo !== selectedTurno && r.horaSalida !== selectedTurno) return false;
      return true;
    });

    if (activeReqs.length === 0) {
      showToast(
        `No se encontraron solicitudes activas en Procesos para ${
          selectedFecha === 'TODOS' ? 'los filtros seleccionados' : formatDateDDMMYYYY(selectedFecha)
        }.`
      );
      return;
    }

    setIsOptimizing(true);
    setTimeout(() => {
      const plan = optimizarViajes(liveReqs, liveDets, {
        fecha: selectedFecha,
        movimiento: selectedMovimiento,
        turno: selectedTurno,
        permitirJuntarFundos,
        unidadesDisponibles: unidades,
      });

      setPlanActual(plan);
      saveStoredProgramacionViaje(plan);
      setIsOptimizing(false);
      showToast(
        `¡Programa oficial generado! Se programaron ${plan.viajes.length} servicios para ${plan.totalPasajeros} pasajeros desde Procesos.`
      );
    }, 250);
  };

  // Guardar programa oficial
  const handleGuardarPrograma = () => {
    if (!planActual || planActual.viajes.length === 0) return;
    saveStoredProgramacionViaje(planActual);
    showToast('Programa de viajes guardado exitosamente en el registro oficial.');
  };

  // Exportar Excel oficial (formato exacto de 26 columnas)
  const handleExportarExcel = () => {
    if (!planActual || planActual.viajes.length === 0) {
      showToast('No hay servicios en el programa para exportar.');
      return;
    }
    exportarPlanViajesExcel(planActual);
    showToast('Descargando archivo Excel oficial del Programa de Viajes.');
  };

  // Actualizar campo de viaje inline
  const handleUpdateViajeField = (viajeId: string, field: keyof ViajeProgramado, value: any) => {
    if (!planActual) return;
    const updatedViajes = planActual.viajes.map((v) => {
      if (v.id !== viajeId) return v;
      const updated = { ...v, [field]: value };
      if (field === 'plan') {
        const planNum = Number(value) || 0;
        updated.plan = planNum;
        updated.totalPasajeros = planNum;
        updated.porcentajeOcupacion = updated.capacidadUnidad > 0 ? Math.round((planNum / updated.capacidadUnidad) * 100) : 0;
      }
      return updated;
    });

    const totalPasajeros = updatedViajes.reduce((sum, v) => sum + (v.plan || v.totalPasajeros), 0);
    const totalCapacidad = updatedViajes.reduce((sum, v) => sum + v.capacidadUnidad, 0);
    const eficiencia = totalCapacidad > 0 ? Math.round((totalPasajeros / totalCapacidad) * 1000) / 10 : 0;

    setPlanActual({
      ...planActual,
      viajes: updatedViajes,
      totalPasajeros,
      totalCapacidad,
      eficienciaGlobal: eficiencia,
    });
  };

  // Cambiar unidad de bus para un viaje
  const handleChangeUnidadViaje = (viajeId: string, nuevaUnidadNombre: string) => {
    if (!planActual) return;
    const targetUnidad = unidades.find((u) => u.nombre === nuevaUnidadNombre) || {
      id: `BUS-CUSTOM-${Date.now()}`,
      nombre: nuevaUnidadNombre,
      capacidad: 40,
      activo: true,
    };

    const updatedViajes = planActual.viajes.map((v) => {
      if (v.id !== viajeId) return v;
      const cap = targetUnidad.capacidad;
      const planVal = v.plan || v.totalPasajeros;
      const ocupacion = Math.round((planVal / cap) * 100);
      return {
        ...v,
        unidad: targetUnidad,
        movil: targetUnidad.nombre,
        capacidadUnidad: cap,
        capSayta: cap,
        porcentajeOcupacion: Math.min(100, ocupacion),
        asientosDisponibles: Math.max(0, cap - planVal),
      };
    });

    const totalCapacidad = updatedViajes.reduce((sum, v) => sum + v.capacidadUnidad, 0);
    const totalPasajeros = updatedViajes.reduce((sum, v) => sum + (v.plan || v.totalPasajeros), 0);
    const eficiencia = totalCapacidad > 0 ? Math.round((totalPasajeros / totalCapacidad) * 1000) / 10 : 0;

    setPlanActual({
      ...planActual,
      viajes: updatedViajes,
      totalCapacidad,
      eficienciaGlobal: eficiencia,
    });
    showToast(`Unidad cambiada a "${targetUnidad.nombre}" (${targetUnidad.capacidad} pax).`);
  };

  // Filtrado reactivo en la tabla
  const viajesFiltrados = useMemo(() => {
    if (!planActual || !planActual.viajes) return [];
    const q = searchTableQuery.toLowerCase().trim();
    if (!q) return planActual.viajes;

    return planActual.viajes.filter((v) => {
      return (
        (v.fundo && v.fundo.toLowerCase().includes(q)) ||
        (v.area && v.area.toLowerCase().includes(q)) ||
        (v.conductor && v.conductor.toLowerCase().includes(q)) ||
        (v.placa && v.placa.toLowerCase().includes(q)) ||
        (v.proveedor && v.proveedor.toLowerCase().includes(q)) ||
        (v.destino && v.destino.toLowerCase().includes(q)) ||
        (v.paraderoInicial && v.paraderoInicial.toLowerCase().includes(q)) ||
        (v.encargado && v.encargado.toLowerCase().includes(q)) ||
        (v.sayta && v.sayta.toLowerCase().includes(q)) ||
        (v.servicioNumero && v.servicioNumero.toString().includes(q))
      );
    });
  }, [planActual, searchTableQuery]);

  // Totales de la vista actual
  const totalesVista = useMemo(() => {
    const totalPlan = viajesFiltrados.reduce((sum, v) => sum + (v.plan || v.totalPasajeros || 0), 0);
    const totalCap = viajesFiltrados.reduce((sum, v) => sum + (v.capacidadUnidad || 0), 0);
    const ocupacion = totalCap > 0 ? Math.round((totalPlan / totalCap) * 100) : 0;
    return {
      servicios: viajesFiltrados.length,
      totalPlan,
      totalCap,
      ocupacion,
    };
  }, [viajesFiltrados]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#173B56] text-white px-5 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Enterprise Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00843D] to-emerald-700 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Bus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-100 text-[#00843D] rounded-md tracking-wider">
                Control de Despacho • CAMPOSOL
              </span>
              <span className="text-xs text-gray-400 font-bold">
                Semana {getWeekNumber(selectedFecha)} | {formatDateDDMMYYYY(selectedFecha)}
              </span>
            </div>
            <h1 className="text-lg font-black text-[#173B56] tracking-tight mt-0.5">
              Programa de Viajes y Asignación de Flota
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          <button
            type="button"
            onClick={handleJalarDatosProcesos}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#00843D] to-emerald-600 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
            title="Sincronizar y generar programa a partir de los requerimientos de Procesos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>Jalar Datos de Procesos</span>
          </button>

          <button
            type="button"
            onClick={handleExportarExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-[#00843D] hover:bg-emerald-100 border border-[#00843D]/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Exportar archivo Excel idéntico a la plantilla oficial de 26 columnas"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Excel Oficial</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarPrograma}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#173B56] hover:bg-[#1a4463] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Guardar este programa en el registro oficial"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Programa</span>
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              Volver
            </button>
          )}
        </div>
      </div>

      {/* Operational Control Bar: Date, Shift, Movement and Search */}
      <div className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Selector de Fechas con Solicitudes en Procesos */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-[#00843D]" />
            <span className="font-bold text-gray-600">Fecha:</span>
            <select
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              className="bg-transparent font-bold text-[#173B56] focus:outline-none cursor-pointer text-xs"
            >
              <option value={getTodayStr()}>HOY ({formatDateDDMMYYYY(getTodayStr())})</option>
              {fechasConDemanda.map((f) => (
                <option key={f.fecha} value={f.fecha}>
                  {formatDateDDMMYYYY(f.fecha)} ({f.count} reqs • {f.pax} pax){f.fecha === getTodayStr() ? ' [HOY]' : ''}
                </option>
              ))}
              <option value="TODOS">TODAS LAS FECHAS ({fechasConDemanda.reduce((s, f) => s + f.pax, 0)} pax)</option>
            </select>
          </div>

          {/* Quick Date Shortcuts */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={selectedFecha === 'TODOS' ? '' : selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold text-[#173B56] focus:outline-none cursor-pointer"
              title="Seleccionar fecha manual"
            />
            <button
              type="button"
              onClick={() => setSelectedFecha(getTodayStr())}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                selectedFecha === getTodayStr()
                  ? 'bg-emerald-100 text-[#00843D]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setSelectedFecha(`${y}-${m}-${day}`);
              }}
              className="px-2 py-1 rounded-lg font-bold text-[11px] bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all cursor-pointer"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => setSelectedFecha('TODOS')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                selectedFecha === 'TODOS'
                  ? 'bg-emerald-100 text-[#00843D]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Ver Todo
            </button>
          </div>

          {/* Movimiento Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
            <span className="font-bold text-gray-500">Mov:</span>
            <select
              value={selectedMovimiento}
              onChange={(e) => setSelectedMovimiento(e.target.value as MovimientoType | 'TODOS')}
              className="bg-transparent font-bold text-[#173B56] focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS LOS MOVIMIENTOS</option>
              <option value="INGRESO">INGRESO (ING)</option>
              <option value="SALIDA">SALIDA (SAL)</option>
              <option value="Programa personal por tarea">Programa personal por tarea</option>
            </select>
          </div>

          {/* Turno Filter */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
            <span className="font-bold text-gray-500">Turno:</span>
            <select
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(e.target.value)}
              className="bg-transparent font-bold text-[#173B56] focus:outline-none cursor-pointer"
            >
              <option value="TODOS">TODOS ({turnosDisponibles.length})</option>
              {turnosDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Consolidar Fundos Switch */}
          <button
            type="button"
            onClick={() => setPermitirJuntarFundos(!permitirJuntarFundos)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
              permitirJuntarFundos
                ? 'bg-emerald-50 border-[#00843D]/40 text-[#00843D]'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
            title="Consolidar fundos compatibles para optimizar la ocupación de flota"
          >
            <span>{permitirJuntarFundos ? '✓ Juntar Fundos Cercanos' : '• Fundos Exclusivos'}</span>
          </button>
        </div>

        {/* Search Input across table */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por fundo, conductor, placa, ruta..."
            value={searchTableQuery}
            onChange={(e) => setSearchTableQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-[#173B56] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00843D]"
          />
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Servicios en Programa
            </span>
            <div className="text-xl font-black text-[#173B56] mt-0.5">
              {totalesVista.servicios} <span className="text-[11px] font-bold text-gray-500">viajes</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center font-bold">
            #
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Personal Programado
            </span>
            <div className="text-xl font-black text-[#00843D] mt-0.5">
              {totalesVista.totalPlan} <span className="text-[11px] font-bold text-emerald-700">pasajeros</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00843D] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Capacidad de Flota
            </span>
            <div className="text-xl font-black text-blue-600 mt-0.5">
              {totalesVista.totalCap} <span className="text-[11px] font-bold text-blue-700">asientos</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Bus className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              % Ocupabilidad Global
            </span>
            <div className="text-xl font-black text-[#173B56] mt-0.5">
              {totalesVista.ocupacion}%
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            %
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* OFICIAL SPREADSHEET TABLE: 26 COLUMNS TAL CUAL LA IMAGEN      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Table Title Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#173B56] to-[#1f4e72] text-white flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide">PROGRAMA DE DESPACHO Y CONTROL DE BUSES (OFICIAL)</span>
            <span className="text-gray-300 font-normal">| {viajesFiltrados.length} registros listados</span>
          </div>
          <div className="text-[11px] text-gray-200">
            * Los campos con lápiz se pueden editar directamente haciendo clic en la celda
          </div>
        </div>

        {/* Horizontal scroll container with custom scrollbar */}
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-[11.5px] border-collapse min-w-[2400px]">
            {/* Table Header matching user spreadsheet */}
            <thead className="bg-[#173B56] text-white sticky top-0 z-20 select-none text-[11px] uppercase tracking-wider font-black">
              <tr className="divide-x divide-gray-700/60 border-b border-gray-700">
                <th className="py-2.5 px-2 text-center w-16 bg-[#173B56] sticky left-0 z-30 shadow-xs">SEMANA</th>
                <th className="py-2.5 px-2.5 text-center w-24">FECHA</th>
                <th className="py-2.5 px-2 text-center w-24">N° Servicio</th>
                <th className="py-2.5 px-2 text-center w-16">FYP</th>
                <th className="py-2.5 px-3 min-w-[140px]">FUNDO</th>
                <th className="py-2.5 px-3 min-w-[130px]">PROVEEDOR</th>
                <th className="py-2.5 px-3 min-w-[120px]">MOVIL</th>
                <th className="py-2.5 px-2.5 text-center min-w-[100px]">PLACA</th>
                <th className="py-2.5 px-2.5 text-center min-w-[90px]">DNI</th>
                <th className="py-2.5 px-3 min-w-[200px]">CONDUCTOR</th>
                <th className="py-2.5 px-2 text-center w-16">TIPO</th>
                <th className="py-2.5 px-2 text-center w-20">Hora</th>
                <th className="py-2.5 px-3 min-w-[150px]">ÁREA</th>
                <th className="py-2.5 px-3 min-w-[160px]">ORIGEN</th>
                <th className="py-2.5 px-4 min-w-[340px]">DESTINO</th>
                <th className="py-2.5 px-2 text-center w-16 bg-[#00843D]/90 text-white">PLAN</th>
                <th className="py-2.5 px-2 text-center w-16">Sayta</th>
                <th className="py-2.5 px-3 min-w-[140px]">PARADERO INICIAL</th>
                <th className="py-2.5 px-2 text-center w-24">% Ocupabilidad</th>
                <th className="py-2.5 px-2 text-center w-20">Hora (Sayta)</th>
                <th className="py-2.5 px-3 min-w-[160px]">Obs. (Sayta)</th>
                <th className="py-2.5 px-2 text-center w-20">Cap. (Sayta)</th>
                <th className="py-2.5 px-3 min-w-[160px]">ENCARGADO</th>
                <th className="py-2.5 px-2 text-center min-w-[100px]">SUPERVISOR</th>
                <th className="py-2.5 px-3 min-w-[140px]">OBSERVACIONES</th>
                <th className="py-2.5 px-2 text-center w-20">TURNO</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-200 font-medium text-[#173B56]">
              {viajesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={26} className="py-12 text-center text-gray-400">
                    <Bus className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-bold text-gray-600">No hay servicios programados para los filtros seleccionados.</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Haz clic en <strong>"Jalar Datos de Procesos"</strong> para generar el programa oficial a partir de las solicitudes reales.
                    </p>
                  </td>
                </tr>
              ) : (
                viajesFiltrados.map((viaje, idx) => {
                  const isSalida = viaje.tipo === 'SAL' || viaje.movimiento === 'SALIDA';
                  const isExpanded = expandedTripId === viaje.id;
                  const isEditingThisPlaca = editingCell?.viajeId === viaje.id && editingCell.field === 'placa';
                  const isEditingThisConductor = editingCell?.viajeId === viaje.id && editingCell.field === 'conductor';
                  const isEditingThisDni = editingCell?.viajeId === viaje.id && editingCell.field === 'dni';
                  const isEditingThisSayta = editingCell?.viajeId === viaje.id && editingCell.field === 'sayta';
                  const isEditingThisPlan = editingCell?.viajeId === viaje.id && editingCell.field === 'plan';

                  return (
                    <React.Fragment key={viaje.id}>
                      <tr
                        className={`hover:bg-emerald-50/40 transition-colors divide-x divide-gray-150 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        {/* 1. SEMANA (Sticky) */}
                        <td className="py-1.5 px-2 text-center font-bold text-gray-600 bg-inherit sticky left-0 z-10">
                          {viaje.semana || getWeekNumber(viaje.fecha)}
                        </td>

                        {/* 2. FECHA */}
                        <td className="py-1.5 px-2.5 text-center whitespace-nowrap text-gray-700">
                          {formatDateDDMMYYYY(viaje.fecha)}
                        </td>

                        {/* 3. N° Servicio */}
                        <td className="py-1.5 px-2 text-center">
                          <span className="inline-block min-w-[28px] px-2 py-0.5 bg-[#00B050] text-white font-black rounded-md text-[11px] shadow-2xs">
                            {viaje.servicioNumero || idx + 1}
                          </span>
                        </td>

                        {/* 4. FYP */}
                        <td className="py-1.5 px-2 text-center font-bold text-gray-600">
                          {viaje.fyp || 'CAMPO'}
                        </td>

                        {/* 5. FUNDO */}
                        <td className="py-1.5 px-3 font-bold truncate max-w-[180px]" title={viaje.fundo}>
                          {viaje.fundo}
                        </td>

                        {/* 6. PROVEEDOR */}
                        <td className="py-1.5 px-3">
                          <select
                            value={viaje.proveedor || 'Ecobus'}
                            onChange={(e) => handleUpdateViajeField(viaje.id, 'proveedor', e.target.value)}
                            className="bg-transparent font-bold text-xs text-[#173B56] hover:bg-gray-100 rounded px-1 py-0.5 cursor-pointer focus:outline-none"
                          >
                            <option value="Ecobus">Ecobus</option>
                            <option value="Mobil">Mobil</option>
                            <option value="Puerto Rico">Puerto Rico</option>
                            <option value="Saraith">Saraith</option>
                            <option value="García">García</option>
                            <option value="Jhonatan">Jhonatan</option>
                            <option value="Sol Radiante">Sol Radiante</option>
                            <option value="Nazario">Nazario</option>
                            <option value="Carrion">Carrion</option>
                            <option value="Ecobus-Honper">Ecobus-Honper</option>
                            <option value="Ecobus-BS">Ecobus-BS</option>
                            <option value="Ecobus-Tubrisa">Ecobus-Tubrisa</option>
                            <option value="Ecobus-Leon del Norte">Ecobus-Leon del Norte</option>
                          </select>
                        </td>

                        {/* 7. MOVIL */}
                        <td className="py-1.5 px-3">
                          <select
                            value={viaje.movil || viaje.unidad?.nombre || 'Bus'}
                            onChange={(e) => handleChangeUnidadViaje(viaje.id, e.target.value)}
                            className="bg-emerald-50/70 border border-[#00843D]/20 text-[#00843D] font-bold text-xs rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                          >
                            <option value="2 PISOS">2 PISOS (60p)</option>
                            <option value="BUS LARGE">BUS LARGE (55p)</option>
                            <option value="BUS">BUS (49p)</option>
                            <option value="MINIBUS">MINIBUS (30p)</option>
                            <option value="COMBI">COMBI (15p)</option>
                            <option value="MINI VAN">MINI VAN (10p)</option>
                          </select>
                        </td>

                        {/* 8. PLACA */}
                        <td className="py-1.5 px-2.5 text-center font-mono font-bold">
                          {isEditingThisPlaca ? (
                            <input
                              type="text"
                              value={viaje.placa || ''}
                              onChange={(e) => handleUpdateViajeField(viaje.id, 'placa', e.target.value.toUpperCase())}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="w-20 px-1 py-0.5 border border-[#00843D] rounded text-center font-mono font-bold text-xs"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ viajeId: viaje.id, field: 'placa' })}
                              className="cursor-pointer hover:bg-yellow-100 px-1.5 py-0.5 rounded text-gray-800"
                              title="Clic para editar placa"
                            >
                              {viaje.placa || '-'}
                            </span>
                          )}
                        </td>

                        {/* 9. DNI */}
                        <td className="py-1.5 px-2.5 text-center font-mono text-gray-600">
                          {isEditingThisDni ? (
                            <input
                              type="text"
                              value={viaje.dni || ''}
                              onChange={(e) => handleUpdateViajeField(viaje.id, 'dni', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="w-20 px-1 py-0.5 border border-[#00843D] rounded text-center text-xs"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ viajeId: viaje.id, field: 'dni' })}
                              className="cursor-pointer hover:bg-yellow-100 px-1 rounded"
                            >
                              {viaje.dni || '-'}
                            </span>
                          )}
                        </td>

                        {/* 10. CONDUCTOR */}
                        <td className="py-1.5 px-3 truncate max-w-[200px]" title={viaje.conductor}>
                          {isEditingThisConductor ? (
                            <input
                              type="text"
                              value={viaje.conductor || ''}
                              onChange={(e) => handleUpdateViajeField(viaje.id, 'conductor', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="w-full px-1.5 py-0.5 border border-[#00843D] rounded text-xs"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ viajeId: viaje.id, field: 'conductor' })}
                              className="cursor-pointer hover:bg-yellow-100 px-1 py-0.5 rounded block truncate"
                              title="Clic para editar conductor"
                            >
                              {viaje.conductor || '-'}
                            </span>
                          )}
                        </td>

                        {/* 11. TIPO */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded font-black text-[10.5px] border ${
                              isSalida
                                ? 'bg-[#C6EFCE] text-[#006100] border-[#A9D08E]'
                                : 'bg-[#FCE4D6] text-[#C65911] border-[#F8CBAD]'
                            }`}
                          >
                            {isSalida ? 'SAL' : 'ING'}
                          </span>
                        </td>

                        {/* 12. Hora */}
                        <td className="py-1.5 px-2 text-center font-mono font-bold bg-cyan-50/50 text-cyan-900">
                          {viaje.hora || viaje.turno}
                        </td>

                        {/* 13. ÁREA */}
                        <td className="py-1.5 px-3 font-bold text-[#173B56] truncate max-w-[160px]" title={viaje.area}>
                          {viaje.area || 'PRODUCCIÓN'}
                        </td>

                        {/* 14. ORIGEN */}
                        <td className="py-1.5 px-3 text-gray-700 truncate max-w-[180px]" title={viaje.origen}>
                          {viaje.origen || 'CAMPO'}
                        </td>

                        {/* 15. DESTINO (Itinerario) */}
                        <td
                          className="py-1.5 px-4 text-gray-700 truncate max-w-[380px] cursor-pointer hover:text-[#00843D]"
                          onClick={() => setExpandedTripId(isExpanded ? null : viaje.id)}
                          title={`${viaje.destino} (Clic para ver paradas detalladas)`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{viaje.destino || 'RUTA OFICIAL'}</span>
                            <span className="text-[10px] text-gray-400 shrink-0 font-bold">
                              ({viaje.recorridoParaderos.length} paradas)
                            </span>
                          </div>
                        </td>

                        {/* 16. PLAN (Columna destacada oficial estilo Excel) */}
                        <td className="py-1.5 px-2 text-center bg-[#E2EFDA] border-x border-[#C6D9C0]">
                          {isEditingThisPlan ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={viaje.plan || viaje.totalPasajeros || 0}
                              onChange={(e) => handleUpdateViajeField(viaje.id, 'plan', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="w-12 text-center font-black text-xs text-[#274E13] border border-[#00843D] rounded px-1 bg-white"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ viajeId: viaje.id, field: 'plan' })}
                              className="font-black text-xs text-[#274E13] cursor-pointer hover:bg-emerald-200/80 px-2 py-0.5 rounded block"
                              title="Clic para editar pasajeros"
                            >
                              {viaje.plan || viaje.totalPasajeros}
                            </span>
                          )}
                        </td>

                        {/* 17. Sayta */}
                        <td className="py-1.5 px-2 text-center font-mono">
                          {isEditingThisSayta ? (
                            <input
                              type="text"
                              value={viaje.sayta || ''}
                              onChange={(e) => handleUpdateViajeField(viaje.id, 'sayta', e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              autoFocus
                              className="w-14 text-center font-mono text-xs border border-[#00843D] rounded"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingCell({ viajeId: viaje.id, field: 'sayta' })}
                              className="cursor-pointer hover:bg-yellow-100 px-1 rounded text-gray-700"
                            >
                              {viaje.sayta || '-'}
                            </span>
                          )}
                        </td>

                        {/* 18. PARADERO INICIAL */}
                        <td className="py-1.5 px-3 font-semibold text-gray-700 truncate max-w-[150px]">
                          {viaje.paraderoInicial || 'V. RAUL, VIRU'}
                        </td>

                        {/* 19. % Ocupabilidad */}
                        <td className="py-1.5 px-2 text-center">
                          <span
                            className={`font-black text-[11px] px-2 py-0.5 rounded border ${
                              viaje.porcentajeOcupacion >= 90
                                ? 'bg-[#C6EFCE] text-[#006100] border-[#A9D08E]'
                                : viaje.porcentajeOcupacion >= 70
                                ? 'bg-[#DDEBF7] text-[#1F4E78] border-[#BDD7EE]'
                                : 'bg-[#FFF2CC] text-[#806000] border-[#FFE699]'
                            }`}
                          >
                            {viaje.porcentajeOcupacion}%
                          </span>
                        </td>

                        {/* 20. Hora (Sayta) */}
                        <td className="py-1.5 px-2 text-center font-mono text-gray-600">
                          {viaje.horaSayta || viaje.hora}
                        </td>

                        {/* 21. Obs. (Sayta) */}
                        <td className="py-1.5 px-3 text-gray-600 truncate max-w-[160px]" title={viaje.obsSayta}>
                          {viaje.obsSayta || `${viaje.servicioNumero || idx + 1}-${viaje.area}`}
                        </td>

                        {/* 22. Cap. (Sayta) */}
                        <td className="py-1.5 px-2 text-center font-bold text-gray-700">
                          {viaje.capSayta || viaje.capacidadUnidad}
                        </td>

                        {/* 23. ENCARGADO */}
                        <td className="py-1.5 px-3 text-gray-700 font-semibold truncate max-w-[160px]" title={viaje.encargado}>
                          {viaje.encargado || 'SUPERVISOR'}
                        </td>

                        {/* 24. SUPERVISOR */}
                        <td className="py-1.5 px-2 text-center font-bold text-gray-600">
                          {viaje.supervisor || 'JSANCHEZ'}
                        </td>

                        {/* 25. OBSERVACIONES */}
                        <td className="py-1.5 px-3 text-gray-500 truncate max-w-[160px]">
                          <input
                            type="text"
                            placeholder="Agregar nota..."
                            value={viaje.observaciones || ''}
                            onChange={(e) => handleUpdateViajeField(viaje.id, 'observaciones', e.target.value)}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border-b border-transparent focus:border-gray-300 px-1 py-0.5 text-[11px]"
                          />
                        </td>

                        {/* 26. TURNO */}
                        <td className="py-1.5 px-2 text-center font-black text-gray-600 text-[10px]">
                          {viaje.turnoText || 'TARDE'}
                        </td>
                      </tr>

                      {/* Fila Desplegable con Manifiesto Detallado de Paraderos */}
                      {isExpanded && (
                        <tr className="bg-emerald-50/20 border-b border-emerald-200">
                          <td colSpan={26} className="py-3 px-6">
                            <div className="bg-white rounded-xl p-3.5 border border-emerald-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-[#00843D]" />
                                  <span className="font-bold text-xs text-[#173B56]">
                                    Manifiesto de Recorrido Paradero por Paradero - Servicio #{viaje.servicioNumero || idx + 1} ({viaje.codigoViaje})
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  Total a subir: <strong className="text-[#00843D]">{viaje.plan || viaje.totalPasajeros} pasajeros</strong> | Capacidad: {viaje.capacidadUnidad} pax
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
                                {viaje.recorridoParaderos.map((p, pIdx) => (
                                  <div
                                    key={p.paradero + pIdx}
                                    className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs flex items-center justify-between"
                                  >
                                    <div className="min-w-0 flex-1 pr-1">
                                      <span className="text-[10px] text-gray-400 font-mono block">#{pIdx + 1}</span>
                                      <span className="font-bold text-[#173B56] truncate block" title={p.paradero}>
                                        {p.paradero}
                                      </span>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#00843D] font-black text-[11px] shrink-0">
                                      +{p.cantidadPasajeros}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer with Official Sums */}
            {viajesFiltrados.length > 0 && (
              <tfoot className="bg-gray-100 text-[#173B56] font-black text-xs border-t-2 border-gray-300 sticky bottom-0 z-20">
                <tr className="divide-x divide-gray-300">
                  <td colSpan={15} className="py-2.5 px-4 text-right uppercase tracking-wider">
                    TOTAL GENERAL PROGRAMADO ({viajesFiltrados.length} SERVICIOS):
                  </td>
                  <td className="py-2.5 px-2 text-center bg-[#00843D] text-white font-black text-sm">
                    {totalesVista.totalPlan}
                  </td>
                  <td colSpan={5} className="py-2.5 px-3 text-center">
                    Ocupabilidad Promedio: {totalesVista.ocupacion}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold">
                    {totalesVista.totalCap}
                  </td>
                  <td colSpan={4} className="py-2.5 px-3 text-gray-500 font-normal">
                    CAMPOSOL Transporte • Control de Flota
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
