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

export function isFirestoreAuthenticated(): boolean {
  return Boolean(hasVerifiedFirebaseAuth());
}

export function getFirebaseUserInfo(): {
  connected: boolean;
  uid: string | null;
  email: string | null;
  displayName: string | null;
  isBootstrappedAdmin: boolean;
} {
  const u = hasVerifiedFirebaseAuth();
  return {
    connected: Boolean(u),
    uid: u?.uid ?? null,
    email: u?.email ?? null,
    displayName: u?.displayName ?? null,
    isBootstrappedAdmin: Boolean(u?.email && u.email.toLowerCase() === 'jhonatanparedes563@gmail.com'),
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

function sanitizeRequerimientoForFirestore(
  req: Requerimiento,
  fbUser: FirebaseUser,
  preserveExistingFirebaseOwner: boolean = false
): Requerimiento {
  const clean = JSON.parse(JSON.stringify(req)) as Record<string, unknown>;
  clean.userId = String(clean.userId || fbUser.uid).slice(0, 128);
  clean.firebaseUid =
    preserveExistingFirebaseOwner && typeof clean.firebaseUid === 'string' && clean.firebaseUid.trim()
      ? clean.firebaseUid.trim().slice(0, 128)
      : fbUser.uid;
  const emailVal =
    preserveExistingFirebaseOwner && typeof clean.firebaseEmail === 'string' && clean.firebaseEmail.trim()
      ? clean.firebaseEmail.trim()
      : fbUser.email || '';
  if (emailVal) {
    clean.firebaseEmail = emailVal.slice(0, 120);
  } else {
    delete clean.firebaseEmail;
  }
  clean.observaciones = String(clean.observaciones || '').slice(0, 500);
  clean.usuario = String(clean.usuario || '').slice(0, 120);
  clean.totalPersonas = Math.min(Math.max(Number(clean.totalPersonas) || 1, 1), 5000);
  if (Array.isArray(clean.parcelas)) clean.parcelas = clean.parcelas.slice(0, 50);
  if (Array.isArray(clean.historialTrazabilidad)) {
    clean.historialTrazabilidad = clean.historialTrazabilidad.slice(-50);
  }
  return clean as unknown as Requerimiento;
}

function sanitizeDetalleForFirestore(
  det: DetalleRequerimiento,
  userId: string,
  fbUser: FirebaseUser,
  preserveExistingFirebaseOwner: boolean = false
): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(det)) as Record<string, unknown>;
  clean.userId = userId;
  clean.firebaseUid =
    preserveExistingFirebaseOwner && typeof clean.firebaseUid === 'string' && clean.firebaseUid.trim()
      ? clean.firebaseUid.trim().slice(0, 128)
      : fbUser.uid;
  const emailVal =
    preserveExistingFirebaseOwner && typeof clean.firebaseEmail === 'string' && clean.firebaseEmail.trim()
      ? clean.firebaseEmail.trim()
      : fbUser.email || '';
  if (emailVal) {
    clean.firebaseEmail = emailVal.slice(0, 120);
  } else {
    delete clean.firebaseEmail;
  }
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
let onConnectedCallback: ((info: ReturnType<typeof getFirebaseUserInfo>) => void) | null = null;
const authStatusSubscribers = new Set<(info: ReturnType<typeof getFirebaseUserInfo>) => void>();
let pendingUpdates: Parameters<OnDataUpdate>[0] = {};
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

function attachVerifiedListeners(firebaseUser: FirebaseUser) {
  cleanupListeners();
  const isBootstrappedAdmin =
    (firebaseUser.email || '').toLowerCase() === 'jhonatanparedes563@gmail.com';

  // 1. Requerimientos (scoped to owner firebaseUid unless bootstrapped admin)
  const reqQuery = isBootstrappedAdmin
    ? collection(db, 'requerimientos')
    : query(collection(db, 'requerimientos'), where('firebaseUid', '==', firebaseUser.uid));

  const unsubReq = onSnapshot(
    reqQuery,
    (snapshot) => {
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const reqs: Requerimiento[] = [];
        snapshot.forEach((d) => {
          reqs.push(d.data() as Requerimiento);
        });
        scheduleDebouncedUpdate({ requerimientos: filterRequerimientosList(reqs) });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'requerimientos');
    }
  );
  unsubscribers.push(unsubReq);

  // 2. Detalles (scoped to owner firebaseUid unless bootstrapped admin)
  const detQuery = isBootstrappedAdmin
    ? collection(db, 'detalles')
    : query(collection(db, 'detalles'), where('firebaseUid', '==', firebaseUser.uid));

  const unsubDet = onSnapshot(
    detQuery,
    (snapshot) => {
      if (!snapshot.empty || !snapshot.metadata.fromCache) {
        const dets: DetalleRequerimiento[] = [];
        snapshot.forEach((d) => {
          dets.push(d.data() as DetalleRequerimiento);
        });
        scheduleDebouncedUpdate({ detalles: filterDetallesList(dets) });
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'detalles');
    }
  );
  unsubscribers.push(unsubDet);

  // 3. Metadatos y catálogos maestros
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

  // 4. Usuarios (solo Admin en la nube)
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
    notifyAuthSubscribers();
    if (firebaseUser && firebaseUser.emailVerified) {
      attachVerifiedListeners(firebaseUser);
    } else {
      cleanupListeners();
    }
  });
}

