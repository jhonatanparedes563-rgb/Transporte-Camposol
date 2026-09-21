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

export const MAESTRO_PARADEROS: MaestroParadero[] = [
  // ZONA SUR (Chao y alrededores)
  { id: 'PAR-S01', paradero: 'Chao', zona: 'SUR' },
  { id: 'PAR-S02', paradero: 'Nuevo Chao', zona: 'SUR' },
  { id: 'PAR-S03', paradero: 'Valle de Dios', zona: 'SUR' },
  { id: 'PAR-S04', paradero: 'Rest. 28', zona: 'SUR' },
  { id: 'PAR-S05', paradero: 'Viviendas MV', zona: 'SUR' },

  // ZONA NORTE (Virú y alrededores)
  { id: 'PAR-N01', paradero: 'Guadalupito', zona: 'NORTE' },
  { id: 'PAR-N02', paradero: 'Santa Elena', zona: 'NORTE' },
  { id: 'PAR-N03', paradero: 'Victor Raúl (La Brasil)', zona: 'NORTE' },
  { id: 'PAR-N04', paradero: 'Valdemar', zona: 'NORTE' },
  { id: 'PAR-N05', paradero: 'T. Propio', zona: 'NORTE' },
  { id: 'PAR-N06', paradero: 'Villa Viru', zona: 'NORTE' },
  { id: 'PAR-N07', paradero: 'Grifo Petro América', zona: 'NORTE' },
  { id: 'PAR-N08', paradero: 'California', zona: 'NORTE' },
  { id: 'PAR-N09', paradero: 'Puente Chanquin', zona: 'NORTE' },
  { id: 'PAR-N10', paradero: 'Puente (Grifo Chimu)', zona: 'NORTE' },
  { id: 'PAR-N11', paradero: 'La Portada', zona: 'NORTE' },
  { id: 'PAR-N12', paradero: 'Los Pinos', zona: 'NORTE' },
  { id: 'PAR-N13', paradero: 'San Luis', zona: 'NORTE' },
  { id: 'PAR-N14', paradero: 'Tamboreal', zona: 'NORTE' },
  { id: 'PAR-N15', paradero: 'Moro', zona: 'NORTE' },
  { id: 'PAR-N16', paradero: 'Plazuela (S. José)', zona: 'NORTE' },
  { id: 'PAR-N17', paradero: 'Viru', zona: 'NORTE' },
  { id: 'PAR-N18', paradero: 'Vinsos', zona: 'NORTE' },
  { id: 'PAR-N19', paradero: 'Alto Trujillo', zona: 'NORTE' },
  { id: 'PAR-N20', paradero: 'Huacapongo', zona: 'NORTE' },
  { id: 'PAR-N21', paradero: 'Buenavista', zona: 'NORTE' },
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
