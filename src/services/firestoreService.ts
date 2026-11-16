import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  writeBatch,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  db,
  auth,
  checkFirestoreServerConnection,
  firebaseProjectId,
  firebaseDatabaseId,
} from '../lib/firebase';
import {
  Requerimiento,
  DetalleRequerimiento,
  DetalleCompacto,
  AppUser,
  MaestroArea,
  MaestroFundo,
  MaestroZona,
  MaestroParadero,
  MaestroComedor,
  MaestroUnidadBus,
} from '../types';
import {
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_ZONAS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from '../data/masterData';

function getRollingCutoffDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildCompactDetalles(detalles: DetalleRequerimiento[]): DetalleCompacto[] {
  return (detalles || []).slice(0, 250).map((det) => ({
    id: String(det.id || '').slice(0, 128),
    c: String(det.comedor || 'Comedor 1').slice(0, 60),
    ...(det.parcela ? { p: String(det.parcela).slice(0, 60) } : {}),
    par: String(det.paradero || '').slice(0, 120),
    ...(det.zona === 'NORTE' || det.zona === 'SUR' ? { z: det.zona } : {}),
    ...(det.cultivo ? { cul: String(det.cultivo).slice(0, 60) } : {}),
    q: Math.min(Math.max(Math.floor(Number(det.cantidad) || 1), 1), 500),
  }));
}

export function expandCompactDetalles(req: Requerimiento): DetalleRequerimiento[] {
  if (!Array.isArray(req.detallesCompactos) || req.detallesCompactos.length === 0) {
    return [];
  }
  return req.detallesCompactos.map((dc) => ({
    id: dc.id,
    requerimientoId: req.id,
    numeroRequerimiento: req.numeroRequerimiento,
    ...(req.userId ? { userId: req.userId } : {}),
    ...(req.firebaseUid ? { firebaseUid: req.firebaseUid } : {}),
    ...(req.firebaseEmail ? { firebaseEmail: req.firebaseEmail } : {}),
    comedor: dc.c || 'Comedor 1',
    ...(dc.p ? { parcela: dc.p } : {}),
    paradero: dc.par || '',
    ...(dc.z === 'NORTE' || dc.z === 'SUR' ? { zona: dc.z } : {}),
    ...(dc.cul ? { cultivo: dc.cul } : {}),
    cantidad: Number(dc.q) || 1,
  }));
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let firestoreServerVerified = false;
let lastFirestoreError: string | null = null;
let masterDataExistsInCloud = false;

export function hasMasterDataInFirestore(): boolean {
  return masterDataExistsInCloud;
}

export function formatFriendlyFirestoreError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  let inner = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      inner = parsed.error;
    }
  } catch {
    // not JSON
  }
  const lower = inner.toLowerCase();
  if (lower.includes('free daily read units')) {
    return `Cuota diaria gratuita Spark excedida. Revise su base de datos en Firebase Console: https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/${firebaseDatabaseId}/data?openUpgradeDialog=true`;
  }
  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    return 'Cuota diaria gratuita del plan Spark de Firebase excedida. Se restablece al día siguiente.';
  }
  if (lower.includes('missing or insufficient permissions') || lower.includes('permission-denied')) {
    return 'Permiso denegado en Cloud Firestore. Verifique las reglas de seguridad o inicie sesión con una cuenta Google autorizada.';
  }
  if (lower.includes('unauthorized-domain') || lower.includes('dominio no está autorizado')) {
    return 'Dominio no autorizado en Firebase Authentication (Authorized domains) del proyecto tdp-camposol.';
  }
  if (lower.includes('the client is offline') || lower.includes('unavailable') || lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Sin conexión a internet para comunicar con Cloud Firestore.';
  }
  return inner || 'Error de comunicación con Cloud Firestore.';
}

function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const user = auth.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
  };
}

function recordFirestoreErrorState(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  lastFirestoreError = formatFriendlyFirestoreError(errInfo.error);
  firestoreServerVerified = false;
  notifyAuthSubscribers();
  return JSON.stringify(errInfo);
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const jsonMsg = recordFirestoreErrorState(error, operationType, path);
  throw new Error(jsonMsg);
}

function hasVerifiedFirebaseAuth(): FirebaseUser | null {
  const user = auth.currentUser;
  return user && user.emailVerified ? user : null;
}

export function isFirestoreAuthenticated(): boolean {
  return Boolean(hasVerifiedFirebaseAuth());
}

export function getFirebaseUserInfo(): {
  connected: boolean;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  isBootstrappedAdmin: boolean;
  serverVerified: boolean;
  lastError: string | null;
  projectId: string;
  databaseId: string;
} {
  const u = hasVerifiedFirebaseAuth();
  return {
    connected: Boolean(u),
    uid: u?.uid ?? null,
    email: u?.email ?? null,
    displayName: u?.displayName ?? null,
    isBootstrappedAdmin: Boolean(u?.email && u.email.toLowerCase() === 'jhonatanparedes563@gmail.com'),
    serverVerified: Boolean(u) && firestoreServerVerified,
    lastError: lastFirestoreError,
    projectId: firebaseProjectId,
    databaseId: firebaseDatabaseId,
  };
}

