import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  Search,
  Edit3,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  Trash2,
  ArrowRight,
  Clock,
  Route,
} from 'lucide-react';
import {
  Requerimiento,
  DetalleRequerimiento,
  MaestroUnidadBus,
  MaestroFundo,
  MaestroParadero,
  ViajeProgramado,
  ProgramacionViajesDia,
  ZonaParadero,
  AppUser,
} from '../types';
import {
  getStoredRequerimientos,
  getStoredDetalles,
  getStoredUnidadesBus,
  getStoredFundos,
  getStoredParaderos,
  saveStoredProgramacionViaje,
  subscribeToDataChanges,
} from '../services/storageService';
import {
  exportarPlanViajesExcel,
  formatDateDDMMYYYY,
  getWeekNumber,
  inferParaderoInicial,
} from '../services/tripOptimizationService';
import { generateCorridorSchedule } from '../services/blueLineOptimizer';

interface ScheduleGeneratorScreenProps {
  requerimientos: Requerimiento[];
  onRefreshData: () => void;
  currentUser?: AppUser;
}

type TurnoLabel = 'MAÑANA' | 'TARDE' | 'NOCHE';
type ZoneFilter = 'TODOS' | 'NORTE' | 'SUR' | 'LÍNEA AZUL';
type StatusFilter = 'TODOS' | 'pendiente' | 'ok' | 'exceso';
type ProcesoEstadoFilter = 'ACTIVOS' | 'PENDIENTE_APROBADO' | 'PENDIENTE' | 'APROBADO' | 'ATENDIDO';

interface StopBadge {
  paradero: string;
  cantidad: number;
  zona: ZonaParadero;
}

interface ScheduleRow {
  id: string;
  matchKey: string;
  zone: ZonaParadero | 'LÍNEA AZUL';
  fundo: string;
  stopsText: string;
  stopDetails: StopBadge[];
  time: string;
  turno: TurnoLabel;
  type: string;
  unidadId?: string;
  people: number;
  cap: number;
  provider: string;
  plate: string;
  dni: string;
  driver: string;
  sayta: string;
  reqOwner: string;
  reqCodes: string[];
  reqIds: string[];
  reqEstados: string[];
  area: string;
  origen: string;
  movimiento: Requerimiento['movimiento'];
  fecha: string;
  observaciones?: string;
  consolidatedRuleNote?: string;
  unidadObj: MaestroUnidadBus;
}

interface SavedAssignmentOverlay {
  provider: string;
  plate: string;
  dni: string;
  driver: string;
  sayta: string;
  type?: string;
  cap?: number;
  unidadId?: string;
  observaciones?: string;
}

const ASSIGNMENTS_STORAGE_KEY = 'camposol_generador_asignaciones_v1';

