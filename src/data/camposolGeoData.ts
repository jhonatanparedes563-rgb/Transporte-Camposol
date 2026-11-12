export interface GeoPoint {
  id: string;
  nombre: string;
  codigo?: string;
  tipo: 'COMEDOR' | 'PARADERO' | 'GARITA' | 'ACOPIO' | 'PLATAFORMA' | 'SECTOR_COSTA';
  cultivo: 'ARÁNDANO' | 'PALTO' | 'ESPÁRRAGO' | 'MANDARINA' | 'GENERAL';
  fundo: string;
  zona: 'NORTE' | 'SUR';
  lat: number;
  lng: number;
  capacidad?: number;
  descripcion?: string;
}

export interface FundoFolder {
  id: string;
  nombre: string;
  cultivo: string;
  visible: boolean;
  color: string;
  puntos: GeoPoint[];
}

// Enlace oficial de Google Earth del proyecto CAMPOSOL
export const GOOGLE_EARTH_PROJECT_URL =
  'https://earth.google.com/web/@-8.42897482,-78.73580362,85.72756244a,37722.31208348d,35y,17.65685095h,0t,0r/data=CgRCAggBMikKJwolCiExYTUyVUVadEZGMFBCdGtLbVpHMk5vLTRpeHJEeEpsSUggAToDCgEwQgIIAEoICJjFmvMBEAE?utm_source=earth7&utm_campaign=vine&hl=es-419&authuser=0&pli=1';

// Parámetros de Cámara de Google Earth extraídos tal cual del enlace
export const GOOGLE_EARTH_CAMERA = {
  lat: -8.42897482,
  lng: -78.73580362,
  altitudeMeters: 37722,
  elevationMeters: 85.7,
  headingDegrees: 35.0,
  tiltDegrees: 17.65,
  zoom: 12,
};

export const MAPA_CAMPOSOL_CENTER: [number, number] = [
  GOOGLE_EARTH_CAMERA.lat,
  GOOGLE_EARTH_CAMERA.lng,
];
export const MAPA_CAMPOSOL_ZOOM = GOOGLE_EARTH_CAMERA.zoom;

// Ruta Troncal Panamericana Norte (Virú a Chao)
export const RUTA_TRANSPORTE_VIRU_CHAO: [number, number][] = [
  [-8.4180, -78.7750], // Valdemar
  [-8.4220, -78.7680], // La Brasil
  [-8.4250, -78.7610], // La Llanta
  [-8.4270, -78.7550], // Techo Propio
  [-8.4290, -78.7480], // California
  [-8.4260, -78.7420], // Primera de Mayo
  [-8.4240, -78.7450], // Puente Chanquín
  [-8.4210, -78.7350], // El Refugio
  [-8.4180, -78.7320], // La Portada
  [-8.4120, -78.7280], // Calle Lima-Virú
  [-8.4380, -78.7300], // Grifo Los Pinos
  [-8.4340, -78.7240], // Mendocilla
  [-8.4410, -78.7180], // La 21
  [-8.4480, -78.7050], // Viviendas Mar Verde
  [-8.4720, -78.6920], // Fundo Gloria
  [-8.4820, -78.6750], // Segundo Paradero
  [-8.5020, -78.6710], // La Botica
  [-8.5110, -78.6680], // La 28
  [-8.5280, -78.6720], // Nuevo Chao
  [-8.5350, -78.6610], // Grifo Gran Chimú
  [-8.5410, -78.6820], // Fundo Agricultor 1 (Comedor 57)
];

// Ruta Costera Histórica: Puerto Morín - El Carmelo - Huancaquito - Panamericana
export const RUTA_COSTERA_CARMELO_MORIN: [number, number][] = [
  [-8.3970, -78.8960], // Puerto Morín
  [-8.3910, -78.8710], // CISA Santorín
  [-8.3840, -78.8520], // Agrícola Alpamayo
  [-8.4350, -78.8250], // El Carmelo
  [-8.4390, -78.8310], // Campo Santo El Carmelo
  [-8.4480, -78.8180], // Las Gaviotas
  [-8.4620, -78.8120], // Playa El León
  [-8.4710, -78.7980], // Peñacerro
  [-8.4950, -78.7680], // Santa Cecilia
  [-8.4180, -78.7750], // Conexión Valdemar (Virú)
];

