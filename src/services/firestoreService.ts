import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Requerimiento,
  DetalleRequerimiento,
  AppUser,
  MaestroArea,
  MaestroFundo,
  MaestroParadero,
  MaestroComedor,
} from '../types';
import {
  INITIAL_REQUERIMIENTOS,
  INITIAL_DETALLES,
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from '../data/masterData';
import { INITIAL_USERS } from './authService';

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
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {},
  };
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let isInitialized = false;
let unsubscribers: Unsubscribe[] = [];

// Callbacks to notify app when Firestore data changes in real-time
type OnDataUpdate = (data: {
  requerimientos?: Requerimiento[];
  detalles?: DetalleRequerimiento[];
  users?: AppUser[];
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
}) => void;

let updateCallback: OnDataUpdate | null = null;

let pendingUpdates: {
  requerimientos?: Requerimiento[];
  detalles?: DetalleRequerimiento[];
  users?: AppUser[];
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
} = {};

let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDebouncedUpdate(data: typeof pendingUpdates) {
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

/**
 * Inicia la sincronización en tiempo real con Firestore y realiza el sembrado (seed)
 * inicial si la base de datos se encuentra vacía.
 */
export async function initializeFirestoreSync(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  try {
    // 1. Escuchar la colección de requerimientos en tiempo real con absorción de ráfagas
    const reqCol = collection(db, 'requerimientos');
    const unsubReq = onSnapshot(
      reqCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const reqs: Requerimiento[] = [];
          snapshot.forEach((d) => {
            reqs.push(d.data() as Requerimiento);
          });
          // Ordenar por fecha o número descendente
          reqs.sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
          scheduleDebouncedUpdate({ requerimientos: reqs });
        } else {
          // Si está vacía en Firestore, sembramos los iniciales
          seedInitialRequerimientos();
        }
      },
      (err) => {
        console.warn('[Firestore] Error en snapshot de requerimientos:', err);
      }
    );
    unsubscribers.push(unsubReq);

    // 2. Escuchar la colección de detalles en tiempo real
    const detCol = collection(db, 'detalles');
    const unsubDet = onSnapshot(
      detCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const dets: DetalleRequerimiento[] = [];
          snapshot.forEach((d) => {
            dets.push(d.data() as DetalleRequerimiento);
          });
          scheduleDebouncedUpdate({ detalles: dets });
        } else {
          seedInitialDetalles();
        }
      },
      (err) => {
        console.warn('[Firestore] Error en snapshot de detalles:', err);
      }
    );
    unsubscribers.push(unsubDet);

    // 3. Escuchar la colección de usuarios en tiempo real
    const usersCol = collection(db, 'users');
    const unsubUsers = onSnapshot(
      usersCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const users: AppUser[] = [];
          snapshot.forEach((d) => {
            users.push(d.data() as AppUser);
          });
          scheduleDebouncedUpdate({ users });
        } else {
          seedInitialUsers();
        }
      },
      (err) => {
        console.warn('[Firestore] Error en snapshot de usuarios:', err);
      }
    );
    unsubscribers.push(unsubUsers);

    // 4. Escuchar metadatos y catálogos maestros
    const metaDoc = doc(db, 'system_metadata', 'master_data');
    const unsubMeta = onSnapshot(
      metaDoc,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          scheduleDebouncedUpdate({
            areas: data.areas,
            fundos: data.fundos,
            paraderos: data.paraderos,
            comedores: data.comedores,
          });
        } else {
          seedInitialMasterData();
        }
      },
      (err) => {
        console.warn('[Firestore] Error en snapshot de maestros:', err);
      }
    );
    unsubscribers.push(unsubMeta);

    console.log('[CAMPOSOL] Conexión en tiempo real con Firebase Firestore establecida (Alta concurrencia activa).');
  } catch (error) {
    console.error('[Firestore] Error al inicializar sincronización:', error);
  }
}

// ----------------------------------------------------------------------
// FUNCIONES DE SIEMBRA INICIAL (SEED)
// ----------------------------------------------------------------------
async function seedInitialRequerimientos() {
  try {
    const batch = writeBatch(db);
    INITIAL_REQUERIMIENTOS.forEach((r) => {
      const docRef = doc(db, 'requerimientos', r.id);
      batch.set(docRef, r);
    });
    await batch.commit();
    console.log('[Firestore] Requerimientos iniciales sembrados en Firestore.');
  } catch (err) {
    console.warn('[Firestore] No se pudieron sembrar requerimientos:', err);
  }
}

async function seedInitialDetalles() {
  try {
    const batch = writeBatch(db);
    INITIAL_DETALLES.forEach((d) => {
      const docRef = doc(db, 'detalles', d.id);
      batch.set(docRef, d);
    });
    await batch.commit();
    console.log('[Firestore] Detalles iniciales sembrados en Firestore.');
  } catch (err) {
    console.warn('[Firestore] No se pudieron sembrar detalles:', err);
  }
}

