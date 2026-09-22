import {
  MaestroArea,
  MaestroFundo,
  MaestroParadero,
  MaestroComedor,
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

// Datos de prueba iniciales
export const INITIAL_REQUERIMIENTOS: Requerimiento[] = [
  {
    id: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    fecha: '2026-09-08',
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 2',
    movimiento: 'INGRESO',
    horaRecojo: '04:30',
    horaSalida: '05:30',
    observaciones: 'Personal para jornada de cosecha temprana lote 14.',
    usuario: 'Juan Pérez',
    userId: 'usr-user-01',
    userUsername: 'jperez',
    fechaRegistro: '2026-09-07T14:30:00Z',
    totalPersonas: 75,
    estado: 'PENDIENTE',
  },
  {
    id: 'req-uuid-002',
    numeroRequerimiento: 'REQ-000002',
    fecha: '2026-09-08',
    area: 'COSECHA',
    fundo: 'ARENAL',
    movimiento: 'SALIDA',
    horaRecojo: '15:30',
    horaSalida: '16:00',
    observaciones: 'Fin de turno tarde arándanos.',
    usuario: 'Carlos Mendoza',
    userId: 'usr-user-03',
    userUsername: 'cmendoza',
    fechaRegistro: '2026-09-07T16:15:00Z',
    totalPersonas: 55,
    estado: 'APROBADO',
  },
  {
    id: 'req-uuid-003',
    numeroRequerimiento: 'REQ-000003',
    fecha: '2026-09-09',
    area: 'EMPAQUE',
    fundo: 'MAR VERDE',
    movimiento: 'INGRESO',
    horaRecojo: '05:00',
    horaSalida: '06:00',
    observaciones: 'Refuerzo línea de packing palta Hass.',
    usuario: 'María Salazar',
    userId: 'usr-user-02',
    userUsername: 'msalazar',
    fechaRegistro: '2026-09-07T18:00:00Z',
    totalPersonas: 90,
    estado: 'EN REVISIÓN',
  },
  {
    id: 'req-uuid-004',
    numeroRequerimiento: 'REQ-000004',
    fecha: '2026-09-09',
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 2',
    movimiento: 'SALIDA',
    horaRecojo: '17:00',
    horaSalida: '17:30',
    observaciones: 'Retorno turno tarde cuadrilla A.',
    usuario: 'Juan Pérez',
    userId: 'usr-user-01',
    userUsername: 'jperez',
    fechaRegistro: '2026-09-08T06:00:00Z',
    totalPersonas: 35,
    estado: 'APROBADO',
  },
];

export const INITIAL_DETALLES: DetalleRequerimiento[] = [
  // REQ-000001
  {
    id: 'det-001-01',
    requerimientoId: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    comedor: '564',
    paradero: 'CHAO',
    cantidad: 15,
  },
  {
    id: 'det-001-02',
    requerimientoId: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    comedor: '564',
    paradero: 'NUEVO CHAO',
    cantidad: 20,
  },
  {
    id: 'det-001-03',
    requerimientoId: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    comedor: '564',
    paradero: 'VIRU',
    cantidad: 10,
  },
  {
    id: 'det-001-04',
    requerimientoId: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    comedor: '524',
    paradero: 'CHAO',
    cantidad: 10,
  },
  {
    id: 'det-001-05',
    requerimientoId: 'req-uuid-001',
    numeroRequerimiento: 'REQ-000001',
    comedor: '524',
    paradero: 'VIRU',
    cantidad: 20,
  },

  // REQ-000002
  {
    id: 'det-002-01',
    requerimientoId: 'req-uuid-002',
    numeroRequerimiento: 'REQ-000002',
    comedor: '562',
    paradero: 'VALLE DE DIOS',
    cantidad: 25,
  },
  {
    id: 'det-002-02',
    requerimientoId: 'req-uuid-002',
    numeroRequerimiento: 'REQ-000002',
    comedor: '562',
    paradero: 'CALIFORNIA',
    cantidad: 15,
  },
  {
    id: 'det-002-03',
    requerimientoId: 'req-uuid-002',
    numeroRequerimiento: 'REQ-000002',
    comedor: '562',
    paradero: 'VIRU',
    cantidad: 15,
  },

  // REQ-000003
  {
    id: 'det-003-01',
    requerimientoId: 'req-uuid-003',
    numeroRequerimiento: 'REQ-000003',
    comedor: '520',
    paradero: 'NUEVO CHAO',
    cantidad: 30,
  },
  {
    id: 'det-003-02',
    requerimientoId: 'req-uuid-003',
    numeroRequerimiento: 'REQ-000003',
    comedor: '520',
    paradero: 'CHAO',
    cantidad: 30,
  },
  {
    id: 'det-003-03',
    requerimientoId: 'req-uuid-003',
    numeroRequerimiento: 'REQ-000003',
    comedor: '520',
    paradero: 'PUENTE LA PORTADA',
    cantidad: 30,
  },
];