function sanitizeUserForFirestore(user: AppUser): Omit<AppUser, 'passwordHash' | 'salt'> {
  const clean: Record<string, unknown> = {
    id: user.id,
    nombre: String(user.nombre || '').slice(0, 120),
    usuario: String(user.usuario || '').slice(0, 32),
    rol: user.rol,
    area: String(user.area || '').slice(0, 80),
    fundo: String(user.fundo || '').slice(0, 80),
    estado: user.estado,
  };
  if (user.email) clean.email = String(user.email).slice(0, 120);
  if (user.cultivo) clean.cultivo = String(user.cultivo).slice(0, 60);
  if (user.fechaCreacion) clean.fechaCreacion = String(user.fechaCreacion).slice(0, 40);
  if (user.ultimoAcceso) clean.ultimoAcceso = String(user.ultimoAcceso).slice(0, 40);
  if (typeof user.terminosAceptados === 'boolean') clean.terminosAceptados = user.terminosAceptados;
  if (user.fechaAceptacionTerminos) clean.fechaAceptacionTerminos = String(user.fechaAceptacionTerminos).slice(0, 40);
  if (user.versionTerminosAceptada) clean.versionTerminosAceptada = String(user.versionTerminosAceptada).slice(0, 40);
  return clean as Omit<AppUser, 'passwordHash' | 'salt'>;
}

function toValidFirestoreId(raw: unknown, fallback: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeRequerimientoForFirestore(
  req: Requerimiento,
  fbUser: FirebaseUser,
  preserveExistingFirebaseOwner: boolean = false,
  compactDetalles?: DetalleCompacto[]
): Requerimiento {
  const src = JSON.parse(JSON.stringify(req)) as Record<string, unknown>;
  const safeId = toValidFirestoreId(src.id, `req-${Date.now()}`);
  const safeUserId = toValidFirestoreId(src.userId, fbUser.uid);
  const safeFirebaseUid =
    preserveExistingFirebaseOwner && typeof src.firebaseUid === 'string' && src.firebaseUid.trim()
      ? toValidFirestoreId(src.firebaseUid.trim(), fbUser.uid)
      : toValidFirestoreId(fbUser.uid, fbUser.uid);

  const validMovimiento =
    src.movimiento === 'INGRESO' ||
    src.movimiento === 'SALIDA' ||
    src.movimiento === 'Programa personal por tarea'
      ? src.movimiento
      : 'Programa personal por tarea';

  const validEstado =
    src.estado === 'PENDIENTE' ||
    src.estado === 'EN REVISIÓN' ||
    src.estado === 'APROBADO' ||
    src.estado === 'RECHAZADO' ||
    src.estado === 'ATENDIDO' ||
    src.estado === 'ANULADO'
      ? src.estado
      : 'PENDIENTE';

  const numRaw = String(src.numeroRequerimiento || 'REQ-000001').trim();
  const safeNumero = /^REQ-[0-9]+$/.test(numRaw) ? numRaw.slice(0, 32) : 'REQ-000001';
  const fechaRaw = String(src.fecha || '').slice(0, 10);
  const safeFecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw) ? fechaRaw : getRollingCutoffDateStr(0);

  const out: Record<string, unknown> = {
    id: safeId,
    numeroRequerimiento: safeNumero,
    fecha: safeFecha,
    area: String(src.area || 'PRODUCCIÓN').trim().slice(0, 80) || 'PRODUCCIÓN',
    fundo: String(src.fundo || 'AGRICULTOR 1').trim().slice(0, 80) || 'AGRICULTOR 1',
    movimiento: validMovimiento,
    horaRecojo: String(src.horaRecojo || '13:00').trim().slice(0, 40) || '13:00',
    horaSalida: String(src.horaSalida || src.horaRecojo || '13:00').trim().slice(0, 40) || '13:00',
    observaciones: String(src.observaciones || '').slice(0, 500),
    usuario: String(src.usuario || fbUser.displayName || 'Supervisor').trim().slice(0, 120) || 'Supervisor',
    userId: safeUserId,
    firebaseUid: safeFirebaseUid,
    fechaRegistro:
      String(src.fechaRegistro || new Date().toISOString()).trim().slice(0, 40) ||
      new Date().toISOString().slice(0, 40),
    totalPersonas: Math.min(Math.max(Math.floor(Number(src.totalPersonas) || 1), 1), 5000),
    estado: validEstado,
  };

  if (typeof src.cultivo === 'string' && src.cultivo.trim()) {
    out.cultivo = src.cultivo.trim().slice(0, 60);
  }
  if (Array.isArray(src.parcelas)) {
    out.parcelas = src.parcelas
      .map((p) => String(p || '').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 50);
  }
  if (typeof src.horaRecojoNorte === 'string' && src.horaRecojoNorte.trim()) {
    out.horaRecojoNorte = src.horaRecojoNorte.trim().slice(0, 16);
  }
  if (typeof src.horaRecojoSur === 'string' && src.horaRecojoSur.trim()) {
    out.horaRecojoSur = src.horaRecojoSur.trim().slice(0, 16);
  }
  const emailVal =
    preserveExistingFirebaseOwner && typeof src.firebaseEmail === 'string' && src.firebaseEmail.trim()
      ? src.firebaseEmail.trim()
      : fbUser.email || '';
  if (emailVal) {
    out.firebaseEmail = emailVal.slice(0, 120);
  }
  if (typeof src.userUsername === 'string' && src.userUsername.trim()) {
    out.userUsername = src.userUsername.trim().slice(0, 64);
  }
  if (src.userRole === 'usuario' || src.userRole === 'admin' || src.userRole === 'receptor') {
    out.userRole = src.userRole;
  }
  if (typeof src.updatedAt === 'string' && src.updatedAt.trim()) {
    out.updatedAt = src.updatedAt.trim().slice(0, 40);
  }
  if (typeof src.fechaAnulacion === 'string' && src.fechaAnulacion.trim()) {
    out.fechaAnulacion = src.fechaAnulacion.trim().slice(0, 40);
  }
  if (typeof src.usuarioAnulacion === 'string' && src.usuarioAnulacion.trim()) {
    out.usuarioAnulacion = src.usuarioAnulacion.trim().slice(0, 120);
  }
  if (typeof src.motivoAnulacion === 'string' && src.motivoAnulacion.trim()) {
    out.motivoAnulacion = src.motivoAnulacion.trim().slice(0, 300);
  }
  if (Array.isArray(src.historialTrazabilidad)) {
    const cleanHist = src.historialTrazabilidad
      .filter((h) => h && typeof h === 'object')
      .slice(-50);
    if (cleanHist.length > 0) {
      out.historialTrazabilidad = cleanHist;
    }
  }
  if (Array.isArray(compactDetalles) && compactDetalles.length > 0) {
    out.detallesCompactos = compactDetalles.slice(0, 250);
  } else if (Array.isArray(src.detallesCompactos) && src.detallesCompactos.length > 0) {
    out.detallesCompactos = src.detallesCompactos.filter((d) => d && typeof d === 'object').slice(0, 250);
  }

  return out as unknown as Requerimiento;
}

