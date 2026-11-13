import {
  MaestroArea,
  MaestroFundo,
  MaestroParadero,
  MaestroComedor,
  MaestroUnidadBus,
  Requerimiento,
  DetalleRequerimiento,
} from '../types';

export const MAESTRO_AREAS: MaestroArea[] = [
  { id: 'AREA-01', area: 'PRODUCCIÓN' },
  { id: 'AREA-02', area: 'COSECHA' },
  { id: 'AREA-03', area: 'EMPAQUE' },
  { id: 'AREA-04', area: 'SANIDAD VEGETAL' },
  { id: 'AREA-05', area: 'RIEGO Y FERTIRRIEGO' },
  { id: 'AREA-06', area: 'MANTENIMIENTO' },
  { id: 'AREA-07', area: 'RECURSOS HUMANOS' },
  { id: 'AREA-08', area: 'ASEGURAMIENTO DE CALIDAD' },
  { id: 'AREA-09', area: 'OPERACIONES AGRÍCOLAS' },
  { id: 'AREA-10', area: 'LOGÍSTICA' },
];

export const MAESTRO_FUNDOS: MaestroFundo[] = [
  { id: 'FUN-01', fundo: 'AGRICULTOR 1' },
  { id: 'FUN-02', fundo: 'AGRICULTOR 2' },
  { id: 'FUN-03', fundo: 'ARENAL' },
  { id: 'FUN-04', fundo: 'MAR VERDE' },
  { id: 'FUN-05', fundo: 'CHAO 1' },
  { id: 'FUN-06', fundo: 'CHAO 2' },
  { id: 'FUN-07', fundo: 'VIRÚ 1' },
  { id: 'FUN-08', fundo: 'YAKU' },
  { id: 'FUN-09', fundo: 'COMPAC' },
  { id: 'FUN-10', fundo: 'AGROINCA' },
  { id: 'FUN-11', fundo: 'SAN VICENTE' },
];

export const MAESTRO_CULTIVOS: string[] = [
  'ARÁNDANO',
  'PALTO',
  'ESPÁRRAGO',
  'MANDARINA',
  'MANGO',
  'UVAS',
];

export const MAESTRO_PARCELAS: string[] = [
  '57',
  '63',
  '65',
  'Garita 1',
];

export const MAESTRO_MOVIMIENTOS: string[] = [
  'Programa personal por tarea',
  'INGRESO',
  'SALIDA',
];

// Maestro Oficial de Flota y Unidades de Transporte
export const MAESTRO_UNIDADES_BUS: MaestroUnidadBus[] = [
  { id: 'BUS-01', nombre: '2 PISOS', capacidad: 60, descripcion: 'Bus interprovincial 2 pisos - Alta capacidad (60 pax)', activo: true },
  { id: 'BUS-02', nombre: 'BUS LARGE', capacidad: 55, descripcion: 'Bus interprovincial largo (55 pax)', activo: true },
  { id: 'BUS-03', nombre: 'BUS', capacidad: 49, descripcion: 'Bus estándar de transporte de personal (49 pax)', activo: true },
  { id: 'BUS-04', nombre: 'MINIBUS', capacidad: 30, descripcion: 'Minibús de ruta intermedia (30 pax)', activo: true },
  { id: 'BUS-05', nombre: 'COMBI', capacidad: 15, descripcion: 'Combi de traslado rápido (15 pax)', activo: true },
  { id: 'BUS-06', nombre: 'MINI VAN', capacidad: 10, descripcion: 'Van ligera de supervisión y traslado (10 pax)', activo: true },
];

// Orden Canónico Oficial de Rutas de Paraderos (Virú y Chao)
export const CANONICAL_PARADEROS_ORDER: string[] = [
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
  'VIVIENDAS MAR VERDE',
  'GRIFO GRAN CHIMU',
  'LA 28',
  'LA BOTICA',
  'SEGUNDO PARADERO',
];

