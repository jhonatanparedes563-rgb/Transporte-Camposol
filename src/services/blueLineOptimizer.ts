import {
  Requerimiento,
  DetalleRequerimiento,
  MaestroUnidadBus,
  MaestroParadero,
  ZonaParadero,
} from '../types';
import { CANONICAL_PARADEROS_ORDER, normalizeParaderoKey } from '../data/masterData';
import { inferParaderoZona } from './storageService';

export interface StopDemandItem {
  paradero: string;
  zona: ZonaParadero;
  isBlueLine: boolean;
  cantidad: number;
  fundo: string;
  area: string;
  reqId: string;
  reqCode: string;
  owner: string;
  horaDisplay: string;
  movimiento: Requerimiento['movimiento'];
  fecha: string;
  estadoReq: string;
  origenComedor: string;
}

export interface OptimizedCorridorTrip {
  id: string;
  matchKey: string;
  zone: ZonaParadero | 'LÍNEA AZUL';
  fecha: string;
  time: string;
  movimiento: Requerimiento['movimiento'];
  fundos: string[];
  areas: string[];
  stops: Array<{ paradero: string; cantidad: number; zona: ZonaParadero }>;
  unidad: MaestroUnidadBus;
  people: number;
  cap: number;
  reqCodes: string[];
  reqIds: string[];
  reqEstados: string[];
  owners: string[];
  origenes: string[];
  consolidatedRuleNote?: string;
}

// Paraderos que pertenecen directamente a la línea recta azul (Panamericana: La Brasil <-> Viviendas Mar Verde / Chao)
const BLUE_LINE_PARADEROS = new Set<string>(CANONICAL_PARADEROS_ORDER);

// Paraderos fuera del eje troncal azul
const OFF_BLUE_LINE_KEYWORDS = [
  'HUACAPONGO',
  'CERRITO',
  'REPRESA',
  'SANTA ELENA',
  'HUANCAQUITO',
  'CARTAVIO',
  'RICARDINA',
];