function sanitizeDetalleForFirestore(
  det: DetalleRequerimiento,
  userId: string,
  fbUser: FirebaseUser,
  preserveExistingFirebaseOwner: boolean = false
): Record<string, unknown> {
  const src = JSON.parse(JSON.stringify(det)) as Record<string, unknown>;
  const safeNumero =
    typeof src.numeroRequerimiento === 'string' && /^REQ-[0-9]+$/.test(src.numeroRequerimiento.trim())
      ? src.numeroRequerimiento.trim().slice(0, 32)
      : 'REQ-000001';

  const out: Record<string, unknown> = {
    id: toValidFirestoreId(src.id, `det-${Date.now()}`),
    requerimientoId: toValidFirestoreId(src.requerimientoId, 'req-0'),
    numeroRequerimiento: safeNumero,
    userId: toValidFirestoreId(userId, fbUser.uid),
    firebaseUid:
      preserveExistingFirebaseOwner && typeof src.firebaseUid === 'string' && src.firebaseUid.trim()
        ? toValidFirestoreId(src.firebaseUid.trim(), fbUser.uid)
        : toValidFirestoreId(fbUser.uid, fbUser.uid),
    comedor: String(src.comedor || 'Comedor 1').trim().slice(0, 60) || 'Comedor 1',
    paradero: String(src.paradero || 'PARADERO').trim().slice(0, 120) || 'PARADERO',
    cantidad: Math.min(Math.max(Math.floor(Number(src.cantidad) || 1), 1), 500),
  };

  const emailVal =
    preserveExistingFirebaseOwner && typeof src.firebaseEmail === 'string' && src.firebaseEmail.trim()
      ? src.firebaseEmail.trim()
      : fbUser.email || '';
  if (emailVal) out.firebaseEmail = emailVal.slice(0, 120);
  if (typeof src.parcela === 'string' && src.parcela.trim()) {
    out.parcela = src.parcela.trim().slice(0, 60);
  }
  if (src.zona === 'NORTE' || src.zona === 'SUR') {
    out.zona = src.zona;
  }
  if (typeof src.cultivo === 'string' && src.cultivo.trim()) {
    out.cultivo = src.cultivo.trim().slice(0, 60);
  }

  return out;
}

let isAuthListenerRegistered = false;
let unsubscribers: Unsubscribe[] = [];
const legacyDetallesCache = new Map<string, DetalleRequerimiento[]>();
const legacyDetallesPending = new Set<string>();
const knownFirestoreReqIds = new Set<string>();

export function hasKnownFirestoreReqId(id: string): boolean {
  return knownFirestoreReqIds.has(id);
}

