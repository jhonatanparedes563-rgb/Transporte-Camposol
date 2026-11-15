import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import {
  Requerimiento,
  DetalleRequerimiento,
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
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
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function hasVerifiedFirebaseAuth(): FirebaseUser | null {
  const user = auth.currentUser;
  return user && user.emailVerified ? user : null;
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

function sanitizeRequerimientoForFirestore(req: Requerimiento, fallbackUid: string): Requerimiento {
  const clean = JSON.parse(JSON.stringify(req)) as Record<string, unknown>;
  clean.userId = String(clean.userId || fallbackUid).slice(0, 128);
  clean.observaciones = String(clean.observaciones || '').slice(0, 500);
  clean.usuario = String(clean.usuario || '').slice(0, 120);
  clean.totalPersonas = Math.min(Math.max(Number(clean.totalPersonas) || 1, 1), 5000);
  if (Array.isArray(clean.parcelas)) clean.parcelas = clean.parcelas.slice(0, 50);
  if (Array.isArray(clean.historialTrazabilidad)) {
    clean.historialTrazabilidad = clean.historialTrazabilidad.slice(-50);
  }
  return clean as unknown as Requerimiento;
}

function sanitizeDetalleForFirestore(det: DetalleRequerimiento, userId: string): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(det)) as Record<string, unknown>;
  clean.userId = userId;
  clean.paradero = String(clean.paradero || '').slice(0, 120);
  clean.comedor = String(clean.comedor || '').slice(0, 60);
  clean.cantidad = Math.min(Math.max(Number(clean.cantidad) || 1, 1), 500);
  return clean;
}

let isAuthListenerRegistered = false;
let unsubscribers: Unsubscribe[] = [];

type OnDataUpdate = (data: {
  requerimientos?: Requerimiento[];
  detalles?: DetalleRequerimiento[];
  users?: AppUser[];
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  zonas?: MaestroZona[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
  unidadesBus?: MaestroUnidadBus[];
}) => void;

let updateCallback: OnDataUpdate | null = null;
let pendingUpdates: Parameters<OnDataUpdate>[0] = {};
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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
  }, 100);
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

function attachVerifiedListeners(firebaseUser: FirebaseUser) {
  cleanupListeners();
  const isBootstrappedAdmin = firebaseUser.email === 'jhonatanparedes563@gmail.com';

  // 1. Requerimientos (scoped to owner unless bootstrapped admin)
  const reqQuery = isBootstrappedAdmin
    ? collection(db, 'requerimientos')
    : query(collection(db, 'requerimientos'), where('userId', '==', firebaseUser.uid));

  const unsubReq = onSnapshot(
    reqQuery,
    (snapshot) => {
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const reqs: Requerimiento[] = [];
        snapshot.forEach((d) => {
          const r = d.data() as Requerimiento;
          const isLegacyDemo = r.id?.startsWith('req-uuid-') || /-ops-1\d\d$/.test(r.id || '');
          if (!isLegacyDemo) {
            reqs.push(r);
          }
        });
        reqs.sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
        scheduleDebouncedUpdate({ requerimientos: reqs });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'requerimientos');
    }
  );
  unsubscribers.push(unsubReq);

  // 2. Detalles (scoped to owner unless bootstrapped admin)
  const detQuery = isBootstrappedAdmin
    ? collection(db, 'detalles')
    : query(collection(db, 'detalles'), where('userId', '==', firebaseUser.uid));

  const unsubDet = onSnapshot(
    detQuery,
    (snapshot) => {
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const dets: DetalleRequerimiento[] = [];
        snapshot.forEach((d) => {
          const det = d.data() as DetalleRequerimiento;
          const isLegacyDemo =
            det.id?.startsWith('det-001-') ||
            det.id?.startsWith('det-002-') ||
            det.id?.startsWith('det-003-') ||
            det.id?.startsWith('det-179040001') ||
            /-ops-1\d\d$/.test(det.requerimientoId || '');
          if (!isLegacyDemo) {
            dets.push(det);
          }
        });
        scheduleDebouncedUpdate({ detalles: dets });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'detalles');
    }
  );
  unsubscribers.push(unsubDet);

  // 3. Metadatos y catálogos maestros (single document get/snapshot allowed for verified users)
  const metaDoc = doc(db, 'system_metadata', 'master_data');
  const unsubMeta = onSnapshot(
    metaDoc,
    (snap) => {
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
        seedInitialMasterData();
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, 'system_metadata/master_data');
    }
  );
  unsubscribers.push(unsubMeta);
}