export async function connectWithGoogleFirebase(): Promise<{
  success: boolean;
  email?: string | null;
  error?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    if (!cred.user || !cred.user.emailVerified) {
      return {
        success: false,
        error: 'La cuenta de Google seleccionada no tiene un correo verificado.',
      };
    }
    notifyAuthSubscribers();
    attachVerifiedListeners(cred.user);
    return { success: true, email: cred.user.email };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { success: false, error: 'Inicio de sesión con Google cancelado.' };
    }
    if (code === 'auth/unauthorized-domain') {
      return {
        success: false,
        error:
          'Este dominio no está autorizado en Firebase Authentication (Authorized domains). Agregue su dominio de GitHub Pages en Firebase Console.',
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || 'No se pudo conectar con Google Cloud Firestore.' };
  }
}

export async function disconnectGoogleFirebase(): Promise<void> {
  cleanupListeners();
  await signOut(auth);
  notifyAuthSubscribers();
}

export async function firestorePullAllNow(): Promise<boolean> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser || !updateCallback) return false;

  const isBootstrappedAdmin =
    (fbUser.email || '').toLowerCase() === 'jhonatanparedes563@gmail.com';

  try {
    const reqQuery = isBootstrappedAdmin
      ? collection(db, 'requerimientos')
      : query(collection(db, 'requerimientos'), where('firebaseUid', '==', fbUser.uid));
    const detQuery = isBootstrappedAdmin
      ? collection(db, 'detalles')
      : query(collection(db, 'detalles'), where('firebaseUid', '==', fbUser.uid));

    const [reqSnap, detSnap, metaSnap, usersSnap] = await Promise.all([
      getDocsFromServer(reqQuery).catch(() => getDocs(reqQuery)),
      getDocsFromServer(detQuery).catch(() => getDocs(detQuery)),
      getDocFromServer(doc(db, 'system_metadata', 'master_data')).catch(() =>
        getDoc(doc(db, 'system_metadata', 'master_data'))
      ),
      isBootstrappedAdmin
        ? getDocsFromServer(collection(db, 'users')).catch(() => getDocs(collection(db, 'users')))
        : Promise.resolve(null),
    ]);

    const reqs: Requerimiento[] = [];
    reqSnap.forEach((d) => reqs.push(d.data() as Requerimiento));

    const dets: DetalleRequerimiento[] = [];
    detSnap.forEach((d) => dets.push(d.data() as DetalleRequerimiento));

    const payload: Parameters<OnDataUpdate>[0] = {
      requerimientos: filterRequerimientosList(reqs),
      detalles: filterDetallesList(dets),
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
    console.warn('[Firestore] Error consultando datos en línea:', err);
    return false;
  }
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
  detalles: DetalleRequerimiento[],
  preserveExistingFirebaseOwner: boolean = false
): Promise<boolean> {
  const fbUser = hasVerifiedFirebaseAuth();
  if (!fbUser) return false;

  const path = `requerimientos/${req.id}`;
  const cleanReq = sanitizeRequerimientoForFirestore(req, fbUser, preserveExistingFirebaseOwner);
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
        firstBatch.set(
          detRef,
          sanitizeDetalleForFirestore(det, ownerId, fbUser, preserveExistingFirebaseOwner)
        );
      });
      batches.push(firstBatch.commit());

      for (let i = CHUNK_SIZE; i < detalles.length; i += CHUNK_SIZE) {
        const nextBatch = writeBatch(db);
        const chunk = detalles.slice(i, i + CHUNK_SIZE);
        chunk.forEach((det) => {
          const detRef = doc(db, 'detalles', det.id);
          nextBatch.set(
            detRef,
            sanitizeDetalleForFirestore(det, ownerId, fbUser, preserveExistingFirebaseOwner)
          );
        });
        batches.push(nextBatch.commit());
      }

      await Promise.all(batches);
      return true;
    } catch (err: unknown) {
      if (attempt >= maxAttempts) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 200 + Math.random() * 100));
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
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