type OnDataUpdate = (data: {
  requerimientos?: Requerimiento[];
  detalles?: DetalleRequerimiento[];
  isWindowed?: boolean;
  windowDesde?: string;
  users?: AppUser[];
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  zonas?: MaestroZona[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
  unidadesBus?: MaestroUnidadBus[];
}) => void;

let updateCallback: OnDataUpdate | null = null;
let onConnectedCallback: ((info: ReturnType<typeof getFirebaseUserInfo>) => void) | null = null;
let masterDataSeedProvider:
  | (() => {
      areas: MaestroArea[];
      fundos: MaestroFundo[];
      zonas: MaestroZona[];
      paraderos: MaestroParadero[];
      comedores: MaestroComedor[];
      unidadesBus: MaestroUnidadBus[];
    })
  | null = null;
const authStatusSubscribers = new Set<(info: ReturnType<typeof getFirebaseUserInfo>) => void>();
let pendingUpdates: Parameters<OnDataUpdate>[0] = {};
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function registerMasterDataSeedProvider(
  provider: () => {
    areas: MaestroArea[];
    fundos: MaestroFundo[];
    zonas: MaestroZona[];
    paraderos: MaestroParadero[];
    comedores: MaestroComedor[];
    unidadesBus: MaestroUnidadBus[];
  }
): void {
  masterDataSeedProvider = provider;
}

function notifyAuthSubscribers() {
  const info = getFirebaseUserInfo();
  authStatusSubscribers.forEach((cb) => {
    try {
      cb(info);
    } catch {
      // ignore
    }
  });
}

export function subscribeToFirebaseAuth(
  cb: (info: ReturnType<typeof getFirebaseUserInfo>) => void
): () => void {
  authStatusSubscribers.add(cb);
  cb(getFirebaseUserInfo());
  return () => {
    authStatusSubscribers.delete(cb);
  };
}

export function registerFirebaseConnectedCallback(
  cb: (info: ReturnType<typeof getFirebaseUserInfo>) => void
): void {
  onConnectedCallback = cb;
}

function scheduleDebouncedUpdate(data: Parameters<OnDataUpdate>[0]) {
  pendingUpdates = { ...pendingUpdates, ...data };
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
  }
  updateDebounceTimer = setTimeout(() => {
    updateDebounceTimer = null;
    if (updateCallback) {
      const payload = { ...pendingUpdates };
      pendingUpdates = {};
      updateCallback(payload);
    }
  }, 80);
}

export function registerFirestoreSyncCallback(cb: OnDataUpdate) {
  updateCallback = cb;
}

function cleanupListeners() {
  unsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // ignore
    }
  });
  unsubscribers = [];
}

function filterRequerimientosList(rawReqs: Requerimiento[]): Requerimiento[] {
  const cleaned = rawReqs.filter((r) => {
    const isLegacyDemo = r.id?.startsWith('req-uuid-') || /-ops-1\d\d$/.test(r.id || '');
    return !isLegacyDemo;
  });
  cleaned.sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
  return cleaned;
}

function filterDetallesList(rawDets: DetalleRequerimiento[]): DetalleRequerimiento[] {
  return rawDets.filter((det) => {
    const isLegacyDemo =
      det.id?.startsWith('det-001-') ||
      det.id?.startsWith('det-002-') ||
      det.id?.startsWith('det-003-') ||
      det.id?.startsWith('det-179040001') ||
      /-ops-1\d\d$/.test(det.requerimientoId || '');
    return !isLegacyDemo;
  });
}

async function resolveDetallesForRequerimientos(
  reqs: Requerimiento[],
  fbUser: FirebaseUser,
  isBootstrappedAdmin: boolean
): Promise<DetalleRequerimiento[]> {
  const result: DetalleRequerimiento[] = [];
  const missingLegacyReqIds: string[] = [];

  for (const r of reqs) {
    const expanded = expandCompactDetalles(r);
    if (expanded.length > 0) {
      result.push(...expanded);
      if (r.detallesCompactos && r.detallesCompactos.length >= 250) {
        const cached = legacyDetallesCache.get(r.id);
        if (cached) {
          const compactIds = new Set(expanded.map((d) => d.id));
          result.push(...cached.filter((d) => !compactIds.has(d.id)));
        }
      }
    } else {
      const cached = legacyDetallesCache.get(r.id);
      if (cached) {
        result.push(...cached);
      } else if (!legacyDetallesPending.has(r.id)) {
        missingLegacyReqIds.push(r.id);
      }
    }
  }

  if (missingLegacyReqIds.length > 0) {
    missingLegacyReqIds.forEach((id) => legacyDetallesPending.add(id));
    try {
      const CHUNK = 30;
      for (let i = 0; i < missingLegacyReqIds.length; i += CHUNK) {
        const batchIds = missingLegacyReqIds.slice(i, i + CHUNK);
        const detQuery = isBootstrappedAdmin
          ? query(collection(db, 'detalles'), where('requerimientoId', 'in', batchIds))
          : query(
              collection(db, 'detalles'),
              where('firebaseUid', '==', fbUser.uid)
            );
        const snap = await getDocs(detQuery);
        const grouped = new Map<string, DetalleRequerimiento[]>();
        snap.forEach((d) => {
          const det = d.data() as DetalleRequerimiento;
          if (!isBootstrappedAdmin && !batchIds.includes(det.requerimientoId)) return;
          const arr = grouped.get(det.requerimientoId) || [];
          arr.push(det);
          grouped.set(det.requerimientoId, arr);
        });
        batchIds.forEach((id) => {
          const list = grouped.get(id) || [];
          legacyDetallesCache.set(id, list);
          result.push(...list);
        });
      }
    } catch (err) {
      console.warn('[Firestore] Aviso cargando detalles heredados:', err);
    } finally {
      missingLegacyReqIds.forEach((id) => legacyDetallesPending.delete(id));
    }
  }

  return filterDetallesList(result);
}

