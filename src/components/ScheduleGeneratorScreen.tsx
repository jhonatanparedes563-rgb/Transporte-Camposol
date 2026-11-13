import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Edit3,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  X,
  Trash2,
  Clock,
  Layers,
  Users,
  PlusCircle,
  Eye,
  Inbox,
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

const getPrimaryReqCode = (reqCodes: string[]): string => {
  if (!reqCodes || reqCodes.length === 0) return 'ZZZ-999999';
  return [...reqCodes].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )[0];
};

const compareScheduleRowsByReq = (a: ScheduleRow, b: ScheduleRow): number => {
  const cmpFecha = b.fecha.localeCompare(a.fecha);
  if (cmpFecha !== 0) return cmpFecha;
  const reqA = getPrimaryReqCode(a.reqCodes);
  const reqB = getPrimaryReqCode(b.reqCodes);
  const cmpReq = reqA.localeCompare(reqB, undefined, { numeric: true, sensitivity: 'base' });
  if (cmpReq !== 0) return cmpReq;
  const cmpTime = a.time.localeCompare(b.time);
  if (cmpTime !== 0) return cmpTime;
  const cmpZone = a.zone.localeCompare(b.zone);
  if (cmpZone !== 0) return cmpZone;
  return b.cap - a.cap;
};

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
    setLiveReqs(requerimientos);
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
  const [hasManualDateSelection, setHasManualDateSelection] = useState<boolean>(false);
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
    if (!hasManualDateSelection) {
      if (selectedFecha !== initialDate) {
        setSelectedFecha(initialDate);
      }
      return;
    }
    if (selectedFecha !== 'TODOS' && !availableDates.includes(selectedFecha) && availableDates.length > 0) {
      setSelectedFecha(initialDate);
    }
  }, [availableDates, initialDate, selectedFecha, hasManualDateSelection]);

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

      generatedRows.sort(compareScheduleRowsByReq);

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
    const defaultFundo = maestroFundos[0]?.fundo || '';
    const defaultStops = maestroParaderos
      .filter((p) => (p.zona || 'NORTE') === 'NORTE')
      .slice(0, 2)
      .map((p) => p.paradero)
      .join(' · ');

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
      setRows((prev) =>
        prev.map((r) => (r.id === updatedRow.id ? updatedRow : r)).sort(compareScheduleRowsByReq)
      );
      showToast('Recorrido guardado correctamente.');
    } else {
      setRows((prev) => [...prev, updatedRow].sort(compareScheduleRowsByReq));
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
    <div className="space-y-4 text-[#173B56] font-sans">
      {/* Notificación flotante estilo CAMPOSOL */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-6 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border transition-all duration-200 ${
            toastMsg.type === 'warn'
              ? 'bg-amber-600 text-white border-amber-400/50'
              : 'bg-[#173B56] text-white border-emerald-500/40'
          }`}
        >
          {toastMsg.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Franja KPI Superior (Idéntica a Recepción de requerimientos) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">Solicitudes</div>
            <div className="text-xl font-bold text-[#1E293B] tabular-nums leading-tight mt-0.5">
              {consideredReqsCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/90 border-l-4 border-l-amber-400 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">Sin Móvil</div>
            <div className="text-xl font-bold text-amber-600 tabular-nums leading-tight mt-0.5">
              {pendingAssignmentCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/90 border-l-4 border-l-[#009A44] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">Ocupabilidad</div>
            <div className="text-xl font-bold text-[#009A44] tabular-nums leading-tight mt-0.5">
              {zoneSummary.ocupacionGlobal}%
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#009A44] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/90 border-l-4 border-l-sky-500 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">Unidades</div>
            <div className="text-xl font-bold text-sky-600 tabular-nums leading-tight mt-0.5">
              {rows.length}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <CheckCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl px-4 py-3 border border-gray-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-gray-500">Total Personal</div>
            <div className="text-xl font-bold text-[#1E293B] tabular-nums leading-tight mt-0.5">
              {totalDistributedPeople}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#1E293B] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Alerta si falta configurar flota activa */}
      {activeFleetMasters.length === 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-800 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            No hay unidades activas en <b>Datos Maestros · Flota Buses</b>. Activa al menos una unidad para generar recorridos.
          </span>
        </div>
      )}

      {/* Panel Principal (Mismo visual, formas, fuentes y bordes que Recepción de requerimientos) */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-xs overflow-hidden">
        {/* Cabecera del Panel */}
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#1E293B] leading-tight">
              Generación de programación
            </h3>
            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>
                Visualizar, optimizar y asignar recorridos • Mostrando{' '}
                <strong className="text-[#1E293B] font-semibold">{filteredRows.length}</strong> de{' '}
                <strong className="text-[#1E293B] font-semibold">{rows.length}</strong> unidades
              </span>
              {selectedFecha !== 'TODOS' && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-[#009A44] rounded-full border border-emerald-200/70">
                  DEL DÍA ({selectedFecha})
                </span>
              )}
              {consolidarLineaAzul && (
                <span
                  className="px-2 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 rounded-full border border-sky-200/70"
                  title="Agricultor 1-2 y Sincromax consolidan línea azul completa; Yakuy Minka consolida Norte + Sur sin Viviendas Mar Verde; fundos centrales operan por zona."
                >
                  LÍNEA AZUL 100%
                </span>
              )}
            </div>
          </div>

          {/* Botones de Acción con Ícono Arriba + Buscador Píldora */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={rows.length === 0}
              className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#009A44] hover:text-[#007a35] hover:bg-emerald-50/70 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Descargar programación en Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-[10px] font-medium">Descarga</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              disabled={activeFleetMasters.length === 0}
              className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#009A44] hover:text-[#007a35] hover:bg-emerald-50/70 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Agregar unidad manual"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="text-[10px] font-medium">Nuevo</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExcelPreview(true)}
              disabled={rows.length === 0}
              className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#009A44] hover:text-[#007a35] hover:bg-emerald-50/70 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="Vista previa formato Excel (26 columnas)"
            >
              <Eye className="w-4 h-4" />
              <span className="text-[10px] font-medium">Vista</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 text-[#009A44] hover:text-[#007a35] hover:bg-emerald-50/70 rounded-lg transition-colors cursor-pointer"
              title="Recalcular con Procesos y Flota Maestra"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-[10px] font-medium">Actualizar</span>
            </button>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Palabra clave"
                className="w-52 sm:w-60 h-9 pl-4 pr-9 bg-white border border-gray-300 rounded-full text-xs text-gray-700 placeholder-gray-400 focus:border-[#009A44] focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-[#009A44] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filtros Tipo Píldora con Etiqueta Flotante (4 columnas exactas) */}
        <div className="px-5 pt-2 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3.5 gap-y-3.5">
            {/* Fecha de servicio */}
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-gray-500 font-medium z-10 pointer-events-none">
                Fecha de servicio
              </label>
              <select
                value={selectedFecha}
                onChange={(e) => {
                  setHasManualDateSelection(true);
                  setSelectedFecha(e.target.value);
                }}
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-full text-xs text-gray-700 focus:border-[#009A44] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="TODOS">Todas ({eligibleReqs.length} req.)</option>
                {selectedFecha !== 'TODOS' && !availableDates.includes(selectedFecha) && (
                  <option value={selectedFecha}>
                    {formatDateDDMMYYYY(selectedFecha)} (0 req.)
                  </option>
                )}
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

            {/* Estado Procesos */}
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-gray-500 font-medium z-10 pointer-events-none">
                Procesos
              </label>
              <select
                value={procesoEstadoFilter}
                onChange={(e) => setProcesoEstadoFilter(e.target.value as ProcesoEstadoFilter)}
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-full text-xs text-gray-700 focus:border-[#009A44] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="ACTIVOS">Activos</option>
                <option value="PENDIENTE_APROBADO">Pendientes y Aprobados</option>
                <option value="PENDIENTE">Solo Pendientes</option>
                <option value="APROBADO">Solo Aprobados</option>
                <option value="ATENDIDO">Solo Atendidos</option>
              </select>
            </div>

            {/* Turno */}
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-gray-500 font-medium z-10 pointer-events-none">
                Turno
              </label>
              <select
                value={turnoFilter}
                onChange={(e) => setTurnoFilter(e.target.value)}
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-full text-xs text-gray-700 focus:border-[#009A44] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                <option value="MAÑANA">Mañana</option>
                <option value="TARDE">Tarde</option>
                <option value="NOCHE">Noche</option>
              </select>
            </div>

            {/* Estado de móvil */}
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-gray-500 font-medium z-10 pointer-events-none">
                Estado móvil
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-full text-xs text-gray-700 focus:border-[#009A44] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                <option value="pendiente">Sin asignar móvil</option>
                <option value="ok">Listos</option>
                <option value="exceso">Excede capacidad</option>
              </select>
            </div>

            {/* Regla de consolidación */}
            <div className="relative">
              <label className="absolute -top-1.5 left-4 bg-white px-1.5 text-[10px] leading-[12px] text-gray-500 font-medium z-10 pointer-events-none">
                Optimización corredor
              </label>
              <select
                value={consolidarLineaAzul ? 'AZUL' : 'ZONA'}
                onChange={(e) => setConsolidarLineaAzul(e.target.value === 'AZUL')}
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-full text-xs text-gray-700 focus:border-[#009A44] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="AZUL">Línea Azul: 100% (Activa)</option>
                <option value="ZONA">Por zona estricta</option>
              </select>
            </div>

            {/* Selectores rápidos de Zona + Limpiar */}
            <div className="sm:col-span-1 lg:col-span-3 flex flex-wrap items-center justify-between lg:justify-end gap-2 self-center">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-gray-400 mr-0.5">Zona:</span>
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
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                      zoneTab === tab.id
                        ? 'bg-[#009A44] text-white border-[#009A44]'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {hasActiveTableFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setZoneTab('TODOS');
                    setTurnoFilter('TODOS');
                    setStatusFilter('TODOS');
                    setSearchQuery('');
                  }}
                  className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-[11px] font-medium text-gray-700 transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla Limpia con Cabecera Celeste #EDF6FC (Idéntica a Recepción de requerimientos) */}
        <div className="overflow-x-auto max-h-[calc(100vh-340px)]">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#EDF6FC] text-[#1D7FC4] font-semibold text-[11px] border-y border-[#DCECF7]">
              <tr>
                <th className="py-2.5 px-3 w-10 whitespace-nowrap">#</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Zona / Ruta</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Área / Fundo</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Paraderos del recorrido</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Movimiento & Hora</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Unidad</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Personal</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Proveedor / Móvil</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Estado</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap border-l border-[#DCECF7]/70">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-gray-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-gray-500">
                    <Inbox className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <span className="block font-semibold text-[#1E293B] text-xs">
                      {rows.length === 0
                        ? 'No hay requerimientos programados para la fecha seleccionada'
                        : 'No se encontraron recorridos con los filtros seleccionados'}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-1 block max-w-md mx-auto">
                      {rows.length === 0
                        ? 'Cambia la fecha de servicio o el filtro de Procesos para visualizar los requerimientos.'
                        : 'Prueba cambiando o limpiando los filtros seleccionados.'}
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const pct = row.cap > 0 ? Math.round((row.people / row.cap) * 100) : 0;
                  const overCap = row.people > row.cap;
                  const missingAssign = isPendingAssignment(row);

                  return (
                    <tr key={row.id} className="hover:bg-[#F7FBFE] transition-colors">
                      <td className="py-2.5 px-3 text-[11px] font-medium text-gray-400 tabular-nums whitespace-nowrap">
                        {String(idx + 1).padStart(2, '0')}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-semibold uppercase ${
                            row.zone === 'LÍNEA AZUL'
                              ? 'text-[#1D7FC4]'
                              : row.zone === 'SUR'
                              ? 'text-[#009A44]'
                              : 'text-sky-600'
                          }`}
                        >
                          {row.zone}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                          {row.reqCodes.length > 0 ? row.reqCodes.join(', ') : 'Manual'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-[11px] font-medium text-[#1E293B]">{row.area}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{row.fundo}</div>
                      </td>

                      <td className="py-2.5 px-3 max-w-[320px]">
                        <div className="text-[11px] text-gray-700 leading-snug">
                          {row.stopDetails.length > 0 ? (
                            row.stopDetails.map((s, sIdx) => (
                              <React.Fragment key={`${s.paradero}-${sIdx}`}>
                                {sIdx > 0 && <span className="text-gray-300 mx-1">→</span>}
                                <span className="font-medium text-[#1E293B]">{s.paradero}</span>
                                <span className="text-gray-400 tabular-nums ml-0.5">
                                  ({s.cantidad})
                                </span>
                              </React.Fragment>
                            ))
                          ) : (
                            <span>{row.stopsText}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-semibold uppercase block ${
                            row.movimiento === 'INGRESO'
                              ? 'text-[#009A44]'
                              : row.movimiento === 'SALIDA'
                              ? 'text-sky-600'
                              : 'text-purple-600'
                          }`}
                        >
                          {row.movimiento}
                        </span>
                        <div className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap tabular-nums">
                          Hora: <strong className="font-medium text-gray-700">{row.time}</strong> ·{' '}
                          {formatTurnoDisplay(row.turno)}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="text-[11px] font-medium text-[#1E293B]">{row.type}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
                          Cap. {row.cap} pax
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                        <div>
                          <span className="font-semibold text-[#1E293B]">{row.people}</span>{' '}
                          <span className="text-[10px] text-gray-500">
                            / {row.cap} pers.
                          </span>
                        </div>
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            overCap
                              ? 'text-red-600'
                              : pct >= 90
                              ? 'text-[#009A44]'
                              : 'text-amber-600'
                          }`}
                        >
                          {pct}% ocupación
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {missingAssign ? (
                          <span className="text-[11px] text-gray-400 italic">Por asignar</span>
                        ) : (
                          <div>
                            <div className="text-[11px] font-medium text-[#1E293B]">
                              {row.provider} • {row.plate}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[170px]">
                              {row.driver}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {overCap ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-800 border border-red-200 shadow-2xs whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            EXCEDE CAP.
                          </span>
                        ) : missingAssign ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs whitespace-nowrap">
                            <Clock className="w-3 h-3 text-amber-600" />
                            SIN ASIGNAR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            LISTO
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 border-l border-gray-100 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="p-1 rounded-md text-[#009A44] hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Editar unidad y paraderos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="px-2.5 py-0.5 bg-white hover:bg-emerald-50 text-[#009A44] border border-emerald-300 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap cursor-pointer"
                            title={missingAssign ? 'Asignar placa y conductor' : 'Modificar móvil'}
                          >
                            {missingAssign ? 'Asignar' : 'Editar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 rounded-md text-orange-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Quitar recorrido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra Inferior Limpia (Idéntica a Recepción de requerimientos) */}
        <div className="bg-white px-5 py-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="text-gray-500 font-medium tabular-nums">
            {filteredRows.length > 0 ? (
              <>
                Mostrando <strong className="text-[#1E293B] font-semibold">1</strong> a{' '}
                <strong className="text-[#1E293B] font-semibold">{filteredRows.length}</strong> de{' '}
                <strong className="text-[#1E293B] font-semibold">{rows.length}</strong> recorridos
              </>
            ) : (
              'Mostrando 0 recorridos'
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500 tabular-nums">
            <span>
              Norte: <strong className="text-[#1E293B] font-semibold">{zoneSummary.norteCount}</strong> ({zoneSummary.nortePax} p.)
            </span>
            <span>
              Sur: <strong className="text-[#1E293B] font-semibold">{zoneSummary.surCount}</strong> ({zoneSummary.surPax} p.)
            </span>
            {zoneSummary.blueCount > 0 && (
              <span className="text-[#1D7FC4]">
                Línea Azul: <strong>{zoneSummary.blueCount}</strong> ({zoneSummary.bluePax} p.)
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowExcelPreview(true)}
              disabled={rows.length === 0}
              className="text-[#009A44] hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Vista previa Excel</span>
            </button>
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 uppercase outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 uppercase outline-none focus:border-[#009A44]"
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
                      className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#009A44]"
                    />
                    <input
                      type="text"
                      value={formState.sayta}
                      onChange={(e) => setFormState((s) => ({ ...s, sayta: e.target.value }))}
                      placeholder="Sayta"
                      className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 tabular-nums outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="w-full h-9 px-2.5 border border-slate-200 rounded-md text-xs text-slate-900 outline-none focus:border-[#009A44]"
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
                    className="px-4 py-2 rounded-md bg-[#009A44] hover:bg-[#007a35] text-white text-xs font-semibold cursor-pointer"
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
                  <FileSpreadsheet className="w-4 h-4 text-[#009A44]" />
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
                    <tr className="bg-[#009A44] text-white text-[10px] uppercase tracking-wider">
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
                className="px-4 py-2 rounded-md bg-[#009A44] hover:bg-[#007a35] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
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
