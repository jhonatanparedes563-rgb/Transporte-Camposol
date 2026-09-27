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

// Requerimientos y detalles reales sincronizados
export const INITIAL_REQUERIMIENTOS: Requerimiento[] = [
  {
    "userRole": "usuario",
    "estado": "ANULADO",
    "fechaRegistro": "2026-09-24T21:09:16.056Z",
    "usuario": "Esther Paredes Rodríguez",
    "totalPersonas": 17,
    "horaSalida": "22:15",
    "area": "LAB. ARANDANO",
    "observaciones": "",
    "parcelas": [],
    "movimiento": "INGRESO",
    "userUsername": "eparedes",
    "fundo": "AGRICULTOR 1",
    "numeroRequerimiento": "REQ-000005",
    "updatedAt": "2026-09-24T23:39:04.308Z",
    "horaRecojo": "22:15",
    "userId": "usr-1790015788736-kxw1",
    "id": "req-1790284156053-rrwit",
    "fecha": "2026-09-25",
    "cultivo": "ARÁNDANO"
  },
  {
    "usuario": "Esther Paredes Rodríguez",
    "parcelas": [],
    "numeroRequerimiento": "REQ-000006",
    "totalPersonas": 16,
    "userUsername": "eparedes",
    "horaRecojo": "13:00",
    "fecha": "2026-09-24",
    "userId": "usr-1790015788736-kxw1",
    "movimiento": "SALIDA",
    "fechaRegistro": "2026-09-24T21:14:07.217Z",
    "fundo": "AGRICULTOR 1",
    "updatedAt": "2026-09-24T23:33:42.324Z",
    "horaSalida": "14:00",
    "userRole": "usuario",
    "observaciones": "",
    "area": "LAB. ARANDANO",
    "cultivo": "ARÁNDANO",
    "id": "req-1790284447213-77a3r",
    "estado": "ANULADO"
  },
  {
    "userUsername": "eparedes",
    "movimiento": "INGRESO",
    "observaciones": "",
    "fecha": "2026-09-24",
    "cultivo": "ARÁNDANO",
    "horaRecojo": "05:00 (N) / 05:15 (S)",
    "userRole": "usuario",
    "fundo": "AGRICULTOR 1",
    "horaRecojoSur": "05:15",
    "area": "LAB. ARANDANO",
    "userId": "usr-1790015788736-kxw1",
    "numeroRequerimiento": "REQ-000007",
    "fechaRegistro": "2026-09-24T23:38:44.076Z",
    "historialTrazabilidad": [
      {
        "fecha": "2026-09-24T23:38:44.076Z",
        "detalle": "Requerimiento registrado para el servicio del 2026-09-24 con 39 personas.",
        "usuario": "Esther Paredes Rodríguez",
        "accion": "CREADO"
      }
    ],
    "estado": "PENDIENTE",
    "id": "req-1790293124071-1eicncy-107",
    "horaRecojoNorte": "05:00",
    "horaSalida": "05:00 (N) / 05:15 (S)",
    "usuario": "Esther Paredes Rodríguez",
    "totalPersonas": 39,
    "parcelas": []
  },
  {
    "historialTrazabilidad": [
      {
        "accion": "CREADO",
        "fecha": "2026-09-24T23:44:01.513Z",
        "detalle": "Requerimiento registrado para el servicio del 2026-09-24 con 21 personas.",
        "usuario": "Esther Paredes Rodríguez"
      }
    ],
    "userUsername": "eparedes",
    "horaSalida": "20:00",
    "userRole": "usuario",
    "fundo": "AGRICULTOR 1",
    "observaciones": "",
    "userId": "usr-1790015788736-kxw1",
    "fecha": "2026-09-24",
    "usuario": "Esther Paredes Rodríguez",
    "totalPersonas": 21,
    "estado": "PENDIENTE",
    "horaRecojo": "20:00",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000008",
    "parcelas": [],
    "id": "req-1790293441509-8jj4e3a-868",
    "movimiento": "SALIDA",
    "fechaRegistro": "2026-09-24T23:44:01.513Z",
    "area": "LAB. ARANDANO"
  },
  {
    "userId": "usr-1790015788736-kxw1",
    "numeroRequerimiento": "REQ-000009",
    "area": "LAB. ARANDANO",
    "userRole": "usuario",
    "fundo": "AGRICULTOR 1",
    "horaRecojo": "04:30 (N) / 04:45 (S)",
    "horaRecojoSur": "04:45",
    "cultivo": "ARÁNDANO",
    "fecha": "2026-09-25",
    "historialTrazabilidad": [
      {
        "accion": "CREADO",
        "fecha": "2026-09-25T20:21:53.771Z",
        "detalle": "Requerimiento registrado para el servicio del 2026-09-25 con 23 personas.",
        "usuario": "Esther Paredes Rodríguez"
      }
    ],
    "observaciones": "",
    "movimiento": "INGRESO",
    "parcelas": [],
    "usuario": "Esther Paredes Rodríguez",
    "totalPersonas": 23,
    "updatedAt": "2026-09-25T20:24:36.758Z",
    "horaSalida": "04:30 (N) / 04:45 (S)",
    "id": "req-1790367713768-hfiollx-108",
    "horaRecojoNorte": "04:30",
    "estado": "ATENDIDO",
    "fechaRegistro": "2026-09-25T20:21:53.771Z",
    "userUsername": "eparedes"
  }
];