export function isBlueLineParadero(paraderoName: string): boolean {
  const upper = (paraderoName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (OFF_BLUE_LINE_KEYWORDS.some((kw) => upper.includes(kw))) {
    return false;
  }
  if (upper.includes('PRIMERO DE MAYO') || upper.includes('CALLE LIMA')) {
    return true;
  }
  const canonical = normalizeParaderoKey(paraderoName);
  return BLUE_LINE_PARADEROS.has(canonical);
}

// Fundos que comparten la línea recta del corredor Agricultor 1 / 2 / 3 / Sincromax (en el Sur)
export function isAgricultorCorridorFundo(fundo: string): boolean {
  const norm = (fundo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return (
    norm.includes('AGRICULTOR 1') ||
    norm.includes('AGRICULTOR 2') ||
    norm.includes('AGRICULTOR 3') ||
    norm.includes('AGRICULTOR1') ||
    norm.includes('AGRICULTOR2') ||
    norm.includes('AGRICULTOR3') ||
    norm.includes('SINCROMAX')
  );
}

// Yakuy Minka: puede consolidar Norte + Sur (excepto Viviendas Mar Verde) cuando viene de La Brasil/Norte
export function isYakuyMinkaFundo(fundo: string): boolean {
  const norm = (fundo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

  return (
    norm.includes('YAKUY') ||
    norm === 'YAKU' ||
    norm.startsWith('YAKU ') ||
    norm === 'YK'
  );
}

function getCorridorGroupKey(fundo: string): string {
  return (fundo || 'SIN_FUNDO').trim().toUpperCase();
}

function parseMinutesFromTime(rawTime: string): number {
  const match = (rawTime || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return 13 * 60;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function formatMinutesToHHMM(mins: number): string {
  const clamped = ((mins % 1440) + 1440) % 1440;
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function extractZoneHour(rawTime: string, zone: ZonaParadero, req: Requerimiento): string {
  if (zone === 'NORTE' && req.horaRecojoNorte) return req.horaRecojoNorte;
  if (zone === 'SUR' && req.horaRecojoSur) return req.horaRecojoSur;
  const match = (rawTime || '13:00').match(/(\d{1,2}:\d{2})/);
  if (match) {
    const [h, m] = match[1].split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  return '13:00';
}

/**
 * Programación dinámica para elegir la combinación de unidades activas de Datos Maestros
 * que minimiza: 1) cantidad de vehículos, 2) asientos vacíos (buscando 100% de ocupación).
 */
export function solveOptimalFleetDP(
  totalPax: number,
  activeFleet: MaestroUnidadBus[]
): MaestroUnidadBus[] {
  if (totalPax <= 0 || activeFleet.length === 0) return [];

  const sorted = [...activeFleet]
    .filter((u) => u.activo && u.capacidad > 0)
    .sort((a, b) => b.capacidad - a.capacidad);
  if (sorted.length === 0) return [];

  const maxCap = sorted[0].capacidad;

  // Caso 1 unidad alcanza exactamente o con menor desperdicio
  const singleFitting = sorted.filter((u) => u.capacidad >= totalPax);
  if (singleFitting.length > 0) {
    return [singleFitting[singleFitting.length - 1]];
  }

  // Para demandas grandes que exceden la unidad mayor, fijamos bloques de la unidad más eficiente si superan 240 pax
  let prefixUnits: MaestroUnidadBus[] = [];
  let rem = totalPax;
  while (rem > 240) {
    prefixUnits.push(sorted[0]);
    rem -= maxCap;
  }

  const targetLimit = rem + maxCap;
  const INF = 1e9;
  const bestVehicleCount = new Array<number>(targetLimit + 1).fill(INF);
  const parentChoice = new Array<number>(targetLimit + 1).fill(-1);
  bestVehicleCount[0] = 0;

  for (let c = 1; c <= targetLimit; c++) {
    for (let uIdx = 0; uIdx < sorted.length; uIdx++) {
      const cap = sorted[uIdx].capacidad;
      if (c >= cap && bestVehicleCount[c - cap] + 1 < bestVehicleCount[c]) {
        bestVehicleCount[c] = bestVehicleCount[c - cap] + 1;
        parentChoice[c] = uIdx;
      }
    }
  }

  let bestCap = -1;
  let bestScore = INF;
  for (let c = rem; c <= targetLimit; c++) {
    if (bestVehicleCount[c] >= INF) continue;
    const wasted = c - rem;
    // Priorizar menos unidades y luego mínimo desperdicio (máximo % hacia 100%)
    const score = bestVehicleCount[c] * 10000 + wasted;
    if (score < bestScore) {
      bestScore = score;
      bestCap = c;
    }
  }

  if (bestCap === -1) {
    return [...prefixUnits, sorted[0]];
  }

  const chosen: MaestroUnidadBus[] = [];
  let curr = bestCap;
  while (curr > 0 && parentChoice[curr] !== -1) {
    const unit = sorted[parentChoice[curr]];
    chosen.push(unit);
    curr -= unit.capacidad;
  }

  return [...prefixUnits, ...chosen].sort((a, b) => b.capacidad - a.capacidad);
}

function getAllocationStats(pax: number, units: MaestroUnidadBus[]) {
  const totalCap = units.reduce((s, u) => s + u.capacidad, 0);
  const wasted = Math.max(0, totalCap - pax);
  const occ = totalCap > 0 ? (pax / totalCap) * 100 : 0;
  return { count: units.length, totalCap, wasted, occ };
}

// Orden geográfico real de Norte a Sur sobre la línea azul Panamericana
const GEO_NORTH_TO_SOUTH_ORDER: string[] = [
  // ZONA NORTE (Virú): Norte -> Sur (0..18)
  'LA BRASIL',
  'VALDEMAR',
  'LA LLANTA',
  'VILLA VIRU',
  'TECHO PROPIO',
  'PETROAMERICA',
  'PUENTE CHANQUIN',
  'CALIFORNIA',
  'EL CAÑAN',
  'PRIMERA DE MAYO',
  'EL REFUGIO',
  'LA PORTADA',
  'CALLE LIMA-VIRU',
  'GRIFO LOS PINOS',
  'SAN LUIS',
  'MENDOCILLA',
  'LA 21',
  'LA PLAZUELA SAN JOSE',
  'SANTA CECILIA',
  // ZONA SUR (Chao): Norte -> Sur (19..23)
  'SEGUNDO PARADERO',
  'LA BOTICA',
  'LA 28',
  'GRIFO GRAN CHIMU',
  'VIVIENDAS MAR VERDE',
];

function getCanonicalOrderKey(paradero: string): string {
  const upper = (paradero || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (upper.includes('PRIMERO DE MAYO')) return 'PRIMERA DE MAYO';
  if (upper === 'CALLE LIMA') return 'CALLE LIMA-VIRU';
  return normalizeParaderoKey(paradero);
}

function getGeoNorthToSouthIndex(paradero: string, masterParaderos: MaestroParadero[]): number {
  const canonical = getCanonicalOrderKey(paradero);
  const geoIdx = GEO_NORTH_TO_SOUTH_ORDER.indexOf(canonical);
  if (geoIdx !== -1) return geoIdx;

  const normUpper = (paradero || '').trim().toUpperCase();
  const masterIdx = masterParaderos.findIndex(
    (m) => m.paradero.trim().toUpperCase() === normUpper
  );
  if (masterIdx !== -1) return 500 + masterIdx;

  return 999;
}

/**
 * Ordena los paraderos respetando la ubicación real del fundo y el sentido de la línea:
 * - Fundos en el SUR (AGRICULTOR 1/2/3, SINCROMAX):
 *   - INGRESO: de Norte a Sur por toda la línea (LA BRASIL -> ... -> SANTA CECILIA -> SEGUNDO PARADERO -> ... -> VIVIENDAS MAR VERDE)
 *   - SALIDA: de Sur a Norte (VIVIENDAS MAR VERDE -> ... -> SEGUNDO PARADERO -> SANTA CECILIA -> ... -> LA BRASIL)
 * - YAKUY MINKA:
 *   - Si viene de Norte / Línea Azul (sin Viviendas): INGRESO va Norte->Sur (LA BRASIL -> ... -> GRIFO GRAN CHIMU), SALIDA va Sur->Norte
 *   - Si es solo SUR: INGRESO sale de VIVIENDAS MAR VERDE (Sur->Norte: VIVIENDAS -> ... -> SEGUNDO PARADERO), SALIDA va Norte->Sur
 * - Demás fundos en el MEDIO (GLORIA BAJA/MEDIA/ALTA, MAR VERDE, ORO AZUL, FRUSOL 1/2, SAN JOSE, AGROMAS, NAPO):
 *   - INGRESO NORTE: Norte->Sur (LA BRASIL -> ... -> SANTA CECILIA)
 *   - INGRESO SUR: Sur->Norte (VIVIENDAS MAR VERDE -> ... -> SEGUNDO PARADERO)
 *   - SALIDA NORTE: Sur->Norte; SALIDA SUR: Norte->Sur
 */
function compareStopsByCorridorDirection(
  a: Pick<StopDemandItem, 'paradero' | 'zona' | 'fundo'>,
  b: Pick<StopDemandItem, 'paradero' | 'zona' | 'fundo'>,
  movimiento: Requerimiento['movimiento'],
  masterParaderos: MaestroParadero[],
  hasNorteOnTrip: boolean,
  tripZone?: ZonaParadero | 'LÍNEA AZUL'
): number {
  const geoA = getGeoNorthToSouthIndex(a.paradero, masterParaderos);
  const geoB = getGeoNorthToSouthIndex(b.paradero, masterParaderos);

  const isCanonA = geoA < 100;
  const isCanonB = geoB < 100;
  if (isCanonA !== isCanonB) return isCanonA ? -1 : 1;
  if (!isCanonA && !isCanonB) {
    return geoA !== geoB ? geoA - geoB : a.paradero.localeCompare(b.paradero);
  }

  const isSalida = movimiento === 'SALIDA';
  const isSouthFundo = isAgricultorCorridorFundo(a.fundo) || isAgricultorCorridorFundo(b.fundo);
  const isYakuy = isYakuyMinkaFundo(a.fundo) || isYakuyMinkaFundo(b.fundo);

  if (isSouthFundo || (isYakuy && hasNorteOnTrip)) {
    const diff = !isSalida ? geoA - geoB : geoB - geoA;
    return diff !== 0 ? diff : a.paradero.localeCompare(b.paradero);
  }

  // Si el recorrido tiene una zona operativa definida (ej. ruta SUR que absorbe San José), ordenar todo el tramo en su sentido vial
  if (tripZone === 'NORTE' || tripZone === 'SUR') {
    const ascending = tripZone === 'NORTE' ? !isSalida : isSalida;
    const diff = ascending ? geoA - geoB : geoB - geoA;
    return diff !== 0 ? diff : a.paradero.localeCompare(b.paradero);
  }

  // Fundos en el Medio (Gloria*, Mar Verde, Oro Azul, Frusol 1/2, San Jose, Agromas, Napo) y Yakuy solo-Sur
  if (a.zona !== b.zona) {
    return a.zona === 'NORTE' ? -1 : 1;
  }

  const ascending = a.zona === 'NORTE' ? !isSalida : isSalida;
  const diff = ascending ? geoA - geoB : geoB - geoA;
  return diff !== 0 ? diff : a.paradero.localeCompare(b.paradero);
}

/**
 * Reparte los tramos/paraderos ordenados entre las unidades elegidas llenando cada unidad al máximo.
 */
function packStopsIntoUnits(
  items: StopDemandItem[],
  units: MaestroUnidadBus[],
  zoneLabel: ZonaParadero | 'LÍNEA AZUL',
  masterParaderos: MaestroParadero[],
  fecha: string,
  time: string,
  movimiento: Requerimiento['movimiento'],
  groupCounter: Record<string, number>,
  ruleNote?: string,
  preserveZoneLabel?: boolean
): OptimizedCorridorTrip[] {
  if (items.length === 0 || units.length === 0) return [];

  const hasNorteOnTrip = items.some((i) => i.zona === 'NORTE');
  // Ordenar paraderos geográficamente según ubicación real del fundo y sentido de la línea
  const sortedItems = [...items].sort((a, b) =>
    compareStopsByCorridorDirection(a, b, movimiento, masterParaderos, hasNorteOnTrip, zoneLabel)
  );

  // Cola mutable de cantidades por ítem
  const queue = sortedItems.map((it) => ({ ...it }));
  const trips: OptimizedCorridorTrip[] = [];

  for (const unit of units) {
    let seatsLeft = unit.capacidad;
    const assignedStopsMap = new Map<
      string,
      { paradero: string; cantidad: number; zona: ZonaParadero }
    >();
    const fundosSet = new Set<string>();
    const areasSet = new Set<string>();
    const reqCodesSet = new Set<string>();
    const reqIdsSet = new Set<string>();
    const reqEstadosSet = new Set<string>();
    const ownersSet = new Set<string>();
    const origenesSet = new Set<string>();
    const zonesSeen = new Set<ZonaParadero>();
    let totalLoaded = 0;

    for (let i = 0; i < queue.length && seatsLeft > 0; i++) {
      const q = queue[i];
      if (q.cantidad <= 0) continue;

      const take = Math.min(seatsLeft, q.cantidad);
      q.cantidad -= take;
      seatsLeft -= take;
      totalLoaded += take;

      const prevStop = assignedStopsMap.get(q.paradero);
      if (prevStop) {
        prevStop.cantidad += take;
      } else {
        assignedStopsMap.set(q.paradero, {
          paradero: q.paradero,
          cantidad: take,
          zona: q.zona,
        });
      }

      zonesSeen.add(q.zona);
      if (q.fundo) fundosSet.add(q.fundo);
      if (q.area) areasSet.add(q.area);
      if (q.reqCode) reqCodesSet.add(q.reqCode);
      if (q.reqId) reqIdsSet.add(q.reqId);
      if (q.estadoReq) reqEstadosSet.add(q.estadoReq);
      if (q.owner) ownersSet.add(q.owner);
      if (q.origenComedor) origenesSet.add(q.origenComedor);
    }

    if (totalLoaded <= 0) continue;

    const effectiveZone: ZonaParadero | 'LÍNEA AZUL' = preserveZoneLabel
      ? zoneLabel
      : zonesSeen.size > 1
      ? 'LÍNEA AZUL'
      : Array.from(zonesSeen)[0] || zoneLabel;

    const fundosList = Array.from(fundosSet);
    const baseKey = `${fecha}__${effectiveZone}__${fundosList.join('+')}__${time}__${movimiento}`;
    const seq = (groupCounter[baseKey] || 0) + 1;
    groupCounter[baseKey] = seq;
    const matchKey = `${baseKey}__${seq}`;

    trips.push({
      id: `${matchKey}__trip`,
      matchKey,
      zone: effectiveZone,
      fecha,
      time,
      movimiento,
      fundos: fundosList,
      areas: Array.from(areasSet),
      stops: Array.from(assignedStopsMap.values()),
      unidad: unit,
      people: totalLoaded,
      cap: unit.capacidad,
      reqCodes: Array.from(reqCodesSet),
      reqIds: Array.from(reqIdsSet),
      reqEstados: Array.from(reqEstadosSet),
      owners: Array.from(ownersSet),
      origenes: Array.from(origenesSet),
      consolidatedRuleNote: ruleNote,
    });
  }

  return trips;
}

/**
 * Motor principal de generación de programación con consolidación de Línea Azul (100%).
 * - Mantiene separados los destinos incompatibles.
 * - Permite compartir vehículos entre Agricultor 1 / 2 / 3 / Sincromax sobre la línea recta (Viviendas <-> La Brasil).
 * - Busca la máxima ocupación posible (objetivo 100%) absorbiendo saldos pequeños (ej. 2 personas a la combi de 13/15 -> 15/15).
 */
export function generateCorridorSchedule(params: {
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  unidadesDisponibles: MaestroUnidadBus[];
  paraderosMaestros: MaestroParadero[];
  fechaFiltro: string; // YYYY-MM-DD | 'TODOS'
  consolidarLineaAzul: boolean;
}): OptimizedCorridorTrip[] {
  const {
    requerimientos,
    detalles,
    unidadesDisponibles,
    paraderosMaestros,
    fechaFiltro,
    consolidarLineaAzul,
  } = params;

  const activeFleet = unidadesDisponibles
    .filter((u) => u.activo && u.capacidad > 0)
    .sort((a, b) => b.capacidad - a.capacidad);

  if (activeFleet.length === 0) return [];

  const filteredReqs = requerimientos.filter((r) => {
    if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') return false;
    if (fechaFiltro !== 'TODOS' && r.fecha !== fechaFiltro) return false;
    return true;
  });

  // 1. Expandir requerimientos en StopDemandItem
  const allDemandItems: StopDemandItem[] = [];
  filteredReqs.forEach((req) => {
    const reqDets = detalles.filter((d) => d.requerimientoId === req.id && d.cantidad > 0);
    const comedorFallback =
      req.parcelas && req.parcelas.length > 0 ? req.parcelas.join(', ') : 'CAMPO';
    const owner = req.usuario || req.userUsername || 'Supervisor';

    if (reqDets.length === 0) {
      if (req.totalPersonas <= 0) return;
      const zoneFallback: ZonaParadero =
        req.fundo.toUpperCase().includes('CHAO') || isAgricultorCorridorFundo(req.fundo)
          ? 'SUR'
          : 'NORTE';
      const masterZoneStop = paraderosMaestros.find(
        (p) => (p.zona || inferParaderoZona(p.paradero)) === zoneFallback
      )?.paradero;
      const defaultStop = masterZoneStop || (zoneFallback === 'SUR' ? 'SEGUNDO PARADERO' : 'LA BRASIL');
      allDemandItems.push({
        paradero: defaultStop,
        zona: zoneFallback,
        isBlueLine: isBlueLineParadero(defaultStop),
        cantidad: req.totalPersonas,
        fundo: req.fundo,
        area: req.area || 'PRODUCCIÓN',
        reqId: req.id,
        reqCode: req.numeroRequerimiento,
        owner,
        horaDisplay: extractZoneHour(req.horaRecojo || req.horaSalida, zoneFallback, req),
        movimiento: req.movimiento,
        fecha: req.fecha,
        estadoReq: req.estado,
        origenComedor: comedorFallback,
      });
      return;
    }

    reqDets.forEach((det) => {
      const zona: ZonaParadero = det.zona || inferParaderoZona(det.paradero);
      allDemandItems.push({
        paradero: det.paradero,
        zona,
        isBlueLine: isBlueLineParadero(det.paradero),
        cantidad: det.cantidad,
        fundo: req.fundo,
        area: req.area || 'PRODUCCIÓN',
        reqId: req.id,
        reqCode: req.numeroRequerimiento,
        owner,
        horaDisplay: extractZoneHour(req.horaRecojo || req.horaSalida, zona, req),
        movimiento: req.movimiento,
        fecha: req.fecha,
        estadoReq: req.estado,
        origenComedor: det.comedor || comedorFallback,
      });
    });
  });

  // 2. Agrupar por (fecha, movimiento, ventana de turno, grupo de fundo/corredor)
  // Dentro de un mismo turno (<= 20 min de diferencia en la misma línea/corredor), se consolidan en un mismo cluster
  interface CorridorBucket {
    fecha: string;
    movimiento: Requerimiento['movimiento'];
    corridorKey: string;
    anchorMinutes: number;
    anchorTime: string;
    items: StopDemandItem[];
  }

  const buckets: CorridorBucket[] = [];
  const sortedItems = [...allDemandItems].sort((a, b) => {
    const cmpDate = a.fecha.localeCompare(b.fecha);
    if (cmpDate !== 0) return cmpDate;
    const cmpMins = parseMinutesFromTime(a.horaDisplay) - parseMinutesFromTime(b.horaDisplay);
    if (cmpMins !== 0) return cmpMins;
    return a.reqCode.localeCompare(b.reqCode, undefined, { numeric: true, sensitivity: 'base' });
  });

  for (const item of sortedItems) {
    const mins = parseMinutesFromTime(item.horaDisplay);
    const isBlueLineCorridorFundo =
      isAgricultorCorridorFundo(item.fundo) || isYakuyMinkaFundo(item.fundo);
    const fundoKey = getCorridorGroupKey(item.fundo);
    // Cada requerimiento (por usuario y fundo) opera de forma independiente; solo consolida sus propios paraderos
    const corridorKey = !consolidarLineaAzul
      ? `${item.reqId}__${fundoKey}__${item.zona}`
      : isBlueLineCorridorFundo
      ? `CORREDOR__${item.reqId}__${fundoKey}`
      : `CENTRAL__${item.reqId}__${fundoKey}`;

    // Ventana de 20 min dentro del mismo requerimiento cuando consolida paraderos Norte + Sur
    const maxGap = consolidarLineaAzul && isBlueLineCorridorFundo ? 20 : 0;
    const existing = buckets.find(
      (b) =>
        b.fecha === item.fecha &&
        b.movimiento === item.movimiento &&
        b.corridorKey === corridorKey &&
        Math.abs(b.anchorMinutes - mins) <= maxGap
    );

    if (existing) {
      existing.items.push(item);
    } else {
      buckets.push({
        fecha: item.fecha,
        movimiento: item.movimiento,
        corridorKey,
        anchorMinutes: mins,
        anchorTime: formatMinutesToHHMM(mins),
        items: [item],
      });
    }
  }

  // 3. Optimizar flota para cada bucket buscando 100% en Línea Azul
  const finalTrips: OptimizedCorridorTrip[] = [];
  const groupCounter: Record<string, number> = {};

  for (const bucket of buckets) {
    const norteItems = bucket.items.filter((i) => i.zona === 'NORTE');
    const surItems = bucket.items.filter((i) => i.zona === 'SUR');
    const totalN = norteItems.reduce((s, i) => s + i.cantidad, 0);
    const totalS = surItems.reduce((s, i) => s + i.cantidad, 0);

    // Si solo hay una zona o no se consolida línea azul
    if (!consolidarLineaAzul || totalN === 0 || totalS === 0) {
      if (totalN > 0) {
        const unitsN = solveOptimalFleetDP(totalN, activeFleet);
        finalTrips.push(
          ...packStopsIntoUnits(
            norteItems,
            unitsN,
            'NORTE',
            paraderosMaestros,
            bucket.fecha,
            bucket.anchorTime,
            bucket.movimiento,
            groupCounter
          )
        );
      }
      if (totalS > 0) {
        const unitsS = solveOptimalFleetDP(totalS, activeFleet);
        finalTrips.push(
          ...packStopsIntoUnits(
            surItems,
            unitsS,
            'SUR',
            paraderosMaestros,
            bucket.fecha,
            bucket.anchorTime,
            bucket.movimiento,
            groupCounter
          )
        );
      }
      continue;
    }

    // Para fundos centrales (Gloria, Agromas, Frusol, Mar Verde, Oro Azul, San José, Napo):
    // Evaluar reequilibrio fronterizo en sector San José (La 21, La Plazuela San José, Santa Cecilia, Mendocilla -> Sur)
    // o Segundo Paradero/La Botica -> Norte cuando reduce flota o mejora la ocupabilidad global.
    const isCentralBucket = bucket.corridorKey.startsWith('CENTRAL__');
    if (isCentralBucket) {
      const sepUnitsN = solveOptimalFleetDP(totalN, activeFleet);
      const sepUnitsS = solveOptimalFleetDP(totalS, activeFleet);
      let bestStats = getAllocationStats(totalN + totalS, [...sepUnitsN, ...sepUnitsS]);
      let bestNItems = norteItems;
      let bestSItems = surItems;
      let bestUnitsN = sepUnitsN;
      let bestUnitsS = sepUnitsS;
      let bestNoteN: string | undefined;
      let bestNoteS: string | undefined;

      const isBetterAllocation = (
        candidate: ReturnType<typeof getAllocationStats>,
        current: ReturnType<typeof getAllocationStats>
      ) =>
        candidate.count < current.count ||
        (candidate.count === current.count && candidate.wasted < current.wasted);

      // 1) SUR absorbe paraderos fronterizos contiguos de San José (Sur -> Norte: Santa Cecilia -> Plazuela San José -> La 21)
      const sanJoseStopGroups = new Map<number, StopDemandItem[]>();
      for (const it of norteItems) {
        if (!it.isBlueLine) continue;
        const gIdx = getGeoNorthToSouthIndex(it.paradero, paraderosMaestros);
        if (gIdx >= 16 && gIdx <= 18) {
          const arr = sanJoseStopGroups.get(gIdx) || [];
          arr.push(it);
          sanJoseStopGroups.set(gIdx, arr);
        }
      }
      const orderedSanJoseIdxs = Array.from(sanJoseStopGroups.keys()).sort((a, b) => b - a);
      const movedToSurSet = new Set<StopDemandItem>();
      for (const gIdx of orderedSanJoseIdxs) {
        const group = sanJoseStopGroups.get(gIdx) || [];
        group.forEach((it) => movedToSurSet.add(it));
        const candN = norteItems.filter((it) => !movedToSurSet.has(it));
        const candS = [...surItems, ...Array.from(movedToSurSet)];
        const paxN = candN.reduce((s, i) => s + i.cantidad, 0);
        const paxS = candS.reduce((s, i) => s + i.cantidad, 0);
        const candUnitsN = paxN > 0 ? solveOptimalFleetDP(paxN, activeFleet) : [];
        const candUnitsS = paxS > 0 ? solveOptimalFleetDP(paxS, activeFleet) : [];
        const candStats = getAllocationStats(totalN + totalS, [...candUnitsN, ...candUnitsS]);
        if (isBetterAllocation(candStats, bestStats)) {
          bestStats = candStats;
          bestNItems = candN;
          bestSItems = candS;
          bestUnitsN = candUnitsN;
          bestUnitsS = candUnitsS;
          const movedStopsNames = Array.from(
            new Set(Array.from(movedToSurSet).map((x) => x.paradero))
          ).join(', ');
          bestNoteN = `Parada límite (${movedStopsNames}) asignada a ruta Sur para optimizar ocupabilidad`;
          bestNoteS = `Incluye sector San José (${movedStopsNames}) para optimizar ocupabilidad`;
        }
      }

      // 2) Simétrico: NORTE absorbe Segundo Paradero (límite norte de Chao) solo si mejora estrictamente frente al resultado anterior
      const chaoNorthGroups = new Map<number, StopDemandItem[]>();
      for (const it of surItems) {
        if (!it.isBlueLine) continue;
        const gIdx = getGeoNorthToSouthIndex(it.paradero, paraderosMaestros);
        if (gIdx === 19) {
          const arr = chaoNorthGroups.get(gIdx) || [];
          arr.push(it);
          chaoNorthGroups.set(gIdx, arr);
        }
      }
      const orderedChaoNorthIdxs = Array.from(chaoNorthGroups.keys()).sort((a, b) => a - b);
      const movedToNorteSet = new Set<StopDemandItem>();
      for (const gIdx of orderedChaoNorthIdxs) {
        const group = chaoNorthGroups.get(gIdx) || [];
        group.forEach((it) => movedToNorteSet.add(it));
        const candS = surItems.filter((it) => !movedToNorteSet.has(it));
        const candN = [...norteItems, ...Array.from(movedToNorteSet)];
        const paxN = candN.reduce((s, i) => s + i.cantidad, 0);
        const paxS = candS.reduce((s, i) => s + i.cantidad, 0);
        const candUnitsN = paxN > 0 ? solveOptimalFleetDP(paxN, activeFleet) : [];
        const candUnitsS = paxS > 0 ? solveOptimalFleetDP(paxS, activeFleet) : [];
        const candStats = getAllocationStats(totalN + totalS, [...candUnitsN, ...candUnitsS]);
        if (isBetterAllocation(candStats, bestStats)) {
          bestStats = candStats;
          bestNItems = candN;
          bestSItems = candS;
          bestUnitsN = candUnitsN;
          bestUnitsS = candUnitsS;
          const movedStopsNames = Array.from(
            new Set(Array.from(movedToNorteSet).map((x) => x.paradero))
          ).join(', ');
          bestNoteN = `Incluye paradero límite (${movedStopsNames}) para optimizar ocupabilidad`;
          bestNoteS = `Parada límite (${movedStopsNames}) asignada a ruta Norte para optimizar ocupabilidad`;
        }
      }

      finalTrips.push(
        ...packStopsIntoUnits(
          bestNItems,
          bestUnitsN,
          'NORTE',
          paraderosMaestros,
          bucket.fecha,
          bucket.anchorTime,
          bucket.movimiento,
          groupCounter,
          bestNoteN,
          true
        ),
        ...packStopsIntoUnits(
          bestSItems,
          bestUnitsS,
          'SUR',
          paraderosMaestros,
          bucket.fecha,
          bucket.anchorTime,
          bucket.movimiento,
          groupCounter,
          bestNoteS,
          true
        )
      );
      continue;
    }

    // Separar paraderos en línea azul vs fuera de eje
    const isYakuyBucket = isYakuyMinkaFundo(bucket.items[0]?.fundo || '');
    const norteBlue = norteItems.filter((i) => i.isBlueLine);
    const norteOff = norteItems.filter((i) => !i.isBlueLine);

    // En Yakuy Minka, si vienen de La Brasil/Norte NO toman Viviendas Mar Verde (Viviendas queda en Sur)
    const surBlueAll = surItems.filter((i) => i.isBlueLine);
    const surBlue = isYakuyBucket
      ? surBlueAll.filter((i) => getCanonicalOrderKey(i.paradero) !== 'VIVIENDAS MAR VERDE')
      : surBlueAll;
    const surOff = isYakuyBucket
      ? [
          ...surItems.filter((i) => !i.isBlueLine),
          ...surBlueAll.filter((i) => getCanonicalOrderKey(i.paradero) === 'VIVIENDAS MAR VERDE'),
        ]
      : surItems.filter((i) => !i.isBlueLine);

    const paxNBlue = norteBlue.reduce((s, i) => s + i.cantidad, 0);
    const paxSBlue = surBlue.reduce((s, i) => s + i.cantidad, 0);
    const paxNOff = norteOff.reduce((s, i) => s + i.cantidad, 0);
    const paxSOff = surOff.reduce((s, i) => s + i.cantidad, 0);

    // Evaluar Plan A: Zonas separadas
    const sepUnitsN = solveOptimalFleetDP(totalN, activeFleet);
    const sepUnitsS = solveOptimalFleetDP(totalS, activeFleet);
    const sepStats = getAllocationStats(totalN + totalS, [...sepUnitsN, ...sepUnitsS]);

    // Evaluar Plan B: Unificar demanda sobre Línea Azul
    const bluePoolItems = [...norteBlue, ...surBlue];
    const bluePoolPax = paxNBlue + paxSBlue;

    const mergedBlueUnits = solveOptimalFleetDP(bluePoolPax, activeFleet);
    const mergedOffNUnits = solveOptimalFleetDP(paxNOff, activeFleet);
    const mergedOffSUnits = solveOptimalFleetDP(paxSOff, activeFleet);
    const mergedAllUnits = [...mergedBlueUnits, ...mergedOffNUnits, ...mergedOffSUnits];
    const mergedStats = getAllocationStats(totalN + totalS, mergedAllUnits);

    // Evaluar Plan C: Mantener buses llenos por zona y juntar remanentes sobre Línea Azul
    let hybridTrips: OptimizedCorridorTrip[] | null = null;
    let hybridStats = { count: 9999, totalCap: 9999, wasted: 9999, occ: 0 };

    if (paxNOff === 0 && (sepUnitsN.length > 1 || sepUnitsS.length > 1)) {
      const largestCap = activeFleet[0].capacidad;
      if ((paxNBlue > largestCap || paxSBlue > largestCap) && paxSBlue > 0) {
        const fullUnitsN: MaestroUnidadBus[] = [];
        let remN = paxNBlue;
        while (remN >= largestCap) {
          fullUnitsN.push(activeFleet[0]);
          remN -= largestCap;
        }
        const fullUnitsS: MaestroUnidadBus[] = [];
        let remS = paxSBlue;
        while (remS >= largestCap) {
          fullUnitsS.push(activeFleet[0]);
          remS -= largestCap;
        }

        if (remN > 0 && remS > 0) {
          const pooledRemUnits = solveOptimalFleetDP(remN + remS, activeFleet);
          const offSUnitsForHybrid = solveOptimalFleetDP(paxSOff, activeFleet);
          const allHybridUnits = [
            ...fullUnitsN,
            ...fullUnitsS,
            ...pooledRemUnits,
            ...offSUnitsForHybrid,
          ];
          hybridStats = getAllocationStats(totalN + totalS, allHybridUnits);

          if (
            hybridStats.count < sepStats.count ||
            (hybridStats.count === sepStats.count && hybridStats.wasted < sepStats.wasted)
          ) {
            const sortedNorteBlue = [...norteBlue].sort((a, b) =>
              compareStopsByCorridorDirection(a, b, bucket.movimiento, paraderosMaestros, true)
            );
            const sortedSurBlue = [...surBlue].sort((a, b) =>
              compareStopsByCorridorDirection(a, b, bucket.movimiento, paraderosMaestros, true)
            );

            const remItemsN: StopDemandItem[] = [];
            const fullItemsN: StopDemandItem[] = [];
            let needN = fullUnitsN.reduce((s, u) => s + u.capacidad, 0);
            for (const it of sortedNorteBlue) {
              if (needN <= 0) {
                remItemsN.push({ ...it });
              } else if (it.cantidad <= needN) {
                fullItemsN.push({ ...it });
                needN -= it.cantidad;
              } else {
                fullItemsN.push({ ...it, cantidad: needN });
                remItemsN.push({ ...it, cantidad: it.cantidad - needN });
                needN = 0;
              }
            }

            const remItemsS: StopDemandItem[] = [];
            const fullItemsS: StopDemandItem[] = [];
            let needS = fullUnitsS.reduce((s, u) => s + u.capacidad, 0);
            for (const it of sortedSurBlue) {
              if (needS <= 0) {
                remItemsS.push({ ...it });
              } else if (it.cantidad <= needS) {
                fullItemsS.push({ ...it });
                needS -= it.cantidad;
              } else {
                fullItemsS.push({ ...it, cantidad: needS });
                remItemsS.push({ ...it, cantidad: it.cantidad - needS });
                needS = 0;
              }
            }

            hybridTrips = [
              ...packStopsIntoUnits(
                fullItemsN,
                fullUnitsN,
                'NORTE',
                paraderosMaestros,
                bucket.fecha,
                bucket.anchorTime,
                bucket.movimiento,
                groupCounter
              ),
              ...packStopsIntoUnits(
                fullItemsS,
                fullUnitsS,
                'SUR',
                paraderosMaestros,
                bucket.fecha,
                bucket.anchorTime,
                bucket.movimiento,
                groupCounter
              ),
              ...packStopsIntoUnits(
                [...remItemsN, ...remItemsS],
                pooledRemUnits,
                'LÍNEA AZUL',
                paraderosMaestros,
                bucket.fecha,
                bucket.anchorTime,
                bucket.movimiento,
                groupCounter,
                isYakuyBucket
                  ? 'Yakuy Minka: consolidado desde Norte sin Viviendas Mar Verde'
                  : 'Consolidación de remanentes en Línea Azul al máximo de ocupación'
              ),
              ...(paxSOff > 0
                ? packStopsIntoUnits(
                    surOff,
                    offSUnitsForHybrid,
                    'SUR',
                    paraderosMaestros,
                    bucket.fecha,
                    bucket.anchorTime,
                    bucket.movimiento,
                    groupCounter
                  )
                : []),
            ];
          }
        }
      }
    }

    // Decidir el mejor plan entre Separado, Unificado Línea Azul (B) o Híbrido (C)
    const useHybrid =
      hybridTrips !== null &&
      (hybridStats.count < mergedStats.count ||
        (hybridStats.count === mergedStats.count && hybridStats.wasted < mergedStats.wasted)) &&
      (hybridStats.count < sepStats.count ||
        (hybridStats.count === sepStats.count && hybridStats.wasted < sepStats.wasted));

    if (useHybrid && hybridTrips) {
      finalTrips.push(...hybridTrips);
      continue;
    }

    const useMergedBlue =
      bluePoolPax > 0 &&
      paxSBlue > 0 &&
      (mergedStats.count < sepStats.count ||
        (mergedStats.count === sepStats.count && mergedStats.wasted < sepStats.wasted));

    if (useMergedBlue) {
      finalTrips.push(
        ...packStopsIntoUnits(
          bluePoolItems,
          mergedBlueUnits,
          'LÍNEA AZUL',
          paraderosMaestros,
          bucket.fecha,
          bucket.anchorTime,
          bucket.movimiento,
          groupCounter,
          isYakuyBucket
            ? 'Yakuy Minka: recorrido Norte + Sur (sin Viviendas Mar Verde)'
            : 'Consolidado en corredor Línea Azul (La Brasil ↔ Viviendas Mar Verde)'
        )
      );
      if (paxNOff > 0) {
        finalTrips.push(
          ...packStopsIntoUnits(
            norteOff,
            mergedOffNUnits,
            'NORTE',
            paraderosMaestros,
            bucket.fecha,
            bucket.anchorTime,
            bucket.movimiento,
            groupCounter
          )
        );
      }
      if (paxSOff > 0) {
        finalTrips.push(
          ...packStopsIntoUnits(
            surOff,
            mergedOffSUnits,
            'SUR',
            paraderosMaestros,
            bucket.fecha,
            bucket.anchorTime,
            bucket.movimiento,
            groupCounter
          )
        );
      }
    } else {
      finalTrips.push(
        ...packStopsIntoUnits(
          norteItems,
          sepUnitsN,
          'NORTE',
          paraderosMaestros,
          bucket.fecha,
          bucket.anchorTime,
          bucket.movimiento,
          groupCounter
        ),
        ...packStopsIntoUnits(
          surItems,
          sepUnitsS,
          'SUR',
          paraderosMaestros,
          bucket.fecha,
          bucket.anchorTime,
          bucket.movimiento,
          groupCounter
        )
      );
    }
  }

  return finalTrips;
}