export function normalizeParaderoKey(name: string): string {
  const norm = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (norm.includes('BRASIL') || norm.includes('VICTOR RAUL')) return 'LA BRASIL';
  if (norm === 'VALDEMAR') return 'VALDEMAR';
  if (norm.includes('LLANTA')) return 'LA LLANTA';
  if (norm.includes('VILLA VIRU') || norm === 'VILLA VIRÚ') return 'VILLA VIRU';
  if (norm.includes('TECHO PROPIO') || norm === 'T. PROPIO' || norm === 'T PROPIO') return 'TECHO PROPIO';
  if (norm.includes('PETROAMERICA') || norm.includes('PETRO AMERICA') || norm.includes('PETROAMÉRICA')) return 'PETROAMERICA';
  if (norm.includes('CHANQUIN') || norm.includes('CHANQUÍN')) return 'PUENTE CHANQUIN';
  if (norm === 'CALIFORNIA') return 'CALIFORNIA';
  if (norm.includes('CAÑAN') || norm.includes('CANAN')) return 'EL CAÑAN';
  if (norm.includes('PRIMERA DE MAYO') || norm.includes('1 DE MAYO')) return 'PRIMERA DE MAYO';
  if (norm.includes('REFUGIO')) return 'EL REFUGIO';
  if (norm.includes('PORTADA')) return 'LA PORTADA';
  if (norm.includes('CALLE LIMA') || norm.includes('LIMA-VIRU') || norm.includes('LIMA - VIRU')) return 'CALLE LIMA-VIRU';
  if (norm.includes('PINOS')) return 'GRIFO LOS PINOS';
  if (norm.includes('SAN LUIS')) return 'SAN LUIS';
  if (norm.includes('MENDOCILLA')) return 'MENDOCILLA';
  if (norm === 'LA 21' || norm === '21') return 'LA 21';
  if (norm.includes('PLAZUELA') || norm.includes('SAN JOSE') || norm.includes('S. JOSE')) return 'LA PLAZUELA SAN JOSE';
  if (norm.includes('SANTA CECILIA') || norm.includes('STA CECILIA') || norm.includes('STA. CECILIA')) return 'SANTA CECILIA';
  if (norm.includes('VIVIENDAS') || norm.includes('MAR VERDE') || norm.includes('VIVIENDAS MV') || norm === 'MV') return 'VIVIENDAS MAR VERDE';
  if (norm.includes('GRAN CHIMU') || norm.includes('GRIFO CHIMU') || norm.includes('CHIMÚ')) return 'GRIFO GRAN CHIMU';
  if (norm.includes('28') || norm.includes('REST. 28')) return 'LA 28';
  if (norm.includes('BOTICA')) return 'LA BOTICA';
  if (norm.includes('SEGUNDO PARADERO') || norm.includes('2DO PARADERO') || norm.includes('2° PARADERO')) return 'SEGUNDO PARADERO';

  return norm;
}

export function getParaderoOrderIndex(name: string): number {
  const norm = normalizeParaderoKey(name);
  const idx = CANONICAL_PARADEROS_ORDER.indexOf(norm);
  return idx !== -1 ? idx : 999;
}

export const MAESTRO_PARADEROS: MaestroParadero[] = [
  // RUTA VIRÚ (ZONA NORTE) - Orden Oficial Operativo (1 a 19)
  { id: 'PAR-01', paradero: 'LA BRASIL', zona: 'NORTE' },
  { id: 'PAR-02', paradero: 'VALDEMAR', zona: 'NORTE' },
  { id: 'PAR-03', paradero: 'LA LLANTA', zona: 'NORTE' },
  { id: 'PAR-04', paradero: 'VILLA VIRU', zona: 'NORTE' },
  { id: 'PAR-05', paradero: 'TECHO PROPIO', zona: 'NORTE' },
  { id: 'PAR-06', paradero: 'PETROAMERICA', zona: 'NORTE' },
  { id: 'PAR-07', paradero: 'PUENTE CHANQUIN', zona: 'NORTE' },
  { id: 'PAR-08', paradero: 'CALIFORNIA', zona: 'NORTE' },
  { id: 'PAR-09', paradero: 'EL CAÑAN', zona: 'NORTE' },
  { id: 'PAR-10', paradero: 'PRIMERA DE MAYO', zona: 'NORTE' },
  { id: 'PAR-11', paradero: 'EL REFUGIO', zona: 'NORTE' },
  { id: 'PAR-12', paradero: 'LA PORTADA', zona: 'NORTE' },
  { id: 'PAR-13', paradero: 'CALLE LIMA-VIRU', zona: 'NORTE' },
  { id: 'PAR-14', paradero: 'GRIFO LOS PINOS', zona: 'NORTE' },
  { id: 'PAR-15', paradero: 'SAN LUIS', zona: 'NORTE' },
  { id: 'PAR-16', paradero: 'MENDOCILLA', zona: 'NORTE' },
  { id: 'PAR-17', paradero: 'LA 21', zona: 'NORTE' },
  { id: 'PAR-18', paradero: 'LA PLAZUELA SAN JOSE', zona: 'NORTE' },
  { id: 'PAR-19', paradero: 'SANTA CECILIA', zona: 'NORTE' },

  // RUTA CHAO (ZONA SUR) - Orden Oficial Operativo (20 a 24)
  { id: 'PAR-20', paradero: 'VIVIENDAS MAR VERDE', zona: 'SUR' },
  { id: 'PAR-21', paradero: 'GRIFO GRAN CHIMU', zona: 'SUR' },
  { id: 'PAR-22', paradero: 'LA 28', zona: 'SUR' },
  { id: 'PAR-23', paradero: 'LA BOTICA', zona: 'SUR' },
  { id: 'PAR-24', paradero: 'SEGUNDO PARADERO', zona: 'SUR' },
];