function attachVerifiedListeners(firebaseUser: FirebaseUser) {
  cleanupListeners();
  const isBootstrappedAdmin =
    (firebaseUser.email || '').toLowerCase() === 'jhonatanparedes563@gmail.com';
  const rollingCutoff14 = getRollingCutoffDateStr(14);

  // 1. Requerimientos (ventana móvil de 14 días para Admin -> entrega instantánea y mínimo consumo de lecturas)
  const reqQuery = isBootstrappedAdmin
    ? query(collection(db, 'requerimientos'), where('fecha', '>=', rollingCutoff14))
    : query(collection(db, 'requerimientos'), where('firebaseUid', '==', firebaseUser.uid));

  const unsubReq = onSnapshot(
    reqQuery,
    (snapshot) => {
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const reqs: Requerimiento[] = [];
        const compactDets: DetalleRequerimiento[] = [];
        const missingIds: string[] = [];

        snapshot.forEach((d) => {
          const req = d.data() as Requerimiento;
          if (req?.id) knownFirestoreReqIds.add(req.id);
          reqs.push(req);
          const expanded = expandCompactDetalles(req);
          if (expanded.length > 0) {
            compactDets.push(...expanded);
          } else {
            const cached = legacyDetallesCache.get(req.id);
            if (cached) {
              compactDets.push(...cached);
            } else if (!legacyDetallesPending.has(req.id)) {
              missingIds.push(req.id);
            }
          }
        });

        if (!snapshot.metadata.fromCache) {
          firestoreServerVerified = true;
          lastFirestoreError = null;
          notifyAuthSubscribers();
        }
        const cleanedReqs = filterRequerimientosList(reqs);
        scheduleDebouncedUpdate({
          requerimientos: cleanedReqs,
          detalles: filterDetallesList(compactDets),
          isWindowed: isBootstrappedAdmin,
          ...(isBootstrappedAdmin ? { windowDesde: rollingCutoff14 } : {}),
        });

        if (missingIds.length > 0) {
          void resolveDetallesForRequerimientos(cleanedReqs, firebaseUser, isBootstrappedAdmin).then(
            (allResolvedDets) => {
              scheduleDebouncedUpdate({
                requerimientos: cleanedReqs,
                detalles: allResolvedDets,
                isWindowed: isBootstrappedAdmin,
                ...(isBootstrappedAdmin ? { windowDesde: rollingCutoff14 } : {}),
              });
            }
          );
        }
      }
    },
    (err) => {
      recordFirestoreErrorState(err, OperationType.LIST, 'requerimientos');
    }
  );
  unsubscribers.push(unsubReq);

  // 2. Metadatos y catálogos maestros
  const metaDoc = doc(db, 'system_metadata', 'master_data');
  const unsubMeta = onSnapshot(
    metaDoc,
    (snap) => {
      masterDataExistsInCloud = snap.exists();
      if (!snap.metadata.fromCache) {
        firestoreServerVerified = true;
        lastFirestoreError = null;
        notifyAuthSubscribers();
      }
      if (snap.exists()) {
        const data = snap.data();
        scheduleDebouncedUpdate({
          areas: data.areas,
          fundos: data.fundos,
          ...(Array.isArray(data.zonas) ? { zonas: data.zonas } : {}),
          paraderos: data.paraderos,
          comedores: data.comedores,
          ...(Array.isArray(data.unidadesBus) && data.unidadesBus.length > 0
            ? { unidadesBus: data.unidadesBus }
            : {}),
        });
      } else if (isBootstrappedAdmin) {
        void seedInitialMasterData();
      }
    },
    (err) => {
      recordFirestoreErrorState(err, OperationType.GET, 'system_metadata/master_data');
    }
  );
  unsubscribers.push(unsubMeta);

  // 3. Usuarios (solo Admin en la nube)
  if (isBootstrappedAdmin) {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudUsers: AppUser[] = [];
          snapshot.forEach((d) => {
            const u = d.data() as AppUser;
            cloudUsers.push({
              ...u,
              passwordHash: '',
              salt: '',
            });
          });
          if (cloudUsers.length > 0) {
            scheduleDebouncedUpdate({ users: cloudUsers });
          }
        }
      },
      (err) => {
        console.warn('[Firestore] Aviso leyendo usuarios:', err);
      }
    );
    unsubscribers.push(unsubUsers);
  }

  if (onConnectedCallback) {
    try {
      onConnectedCallback(getFirebaseUserInfo());
    } catch {
      // ignore
    }
  }
}