// Ruta Interior Valles y Fundos Camposol
export const RUTA_INTERIOR_FUNDOS: [number, number][] = [
  [-8.4480, -78.7050], // Mar Verde
  [-8.4610, -78.7250], // Arenal
  [-8.4720, -78.6920], // Gloria
  [-8.5200, -78.7050], // Yakuy Minka
  [-8.5410, -78.6820], // Agricultor 1
  [-8.5480, -78.6865], // Agricultor 2
  [-8.5280, -78.6720], // Nuevo Chao
];

// ----------------------------------------------------------------------
// 1. PUNTOS REALES DEL PROYECTO GOOGLE EARTH "COMEDORES CAMPOSOL 2025"
// ----------------------------------------------------------------------
export const PUNTOS_GOOGLE_EARTH_PROYECTO: GeoPoint[] = [
  // Sector Costa / El Carmelo / Puerto Morín (Tal cual en el proyecto Earth)
  {
    id: 'GE-ALPAMAYO',
    nombre: 'Agrícola Alpamayo',
    codigo: 'ALPAMAYO',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.3840,
    lng: -78.8520,
    descripcion: 'Operaciones agrícolas y sector de influencia costera',
  },
  {
    id: 'GE-SANTORIN',
    nombre: 'CISA Santorín',
    codigo: 'SANTORIN',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.3910,
    lng: -78.8710,
    descripcion: 'Punto estratégico agroindustrial CISA Santorín',
  },
  {
    id: 'GE-PUERTO-MORIN',
    nombre: 'Puerto Morín',
    codigo: 'PTO-MORIN',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.3970,
    lng: -78.8960,
    descripcion: 'Caleta pesquera y balneario Puerto Morín',
  },
  {
    id: 'GE-CARMELO',
    nombre: 'El Carmelo (Negro - El Carmelo)',
    codigo: 'CARMELO',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'EL CARMELO',
    zona: 'NORTE',
    lat: -8.4350,
    lng: -78.8250,
    descripcion: 'Centro poblado El Carmelo - Ruta de personal',
  },
  {
    id: 'GE-CAMPOSANTO',
    nombre: 'Campo Santo El Carmelo',
    codigo: 'CS-CARMELO',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'EL CARMELO',
    zona: 'NORTE',
    lat: -8.4390,
    lng: -78.8310,
    descripcion: 'Punto de referencia geográfico y vial El Carmelo',
  },
  {
    id: 'GE-ISLAS-GUANAPE',
    nombre: 'Islas Guañape - El Carmelo',
    codigo: 'GUANAPE',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.4550,
    lng: -78.8450,
    descripcion: 'Sector litoral Islas Guañape frente a El Carmelo',
  },
  {
    id: 'GE-GAVIOTAS',
    nombre: 'Las Gaviotas',
    codigo: 'GAVIOTAS',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.4480,
    lng: -78.8180,
    descripcion: 'Sector costero Las Gaviotas',
  },
  {
    id: 'GE-PLAYA-LEON',
    nombre: 'Playa El León',
    codigo: 'PL-LEON',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.4620,
    lng: -78.8120,
    descripcion: 'Litoral viruñero Playa El León',
  },
  {
    id: 'GE-PENACERRO',
    nombre: 'Peñacerro',
    codigo: 'PENACERRO',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'SECTOR COSTA',
    zona: 'NORTE',
    lat: -8.4710,
    lng: -78.7980,
    descripcion: 'Sector de dunas y relieve costero Peñacerro',
  },
  {
    id: 'GE-RAMADA',
    nombre: 'La Ramada',
    codigo: 'RAMADA',
    tipo: 'SECTOR_COSTA',
    cultivo: 'GENERAL',
    fundo: 'VIRU NORTE',
    zona: 'NORTE',
    lat: -8.3890,
    lng: -78.7850,
    descripcion: 'Sector agrícola La Ramada',
  },
  {
    id: 'GE-COMPOSTERA',
    nombre: 'Fundo Compostera / Danper',
    codigo: 'COMPOSTERA',
    tipo: 'ACOPIO',
    cultivo: 'GENERAL',
    fundo: 'FUNDO COMPOSTERA',
    zona: 'NORTE',
    lat: -8.4120,
    lng: -78.7950,
    descripcion: 'Instalaciones de compostaje industrial y acopio agrícola',
  },
];