/**
 * Inicializa observador de Firebase Auth. Sólo adjunta listeners en Firestore
 * cuando existe una sesión Firebase Auth verificada.
 */
export async function initializeFirestoreSync(): Promise<void> {
  if (isAuthListenerRegistered) return;
  isAuthListenerRegistered = true;

  onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser && firebaseUser.emailVerified) {
      attachVerifiedListeners(firebaseUser);
    } else {
      cleanupListeners();
    }
  });
}

async function seedInitialMasterData() {
  if (!hasVerifiedFirebaseAuth()) return;
  try {
    await setDoc(doc(db, 'system_metadata', 'master_data'), {
      id: 'master_data',
      areas: MAESTRO_AREAS,
      fundos: MAESTRO_FUNDOS,
      zonas: MAESTRO_ZONAS,
      paraderos: MAESTRO_PARADEROS,
      comedores: MAESTRO_COMEDORES,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Firestore] No se pudieron sembrar maestros:', err);
  }
}

export async function firestoreSaveRequerimiento(
  req: Requerimiento,
  detalles: DetalleRequerimiento[]
): Promise<void> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return;

  const path = `requerimientos/${req.id}`;
  const cleanReq = sanitizeRequerimientoForFirestore(req, fbUser.uid);
  const ownerId = cleanReq.userId || fbUser.uid;
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const CHUNK_SIZE = 400;
      const batches = [];
      const firstBatch = writeBatch(db);
      const reqRef = doc(db, 'requerimientos', req.id);
      firstBatch.set(reqRef, cleanReq);

      const firstChunk = detalles.slice(0, CHUNK_SIZE);
      firstChunk.forEach((det) => {
        const detRef = doc(db, 'detalles', det.id);
        firstBatch.set(detRef, sanitizeDetalleForFirestore(det, ownerId));
      });
      batches.push(firstBatch.commit());

      for (let i = CHUNK_SIZE; i < detalles.length; i += CHUNK_SIZE) {
        const nextBatch = writeBatch(db);
        const chunk = detalles.slice(i, i + CHUNK_SIZE);
        chunk.forEach((det) => {
          const detRef = doc(db, 'detalles', det.id);
          nextBatch.set(detRef, sanitizeDetalleForFirestore(det, ownerId));
        });
        batches.push(nextBatch.commit());
      }

      await Promise.all(batches);
      return;
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 200 + Math.random() * 100));
    }
  }
}

export async function firestoreUpdateRequerimientoEstado(
  id: string,
  estado: Requerimiento['estado']
): Promise<void> {
  if (!hasVerifiedFirebaseAuth()) return;
  const path = `requerimientos/${id}`;
  try {
    const reqRef = doc(db, 'requerimientos', id);
    await updateDoc(reqRef, {
      estado,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function firestoreDeleteRequerimiento(id: string, numeroRequerimiento?: string): Promise<void> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return;
  const path = `requerimientos/${id}`;
  try {
    await deleteDoc(doc(db, 'requerimientos', id));

    const detQuery = query(collection(db, 'detalles'), where('requerimientoId', '==', id));
    const detsSnapshot = await getDocs(detQuery);
    const batch = writeBatch(db);
    let count = 0;

    detsSnapshot.forEach((d) => {
      const data = d.data() as DetalleRequerimiento;
      if (data.requerimientoId === id || (numeroRequerimiento && data.numeroRequerimiento === numeroRequerimiento)) {
        batch.delete(d.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function firestoreSaveUser(user: AppUser): Promise<void> {
  if (!hasVerifiedFirebaseAuth()) return;
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), sanitizeUserForFirestore(user));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function firestoreDeleteUser(userId: string): Promise<void> {
  if (!hasVerifiedFirebaseAuth()) return;
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
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
}): Promise<void> {
  if (!hasVerifiedFirebaseAuth()) return;
  const path = 'system_metadata/master_data';
  try {
    const metaRef = doc(db, 'system_metadata', 'master_data');
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(
      metaRef,
      {
        id: 'master_data',
        ...cleanData,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