async function seedInitialUsers() {
  try {
    const batch = writeBatch(db);
    INITIAL_USERS.forEach((u) => {
      const docRef = doc(db, 'users', u.id);
      batch.set(docRef, u);
    });
    await batch.commit();
    console.log('[Firestore] Usuarios iniciales sembrados en Firestore.');
  } catch (err) {
    console.warn('[Firestore] No se pudieron sembrar usuarios:', err);
  }
}

async function seedInitialMasterData() {
  try {
    await setDoc(doc(db, 'system_metadata', 'master_data'), {
      areas: MAESTRO_AREAS,
      fundos: MAESTRO_FUNDOS,
      paraderos: MAESTRO_PARADEROS,
      comedores: MAESTRO_COMEDORES,
      lastUpdated: new Date().toISOString(),
    });
    console.log('[Firestore] Maestros iniciales sembrados en Firestore.');
  } catch (err) {
    console.warn('[Firestore] No se pudieron sembrar maestros:', err);
  }
}

// ----------------------------------------------------------------------
// OPERACIONES DE ESCRITURA EN FIRESTORE
// ----------------------------------------------------------------------

/**
 * Guarda un requerimiento y todos sus detalles directamente en Firestore
 * con soporte para alta concurrencia, reintentos exponenciales y particionamiento de batches.
 */
export async function firestoreSaveRequerimiento(
  req: Requerimiento,
  detalles: DetalleRequerimiento[]
): Promise<void> {
  const path = `requerimientos/${req.id}`;
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Particionar en lotes de máximo 400 operaciones (el límite estricto de Firestore es 500)
      const CHUNK_SIZE = 400;
      const batches = [];
      const firstBatch = writeBatch(db);
      const reqRef = doc(db, 'requerimientos', req.id);
      firstBatch.set(reqRef, req);

      const firstChunk = detalles.slice(0, CHUNK_SIZE);
      firstChunk.forEach((det) => {
        const detRef = doc(db, 'detalles', det.id);
        firstBatch.set(detRef, det);
      });
      batches.push(firstBatch.commit());

      for (let i = CHUNK_SIZE; i < detalles.length; i += CHUNK_SIZE) {
        const nextBatch = writeBatch(db);
        const chunk = detalles.slice(i, i + CHUNK_SIZE);
        chunk.forEach((det) => {
          const detRef = doc(db, 'detalles', det.id);
          nextBatch.set(detRef, det);
        });
        batches.push(nextBatch.commit());
      }

      await Promise.all(batches);
      console.log('[Firestore] Requerimiento y detalles guardados con éxito en la nube:', req.numeroRequerimiento);
      return;
    } catch (err: any) {
      console.warn(`[Firestore] Intento ${attempt}/${maxAttempts} para requerimiento ${req.numeroRequerimiento} falló:`, err?.message || err);
      if (attempt >= maxAttempts) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      // Retroceso exponencial con fluctuación aleatoria (jitter)
      await new Promise((resolve) => setTimeout(resolve, attempt * 200 + Math.random() * 100));
    }
  }
}

/**
 * Actualiza el estado de un requerimiento en Firestore.
 */
export async function firestoreUpdateRequerimientoEstado(
  id: string,
  estado: Requerimiento['estado']
): Promise<void> {
  const path = `requerimientos/${id}`;
  try {
    const reqRef = doc(db, 'requerimientos', id);
    await updateDoc(reqRef, {
      estado,
      updatedAt: new Date().toISOString(),
    });
    console.log('[Firestore] Estado actualizado en la nube:', id, estado);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Elimina un requerimiento y sus detalles asociados en Firestore.
 */
export async function firestoreDeleteRequerimiento(id: string, numeroRequerimiento?: string): Promise<void> {
  const path = `requerimientos/${id}`;
  try {
    // 1. Eliminar doc principal
    await deleteDoc(doc(db, 'requerimientos', id));

    // 2. Buscar y eliminar detalles vinculados
    const detsSnapshot = await getDocs(collection(db, 'detalles'));
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
    console.log('[Firestore] Requerimiento y detalles eliminados en la nube:', id);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Guarda o actualiza un usuario en Firestore.
 */
export async function firestoreSaveUser(user: AppUser): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), user);
    console.log('[Firestore] Usuario persistido en la nube:', user.usuario);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Elimina un usuario de Firestore.
 */
export async function firestoreDeleteUser(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
    console.log('[Firestore] Usuario eliminado en la nube:', userId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Actualiza los maestros en Firestore.
 */
export async function firestoreSaveMasterData(data: {
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
}): Promise<void> {
  const path = 'system_metadata/master_data';
  try {
    const metaRef = doc(db, 'system_metadata', 'master_data');
    // Sanitizar datos para remover valores 'undefined' incompatibles con Firestore
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(
      metaRef,
      {
        ...cleanData,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('[Firestore] Catálogos maestros actualizados y sincronizados en la nube.');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