export const MAESTRO_COMEDORES: MaestroComedor[] = [
  { id: 'COM-57', comedor: '57' },
  { id: 'COM-63', comedor: '63' },
  { id: 'COM-65', comedor: '65' },
  { id: 'COM-G1', comedor: 'Garita 1' },
  { id: 'COM-564', comedor: '564' },
  { id: 'COM-524', comedor: '524' },
  { id: 'COM-562', comedor: '562' },
  { id: 'COM-520', comedor: '520' },
];

// Producción: iniciar sin requerimientos ni detalles ficticios precargados (100% datos reales desde Firestore / BD)
export const INITIAL_REQUERIMIENTOS: Requerimiento[] = [];

export const INITIAL_DETALLES: DetalleRequerimiento[] = [];


/**
 * Extrae y formatea 16:00 o Turno 13:00)
 */
export function getHorarioDisplay(req: {
  movimiento?: string;
  horaRecojo?: string;
  horaSalida?: string;
  horaRecojoNorte?: string;
  horaRecojoSur?: string;
}): {
  isIngreso: boolean;
  isSalida: boolean;
  horaNorte: string;
  horaSur: string;
  horaNormal: string;
  textoHorario: string;
  textoTurnoHeader: string;
} {
  const movUpper = (req.movimiento || '').toUpperCase().trim();
  const isIngreso = movUpper === 'INGRESO';
  const isSalida = movUpper === 'SALIDA';

  let horaNorte = req.horaRecojoNorte || '';
  let horaSur = req.horaRecojoSur || '';

  if (isIngreso) {
    if (!horaNorte || !horaSur) {
      if (req.horaRecojo) {
        const matchN = req.horaRecojo.match(/(\d{1,2}:\d{2})\s*(?:\(N\)|Norte)/i);
        const matchS = req.horaRecojo.match(/(\d{1,2}:\d{2})\s*(?:\(S\)|Sur)/i);
        if (matchN) horaNorte = matchN[1];
        if (matchS) horaSur = matchS[1];

        if ((!horaNorte || !horaSur) && req.horaRecojo.includes('/')) {
          const parts = req.horaRecojo.split('/');
          if (parts.length >= 2) {
            const p0 = parts[0].match(/\b(\d{1,2}:\d{2})\b/);
            const p1 = parts[1].match(/\b(\d{1,2}:\d{2})\b/);
            if (p0) horaNorte = p0[1];
            if (p1) horaSur = p1[1];
          }
        }
      }

      // Si aún no se encontraron y tiene horaRecojo y horaSalida diferentes
      if (
        (!horaNorte || !horaSur) &&
        req.horaRecojo &&
        req.horaSalida &&
        req.horaRecojo !== req.horaSalida &&
        !req.horaSalida.includes('(')
      ) {
        horaNorte = req.horaRecojo;
        horaSur = req.horaSalida;
      }

      // Fallback
      if (!horaNorte) horaNorte = req.horaRecojo || '05:00';
      if (!horaSur) horaSur = req.horaSalida || req.horaRecojo || '05:00';
    }

    const textoHorario = `Norte: ${horaNorte} | Sur: ${horaSur}`;
    const textoTurnoHeader = `Norte: ${horaNorte} • Sur: ${horaSur}`;
    return {
      isIngreso: true,
      isSalida: false,
      horaNorte,
      horaSur,
      horaNormal: '',
      textoHorario,
      textoTurnoHeader,
    };
  }

  // Si es SALIDA o Tarea normal:
  let horaNormal = '';
  if (isSalida) {
    horaNormal = req.horaSalida || req.horaRecojo || '13:00';
  } else {
    horaNormal = req.horaRecojo || req.horaSalida || '13:00';
  }

  const matchTime = horaNormal.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  if (matchTime) {
    horaNormal = matchTime[0];
  }

  const textoHorario = `Hora: ${horaNormal}`;
  const textoTurnoHeader = isSalida ? `Salida ${horaNormal}` : `Turno ${horaNormal}`;

  return {
    isIngreso: false,
    isSalida,
    horaNorte: '',
    horaSur: '',
    horaNormal,
    textoHorario,
    textoTurnoHeader,
  };
}