export async function initializeFirestoreSync(): Promise<void> {
  if (isAuthListenerRegistered) return;
  isAuthListenerRegistered = true;

  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser && firebaseUser.emailVerified) {
      attachVerifiedListeners(firebaseUser);
      void checkFirestoreServerConnection().then((health) => {
        firestoreServerVerified = health.ok;
        lastFirestoreError = health.ok ? null : (health.error || null);
        notifyAuthSubscribers();
      });
    } else {
      firestoreServerVerified = false;
      lastFirestoreError = null;
      cleanupListeners();
      notifyAuthSubscribers();
    }
  });
}

export async function connectWithGoogleFirebase(): Promise<{
  success: boolean;
  email?: string | null;
  error?: string;
  serverVerified?: boolean;
}> {
  try {
    lastFirestoreError = null;
    notifyAuthSubscribers();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    if (!cred.user || !cred.user.emailVerified) {
      return {
        success: false,
        error: 'La cuenta de Google seleccionada no tiene un correo verificado.',
      };
    }

    const health = await checkFirestoreServerConnection();
    firestoreServerVerified = health.ok;
    lastFirestoreError = health.ok ? null : (health.error || null);
    notifyAuthSubscribers();

    if (!health.ok && (health.permissionDenied || health.quotaExceeded)) {
      return {
        success: false,
        email: cred.user.email,
        error: health.error,
        serverVerified: false,
      };
    }

    attachVerifiedListeners(cred.user);
    return {
      success: true,
      email: cred.user.email,
      serverVerified: health.ok,
      ...(!health.ok && health.error ? { error: health.error } : {}),
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Inicio de sesión con Google cancelado.' };
    }
    if (code === 'auth/popup-blocked') {
      return {
        success: false,
        error: 'El navegador bloqueó la ventana emergente de Google. Permita ventanas emergentes para este sitio e intente nuevamente.',
      };
    }
    if (code === 'auth/unauthorized-domain') {
      const originHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const msg = `Dominio "${originHost}" no autorizado en Firebase Authentication (proyecto ${firebaseProjectId}). Agréguelo en Authorized domains en Firebase Console.`;
      lastFirestoreError = msg;
      notifyAuthSubscribers();
      return { success: false, error: msg };
    }
    const msg = formatFriendlyFirestoreError(err);
    lastFirestoreError = msg;
    notifyAuthSubscribers();
    return { success: false, error: msg || 'No se pudo conectar con Google Cloud Firestore.' };
  }
}

export async function disconnectGoogleFirebase(): Promise<void> {
  cleanupListeners();
  firestoreServerVerified = false;
  lastFirestoreError = null;
  await signOut(auth);
  notifyAuthSubscribers();
}

export async function firestorePullAllNow(): Promise<boolean> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser || !updateCallback) return false;

  const isBootstrappedAdmin =
    (fbUser.email || '').toLowerCase() === 'jhonatanparedes563@gmail.com';
  const cutoff30 = getRollingCutoffDateStr(30);

  try {
    const reqQuery = isBootstrappedAdmin
      ? query(collection(db, 'requerimientos'), where('fecha', '>=', cutoff30))
      : query(collection(db, 'requerimientos'), where('firebaseUid', '==', fbUser.uid));

    const [reqSnap, metaSnap, usersSnap] = await Promise.all([
      getDocsFromServer(reqQuery),
      getDocFromServer(doc(db, 'system_metadata', 'master_data')),
      isBootstrappedAdmin
        ? getDocsFromServer(collection(db, 'users')).catch(() => null)
        : Promise.resolve(null),
    ]);

    firestoreServerVerified = true;
    lastFirestoreError = null;
    masterDataExistsInCloud = metaSnap.exists();
    notifyAuthSubscribers();

    const reqs: Requerimiento[] = [];
    reqSnap.forEach((d) => {
      const req = d.data() as Requerimiento;
      if (req?.id) knownFirestoreReqIds.add(req.id);
      reqs.push(req);
    });
    const cleanedReqs = filterRequerimientosList(reqs);
    const resolvedDets = await resolveDetallesForRequerimientos(cleanedReqs, fbUser, isBootstrappedAdmin);

    const payload: Parameters<OnDataUpdate>[0] = {
      requerimientos: cleanedReqs,
      detalles: resolvedDets,
      isWindowed: isBootstrappedAdmin,
      ...(isBootstrappedAdmin ? { windowDesde: cutoff30 } : {}),
    };

    if (metaSnap && metaSnap.exists()) {
      const mData = metaSnap.data();
      if (Array.isArray(mData.areas)) payload.areas = mData.areas;
      if (Array.isArray(mData.fundos)) payload.fundos = mData.fundos;
      if (Array.isArray(mData.zonas)) payload.zonas = mData.zonas;
      if (Array.isArray(mData.paraderos)) payload.paraderos = mData.paraderos;
      if (Array.isArray(mData.comedores)) payload.comedores = mData.comedores;
      if (Array.isArray(mData.unidadesBus) && mData.unidadesBus.length > 0) {
        payload.unidadesBus = mData.unidadesBus;
      }
    }

    if (usersSnap && !usersSnap.empty) {
      const cloudUsers: AppUser[] = [];
      usersSnap.forEach((d) => {
        const u = d.data() as AppUser;
        cloudUsers.push({ ...u, passwordHash: '', salt: '' });
      });
      if (cloudUsers.length > 0) payload.users = cloudUsers;
    }

    updateCallback(payload);
    return true;
  } catch (err) {
    lastFirestoreError = formatFriendlyFirestoreError(err);
    firestoreServerVerified = false;
    notifyAuthSubscribers();
    console.warn('[Firestore] Error consultando datos en línea:', err);
    return false;
  }
}