const loadSavedAssignments = (): Record<string, SavedAssignmentOverlay> => {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persistSavedAssignment = (matchKey: string, data: SavedAssignmentOverlay) => {
  try {
    const all = loadSavedAssignments();
    all[matchKey] = data;
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
};

const getTodayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const inferTurnoFromTime = (timeStr: string): TurnoLabel => {
  const hour = parseInt((timeStr || '13:00').split(':')[0] || '13', 10);
  if (hour >= 5 && hour < 12) return 'MAÑANA';
  if (hour >= 12 && hour < 19) return 'TARDE';
  return 'NOCHE';
};

const formatTurnoDisplay = (t: TurnoLabel): string => {
  if (t === 'MAÑANA') return 'Mañana';
  if (t === 'TARDE') return 'Tarde';
  return 'Noche';
};

const isPendingAssignment = (row: ScheduleRow): boolean => {
  const prov = (row.provider || '').trim().toLowerCase();
  const plate = (row.plate || '').trim().toLowerCase();
  const driver = (row.driver || '').trim().toLowerCase();
  return (
    !prov ||
    prov === 'por asignar' ||
    !plate ||
    plate === 'por asignar' ||
    !driver ||
    driver === 'por asignar'
  );
};

export const ScheduleGeneratorScreen: React.FC<ScheduleGeneratorScreenProps> = ({
  requerimientos,
  onRefreshData,
  currentUser,
}) => {
  const [liveReqs, setLiveReqs] = useState<Requerimiento[]>(() =>
    requerimientos.length > 0 ? requerimientos : getStoredRequerimientos()
  );
  const [liveDetalles, setLiveDetalles] = useState<DetalleRequerimiento[]>(() =>
    getStoredDetalles()
  );
  const [maestroUnidades, setMaestroUnidades] = useState<MaestroUnidadBus[]>(() =>
    getStoredUnidadesBus()
  );
  const [maestroFundos, setMaestroFundos] = useState<MaestroFundo[]>(() => getStoredFundos());
  const [maestroParaderos, setMaestroParaderos] = useState<MaestroParadero[]>(() =>
    getStoredParaderos()
  );

  useEffect(() => {
    setLiveReqs(requerimientos.length > 0 ? requerimientos : getStoredRequerimientos());
    setLiveDetalles(getStoredDetalles());
  }, [requerimientos]);

  useEffect(() => {
    const reloadMastersAndData = () => {
      setLiveReqs(getStoredRequerimientos());
      setLiveDetalles(getStoredDetalles());
      setMaestroUnidades(getStoredUnidadesBus());
      setMaestroFundos(getStoredFundos());
      setMaestroParaderos(getStoredParaderos());
    };
    return subscribeToDataChanges(reloadMastersAndData);
  }, []);

  const activeFleetMasters = useMemo(
    () =>
      maestroUnidades
        .filter((u) => u.activo && u.capacidad > 0)
        .sort((a, b) => b.capacidad - a.capacidad),
    [maestroUnidades]
  );

  const [procesoEstadoFilter, setProcesoEstadoFilter] =
    useState<ProcesoEstadoFilter>('ACTIVOS');
  const [consolidarLineaAzul, setConsolidarLineaAzul] = useState<boolean>(true);

  const eligibleReqs = useMemo(() => {
    return liveReqs.filter((r) => {
      if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') return false;
      if (procesoEstadoFilter === 'PENDIENTE_APROBADO') {
        return r.estado === 'PENDIENTE' || r.estado === 'EN REVISIÓN' || r.estado === 'APROBADO';
      }
      if (procesoEstadoFilter === 'PENDIENTE') {
        return r.estado === 'PENDIENTE' || r.estado === 'EN REVISIÓN';
      }
      if (procesoEstadoFilter === 'APROBADO') return r.estado === 'APROBADO';
      if (procesoEstadoFilter === 'ATENDIDO') return r.estado === 'ATENDIDO';
      return true;
    });
  }, [liveReqs, procesoEstadoFilter]);

  const availableDates = useMemo(() => {
    return Array.from(new Set<string>(eligibleReqs.map((r) => r.fecha).filter(Boolean))).sort(
      (a, b) => b.localeCompare(a)
    );
  }, [eligibleReqs]);

  const initialDate = useMemo(() => {
    const today = getTodayStr();
    if (availableDates.includes(today)) return today;
    if (availableDates.length > 0) return availableDates[0];
    return today;
  }, [availableDates]);

  const [selectedFecha, setSelectedFecha] = useState<string>(initialDate);
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const [zoneTab, setZoneTab] = useState<ZoneFilter>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [turnoFilter, setTurnoFilter] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');

  const [editingRow, setEditingRow] = useState<ScheduleRow | null>(null);
  const [isNewRow, setIsNewRow] = useState<boolean>(false);
  const [formState, setFormState] = useState({
    zone: 'NORTE' as ZonaParadero | 'LÍNEA AZUL',
    fundo: '',
    stops: '',
    time: '07:00',
    type: '',
    unidadId: '',
    people: 20,
    cap: 30,
    provider: 'Por asignar',
    plate: 'Por asignar',
    dni: '-',
    driver: 'Por asignar',
    sayta: '-',
    reqOwner: '',
    area: 'PRODUCCIÓN',
    origen: 'CAMPO',
    observaciones: '',
  });
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [showExcelPreview, setShowExcelPreview] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'ok' | 'warn' } | null>(null);

  const showToast = useCallback((text: string, type: 'ok' | 'warn' = 'ok') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  }, []);

  useEffect(() => {
    if (selectedFecha !== 'TODOS' && !availableDates.includes(selectedFecha) && availableDates.length > 0) {
      const today = getTodayStr();
      setSelectedFecha(availableDates.includes(today) ? today : availableDates[0]);
    }
  }, [availableDates, selectedFecha]);

  const buildScheduleFromRealData = useCallback(
    (fechaTarget: string, enableBlueLine: boolean) => {
      if (activeFleetMasters.length === 0) {
        setRows([]);
        return;
      }

      const trips = generateCorridorSchedule({
        requerimientos: eligibleReqs,
        detalles: liveDetalles,
        unidadesDisponibles: activeFleetMasters,
        paraderosMaestros: maestroParaderos,
        fechaFiltro: fechaTarget,
        consolidarLineaAzul: enableBlueLine,
      });

      const savedAssignments = loadSavedAssignments();

      const generatedRows: ScheduleRow[] = trips.map((t) => {
        const overlay = savedAssignments[t.matchKey];
        const unitFromMaster =
          (overlay?.unidadId && activeFleetMasters.find((u) => u.id === overlay.unidadId)) ||
          t.unidad;

        return {
          id: t.id,
          matchKey: t.matchKey,
          zone: t.zone,
          fundo: t.fundos.join(' + '),
          stopsText: t.stops.map((s) => `${s.paradero} (${s.cantidad})`).join(' · '),
          stopDetails: t.stops,
          time: t.time,
          turno: inferTurnoFromTime(t.time),
          type: overlay?.type || unitFromMaster.nombre,
          unidadId: unitFromMaster.id,
          people: t.people,
          cap: overlay?.cap ?? unitFromMaster.capacidad,
          provider: overlay?.provider || 'Por asignar',
          plate: overlay?.plate || 'Por asignar',
          dni: overlay?.dni || '-',
          driver: overlay?.driver || 'Por asignar',
          sayta: overlay?.sayta || '-',
          reqOwner: t.owners.join(' / ') || 'Supervisor',
          reqCodes: t.reqCodes,
          reqIds: t.reqIds,
          reqEstados: t.reqEstados,
          area: t.areas.join(', ') || 'PRODUCCIÓN',
          origen: t.origenes.join(', ') || 'CAMPO',
          movimiento: t.movimiento,
          fecha: t.fecha,
          observaciones: overlay?.observaciones || t.consolidatedRuleNote || '',
          consolidatedRuleNote: t.consolidatedRuleNote,
          unidadObj: unitFromMaster,
        };
      });

      generatedRows.sort((a, b) => {
        const cmpFecha = b.fecha.localeCompare(a.fecha);
        if (cmpFecha !== 0) return cmpFecha;
        const cmpTime = a.time.localeCompare(b.time);
        if (cmpTime !== 0) return cmpTime;
        return a.zone.localeCompare(b.zone);
      });

      setRows(generatedRows);
    },
    [eligibleReqs, liveDetalles, activeFleetMasters, maestroParaderos]
  );

  useEffect(() => {
    buildScheduleFromRealData(selectedFecha, consolidarLineaAzul);
  }, [selectedFecha, consolidarLineaAzul, buildScheduleFromRealData]);

  const consideredReqsCount = useMemo(() => {
    if (selectedFecha === 'TODOS') return eligibleReqs.length;
    return eligibleReqs.filter((r) => r.fecha === selectedFecha).length;
  }, [eligibleReqs, selectedFecha]);

  const hasMixedBlueLineRows = useMemo(
    () => rows.some((r) => r.zone === 'LÍNEA AZUL'),
    [rows]
  );

  const hasActiveTableFilters =
    zoneTab !== 'TODOS' ||
    turnoFilter !== 'TODOS' ||
    statusFilter !== 'TODOS' ||
    searchQuery.trim().length > 0;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (zoneTab === 'NORTE') {
        if (row.zone !== 'NORTE' && !row.stopDetails.some((s) => s.zona === 'NORTE')) return false;
      } else if (zoneTab === 'SUR') {
        if (row.zone !== 'SUR' && !row.stopDetails.some((s) => s.zona === 'SUR')) return false;
      } else if (zoneTab === 'LÍNEA AZUL') {
        if (row.zone !== 'LÍNEA AZUL') return false;
      }

      if (turnoFilter !== 'TODOS' && row.turno !== turnoFilter) return false;

      const overCap = row.people > row.cap;
      const missingAssign = isPendingAssignment(row);
      const statusKey = overCap ? 'exceso' : missingAssign ? 'pendiente' : 'ok';
      if (statusFilter !== 'TODOS' && statusFilter !== statusKey) return false;

      if (q) {
        const searchable = [
          row.fundo,
          row.stopsText,
          row.reqOwner,
          row.provider,
          row.plate,
          row.driver,
          row.type,
          row.area,
          row.reqCodes.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [rows, zoneTab, turnoFilter, statusFilter, searchQuery]);

  const totalDistributedPeople = useMemo(
    () => rows.reduce((sum, r) => sum + r.people, 0),
    [rows]
  );
  const totalCapacityPeople = useMemo(
    () => rows.reduce((sum, r) => sum + r.cap, 0),
    [rows]
  );
  const pendingAssignmentCount = useMemo(
    () => rows.filter((r) => isPendingAssignment(r)).length,
    [rows]
  );

  const zoneSummary = useMemo(() => {
    const norteRows = rows.filter((r) => r.zone === 'NORTE');
    const surRows = rows.filter((r) => r.zone === 'SUR');
    const blueRows = rows.filter((r) => r.zone === 'LÍNEA AZUL');
    const nortePax = norteRows.reduce((s, r) => s + r.people, 0);
    const surPax = surRows.reduce((s, r) => s + r.people, 0);
    const bluePax = blueRows.reduce((s, r) => s + r.people, 0);
    const totalPax = totalDistributedPeople || 1;
    return {
      norteCount: norteRows.length,
      nortePax,
      norteShare: Math.round((nortePax / totalPax) * 100),
      surCount: surRows.length,
      surPax,
      surShare: Math.round((surPax / totalPax) * 100),
      blueCount: blueRows.length,
      bluePax,
      blueShare: Math.round((bluePax / totalPax) * 100),
      totalCount: rows.length,
      totalPax: totalDistributedPeople,
      ocupacionGlobal:
        totalCapacityPeople > 0
          ? Math.round((totalDistributedPeople / totalCapacityPeople) * 100)
          : 0,
    };
  }, [rows, totalDistributedPeople, totalCapacityPeople]);

  const buildProgramacionDia = useCallback((): ProgramacionViajesDia => {
    const targetDate = selectedFecha !== 'TODOS' ? selectedFecha : rows[0]?.fecha || getTodayStr();
    const realSupervisor = currentUser?.usuario || currentUser?.nombre || 'ADMINISTRADOR';

    const viajes: ViajeProgramado[] = rows.map((row, index) => {
      const paradas =
        row.stopDetails.length > 0
          ? row.stopDetails
          : row.stopsText
              .split('·')
              .map((s) => s.replace(/\(\d+\)/g, '').trim())
              .filter(Boolean)
              .map((p) => ({
                paradero: p,
                cantidad: 0,
                zona: (row.zone === 'SUR' ? 'SUR' : 'NORTE') as ZonaParadero,
              }));

      const ocup = row.cap > 0 ? Math.min(100, Math.round((row.people / row.cap) * 100)) : 0;
      const matchedMaster =
        activeFleetMasters.find((u) => u.id === row.unidadId || u.nombre === row.type) ||
        row.unidadObj;
      const serviceNum = index + 1;
      const fechaRow = row.fecha || targetDate;
      const excelZone: ZonaParadero | 'MIXTA' =
        row.zone === 'LÍNEA AZUL' ? 'MIXTA' : row.zone;

      return {
        id: row.id,
        codigoViaje: `VJ-${row.zone === 'SUR' ? 'SUR' : row.zone === 'NORTE' ? 'NOR' : 'AZL'}-${String(serviceNum).padStart(3, '0')}`,
        fecha: fechaRow,
        semana: getWeekNumber(fechaRow),
        servicioNumero: serviceNum,
        fyp: 'CAMPO',
        fundo: row.fundo,
        proveedor: row.provider || 'Por asignar',
        movil: row.type,
        placa: row.plate || 'Por asignar',
        dni: row.dni || '-',
        conductor: row.driver || 'Por asignar',
        tipo: row.movimiento === 'INGRESO' ? 'ING' : 'SAL',
        hora: row.time,
        area: row.area || 'PRODUCCIÓN',
        origen: row.origen || 'CAMPO',
        destino: paradas.map((p) => p.paradero).join(', '),
        plan: row.people,
        sayta: row.sayta || '-',
        paraderoInicial:
          paradas[0]?.paradero ||
          inferParaderoInicial(
            row.zone === 'LÍNEA AZUL' ? 'NORTE' : row.zone,
            paradas.map((p) => p.paradero)
          ),
        porcentajeOcupacion: ocup,
        horaSayta: row.time,
        obsSayta: `${serviceNum}-${row.area || 'PRODUCCIÓN'}`,
        capSayta: row.cap,
        encargado: row.reqOwner || 'Supervisor',
        supervisor: realSupervisor,
        turnoText: row.turno,
        turno: row.time,
        movimiento: row.movimiento || 'INGRESO',
        zona: excelZone,
        unidad: matchedMaster,
        totalPasajeros: row.people,
        capacidadUnidad: row.cap,
        asientosDisponibles: Math.max(0, row.cap - row.people),
        fundos: [{ fundo: row.fundo, cantidadPasajeros: row.people }],
        recorridoParaderos: paradas.map((p, idx) => ({
          paradero: p.paradero,
          zona: p.zona,
          cantidadPasajeros: p.cantidad,
          orden: idx + 1,
        })),
        requerimientosIds: row.reqIds,
        estado: 'PROGRAMADO',
        chofer: row.driver || 'Por asignar',
        observaciones: row.observaciones || (row.people > row.cap ? 'Revisar capacidad' : ''),
      };
    });

    const totalPasajeros = viajes.reduce((s, v) => s + v.totalPasajeros, 0);
    const totalCapacidad = viajes.reduce((s, v) => s + v.capacidadUnidad, 0);
    const resumenUnidades: Record<string, number> = {};
    viajes.forEach((v) => {
      const key = v.movil || v.unidad.nombre;
      resumenUnidades[key] = (resumenUnidades[key] || 0) + 1;
    });

    return {
      id: `prog-gen-${targetDate}-${Date.now()}`,
      fecha: targetDate,
      movimiento: 'TODOS',
      turno: 'TODOS',
      fechaGeneracion: new Date().toISOString(),
      viajes,
      totalPasajeros,
      totalCapacidad,
      eficienciaGlobal:
        totalCapacidad > 0 ? Math.round((totalPasajeros / totalCapacidad) * 1000) / 10 : 0,
      resumenUnidades,
    };
  }, [rows, selectedFecha, activeFleetMasters, currentUser]);

  const handleRefresh = () => {
    onRefreshData();
    setLiveReqs(getStoredRequerimientos());
    setLiveDetalles(getStoredDetalles());
    setMaestroUnidades(getStoredUnidadesBus());
    setMaestroFundos(getStoredFundos());
    setMaestroParaderos(getStoredParaderos());
    buildScheduleFromRealData(selectedFecha, consolidarLineaAzul);
    showToast('Programación recalculada con los requerimientos y flota reales.');
  };

  const openEditModal = (row: ScheduleRow) => {
    const matchedUnit =
      activeFleetMasters.find((u) => u.id === row.unidadId || u.nombre === row.type) ||
      activeFleetMasters[0];
    setIsNewRow(false);
    setEditingRow(row);
    setFormState({
      zone: row.zone,
      fundo: row.fundo,
      stops: row.stopsText,
      time: row.time,
      type: row.type,
      unidadId: matchedUnit?.id || row.unidadId || '',
      people: row.people,
      cap: row.cap,
      provider: row.provider === 'Por asignar' ? '' : row.provider,
      plate: row.plate === 'Por asignar' ? '' : row.plate,
      dni: row.dni === '-' ? '' : row.dni,
      driver: row.driver === 'Por asignar' ? '' : row.driver,
      sayta: row.sayta === '-' ? '' : row.sayta,
      reqOwner: row.reqOwner,
      area: row.area,
      origen: row.origen,
      observaciones: row.observaciones || '',
    });
    setFormWarning(
      row.people > row.cap ? 'El personal asignado supera la capacidad de la unidad.' : null
    );
  };

  const openAddModal = () => {
    const defaultUnit = activeFleetMasters[0] || {
      id: 'BUS-DEFAULT',
      nombre: 'MINIBUS',
      capacidad: 30,
      activo: true,
    };
    const defaultFundo = maestroFundos[0]?.fundo || 'AGRICULTOR 1';
    const defaultStops =
      maestroParaderos
        .filter((p) => (p.zona || 'NORTE') === 'NORTE')
        .slice(0, 2)
        .map((p) => p.paradero)
        .join(' · ') || 'LA BRASIL · VILLA VIRU';

    setIsNewRow(true);
    setEditingRow({
      id: `manual-${Date.now()}`,
      matchKey: `manual-${Date.now()}`,
      zone: 'NORTE',
      fundo: defaultFundo,
      stopsText: defaultStops,
      stopDetails: [],
      time: '07:00',
      turno: 'MAÑANA',
      type: defaultUnit.nombre,
      unidadId: defaultUnit.id,
      people: 0,
      cap: defaultUnit.capacidad,
      provider: 'Por asignar',
      plate: 'Por asignar',
      dni: '-',
      driver: 'Por asignar',
      sayta: '-',
      reqOwner: currentUser?.nombre || 'Supervisor de turno',
      reqCodes: [],
      reqIds: [],
      reqEstados: ['MANUAL'],
      area: 'PRODUCCIÓN',
      origen: 'CAMPO',
      movimiento: 'INGRESO',
      fecha: selectedFecha !== 'TODOS' ? selectedFecha : getTodayStr(),
      unidadObj: defaultUnit,
    });
    setFormState({
      zone: 'NORTE',
      fundo: defaultFundo,
      stops: defaultStops,
      time: '07:00',
      type: defaultUnit.nombre,
      unidadId: defaultUnit.id,
      people: 0,
      cap: defaultUnit.capacidad,
      provider: '',
      plate: '',
      dni: '',
      driver: '',
      sayta: '',
      reqOwner: currentUser?.nombre || 'Supervisor de turno',
      area: 'PRODUCCIÓN',
      origen: 'CAMPO',
      observaciones: '',
    });
    setFormWarning(null);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    const peopleNum = Math.max(0, Number(formState.people) || 0);
    const capNum = Math.max(1, Number(formState.cap) || 1);

    if (peopleNum > capNum && !formWarning) {
      setFormWarning(
        'El personal supera la capacidad de la unidad. Cambia el tipo de bus o vuelve a guardar para confirmarlo.'
      );
      return;
    }

    const cleanStopsText = formState.stops.trim() || 'Por definir';
    const parsedStops: StopBadge[] = cleanStopsText
      .split('·')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((raw) => {
        const m = raw.match(/^(.*?)\s*\((\d+)\)$/);
        return {
          paradero: m ? m[1].trim() : raw,
          cantidad: m ? Number(m[2]) : 0,
          zona: (formState.zone === 'SUR' ? 'SUR' : 'NORTE') as ZonaParadero,
        };
      });

    const updatedRow: ScheduleRow = {
      ...editingRow,
      zone: formState.zone,
      fundo: formState.fundo.trim() || 'Por definir',
      stopsText: cleanStopsText,
      stopDetails: parsedStops,
      time: formState.time || '07:00',
      turno: inferTurnoFromTime(formState.time || '07:00'),
      type: formState.type,
      unidadId: formState.unidadId,
      people: peopleNum,
      cap: capNum,
      provider: formState.provider.trim() || 'Por asignar',
      plate: formState.plate.trim().toUpperCase() || 'Por asignar',
      dni: formState.dni.trim() || '-',
      driver: formState.driver.trim().toUpperCase() || 'Por asignar',
      sayta: formState.sayta.trim() || '-',
      reqOwner: formState.reqOwner.trim() || 'Sin encargado',
      area: formState.area.trim() || 'PRODUCCIÓN',
      origen: formState.origen.trim() || 'CAMPO',
      observaciones: formState.observaciones.trim(),
    };

    if (!isNewRow) {
      persistSavedAssignment(updatedRow.matchKey, {
        provider: updatedRow.provider,
        plate: updatedRow.plate,
        dni: updatedRow.dni,
        driver: updatedRow.driver,
        sayta: updatedRow.sayta,
        type: updatedRow.type,
        cap: updatedRow.cap,
        unidadId: updatedRow.unidadId,
        observaciones: updatedRow.observaciones,
      });
      setRows((prev) => prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)));
      showToast('Recorrido guardado correctamente.');
    } else {
      setRows((prev) => [...prev, updatedRow]);
      showToast('Unidad agregada a la programación.');
    }

    setEditingRow(null);
    setFormWarning(null);
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setEditingRow(null);
    showToast('Unidad retirada de la vista actual.', 'warn');
  };

  const handleDownloadExcel = () => {
    if (rows.length === 0) return;
    const plan = buildProgramacionDia();
    saveStoredProgramacionViaje(plan);
    exportarPlanViajesExcel(plan);
    showToast(`Excel generado con ${rows.length} recorridos.`);
  };

  const excelPreviewData = useMemo(() => {
    if (!showExcelPreview) return [];
    return buildProgramacionDia().viajes;
  }, [showExcelPreview, buildProgramacionDia]);

  return (
    <div className="max-w-[1480px] mx-auto space-y-5 text-slate-900">
      {/* Notificación flotante limpia */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 ${
            toastMsg.type === 'warn'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {toastMsg.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Encabezado Ejecutivo */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <h2 className="text-[24px] font-bold tracking-tight text-slate-900 leading-tight">
            Generador de programación
          </h2>
          <p className="text-[13px] text-slate-500">
            Consolida Agricultor 1-2-3 y Sincromax (Sur) sobre la línea azul (La Brasil ↔ Viviendas Mar Verde) y mantiene recorridos por zona para fundos centrales.
          </p>
        </div>

        {/* Barra de controles principales */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 h-9 text-xs text-slate-700 hover:border-slate-300 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-[#0F6B43] shrink-0" />
            <select
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-800 pr-1"
              title="Seleccionar fecha de Procesos"
            >
              <option value="TODOS">Todas las fechas ({eligibleReqs.length})</option>
              {availableDates.map((dateStr) => {
                const count = eligibleReqs.filter((r) => r.fecha === dateStr).length;
                return (
                  <option key={dateStr} value={dateStr}>
                    {formatDateDDMMYYYY(dateStr)} ({count} req.)
                  </option>
                );
              })}
            </select>
          </div>

          <select
            value={procesoEstadoFilter}
            onChange={(e) => setProcesoEstadoFilter(e.target.value as ProcesoEstadoFilter)}
            className="h-9 px-3 border border-slate-200 rounded-lg bg-white text-xs font-medium text-slate-700 outline-none hover:border-slate-300 transition-colors cursor-pointer"
          >
            <option value="ACTIVOS">Procesos: Activos</option>
            <option value="PENDIENTE_APROBADO">Pendientes y Aprobados</option>
            <option value="PENDIENTE">Solo Pendientes</option>
            <option value="APROBADO">Solo Aprobados</option>
            <option value="ATENDIDO">Solo Atendidos</option>
          </select>

          <button
            type="button"
            onClick={() => setConsolidarLineaAzul((prev) => !prev)}
            className={`h-9 px-3 border rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              consolidarLineaAzul
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Consolidar remanentes sobre la línea recta (Viviendas ↔ La Brasil) y corredor Agricultor 1-2-3 / Sincromax"
          >
            <Route className="w-3.5 h-3.5" />
            <span>{consolidarLineaAzul ? 'Línea Azul: 100%' : 'Por zona estricta'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            disabled={activeFleetMasters.length === 0}
            className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#0F6B43]" />
            <span>Agregar unidad</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={rows.length === 0}
            className="h-9 px-4 bg-[#0F6B43] hover:bg-[#0B5434] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel</span>
          </button>
        </div>
      </div>

      {/* Alerta si falta configurar flota activa */}
      {activeFleetMasters.length === 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-xs text-rose-800 font-medium flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            No hay unidades activas en <b>Datos Maestros · Flota Buses</b>. Activa al menos una unidad para generar recorridos.
          </span>
        </div>
      )}

      {/* Franja KPI Ejecutiva */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200/90 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 overflow-hidden">
        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-slate-500">Solicitudes consideradas</div>
          <div className="text-[28px] font-bold tracking-tight text-slate-900 tabular-nums leading-tight mt-1">
            {consideredReqsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Requerimientos desde Procesos</div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-slate-500">Unidades programadas</div>
          <div className="text-[28px] font-bold tracking-tight text-slate-900 tabular-nums leading-tight mt-1">
            {rows.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            Ocupación promedio {zoneSummary.ocupacionGlobal}%
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-slate-500">Personal programado</div>
          <div className="text-[28px] font-bold tracking-tight text-slate-900 tabular-nums leading-tight mt-1">
            {totalDistributedPeople}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            De {totalCapacityPeople} asientos totales
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-slate-500">Pendientes de móvil</div>
          <div
            className={`text-[28px] font-bold tracking-tight tabular-nums leading-tight mt-1 ${
              pendingAssignmentCount > 0 ? 'text-amber-600' : 'text-[#0F6B43]'
            }`}
          >
            {pendingAssignmentCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {pendingAssignmentCount > 0
              ? 'Requieren placa y conductor'
              : 'Todas las unidades asignadas'}
          </div>
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        {/* Cabecera de Tabla + Selector de Zona */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-sm font-bold text-slate-900">Recorridos del servicio</h3>
            <span className="text-xs text-slate-400 tabular-nums">
              {filteredRows.length} {filteredRows.length === 1 ? 'unidad' : 'unidades'}
              {selectedFecha !== 'TODOS' ? ` · ${formatDateDDMMYYYY(selectedFecha)}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'TODOS', label: 'Todos' },
                { id: 'NORTE', label: 'Norte' },
                { id: 'SUR', label: 'Sur' },
                ...(hasMixedBlueLineRows
                  ? [{ id: 'LÍNEA AZUL' as const, label: 'Línea Azul' }]
                  : []),
              ] as Array<{ id: ZoneFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setZoneTab(tab.id)}
                className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  zoneTab === tab.id
                    ? 'bg-white text-[#0F6B43] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros Compactos */}
        <div className="px-5 py-2.5 bg-slate-50/60 border-b border-slate-200/70 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar fundo, paradero, solicitud o placa..."
              className="w-full h-8 pl-8 pr-3 border border-slate-200 rounded-md bg-white text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0F6B43]"
            />
          </div>

          <select
            value={turnoFilter}
            onChange={(e) => setTurnoFilter(e.target.value)}
            className="h-8 px-2.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 outline-none focus:border-[#0F6B43] cursor-pointer"
          >
            <option value="TODOS">Todos los turnos</option>
            <option value="MAÑANA">Mañana</option>
            <option value="TARDE">Tarde</option>
            <option value="NOCHE">Noche</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 px-2.5 border border-slate-200 rounded-md bg-white text-xs text-slate-700 outline-none focus:border-[#0F6B43] cursor-pointer"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="pendiente">Sin asignar móvil</option>
            <option value="ok">Listos</option>
            <option value="exceso">Excede capacidad</option>
          </select>

          {hasActiveTableFilters && (
            <button
              type="button"
              onClick={() => {
                setZoneTab('TODOS');
                setTurnoFilter('TODOS');
                setStatusFilter('TODOS');
                setSearchQuery('');
              }}
              className="h-8 px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Tabla Limpia */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1060px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 pl-5 pr-2 text-left w-10">#</th>
                <th className="py-2.5 px-3 text-left w-24">Zona</th>
                <th className="py-2.5 px-3 text-left">Fundo y solicitud</th>
                <th className="py-2.5 px-3 text-left">Paraderos del recorrido</th>
                <th className="py-2.5 px-3 text-left w-28">Hora</th>
                <th className="py-2.5 px-3 text-left w-32">Unidad</th>
                <th className="py-2.5 px-3 text-left w-32">Ocupación</th>
                <th className="py-2.5 px-3 text-left w-48">Proveedor y móvil</th>
                <th className="py-2.5 px-3 text-left w-28">Estado</th>
                <th className="py-2.5 pl-2 pr-5 text-right w-14">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 px-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {rows.length === 0
                        ? 'No hay requerimientos registrados para la selección actual'
                        : 'Ningún recorrido coincide con tu búsqueda'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {rows.length === 0
                        ? 'Cambia la fecha o el filtro de Procesos para visualizar los requerimientos.'
                        : 'Ajusta o limpia los filtros para ver todos los recorridos.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const pct = row.cap > 0 ? Math.round((row.people / row.cap) * 100) : 0;
                  const overCap = row.people > row.cap;
                  const missingAssign = isPendingAssignment(row);
                  const barColor = overCap
                    ? 'bg-rose-500'
                    : pct >= 90
                    ? 'bg-[#0F6B43]'
                    : pct >= 70
                    ? 'bg-emerald-500'
                    : 'bg-amber-500';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 pl-5 pr-2 font-semibold text-slate-400 tabular-nums align-middle">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-bold tracking-wide px-2 py-0.5 rounded ${
                            row.zone === 'LÍNEA AZUL'
                              ? 'bg-blue-50 text-blue-700'
                              : row.zone === 'SUR'
                              ? 'bg-emerald-50 text-[#0F6B43]'
                              : 'bg-sky-50 text-sky-800'
                          }`}
                        >
                          {row.zone}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.fundo}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.area} · {row.reqCodes.length > 0 ? row.reqCodes.join(', ') : 'Manual'} · {row.reqOwner}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-middle max-w-[340px]">
                        <div className="text-slate-700 leading-snug">
                          {row.stopDetails.length > 0 ? (
                            row.stopDetails.map((s, sIdx) => (
                              <React.Fragment key={`${s.paradero}-${sIdx}`}>
                                {sIdx > 0 && <span className="text-slate-300 mx-1">→</span>}
                                <span className="font-medium text-slate-800">{s.paradero}</span>
                                <span className="text-slate-400 tabular-nums ml-0.5">
                                  ({s.cantidad})
                                </span>
                              </React.Fragment>
                            ))
                          ) : (
                            <span>{row.stopsText}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-900 tabular-nums">{row.time}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatTurnoDisplay(row.turno)} · {row.movimiento === 'INGRESO' ? 'Ingreso' : 'Salida'}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{row.type}</div>
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          Cap. {row.cap} pax
                        </div>
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-baseline justify-between gap-2 tabular-nums">
                          <span className="font-semibold text-slate-900">
                            {row.people} <span className="text-slate-400 font-normal">/ {row.cap}</span>
                          </span>
                          <span
                            className={`text-[11px] font-bold ${
                              overCap
                                ? 'text-rose-600'
                                : pct === 100
                                ? 'text-[#0F6B43]'
                                : 'text-slate-500'
                            }`}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        {missingAssign ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 cursor-pointer"
                          >
                            <span>Asignar unidad</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-900">
                              {row.provider} · {row.plate}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                              {row.driver}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-middle whitespace-nowrap">
                        {overCap ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Excede cap.
                          </span>
                        ) : missingAssign ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <Clock className="w-3.5 h-3.5" />
                            Sin asignar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F6B43]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Listo
                          </span>
                        )}
                      </td>

                      <td className="py-3 pl-2 pr-5 text-right align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Editar recorrido"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de tabla limpio */}
        <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0F6B43]" />
              Óptimo (&ge;90%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Ocupación baja (&lt;70%)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Excede capacidad
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowExcelPreview(true)}
            disabled={rows.length === 0}
            className="text-xs font-semibold text-[#0F6B43] hover:text-[#0B5434] inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Vista previa Excel (26 columnas)</span>
          </button>
        </div>
      </div>

      {/* Grilla Inferior: Balance Zonal + Reglas del Corredor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Balance por zona y corredor
            </h3>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">
              {zoneSummary.totalCount} recorridos · {zoneSummary.totalPax} personas
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="font-medium text-slate-600">Zona Norte</span>
              <div className="flex items-center gap-4 tabular-nums">
                <span className="text-slate-400">{zoneSummary.norteShare}%</span>
                <span className="font-semibold text-slate-900">
                  {zoneSummary.norteCount} unidades · {zoneSummary.nortePax} personas
                </span>
              </div>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="font-medium text-slate-600">Zona Sur</span>
              <div className="flex items-center gap-4 tabular-nums">
                <span className="text-slate-400">{zoneSummary.surShare}%</span>
                <span className="font-semibold text-slate-900">
                  {zoneSummary.surCount} unidades · {zoneSummary.surPax} personas
                </span>
              </div>
            </div>
            {zoneSummary.blueCount > 0 && (
              <div className="py-2.5 flex items-center justify-between gap-4">
                <span className="font-medium text-blue-700">Corredor Línea Azul (Viviendas ↔ La Brasil)</span>
                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-blue-400">{zoneSummary.blueShare}%</span>
                  <span className="font-semibold text-slate-900">
                    {zoneSummary.blueCount} unidades · {zoneSummary.bluePax} personas
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Reglas activas de optimización
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <b>Agricultor 1, 2 y Sincromax</b> (Sur) consolidan la línea azul desde Segundo Paradero y Norte al <b>100%</b>. <b>Yakuy Minka</b> puede cubrir Norte + Sur desde La Brasil sin <b>Viviendas Mar Verde</b> (en ingreso Sur sale desde Viviendas). Los fundos del centro (<b>Glorias, Mar Verde, Oro Azul, Frusol 1-2, San José, Agromas, Napo</b>) operan por zona.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 tabular-nums">
            <span className="font-semibold text-slate-700">Flota Maestra: </span>
            {activeFleetMasters.map((u) => `${u.nombre} (${u.capacidad}p)`).join(' · ')}
          </div>
        </div>
      </div>

      {/* Modal: Editar / Asignar / Agregar Unidad */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-[620px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isNewRow ? 'Agregar unidad de Datos Maestros' : 'Asignar móvil y editar recorrido'}
                </h3>
                {!isNewRow && editingRow.reqCodes.length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingRow.fundo} · {editingRow.reqCodes.join(', ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRow(null);
                  setFormWarning(null);
                }}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formWarning && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Zona / Corredor
                  </label>
                  <select
                    value={formState.zone}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        zone: e.target.value as ZonaParadero | 'LÍNEA AZUL',
                      }))
                    }
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                  >
                    <option value="NORTE">NORTE</option>
                    <option value="SUR">SUR</option>
                    <option value="LÍNEA AZUL">LÍNEA AZUL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Fundo(s)
                  </label>
                  <input
                    type="text"
                    list="maestro-fundos-list"
                    value={formState.fundo}
                    onChange={(e) => setFormState((s) => ({ ...s, fundo: e.target.value }))}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                    required
                  />
                  <datalist id="maestro-fundos-list">
                    {maestroFundos.map((f) => (
                      <option key={f.id} value={f.fundo} />
                    ))}
                  </datalist>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Paraderos del recorrido
                  </label>
                  <input
                    type="text"
                    value={formState.stops}
                    onChange={(e) => setFormState((s) => ({ ...s, stops: e.target.value }))}
                    placeholder="Ej: LA BRASIL (2) · VIVIENDAS MAR VERDE (13)"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={formState.time}
                    onChange={(e) => setFormState((s) => ({ ...s, time: e.target.value }))}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tipo de bus (Datos Maestros)
                  </label>
                  <select
                    value={formState.unidadId}
                    onChange={(e) => {
                      const chosen = activeFleetMasters.find((u) => u.id === e.target.value);
                      if (chosen) {
                        setFormState((s) => ({
                          ...s,
                          unidadId: chosen.id,
                          type: chosen.nombre,
                          cap: chosen.capacidad,
                        }));
                        setFormWarning(
                          formState.people > chosen.capacidad
                            ? 'El personal asignado supera la capacidad de la unidad.'
                            : null
                        );
                      }
                    }}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                  >
                    {activeFleetMasters.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.capacidad} pax)
                      </option>
                    ))}
                    {!activeFleetMasters.some((u) => u.id === formState.unidadId) &&
                      formState.type && (
                        <option value={formState.unidadId}>
                          {formState.type} ({formState.cap} pax)
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Personal
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.people}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setFormState((s) => ({ ...s, people: val }));
                      setFormWarning(
                        val > formState.cap
                          ? 'El personal asignado supera la capacidad de la unidad.'
                          : null
                      );
                    }}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#0F6B43]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Capacidad
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formState.cap}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 1;
                      setFormState((s) => ({ ...s, cap: val }));
                      setFormWarning(
                        formState.people > val
                          ? 'El personal asignado supera la capacidad de la unidad.'
                          : null
                      );
                    }}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#0F6B43]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    value={formState.provider}
                    onChange={(e) => setFormState((s) => ({ ...s, provider: e.target.value }))}
                    placeholder="Nombre del proveedor"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Placa
                  </label>
                  <input
                    type="text"
                    value={formState.plate}
                    onChange={(e) => setFormState((s) => ({ ...s, plate: e.target.value }))}
                    placeholder="Ej: ABC-123"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 uppercase outline-none focus:border-[#0F6B43]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Conductor
                  </label>
                  <input
                    type="text"
                    value={formState.driver}
                    onChange={(e) => setFormState((s) => ({ ...s, driver: e.target.value }))}
                    placeholder="Nombre completo del conductor"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 uppercase outline-none focus:border-[#0F6B43]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    DNI / Cód. Sayta
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formState.dni}
                      onChange={(e) => setFormState((s) => ({ ...s, dni: e.target.value }))}
                      placeholder="DNI"
                      className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#0F6B43]"
                    />
                    <input
                      type="text"
                      value={formState.sayta}
                      onChange={(e) => setFormState((s) => ({ ...s, sayta: e.target.value }))}
                      placeholder="Sayta"
                      className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#0F6B43]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Encargado
                  </label>
                  <input
                    type="text"
                    value={formState.reqOwner}
                    onChange={(e) => setFormState((s) => ({ ...s, reqOwner: e.target.value }))}
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={formState.observaciones}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, observaciones: e.target.value }))
                    }
                    placeholder="Opcional"
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#0F6B43]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {!isNewRow ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(editingRow.id)}
                    className="px-3 py-2 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRow(null);
                      setFormWarning(null);
                    }}
                    className="px-4 py-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-[#0F6B43] hover:bg-[#0B5434] text-white text-xs font-semibold cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vista Previa Tipo Excel (26 Columnas) */}
      {showExcelPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-[1380px] max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#0F6B43]" />
                  <span>Vista previa Excel · PROGRAMA_DE_VIAJES</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {excelPreviewData.length} recorridos con la estructura oficial de 26 columnas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExcelPreview(false)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-lg overflow-auto">
                <table className="w-full border-collapse text-[11px] min-w-[2000px] tabular-nums">
                  <thead>
                    <tr className="bg-[#0F6B43] text-white text-[10px] uppercase tracking-wider">
                      {[
                        'SEMANA',
                        'FECHA',
                        'N° Servicio',
                        'FYP',
                        'FUNDO',
                        'PROVEEDOR',
                        'MOVIL',
                        'PLACA',
                        'DNI',
                        'CONDUCTOR',
                        'TIPO',
                        'Hora',
                        'ÁREA',
                        'ORIGEN',
                        'DESTINO',
                        'PLAN',
                        'Sayta',
                        'PARADERO INICIAL',
                        '% Ocupabilidad',
                        'Hora (Sayta)',
                        'Obs. (Sayta)',
                        'Cap. (Sayta)',
                        'ENCARGADO',
                        'SUPERVISOR',
                        'OBSERVACIONES',
                        'TURNO',
                      ].map((col) => (
                        <th
                          key={col}
                          className="py-2 px-2.5 text-left font-semibold border-r border-emerald-800/40 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelPreviewData.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.semana}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {formatDateDDMMYYYY(v.fecha)}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-center font-semibold">
                          {v.servicioNumero}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.fyp}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 font-semibold whitespace-nowrap">
                          {v.fundo}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.proveedor}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.movil}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.placa}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.dni}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.conductor}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 font-semibold">{v.tipo}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.hora}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.area}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.origen}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 max-w-[320px] truncate">
                          {v.destino}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-center font-semibold">
                          {v.plan}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.sayta}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.paraderoInicial}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-center">
                          {v.porcentajeOcupacion}%
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.horaSayta}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.obsSayta}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-center">
                          {v.capSayta}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 whitespace-nowrap">
                          {v.encargado}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.supervisor}</td>
                        <td className="py-2 px-2.5 border-r border-slate-100">{v.observaciones}</td>
                        <td className="py-2 px-2.5 font-semibold">{v.turnoText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExcelPreview(false)}
                className="px-4 py-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadExcel();
                  setShowExcelPreview(false);
                }}
                className="px-4 py-2 rounded-md bg-[#0F6B43] hover:bg-[#0B5434] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