// ----------------------------------------------------------------------
// 2. CATÁLOGO OFICIAL REAL DE LOS 24 PARADEROS DE CAMPOSOL
// ----------------------------------------------------------------------
export const PARADEROS_GEO: GeoPoint[] = [
  // RUTA VIRÚ (ZONA NORTE) - Orden Oficial Operativo
  { id: 'PAR-01', nombre: 'La Brasil', codigo: 'PAR-01', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4220, lng: -78.7680 },
  { id: 'PAR-02', nombre: 'Valdemar', codigo: 'PAR-02', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4180, lng: -78.7750 },
  { id: 'PAR-03', nombre: 'La Llanta', codigo: 'PAR-03', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4250, lng: -78.7610 },
  { id: 'PAR-04', nombre: 'Villa Virú', codigo: 'PAR-04', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4180, lng: -78.7520 },
  { id: 'PAR-05', nombre: 'Techo Propio', codigo: 'PAR-05', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4270, lng: -78.7550 },
  { id: 'PAR-06', nombre: 'Petroamérica', codigo: 'PAR-06', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4210, lng: -78.7490 },
  { id: 'PAR-07', nombre: 'Puente Chanquín', codigo: 'PAR-07', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4240, lng: -78.7450 },
  { id: 'PAR-08', nombre: 'California', codigo: 'PAR-08', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4290, lng: -78.7480 },
  { id: 'PAR-09', nombre: 'El Cañán', codigo: 'PAR-09', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4260, lng: -78.7440 },
  { id: 'PAR-10', nombre: 'Primera de Mayo', codigo: 'PAR-10', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4260, lng: -78.7420 },
  { id: 'PAR-11', nombre: 'El Refugio', codigo: 'PAR-11', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4210, lng: -78.7350 },
  { id: 'PAR-12', nombre: 'La Portada', codigo: 'PAR-12', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4180, lng: -78.7320 },
  { id: 'PAR-13', nombre: 'Calle Lima-Virú', codigo: 'PAR-13', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4120, lng: -78.7280 },
  { id: 'PAR-14', nombre: 'Grifo Los Pinos', codigo: 'PAR-14', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4380, lng: -78.7300 },
  { id: 'PAR-15', nombre: 'San Luis', codigo: 'PAR-15', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4320, lng: -78.7260 },
  { id: 'PAR-16', nombre: 'Mendocilla', codigo: 'PAR-16', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4340, lng: -78.7240 },
  { id: 'PAR-17', nombre: 'La 21', codigo: 'PAR-17', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4410, lng: -78.7180 },
  { id: 'PAR-18', nombre: 'La Plazuela San José', codigo: 'PAR-18', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4360, lng: -78.7210 },
  { id: 'PAR-19', nombre: 'Santa Cecilia', codigo: 'PAR-19', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'VIRÚ', zona: 'NORTE', lat: -8.4950, lng: -78.7680 },

  // RUTA CHAO (ZONA SUR) - Orden Oficial Operativo
  { id: 'PAR-20', nombre: 'Viviendas Mar Verde', codigo: 'PAR-20', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.4480, lng: -78.7050 },
  { id: 'PAR-21', nombre: 'Grifo Gran Chimú', codigo: 'PAR-21', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.5350, lng: -78.6610 },
  { id: 'PAR-22', nombre: 'La 28', codigo: 'PAR-22', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.5110, lng: -78.6680 },
  { id: 'PAR-23', nombre: 'La Botica', codigo: 'PAR-23', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.5020, lng: -78.6710 },
  { id: 'PAR-24', nombre: 'Segundo Paradero', codigo: 'PAR-24', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.4820, lng: -78.6750 },
  { id: 'PAR-25', nombre: 'Tercer Paradero', codigo: 'PAR-25', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.4760, lng: -78.6780 },
  { id: 'PAR-26', nombre: 'Buena Vista', codigo: 'PAR-26', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.4520, lng: -78.6530 },
  { id: 'PAR-27', nombre: 'Nuevo Chao', codigo: 'PAR-27', tipo: 'PARADERO', cultivo: 'GENERAL', fundo: 'CHAO', zona: 'SUR', lat: -8.5280, lng: -78.6720 },
];