export async function firestoreFetchByDateRange(
  desde?: string,
  hasta?: string
): Promise<{ requerimientos: Requerimiento[]; detalles: DetalleRequerimiento[] } | null> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return null;

  const isBootstrappedAdmin =
    (fbUser.email || '').toLowerCase() === 'jhonatanparedes563@gmail.com';

  try {
    let reqQuery;
    if (isBootstrappedAdmin) {
      if (desde && hasta) {
        reqQuery = query(
          collection(db, 'requerimientos'),
          where('fecha', '>=', desde),
          where('fecha', '<=', hasta)
        );
      } else if (desde) {
        reqQuery = query(collection(db, 'requerimientos'), where('fecha', '>=', desde));
      } else if (hasta) {
        reqQuery = query(collection(db, 'requerimientos'), where('fecha', '<=', hasta));
      } else {
        reqQuery = collection(db, 'requerimientos');
      }
    } else {
      reqQuery = query(collection(db, 'requerimientos'), where('firebaseUid', '==', fbUser.uid));
    }

    const reqSnap = await getDocsFromServer(reqQuery).catch(() => getDocs(reqQuery));
    let reqs: Requerimiento[] = [];
    reqSnap.forEach((d) => reqs.push(d.data() as Requerimiento));
    if (!isBootstrappedAdmin) {
      reqs = reqs.filter((r) => (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta));
    }
    const cleanedReqs = filterRequerimientosList(reqs);
    const detalles = await resolveDetallesForRequerimientos(cleanedReqs, fbUser, isBootstrappedAdmin);
    return { requerimientos: cleanedReqs, detalles };
  } catch (err) {
    console.warn('[Firestore] Error consultando histórico por rango:', err);
    return null;
  }
}

async function seedInitialMasterData() {
  if (!hasVerifiedFirebaseAuth()) return;
  try {
    const provided = masterDataSeedProvider ? masterDataSeedProvider() : null;
    await setDoc(doc(db, 'system_metadata', 'master_data'), {
      id: 'master_data',
      areas: provided?.areas?.length ? provided.areas : MAESTRO_AREAS,
      fundos: provided?.fundos?.length ? provided.fundos : MAESTRO_FUNDOS,
      zonas: provided?.zonas?.length ? provided.zonas : MAESTRO_ZONAS,
      paraderos: provided?.paraderos?.length ? provided.paraderos : MAESTRO_PARADEROS,
      comedores: provided?.comedores?.length ? provided.comedores : MAESTRO_COMEDORES,
      ...(provided?.unidadesBus?.length ? { unidadesBus: provided.unidadesBus } : {}),
      lastUpdated: new Date().toISOString(),
    });
    masterDataExistsInCloud = true;
    firestoreServerVerified = true;
    lastFirestoreError = null;
    notifyAuthSubscribers();
  } catch (err) {
    recordFirestoreErrorState(err, OperationType.WRITE, 'system_metadata/master_data');
  }
}

export async function firestoreSaveRequerimiento(
  req: Requerimiento,
  detalles: DetalleRequerimiento[],
  preserveExistingFirebaseOwner: boolean = false
): Promise<boolean> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return false;

  const path = `requerimientos/${req.id}`;
  const compact = buildCompactDetalles(detalles);
  const cleanReq = sanitizeRequerimientoForFirestore(req, fbUser, preserveExistingFirebaseOwner, compact);
  const ownerId = cleanReq.userId || fbUser.uid;
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Operación atómica de 1 sola escritura en Firestore para el 99.9% de casos (<= 250 paraderos)
      if (detalles.length <= 250) {
        await setDoc(doc(db, 'requerimientos', cleanReq.id), cleanReq);
        knownFirestoreReqIds.add(cleanReq.id);
        firestoreServerVerified = true;
        lastFirestoreError = null;
        notifyAuthSubscribers();
        return true;
      }

      // Respaldo extendido en /detalles sólo si supera los 250 paraderos compactos
      const CHUNK_SIZE = 400;
      const batches = [];
      const overflowDets = detalles.slice(250);
      const firstBatch = writeBatch(db);
      const reqRef = doc(db, 'requerimientos', cleanReq.id);
      firstBatch.set(reqRef, cleanReq);

      overflowDets.slice(0, CHUNK_SIZE).forEach((det) => {
        const detRef = doc(db, 'detalles', det.id);
        firstBatch.set(
          detRef,
          sanitizeDetalleForFirestore(det, ownerId, fbUser, preserveExistingFirebaseOwner)
        );
      });
      batches.push(firstBatch.commit());

      for (let i = CHUNK_SIZE; i < overflowDets.length; i += CHUNK_SIZE) {
        const nextBatch = writeBatch(db);
        overflowDets.slice(i, i + CHUNK_SIZE).forEach((det) => {
          const detRef = doc(db, 'detalles', det.id);
          nextBatch.set(
            detRef,
            sanitizeDetalleForFirestore(det, ownerId, fbUser, preserveExistingFirebaseOwner)
          );
        });
        batches.push(nextBatch.commit());
      }

      await Promise.all(batches);
      knownFirestoreReqIds.add(cleanReq.id);
      firestoreServerVerified = true;
      lastFirestoreError = null;
      notifyAuthSubscribers();
      return true;
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 250 + Math.random() * 120));
    }
  }
  return false;
}

