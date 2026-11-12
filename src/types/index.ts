export type MovimientoType = 'INGRESO' | 'SALIDA' | 'Programa personal por tarea';

export type UserRole = 'usuario' | 'admin' | 'receptor';

export type UserStatus = 'ACTIVO' | 'INACTIVO';

export interface AppUser {
  id: string;
  nombre: string;
  usuario: string; // Login username
  email?: string; // Correo electrónico registrado
  passwordHash: string; // SHA-256 hash
  salt: string;
  rol: UserRole;
  area: string;
  fundo: string;
  cultivo?: string;
  estado: UserStatus;
  fechaCreacion?: string;
  ultimoAcceso?: string;
  terminosAceptados?: boolean;
  fechaAceptacionTerminos?: string;
  versionTerminosAceptada?: string;
}

export type EstadoRequerimiento = 
  | 'PENDIENTE'
  | 'EN REVISIÓN'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ATENDIDO'
  | 'ANULADO';

export interface MaestroArea {
  id: string;
  area: string;
}

export interface MaestroFundo {
  id: string;
  fundo: string;
}

export type ZonaParadero = 'NORTE' | 'SUR';

export interface MaestroParadero {
  id: string;
  paradero: string;
  zona?: ZonaParadero;
  codigo?: string;
  macrozona?: string;
  zonaEspecifica?: string;
  agrupador?: string;
  referencia?: string;
  latitud?: number;
  longitud?: number;
}

export interface MaestroComedor {
  id: string;
  comedor: string;
}

export interface MaestroUnidadBus {
  id: string;
  nombre: string; // e.g. "2 PISOS", "BUS LARGE", "BUS", "MINIBUS", "COMBI", "MINI VAN"
  capacidad: number; // e.g. 60, 55, 49, 30, 15, 10
  descripcion?: string;
  activo: boolean;
}

export interface ParadaViaje {
  paradero: string;
  zona: ZonaParadero;
  cantidadPasajeros: number;
  orden?: number;
  requerimientosCodigos?: string[];
}

export interface FundoDestinoViaje {
  fundo: string;
  cantidadPasajeros: number;
}

export interface ViajeProgramado {
  id: string;
  codigoViaje: string; // VJ-001
  fecha: string; // YYYY-MM-DD
  semana?: number; // e.g. 40
  servicioNumero?: number; // 1, 2, 3...
  fyp?: string; // CAMPO
  fundo: string;
  proveedor?: string; // Ecobus, Mobil, Puerto Rico, etc.
  movil?: string; // Bus, Mini Bus, Combi, etc.
  placa?: string;
  dni?: string;
  conductor?: string;
  tipo?: 'SAL' | 'ING';
  hora?: string;
  area?: string;
  origen?: string;
  destino?: string;
  plan?: number;
  sayta?: string;
  paraderoInicial?: string;
  horaSayta?: string;
  obsSayta?: string;
  capSayta?: number;
  encargado?: string;
  supervisor?: string;
  turnoText?: string;
  turno: string;
  movimiento: MovimientoType;
  zona: ZonaParadero | 'MIXTA';
  unidad: MaestroUnidadBus;
  totalPasajeros: number;
  capacidadUnidad: number;
  porcentajeOcupacion: number;
  asientosDisponibles: number;
  fundos: FundoDestinoViaje[];
  recorridoParaderos: ParadaViaje[];
  requerimientosIds: string[];
  estado: 'PROGRAMADO' | 'EN_RUTA' | 'COMPLETADO' | 'CANCELADO';
  chofer?: string;
  observaciones?: string;
}

export interface ProgramacionViajesDia {
  id: string;
  fecha: string;
  movimiento: MovimientoType | 'TODOS';
  turno?: string;
  fechaGeneracion: string;
  viajes: ViajeProgramado[];
  totalPasajeros: number;
  totalCapacidad: number;
  eficienciaGlobal: number;
  resumenUnidades: Record<string, number>;
}

// Entidad principal: REQUERIMIENTOS
export interface Requerimiento {
  id: string;
  numeroRequerimiento: string; // REQ-000001
  fecha: string; // YYYY-MM-DD
  area: string;
  fundo: string;
  cultivo?: string;
  parcelas?: string[];
  movimiento: MovimientoType;
  horaRecojo: string; // HH:mm o formato compuesto Norte/Sur
  horaSalida: string; // HH:mm
  horaRecojoNorte?: string;
  horaRecojoSur?: string;
  observaciones: string;
  usuario: string; // Nombre visible del solicitante
  userId?: string; // ID único del trabajador solicitante
  userUsername?: string; // Nombre de usuario (login) del solicitante
  userRole?: UserRole; // Rol asignado
  fechaRegistro: string; // ISO timestamp
  updatedAt?: string;
  totalPersonas: number;
  estado: EstadoRequerimiento;
  fechaAnulacion?: string;
  usuarioAnulacion?: string;
  motivoAnulacion?: string;
  historialTrazabilidad?: Array<{
    fecha: string;
    usuario: string;
    accion: string;
    detalle?: string;
  }>;
}

// Entidad relacional detalle: DETALLE_REQUERIMIENTO
export interface DetalleRequerimiento {
  id: string;
  requerimientoId: string;
  numeroRequerimiento: string;
  comedor: string; // Parcela o comedor
  parcela?: string;
  paradero: string;
  zona?: ZonaParadero;
  cultivo?: string;
  cantidad: number;
}

// Estructura de trabajo para el formulario durante el Paso 2
export interface ComedorPersonalDraft {
  comedor: string;
  paraderosCantidades: Record<string, number>; // paradero -> cantidad
}

export interface RequerimientoDraft {
  fecha: string;
  area: string;
  fundo: string;
  cultivo: string; // e.g. 'ARÁNDANO'
  parcelas?: string[]; // Opcional, removido del flujo
  movimiento: MovimientoType;
  horaRecojo: string;
  horaSalida: string;
  horaRecojoNorte?: string;
  horaRecojoSur?: string;
  observaciones: string;
  cantidadesPorParadero?: Record<string, number>; // paradero -> cantidad
  matrizCantidades?: Record<string, Record<string, number>>;
  comedores?: ComedorPersonalDraft[];
}