// ----------------------------------------------------------------------
// 3. ESTRUCTURA REAL DE CARPETAS DE FUNDOS Y COMEDORES CAMPOSOL 2025
// ----------------------------------------------------------------------
export const FUNDOS_COMEDORES_TREE: FundoFolder[] = [
  {
    id: 'fundo-agricultor-1',
    nombre: 'AGRICULTOR 1',
    cultivo: 'ARÁNDANO',
    visible: true,
    color: '#0284c7', // Sky Blue
    puntos: [
      { id: 'COM-57', nombre: 'Comedor 57 (Central)', codigo: '57', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5410, lng: -78.6820, capacidad: 180 },
      { id: 'GAR-1', nombre: 'Garita 1', codigo: 'Garita 1', tipo: 'GARITA', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5280, lng: -78.6790 },
      { id: 'COM-521', nombre: 'Comedor 521', codigo: '521', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5380, lng: -78.6850, capacidad: 80 },
      { id: 'COM-520', nombre: 'Comedor 520', codigo: '520', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5390, lng: -78.6830, capacidad: 85 },
      { id: 'COM-524', nombre: 'Comedor 524', codigo: '524', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5420, lng: -78.6870, capacidad: 90 },
      { id: 'COM-562', nombre: 'Comedor 562', codigo: '562', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5440, lng: -78.6840, capacidad: 75 },
      { id: 'COM-564', nombre: 'Comedor 564', codigo: '564', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5430, lng: -78.6815, capacidad: 80 },
      { id: 'COM-63', nombre: 'Comedor 63', codigo: '63', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5450, lng: -78.6850, capacidad: 70 },
      { id: 'COM-65', nombre: 'Comedor 65', codigo: '65', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 1', zona: 'SUR', lat: -8.5470, lng: -78.6820, capacidad: 75 },
    ],
  },
  {
    id: 'fundo-agricultor-2',
    nombre: 'AGRICULTOR 2',
    cultivo: 'ARÁNDANO',
    visible: true,
    color: '#0369a1', // Deep Blue
    puntos: [
      { id: 'COM-556', nombre: 'Comedor 556', codigo: '556', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5460, lng: -78.6880, capacidad: 95 },
      { id: 'COM-557', nombre: 'Comedor 557', codigo: '557', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5480, lng: -78.6865, capacidad: 90 },
      { id: 'COM-561', nombre: 'Comedor 561', codigo: '561', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5490, lng: -78.6840, capacidad: 85 },
      { id: 'COM-C556', nombre: 'Comedor C556', codigo: 'C556', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5470, lng: -78.6875, capacidad: 90 },
      { id: 'COM-C561', nombre: 'Comedor C561', codigo: 'C561', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5500, lng: -78.6845, capacidad: 80 },
      { id: 'COM-766', nombre: 'Comedor 766', codigo: '766', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'AGRICULTOR 2', zona: 'SUR', lat: -8.5510, lng: -78.6850, capacidad: 70 },
    ],
  },
  {
    id: 'fundo-mar-verde',
    nombre: 'MAR VERDE',
    cultivo: 'ARÁNDANO',
    visible: true,
    color: '#16a34a', // Emerald Green
    puntos: [
      { id: 'MV-COMEDOR', nombre: 'Comedor Mar Verde', codigo: 'MV-C1', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4410, lng: -78.7020, capacidad: 150 },
      { id: 'MV-BIOFABRICA', nombre: 'Biofábrica 4', codigo: 'BIOFABRICA 4', tipo: 'PLATAFORMA', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4450, lng: -78.6970 },
      { id: 'MV-ACOPIO', nombre: 'Acopio Mar Verde', codigo: 'ACOPIO MV', tipo: 'ACOPIO', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4470, lng: -78.6950 },
      { id: 'MV-VIVIENDAS', nombre: 'Viviendas Mar Verde', codigo: 'VIV-MV', tipo: 'PARADERO', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4480, lng: -78.7050, capacidad: 100 },
      { id: 'MV-C125', nombre: 'Comedor C125', codigo: 'C125', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4380, lng: -78.6980, capacidad: 80 },
      { id: 'MV-C137', nombre: 'Comedor C137', codigo: 'C137', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'MAR VERDE', zona: 'SUR', lat: -8.4390, lng: -78.6960, capacidad: 80 },
    ],
  },
  {
    id: 'fundo-gloria',
    nombre: 'GLORIA',
    cultivo: 'PALTO / ARÁNDANO',
    visible: true,
    color: '#dc2626', // Red
    puntos: [
      { id: 'GL-GAR1', nombre: 'Garita Gloria 1', codigo: 'GAR-GL1', tipo: 'GARITA', cultivo: 'PALTO', fundo: 'GLORIA', zona: 'SUR', lat: -8.4680, lng: -78.6880 },
      { id: 'GL-CRUCE', nombre: 'Cruce P. Arqueo Gloria Alta', codigo: 'CRUCE ARQUEO', tipo: 'GARITA', cultivo: 'PALTO', fundo: 'GLORIA', zona: 'SUR', lat: -8.4620, lng: -78.6920 },
      { id: 'GL-198', nombre: 'Comedor C198', codigo: 'C198', tipo: 'COMEDOR', cultivo: 'PALTO', fundo: 'GLORIA', zona: 'SUR', lat: -8.4720, lng: -78.6930, capacidad: 110 },
      { id: 'GL-197', nombre: 'Comedor C197', codigo: 'C197', tipo: 'COMEDOR', cultivo: 'PALTO', fundo: 'GLORIA', zona: 'SUR', lat: -8.4740, lng: -78.6910, capacidad: 100 },
      { id: 'GL-PALTO', nombre: 'Comedor Gloria Palto', codigo: 'GL-PALTO', tipo: 'COMEDOR', cultivo: 'PALTO', fundo: 'GLORIA', zona: 'SUR', lat: -8.4850, lng: -78.7050, capacidad: 85 },
    ],
  },
  {
    id: 'fundo-arenal',
    nombre: 'ARENAL',
    cultivo: 'ARÁNDANO',
    visible: true,
    color: '#d97706', // Amber
    puntos: [
      { id: 'AR-COMEDOR', nombre: 'Comedor Arenal', codigo: 'ARENAL-C1', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'ARENAL', zona: 'SUR', lat: -8.4610, lng: -78.7250, capacidad: 100 },
      { id: 'AR-GARITA', nombre: 'Garita Arenal', codigo: 'GAR-ARENAL', tipo: 'GARITA', cultivo: 'ARÁNDANO', fundo: 'ARENAL', zona: 'SUR', lat: -8.4580, lng: -78.7280 },
    ],
  },
  {
    id: 'fundo-chao',
    nombre: 'CHAO 1 Y 2',
    cultivo: 'ARÁNDANO / ESPÁRRAGO',
    visible: true,
    color: '#9333ea', // Purple
    puntos: [
      { id: 'CH1-COMEDOR', nombre: 'Comedor Chao 1', codigo: 'CHAO1-C1', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'CHAO 1', zona: 'SUR', lat: -8.5200, lng: -78.6750, capacidad: 120 },
      { id: 'CH2-COMEDOR', nombre: 'Comedor Chao 2', codigo: 'CHAO2-C1', tipo: 'COMEDOR', cultivo: 'ARÁNDANO', fundo: 'CHAO 2', zona: 'SUR', lat: -8.5250, lng: -78.6710, capacidad: 110 },
      { id: 'CH-GARITA', nombre: 'Garita Chao Central', codigo: 'GAR-CHAO', tipo: 'GARITA', cultivo: 'GENERAL', fundo: 'CHAO 1', zona: 'SUR', lat: -8.5280, lng: -78.6730 },
    ],
  },
  {
    id: 'fundo-yakuy-minka',
    nombre: 'YAKUY MINKA (YAKU)',
    cultivo: 'PALTO / ARÁNDANO',
    visible: true,
    color: '#0d9488', // Teal
    puntos: [
      { id: 'YM-EMBALSE', nombre: 'Embalse YM', codigo: 'EMBALSE-YM', tipo: 'PLATAFORMA', cultivo: 'PALTO', fundo: 'YAKU', zona: 'SUR', lat: -8.5250, lng: -78.6920 },
      { id: 'YM-PLATAFORMA', nombre: 'Plataforma YM', codigo: 'PLATAFORMA YM', tipo: 'ACOPIO', cultivo: 'PALTO', fundo: 'YAKU', zona: 'SUR', lat: -8.5210, lng: -78.7000 },
      { id: 'YM-COMEDOR', nombre: 'Comedor Yaku Minka', codigo: 'YM-C1', tipo: 'COMEDOR', cultivo: 'PALTO', fundo: 'YAKU', zona: 'SUR', lat: -8.5200, lng: -78.7050, capacidad: 90 },
    ],
  },
  {
    id: 'fundo-compostera',
    nombre: 'FUNDO COMPOSTERA (DANPER)',
    cultivo: 'GENERAL',
    visible: true,
    color: '#84cc16', // Lime
    puntos: [
      { id: 'CP-COMPOSTERA', nombre: 'Compostera Central', codigo: 'COMPOSTERA-1', tipo: 'ACOPIO', cultivo: 'GENERAL', fundo: 'FUNDO COMPOSTERA', zona: 'NORTE', lat: -8.4120, lng: -78.7950 },
      { id: 'CP-GARITA', nombre: 'Garita Compostera', codigo: 'GAR-COMPOSTERA', tipo: 'GARITA', cultivo: 'GENERAL', fundo: 'FUNDO COMPOSTERA', zona: 'NORTE', lat: -8.4150, lng: -78.7910 },
    ],
  },
];