export const INITIAL_DETALLES: DetalleRequerimiento[] = [
  {
    "cantidad": 2,
    "id": "det-1790284156054-ggmir",
    "parcela": "57",
    "zona": "NORTE",
    "comedor": "57",
    "paradero": "LA PLAZUELA HUACAPONGO",
    "cultivo": "ARÁNDANO",
    "requerimientoId": "req-1790284156053-rrwit",
    "numeroRequerimiento": "REQ-000005"
  },
  {
    "id": "det-1790284156055-l4ma1",
    "cantidad": 5,
    "numeroRequerimiento": "REQ-000005",
    "requerimientoId": "req-1790284156053-rrwit",
    "paradero": "VALDEMAR",
    "cultivo": "ARÁNDANO",
    "zona": "NORTE",
    "parcela": "57",
    "comedor": "57"
  },
  {
    "cultivo": "ARÁNDANO",
    "requerimientoId": "req-1790284156053-rrwit",
    "comedor": "57",
    "parcela": "57",
    "numeroRequerimiento": "REQ-000005",
    "cantidad": 6,
    "paradero": "VILLA VIRU",
    "id": "det-1790284156055-pklo4",
    "zona": "NORTE"
  },
  {
    "zona": "NORTE",
    "requerimientoId": "req-1790284156053-rrwit",
    "numeroRequerimiento": "REQ-000005",
    "cultivo": "ARÁNDANO",
    "id": "det-1790284156056-bxdzq",
    "comedor": "57",
    "paradero": "CALIFORNIA",
    "parcela": "57",
    "cantidad": 4
  },
  {
    "id": "det-1790284447214-s0qfl",
    "requerimientoId": "req-1790284447213-77a3r",
    "zona": "NORTE",
    "numeroRequerimiento": "REQ-000006",
    "comedor": "C556",
    "parcela": "C556",
    "paradero": "LA BRASIL",
    "cantidad": 2,
    "cultivo": "ARÁNDANO"
  },
  {
    "paradero": "PUENTE CHANQUIN",
    "numeroRequerimiento": "REQ-000006",
    "cantidad": 2,
    "id": "det-1790284447216-82rch",
    "zona": "NORTE",
    "parcela": "C556",
    "requerimientoId": "req-1790284447213-77a3r",
    "comedor": "C556",
    "cultivo": "ARÁNDANO"
  },
  {
    "cantidad": 5,
    "paradero": "LA PLAZUELA HUACAPONGO",
    "zona": "NORTE",
    "id": "det-1790284447216-j9663",
    "requerimientoId": "req-1790284447213-77a3r",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000006",
    "parcela": "557",
    "comedor": "557"
  },
  {
    "zona": "NORTE",
    "cultivo": "ARÁNDANO",
    "comedor": "C556",
    "numeroRequerimiento": "REQ-000006",
    "parcela": "C556",
    "id": "det-1790284447216-lhe7k",
    "cantidad": 2,
    "requerimientoId": "req-1790284447213-77a3r",
    "paradero": "VILLA VIRU"
  },
  {
    "id": "det-1790284447216-zutqw",
    "requerimientoId": "req-1790284447213-77a3r",
    "paradero": "PUENTE CHANQUIN",
    "cantidad": 5,
    "comedor": "557",
    "numeroRequerimiento": "REQ-000006",
    "parcela": "557",
    "zona": "NORTE",
    "cultivo": "ARÁNDANO"
  },
  {
    "zona": "NORTE",
    "id": "det-1790293124072-a9in7eg-439",
    "numeroRequerimiento": "REQ-000007",
    "cultivo": "ARÁNDANO",
    "paradero": "LA BRASIL",
    "comedor": "C561",
    "cantidad": 2,
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "parcela": "C561"
  },
  {
    "cantidad": 2,
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "paradero": "VALDEMAR",
    "numeroRequerimiento": "REQ-000007",
    "zona": "NORTE",
    "id": "det-1790293124073-4enzyhp-46",
    "cultivo": "ARÁNDANO",
    "parcela": "C561",
    "comedor": "C561"
  },
  {
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "zona": "NORTE",
    "cantidad": 3,
    "paradero": "CALIFORNIA",
    "numeroRequerimiento": "REQ-000007",
    "id": "det-1790293124074-8ku3hfv-957",
    "cultivo": "ARÁNDANO",
    "comedor": "C561",
    "parcela": "C561"
  },
  {
    "cantidad": 2,
    "numeroRequerimiento": "REQ-000007",
    "cultivo": "ARÁNDANO",
    "paradero": "SAN LUIS",
    "parcela": "C561",
    "id": "det-1790293124074-e8l4ebq-122",
    "comedor": "C561",
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "zona": "NORTE"
  },
  {
    "comedor": "C561",
    "parcela": "C561",
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "cantidad": 2,
    "id": "det-1790293124074-jxcx6dy-402",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000007",
    "paradero": "PRIMERO DE MAYO",
    "zona": "NORTE"
  },
  {
    "paradero": "PETROAMERICA",
    "zona": "NORTE",
    "cantidad": 2,
    "parcela": "C561",
    "comedor": "C561",
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000007",
    "id": "det-1790293124074-yn25u97-544"
  },
  {
    "parcela": "C561",
    "comedor": "C561",
    "id": "det-1790293124075-hrh13po-880",
    "paradero": "LA BOTICA",
    "cultivo": "ARÁNDANO",
    "cantidad": 5,
    "zona": "SUR",
    "numeroRequerimiento": "REQ-000007",
    "requerimientoId": "req-1790293124071-1eicncy-107"
  },
  {
    "numeroRequerimiento": "REQ-000007",
    "zona": "SUR",
    "id": "det-1790293124075-mvqhtwe-649",
    "cantidad": 5,
    "paradero": "GRIFO GRAN CHIMU",
    "cultivo": "ARÁNDANO",
    "parcela": "C561",
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "comedor": "C561"
  },
  {
    "id": "det-1790293124075-ud747f2-717",
    "zona": "SUR",
    "numeroRequerimiento": "REQ-000007",
    "cultivo": "ARÁNDANO",
    "comedor": "C561",
    "cantidad": 2,
    "paradero": "LA 28",
    "parcela": "C561",
    "requerimientoId": "req-1790293124071-1eicncy-107"
  },
  {
    "zona": "SUR",
    "parcela": "C561",
    "comedor": "C561",
    "cultivo": "ARÁNDANO",
    "cantidad": 2,
    "id": "det-1790293124075-z28eua2-316",
    "paradero": "VIVIENDAS MAR VERDE",
    "requerimientoId": "req-1790293124071-1eicncy-107",
    "numeroRequerimiento": "REQ-000007"
  },
  {
    "parcela": "C561",
    "id": "det-1790293124076-hcogoum-763",
    "comedor": "C561",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000007",
    "paradero": "SEGUNDO PARADERO",
    "zona": "SUR",
    "cantidad": 12,
    "requerimientoId": "req-1790293124071-1eicncy-107"
  },
  {
    "zona": "NORTE",
    "cultivo": "ARÁNDANO",
    "comedor": "556",
    "numeroRequerimiento": "REQ-000008",
    "parcela": "556",
    "id": "det-1790293441510-780bfcd-310",
    "cantidad": 2,
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "paradero": "LA BRASIL"
  },
  {
    "numeroRequerimiento": "REQ-000008",
    "id": "det-1790293441511-bu6dusy-477",
    "paradero": "CALLE LIMA",
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "zona": "NORTE",
    "cantidad": 2,
    "comedor": "556",
    "parcela": "556",
    "cultivo": "ARÁNDANO"
  },
  {
    "cultivo": "ARÁNDANO",
    "parcela": "556",
    "comedor": "556",
    "numeroRequerimiento": "REQ-000008",
    "paradero": "PETROAMERICA",
    "id": "det-1790293441511-i0oh6v7-328",
    "cantidad": 2,
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "zona": "NORTE"
  },
  {
    "cantidad": 2,
    "paradero": "LA BRASIL",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000008",
    "comedor": "557",
    "zona": "NORTE",
    "parcela": "557",
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "id": "det-1790293441512-0iygyxs-268"
  },
  {
    "zona": "NORTE",
    "numeroRequerimiento": "REQ-000008",
    "id": "det-1790293441512-8xtux6i-557",
    "cultivo": "ARÁNDANO",
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "cantidad": 3,
    "parcela": "557",
    "comedor": "557",
    "paradero": "PETROAMERICA"
  },
  {
    "paradero": "GRIFO GRAN CHIMU",
    "id": "det-1790293441512-c9djgsw-97",
    "cantidad": 2,
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000008",
    "zona": "SUR",
    "parcela": "556",
    "comedor": "556"
  },
  {
    "cultivo": "ARÁNDANO",
    "cantidad": 2,
    "paradero": "CALLE LIMA",
    "numeroRequerimiento": "REQ-000008",
    "id": "det-1790293441512-zkcfksz-437",
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "parcela": "557",
    "zona": "NORTE",
    "comedor": "557"
  },
  {
    "requerimientoId": "req-1790293441509-8jj4e3a-868",
    "comedor": "557",
    "parcela": "557",
    "id": "det-1790293441513-ietwhm3-826",
    "paradero": "GRIFO GRAN CHIMU",
    "cultivo": "ARÁNDANO",
    "cantidad": 6,
    "zona": "SUR",
    "numeroRequerimiento": "REQ-000008"
  },
  {
    "id": "det-1790367713769-nbii3gi-343",
    "zona": "NORTE",
    "paradero": "LA BRASIL",
    "cantidad": 2,
    "comedor": "57",
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "parcela": "57",
    "numeroRequerimiento": "REQ-000009",
    "cultivo": "ARÁNDANO"
  },
  {
    "id": "det-1790367713770-3lja2i7-945",
    "numeroRequerimiento": "REQ-000009",
    "cantidad": 2,
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "zona": "SUR",
    "cultivo": "ARÁNDANO",
    "paradero": "LA 28",
    "comedor": "57",
    "parcela": "57"
  },
  {
    "id": "det-1790367713770-glejpys-311",
    "zona": "NORTE",
    "cantidad": 2,
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000009",
    "paradero": "CALIFORNIA",
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "parcela": "57",
    "comedor": "57"
  },
  {
    "numeroRequerimiento": "REQ-000009",
    "zona": "NORTE",
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "id": "det-1790367713770-rdtv949-814",
    "cantidad": 5,
    "paradero": "VILLA VIRU",
    "cultivo": "ARÁNDANO",
    "comedor": "57",
    "parcela": "57"
  },
  {
    "zona": "SUR",
    "id": "det-1790367713770-zbucfvs-487",
    "parcela": "57",
    "comedor": "57",
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "numeroRequerimiento": "REQ-000009",
    "cultivo": "ARÁNDANO",
    "paradero": "VIVIENDAS MAR VERDE",
    "cantidad": 2
  },
  {
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "numeroRequerimiento": "REQ-000009",
    "id": "det-1790367713771-3yegjnk-125",
    "cultivo": "ARÁNDANO",
    "zona": "SUR",
    "cantidad": 5,
    "parcela": "57",
    "paradero": "SEGUNDO PARADERO",
    "comedor": "57"
  },
  {
    "paradero": "LA BOTICA",
    "id": "det-1790367713771-sg0itnf-826",
    "zona": "SUR",
    "cantidad": 5,
    "cultivo": "ARÁNDANO",
    "numeroRequerimiento": "REQ-000009",
    "comedor": "57",
    "requerimientoId": "req-1790367713768-hfiollx-108",
    "parcela": "57"
  }
];

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