export async function firestoreUpdateRequerimientoEstado(
  id: string,
  estado: Requerimiento['estado'],
  extraFields?: {
    updatedAt?: string;
    fechaAnulacion?: string;
    usuarioAnulacion?: string;
    motivoAnulacion?: string;
    historialTrazabilidad?: Requerimiento['historialTrazabilidad'];
  }
): Promise<boolean> {
  if (!hasVerifiedFirebaseAuth()) return false;
  const path = `requerimientos/${id}`;
  try {
    const reqRef = doc(db, 'requerimientos', id);
    const patch: Record<string, unknown> = {
      estado,
      updatedAt: (extraFields?.updatedAt || new Date().toISOString()).slice(0, 40),
    };
    if (extraFields?.fechaAnulacion) patch.fechaAnulacion = String(extraFields.fechaAnulacion).slice(0, 40);
    if (extraFields?.usuarioAnulacion) patch.usuarioAnulacion = String(extraFields.usuarioAnulacion).slice(0, 120);
    if (extraFields?.motivoAnulacion) patch.motivoAnulacion = String(extraFields.motivoAnulacion).slice(0, 300);
    if (Array.isArray(extraFields?.historialTrazabilidad)) {
      patch.historialTrazabilidad = extraFields.historialTrazabilidad.slice(-50);
    }
    await updateDoc(reqRef, patch);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function firestoreDeleteRequerimiento(
  id: string,
  numeroRequerimiento?: string
): Promise<boolean> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return false;
  const path = `requerimientos/${id}`;
  try {
    await deleteDoc(doc(db, 'requerimientos', id));

    const detQuery = query(collection(db, 'detalles'), where('requerimientoId', '==', id));
    const detsSnapshot = await getDocs(detQuery);
    const batch = writeBatch(db);
    let count = 0;

    detsSnapshot.forEach((d) => {
      const data = d.data() as DetalleRequerimiento;
      if (
        data.requerimientoId === id ||
        (numeroRequerimiento && data.numeroRequerimiento === numeroRequerimiento)
      ) {
        batch.delete(d.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function firestoreSaveUser(user: AppUser): Promise<boolean> {
  if (!hasVerifiedFirebaseAuth()) return false;
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), sanitizeUserForFirestore(user));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function firestoreDeleteUser(userId: string): Promise<boolean> {
  if (!hasVerifiedFirebaseAuth()) return false;
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function firestoreSaveMasterData(data: {
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  zonas?: MaestroZona[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
  unidadesBus?: MaestroUnidadBus[];
}): Promise<boolean> {
  if (!hasVerifiedFirebaseAuth()) return false;
  const path = 'system_metadata/master_data';
  try {
    const metaRef = doc(db, 'system_metadata', 'master_data');
    const allowedPayload: Record<string, unknown> = {
      id: 'master_data',
      lastUpdated: new Date().toISOString(),
    };
    if (Array.isArray(data.areas)) allowedPayload.areas = JSON.parse(JSON.stringify(data.areas)).slice(0, 200);
    if (Array.isArray(data.fundos)) allowedPayload.fundos = JSON.parse(JSON.stringify(data.fundos)).slice(0, 200);
    if (Array.isArray(data.zonas)) allowedPayload.zonas = JSON.parse(JSON.stringify(data.zonas)).slice(0, 200);
    if (Array.isArray(data.paraderos)) allowedPayload.paraderos = JSON.parse(JSON.stringify(data.paraderos)).slice(0, 500);
    if (Array.isArray(data.comedores)) allowedPayload.comedores = JSON.parse(JSON.stringify(data.comedores)).slice(0, 200);
    if (Array.isArray(data.unidadesBus)) allowedPayload.unidadesBus = JSON.parse(JSON.stringify(data.unidadesBus)).slice(0, 100);

    await setDoc(metaRef, allowedPayload, { merge: true });
    masterDataExistsInCloud = true;
    firestoreServerVerified = true;
    lastFirestoreError = null;
    notifyAuthSubscribers();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
