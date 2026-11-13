import * as XLSX from 'xlsx';
import {
  Requerimiento,
  DetalleRequerimiento,
  MaestroUnidadBus,
  ViajeProgramado,
  ParadaViaje,
  FundoDestinoViaje,
  ProgramacionViajesDia,
  ZonaParadero,
  MovimientoType,
} from '../types';
import {
  CANONICAL_PARADEROS_ORDER,
  getParaderoOrderIndex,
} from '../data/masterData';
import { inferParaderoZona } from './storageService';

export interface ParametrosOptimizacion {
  fecha: string;
  movimiento?: MovimientoType | 'TODOS';
  turno?: string;
  permitirJuntarFundos: boolean; // Si true, puede consolidar fundos cercanos en la misma unidad
  fundosSeleccionados?: string[];
  unidadesDisponibles: MaestroUnidadBus[];
  ocupacionMinimaObjetivo?: number; // % e.g. 80%
}

export function getWeekNumber(dateStr: string): number {
  if (!dateStr) return 40;
  const d = new Date(dateStr + 'T00:00:00');
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function formatDateDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Catálogo base de vehículos y conductores referenciales del histórico de CAMPOSOL
export const FLOTA_REFERENCIAL: Array<{
  proveedor: string;
  movil: string;
  placa: string;
  dni: string;
  conductor: string;
  sayta: string;
}> = [
  { proveedor: 'Mobil', movil: 'Bus', placa: 'B8C-740', dni: '45799802', conductor: 'ARENAS VASQUEZ FRANCISCO', sayta: '2579' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B8C-740', dni: '42809811', conductor: 'RUIZ NARVAEZ JOEL JOSUE', sayta: '2579' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B7C-043', dni: '18165994', conductor: 'PAREDES ASCATE FRANCISCO EUSEBIO', sayta: '2581' },
  { proveedor: 'Ecobus-Honper', movil: 'Mini Bus', placa: 'T6G-957', dni: '18083104', conductor: 'GUTIERREZ MENDOCILLA JORGE LUIS', sayta: '1177' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B6P-535', dni: '18159186', conductor: 'ACEVEDO VICTORIO GILBERTO FLORENCIO', sayta: '2189' },
  { proveedor: 'Puerto Rico', movil: 'Combi', placa: 'CKD-579', dni: '41483807', conductor: 'BARRETO REYES GREGORIO', sayta: '1177' },
  { proveedor: 'Nazario', movil: 'Mini Bus', placa: 'T9Z-969', dni: '73251924', conductor: 'ALVARADO VERDE BRAYAN WILFREDO', sayta: '2557' },
  { proveedor: 'Sol Radiante', movil: 'Combi', placa: 'F6I-966', dni: '62824486', conductor: 'VASQUEZ REYES BRAYAN', sayta: '2028' },
  { proveedor: 'Ecobus-Leon del Norte', movil: 'Mini Bus', placa: 'D4P-951', dni: '43183010', conductor: 'GONZALES VALVERDE WILMER', sayta: '1177' },
  { proveedor: 'Ecobus', movil: 'Mini Bus', placa: 'CD5-516', dni: '41608956', conductor: 'GUERRA CACHIQUE WINDER', sayta: '1177' },
  { proveedor: 'Ecobus', movil: 'Mini Bus', placa: 'C6D-918', dni: '10204558', conductor: 'DE LA GALARZA JUAN GASPAR', sayta: '1177' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B88-830', dni: '47070683', conductor: 'CALDERON NEYRA JULIAN RICARDO', sayta: '1964' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B72-411', dni: '46334575', conductor: 'BENITES LUJAN ROBERTO MARIANO', sayta: '1431' },
  { proveedor: 'Ecobus', movil: 'Mini Bus', placa: 'T4H-953', dni: '43428730', conductor: 'JUAN DIEGO DESPOSORIO CASTILLO', sayta: '2174' },
  { proveedor: 'Jhonatan', movil: 'Combi', placa: 'CWM-671', dni: '43673393', conductor: 'ALTAMIRANO MOISES', sayta: '1169' },
  { proveedor: 'García', movil: 'Combi', placa: 'T9L-962', dni: '48058121', conductor: 'CESPEDES CAJO JAVIER YOBANY', sayta: '1173' },
  { proveedor: 'Puerto Rico', movil: 'Mini Van', placa: 'AVD-761', dni: '18057035', conductor: 'RONDON CASTILLO WILDER JULIO', sayta: '2563' },
  { proveedor: 'Saraith', movil: 'Combi', placa: 'T5X-493', dni: '80501851', conductor: 'POLO VASQUEZ CRISTO REYES', sayta: '1963' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B6M-464', dni: '43527431', conductor: 'CONTRERAS NAVARRO MIGUEL HUMBERTO', sayta: '1957' },
  { proveedor: 'Jhonatan', movil: 'Combi', placa: 'T8H-015', dni: '80379215', conductor: 'ARANDA SALINAS', sayta: '1050' },
  { proveedor: 'Mobil', movil: 'Bus', placa: 'B7K-364', dni: '43087321', conductor: 'FLORES BUSTAMANTE ABEL ILARIO', sayta: '1950' },
  { proveedor: 'Mobil', movil: 'Bus', placa: 'B88-891', dni: '43864545', conductor: 'DORIA ESPIRITU HENRY BRIAN', sayta: '1953' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'CDX-627', dni: '00240530', conductor: 'YANGUA FARFAN ELMER', sayta: '1967' },
  { proveedor: 'Carrion', movil: 'Bus', placa: 'D8N-967', dni: '42994746', conductor: 'SEGUNDO GONZALES GUEVARA', sayta: '1180' },
  { proveedor: 'Puerto Rico', movil: 'Mini Bus', placa: 'T2J-498', dni: '41432128', conductor: 'CACERES SOTO ALBERTO EDGAR', sayta: '2543' },
  { proveedor: 'Ecobus-Tubrisa', movil: 'Mini Bus', placa: 'T7F-956', dni: '19083880', conductor: 'LEONARDO RODRIGUEZ SANTOS WILDO', sayta: '1953' },
  { proveedor: 'Mobil', movil: 'Mini Bus', placa: 'AVD-760', dni: '18006040', conductor: 'GUTIERREZ MAURICIO BERNARDO GREGORIO', sayta: '2543' },
  { proveedor: 'Carrion', movil: 'Bus', placa: 'B8C-741', dni: '45028420', conductor: 'ZAVALETA RUIZ WILMER OMER', sayta: '2180' },
  { proveedor: 'Puerto Rico', movil: 'Mini Bus', placa: 'V2X-119', dni: '17833097', conductor: 'CASTILLO GONZALES JULIO CESAR', sayta: '1180' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B88-885', dni: '17962243', conductor: 'POLO HARO JAVIER', sayta: '2545' },
  { proveedor: 'Ecobus-BS', movil: 'Bus', placa: 'T5Y-140', dni: '18018191', conductor: 'DIAZ PULIDO JUAN ANTONIO', sayta: '2189' },
  { proveedor: 'Puerto Rico', movil: 'Mini Bus', placa: 'B7K-279', dni: '18195374', conductor: 'MARIN TAMBO JOSE ANIBAL', sayta: '2031' },
  { proveedor: 'Ecobus-Jehova', movil: 'Bus', placa: 'C6J-957', dni: '18180875', conductor: 'RISCO URTECHO FELIPE', sayta: '1964' },
  { proveedor: 'Ecobus-Tubrisa', movil: 'Bus', placa: 'B4H-968', dni: '18188148', conductor: 'ULFEA MORILLO FRANCISCO', sayta: '2561' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B7D-005', dni: '41448324', conductor: 'TERRONES SANCHEZ GENARO', sayta: '2561' },
  { proveedor: 'Ecobus', movil: 'Mini Bus', placa: 'M1R-956', dni: '43486852', conductor: 'MATENCIO GUTIERREZ EDER DAVID', sayta: '1173' },
  { proveedor: 'Puerto Rico', movil: 'Mini Van', placa: 'F7H-950', dni: '75611639', conductor: 'HERMAN RONCAL', sayta: '1755' },
  { proveedor: 'García', movil: 'Mini Van', placa: 'T5K-456', dni: '45651878', conductor: 'TACANGA SIGUENZA HITLER FRANKLIN', sayta: '1745' },
  { proveedor: 'García', movil: 'Mini Van', placa: 'CHL-470', dni: '46264501', conductor: 'ULLOA GONZALES LUIS ARMANDO', sayta: '1756' },
  { proveedor: 'García', movil: 'Combi', placa: 'BEN-321', dni: '18208582', conductor: 'ZAVALETA MOZO JOSE PABLO', sayta: '1750' },
  { proveedor: 'Puerto Rico', movil: 'Mini Van', placa: 'T7V-136', dni: '47999782', conductor: 'SANCHEZ ABANTO EDGAR MICHEL', sayta: '2035' },
  { proveedor: 'Saraith', movil: 'Combi', placa: 'CCT-551', dni: '72780581', conductor: 'ARAUJO LAIZA ROSMEL ROLIN', sayta: '1672' },
  { proveedor: 'Saraith', movil: 'Combi', placa: 'T2U-714', dni: '19572932', conductor: 'RIOS CALDERON JUSTO SEGUNDO', sayta: '1754' },
  { proveedor: 'Ecobus-BS', movil: 'Bus 2 Pisos', placa: 'B7Y-573', dni: '43679466', conductor: 'RAYMUNDO VILLANUEVA DEYVI', sayta: '1170' },
  { proveedor: 'Ecobus-BS', movil: 'Bus', placa: 'B6P-537', dni: '40835910', conductor: 'NAZARIO ABANTO SERGIO ANTONIO', sayta: '2558' },
  { proveedor: 'Ecobus-BS', movil: 'Bus', placa: 'B8C-948', dni: '42531865', conductor: 'QUISPE ROJAS WIL HUBERT', sayta: '1950' },
  { proveedor: 'Ecobus-BS', movil: 'Bus', placa: 'AW8-846', dni: '46614021', conductor: 'ROBLES RUIZ CESAR', sayta: '1964' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B6M-426', dni: '19074751', conductor: 'SALVADOR GUEVARA GUILLERMO', sayta: '1957' },
  { proveedor: 'Ecobus', movil: 'Bus', placa: 'B8C-932', dni: '43454180', conductor: 'CHAVEZ CORNELIO VICENTE GLORIANO', sayta: '1957' },
];

export function inferParaderoInicial(zona: ZonaParadero | string, paraderos: string[]): string {
  if (zona === 'SUR') {
    if (paraderos.some((p) => p.includes('VALLE DE DIOS'))) return 'VALLE DE DIOS';
    if (paraderos.some((p) => p.includes('SAN JOSE') || p.includes('PLAZUELA'))) return 'SAN JOSE';
    if (paraderos.some((p) => p.includes('BUENAVISTA'))) return 'BUENAVISTA';
    return 'CHAO';
  }
  if (paraderos.some((p) => p.includes('HUACAPONGO'))) return 'HUACAPONGO';
  if (paraderos.some((p) => p.includes('SANTA ELENA'))) return 'SANTA ELENA';
  if (paraderos.some((p) => p.includes('PUENTE'))) return 'PUENTE';
  return 'V. RAUL, VIRU';
}

// Algoritmo para encontrar la combinación óptima de buses para N pasajeros
export function seleccionarMejoresUnidades(
  totalPasajeros: number,
  unidadesDisponibles: MaestroUnidadBus[]
): MaestroUnidadBus[] {
  const activas = unidadesDisponibles
    .filter((u) => u.activo && u.capacidad > 0)
    .sort((a, b) => b.capacidad - a.capacidad);

  if (activas.length === 0 || totalPasajeros <= 0) return [];

  let remanente = totalPasajeros;
  const seleccionadas: MaestroUnidadBus[] = [];

  while (remanente > 0) {
    const unidadesQueAlcanzan = activas.filter((u) => u.capacidad >= remanente);
    if (unidadesQueAlcanzan.length > 0) {
      const mejorAjuste = unidadesQueAlcanzan[unidadesQueAlcanzan.length - 1];
      seleccionadas.push(mejorAjuste);
      remanente = 0;
      break;
    }

    const unidadMayor = activas[0];
    seleccionadas.push(unidadMayor);
    remanente -= unidadMayor.capacidad;
  }

  return seleccionadas;
}

// Función principal de optimización y programación de viajes
export function optimizarViajes(
  requerimientos: Requerimiento[],
  detalles: DetalleRequerimiento[],
  params: ParametrosOptimizacion
): ProgramacionViajesDia {
  const {
    fecha,
    movimiento = 'TODOS',
    turno = 'TODOS',
    permitirJuntarFundos = true,
    unidadesDisponibles,
  } = params;

  // 1. Filtrar requerimientos elegibles de la fecha
  const reqsFiltrados = requerimientos.filter((r) => {
    if (r.estado === 'ANULADO' || r.estado === 'RECHAZADO') return false;
    if (fecha !== 'TODOS' && r.fecha !== fecha) return false;
    if (movimiento !== 'TODOS' && r.movimiento !== movimiento) return false;
    if (turno !== 'TODOS' && r.horaRecojo !== turno && r.horaSalida !== turno) return false;
    if (params.fundosSeleccionados && params.fundosSeleccionados.length > 0) {
      if (!params.fundosSeleccionados.includes(r.fundo)) return false;
    }
    return true;
  });

  const reqIds = new Set(reqsFiltrados.map((r) => r.id));
  const detallesFiltrados = detalles.filter((d) => reqIds.has(d.requerimientoId) && d.cantidad > 0);

  // 2. Agrupar la demanda por [Fecha] -> [Turno/Horario] -> [Zona] -> [Fundo o Consolidado] -> [Área]
  type KeyGroup = string;
  const gruposDemanda: Record<
    KeyGroup,
    {
      fecha: string;
      turno: string;
      movimiento: MovimientoType;
      zona: ZonaParadero;
      fundoKey: string;
      fundoNombre: string;
      areaPrincipal: string;
      fundosMap: Record<string, number>;
      comedoresList: Set<string>;
      encargadosList: Set<string>;
      paraderosMap: Record<string, { cantidad: number; reqIds: Set<string> }>;
      reqIds: Set<string>;
      totalPasajeros: number;
    }
  > = {};

  reqsFiltrados.forEach((req) => {
    const turnoReq = req.horaRecojo || req.horaSalida || '13:00';
    const movReq = req.movimiento || 'INGRESO';
    const reqDets = detallesFiltrados.filter((d) => d.requerimientoId === req.id);

    // Comedores o códigos de origen del requerimiento
    const comedores = Array.from(new Set(reqDets.map((d) => d.comedor).filter(Boolean)));
    if (comedores.length === 0 && req.parcelas && req.parcelas.length > 0) {
      req.parcelas.forEach((p) => comedores.push(p));
    }
    const solicitante = req.usuario || req.userUsername || req.area.split(' ')[0] || 'SUPERVISOR';

    if (reqDets.length === 0) {
      const zonaFundo: ZonaParadero = req.fundo.includes('CHAO') ? 'SUR' : 'NORTE';
      const fundoGroupKey = permitirJuntarFundos ? 'CONSOLIDADO_COMPATIBLE' : req.fundo;
      const groupKey = `${req.fecha}__${turnoReq}__${movReq}__${zonaFundo}__${fundoGroupKey}__${req.area}`;

      if (!gruposDemanda[groupKey]) {
        gruposDemanda[groupKey] = {
          fecha: req.fecha,
          turno: turnoReq,
          movimiento: movReq,
          zona: zonaFundo,
          fundoKey: fundoGroupKey,
          fundoNombre: req.fundo,
          areaPrincipal: req.area,
          fundosMap: {},
          comedoresList: new Set(),
          encargadosList: new Set(),
          paraderosMap: {},
          reqIds: new Set(),
          totalPasajeros: 0,
        };
      }
      const g = gruposDemanda[groupKey];
      g.reqIds.add(req.id);
      g.fundosMap[req.fundo] = (g.fundosMap[req.fundo] || 0) + req.totalPersonas;
      g.totalPasajeros += req.totalPersonas;
      comedores.forEach((c) => g.comedoresList.add(c));
      g.encargadosList.add(solicitante);

      const defParadero = zonaFundo === 'SUR' ? 'SEGUNDO PARADERO' : 'LA BRASIL';
      if (!g.paraderosMap[defParadero]) {
        g.paraderosMap[defParadero] = { cantidad: 0, reqIds: new Set() };
      }
      g.paraderosMap[defParadero].cantidad += req.totalPersonas;
      g.paraderosMap[defParadero].reqIds.add(req.numeroRequerimiento);
      return;
    }

    reqDets.forEach((det) => {
      const zona: ZonaParadero = det.zona || inferParaderoZona(det.paradero);
      const fundoGroupKey = permitirJuntarFundos ? 'CONSOLIDADO_COMPATIBLE' : req.fundo;
      const groupKey = `${req.fecha}__${turnoReq}__${movReq}__${zona}__${fundoGroupKey}__${req.area}`;

      if (!gruposDemanda[groupKey]) {
        gruposDemanda[groupKey] = {
          fecha: req.fecha,
          turno: turnoReq,
          movimiento: movReq,
          zona,
          fundoKey: fundoGroupKey,
          fundoNombre: req.fundo,
          areaPrincipal: req.area,
          fundosMap: {},
          comedoresList: new Set(),
          encargadosList: new Set(),
          paraderosMap: {},
          reqIds: new Set(),
          totalPasajeros: 0,
        };
      }

      const g = gruposDemanda[groupKey];
      g.reqIds.add(req.id);
      g.fundosMap[req.fundo] = (g.fundosMap[req.fundo] || 0) + det.cantidad;
      g.totalPasajeros += det.cantidad;
      comedores.forEach((c) => g.comedoresList.add(c));
      g.encargadosList.add(solicitante);

      if (!g.paraderosMap[det.paradero]) {
        g.paraderosMap[det.paradero] = { cantidad: 0, reqIds: new Set() };
      }
      g.paraderosMap[det.paradero].cantidad += det.cantidad;
      g.paraderosMap[det.paradero].reqIds.add(req.numeroRequerimiento);
    });
  });

  // 3. Generar la programación de viajes tal cual la hoja oficial de CAMPOSOL
  const viajesGenerados: ViajeProgramado[] = [];
  const semana = getWeekNumber(fecha);
  let correlativo = 1;

  Object.values(gruposDemanda).forEach((grupo) => {
    if (grupo.totalPasajeros <= 0) return;

    // Ordenar paraderos según el recorrido canónico oficial
    const paradasOrdenadas: ParadaViaje[] = Object.entries(grupo.paraderosMap)
      .map(([paradero, data]) => ({
        paradero,
        zona: grupo.zona,
        cantidadPasajeros: data.cantidad,
        orden: getParaderoOrderIndex(paradero),
        requerimientosCodigos: Array.from(data.reqIds),
      }))
      .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

    const paraderosNombres = paradasOrdenadas.map((p) => p.paradero);
    const paraderoInicial = inferParaderoInicial(grupo.zona, paraderosNombres);
    const destinoTexto = paraderosNombres.join(', ') || (grupo.zona === 'SUR' ? 'RUTA CHAO' : 'RUTA VIRÚ');

    // Seleccionar flota óptima para este grupo
    const unidadesAsignadas = seleccionarMejoresUnidades(
      grupo.totalPasajeros,
      unidadesDisponibles
    );

    if (unidadesAsignadas.length === 0) return;

    const hourNum = parseInt(grupo.turno.split(':')[0] || '13', 10);
    const turnoText = hourNum >= 12 ? 'TARDE' : 'MAÑANA';
    const tipoCode: 'SAL' | 'ING' = grupo.movimiento === 'INGRESO' ? 'ING' : 'SAL';
    const origenTexto = Array.from(grupo.comedoresList).join(', ') || 'CAMPO';
    const encargadoTexto = Array.from(grupo.encargadosList).join(' / ') || 'SUPERVISOR';
    const fundosDestino: FundoDestinoViaje[] = Object.entries(grupo.fundosMap).map(
      ([fundo, cantidad]) => ({ fundo, cantidadPasajeros: cantidad })
    );

    let remanentePasajerosGrupo = grupo.totalPasajeros;
    unidadesAsignadas.forEach((unidad) => {
      if (remanentePasajerosGrupo <= 0) return;
      const refFlota = FLOTA_REFERENCIAL[(correlativo - 1) % FLOTA_REFERENCIAL.length];
      const prefijoZona = grupo.zona === 'SUR' ? 'SUR' : 'NOR';
      const codigoViaje = `VJ-${prefijoZona}-${String(correlativo).padStart(3, '0')}`;
      const planPasajeros = Math.min(unidad.capacidad, remanentePasajerosGrupo);
      remanentePasajerosGrupo = Math.max(0, remanentePasajerosGrupo - planPasajeros);
      const ocupacion = unidad.capacidad > 0 ? Math.round((planPasajeros / unidad.capacidad) * 100) : 0;
      const viajeFecha = grupo.fecha || (fecha !== 'TODOS' ? fecha : new Date().toISOString().slice(0, 10));
      const viajeSemana = getWeekNumber(viajeFecha);

      const nuevoViaje: ViajeProgramado = {
        id: `vjg-${Date.now()}-${correlativo}`,
        codigoViaje,
        fecha: viajeFecha,
        semana: viajeSemana,
        servicioNumero: correlativo,
        fyp: 'CAMPO',
        fundo: Object.keys(grupo.fundosMap).join(' / ') || grupo.fundoNombre,
        proveedor: refFlota.proveedor,
        movil: unidad.nombre,
        placa: refFlota.placa,
        dni: refFlota.dni,
        conductor: refFlota.conductor,
        tipo: tipoCode,
        hora: grupo.turno,
        area: grupo.areaPrincipal,
        origen: origenTexto,
        destino: destinoTexto,
        plan: planPasajeros,
        sayta: refFlota.sayta,
        paraderoInicial,
        porcentajeOcupacion: Math.min(100, ocupacion),
        horaSayta: grupo.turno,
        obsSayta: `${correlativo}-${grupo.areaPrincipal}`,
        capSayta: unidad.capacidad,
        encargado: encargadoTexto,
        supervisor: 'JSANCHEZ',
        turnoText,
        turno: grupo.turno,
        movimiento: grupo.movimiento,
        zona: grupo.zona,
        unidad,
        totalPasajeros: planPasajeros,
        capacidadUnidad: unidad.capacidad,
        asientosDisponibles: Math.max(0, unidad.capacidad - planPasajeros),
        fundos: fundosDestino,
        recorridoParaderos: paradasOrdenadas,
        requerimientosIds: Array.from(grupo.reqIds),
        estado: 'PROGRAMADO',
        chofer: refFlota.conductor,
        observaciones: '',
      };

      viajesGenerados.push(nuevoViaje);
      correlativo++;
    });
  });

  // Métricas globales
  const totalPasajeros = viajesGenerados.reduce((sum, v) => sum + (v.plan || v.totalPasajeros), 0);
  const totalCapacidad = viajesGenerados.reduce((sum, v) => sum + v.capacidadUnidad, 0);
  const eficienciaGlobal =
    totalCapacidad > 0 ? Math.round((totalPasajeros / totalCapacidad) * 1000) / 10 : 0;

  const resumenUnidades: Record<string, number> = {};
  viajesGenerados.forEach((v) => {
    const nombre = v.unidad.nombre;
    resumenUnidades[nombre] = (resumenUnidades[nombre] || 0) + 1;
  });

  return {
    id: `prog-${fecha}-${Date.now()}`,
    fecha,
    movimiento,
    turno,
    fechaGeneracion: new Date().toISOString(),
    viajes: viajesGenerados,
    totalPasajeros,
    totalCapacidad,
    eficienciaGlobal,
    resumenUnidades,
  };
}

// Exportador a Excel exactamente con las 26 columnas de la imagen de CAMPOSOL
export function exportarPlanViajesExcel(programacion: ProgramacionViajesDia): void {
  const workbook = XLSX.utils.book_new();

  // Mapeo 1:1 con la plantilla de la imagen del usuario
  const rows = programacion.viajes.map((v) => ({
    'SEMANA': v.semana || getWeekNumber(v.fecha),
    'FECHA': formatDateDDMMYYYY(v.fecha),
    'N° Servicio': v.servicioNumero || 1,
    'FYP': v.fyp || 'CAMPO',
    'FUNDO': v.fundo,
    'PROVEEDOR': v.proveedor || 'Por asignar',
    'MOVIL': v.movil || v.unidad.nombre,
    'PLACA': v.placa || 'Por asignar',
    'DNI': v.dni || '-',
    'CONDUCTOR': v.conductor || v.chofer || 'Por asignar',
    'TIPO': v.tipo || (v.movimiento === 'INGRESO' ? 'ING' : 'SAL'),
    'Hora': v.hora || v.turno,
    'ÁREA': v.area || 'PRODUCCIÓN',
    'ORIGEN': v.origen || 'CAMPO',
    'DESTINO': v.destino || v.recorridoParaderos.map((p) => p.paradero).join(', '),
    'PLAN': v.plan || v.totalPasajeros,
    'Sayta': v.sayta || '-',
    'PARADERO INICIAL': v.paraderoInicial || '-',
    '% Ocupabilidad': `${v.porcentajeOcupacion}%`,
    'Hora (Sayta)': v.horaSayta || v.hora || v.turno,
    'Obs. (Sayta)': v.obsSayta || `${v.servicioNumero || 1}-${v.area}`,
    'Cap. (Sayta)': v.capSayta || v.capacidadUnidad,
    'ENCARGADO': v.encargado || '-',
    'SUPERVISOR': v.supervisor || '-',
    'OBSERVACIONES': v.observaciones || '',
    'TURNO': v.turnoText || 'TARDE',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Ancho óptimo para cada una de las 26 columnas
  worksheet['!cols'] = [
    { wch: 9 },  // SEMANA
    { wch: 12 }, // FECHA
    { wch: 11 }, // N° Servicio
    { wch: 8 },  // FYP
    { wch: 16 }, // FUNDO
    { wch: 18 }, // PROVEEDOR
    { wch: 12 }, // MOVIL
    { wch: 11 }, // PLACA
    { wch: 11 }, // DNI
    { wch: 32 }, // CONDUCTOR
    { wch: 8 },  // TIPO
    { wch: 8 },  // Hora
    { wch: 18 }, // ÁREA
    { wch: 22 }, // ORIGEN
    { wch: 60 }, // DESTINO
    { wch: 8 },  // PLAN
    { wch: 8 },  // Sayta
    { wch: 18 }, // PARADERO INICIAL
    { wch: 14 }, // % Ocupabilidad
    { wch: 12 }, // Hora (Sayta)
    { wch: 22 }, // Obs. (Sayta)
    { wch: 12 }, // Cap. (Sayta)
    { wch: 20 }, // ENCARGADO
    { wch: 14 }, // SUPERVISOR
    { wch: 16 }, // OBSERVACIONES
    { wch: 10 }, // TURNO
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'PROGRAMA_DE_VIAJES');

  XLSX.writeFile(
    workbook,
    `CAMPOSOL_Programa_Viajes_${programacion.fecha.replace(/-/g, '')}.xlsx`
  );
}
