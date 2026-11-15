import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

function createFirestoreInstance(): Firestore {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;

  if (typeof window !== 'undefined') {
    try {
      return initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        dbId
      );
    } catch {
      return dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  }

  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export const db: Firestore = createFirestoreInstance();
export const auth: Auth = getAuth(app);
export const firebaseProjectId: string = firebaseConfig.projectId;
export const firebaseDatabaseId: string = firebaseConfig.firestoreDatabaseId || '(default)';
export const firebaseAuthDomain: string = firebaseConfig.authDomain;

export interface FirestoreConnectionCheckResult {
  ok: boolean;
  projectId: string;
  databaseId: string;
  error?: string;
  errorCode?: string;
  offline?: boolean;
  permissionDenied?: boolean;
  quotaExceeded?: boolean;
}

export async function checkFirestoreServerConnection(): Promise<FirestoreConnectionCheckResult> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return {
      ok: false,
      projectId: firebaseProjectId,
      databaseId: firebaseDatabaseId,
      error: 'Inicie sesión con Google para conectar con Cloud Firestore.',
      errorCode: 'auth/not-signed-in',
    };
  }
  try {
    await getDocFromServer(doc(db, 'system_metadata', 'master_data'));
    return {
      ok: true,
      projectId: firebaseProjectId,
      databaseId: firebaseDatabaseId,
    };
  } catch (error: any) {
    const code = String(error?.code || '');
    const msg = String(error?.message || error || '');
    const lower = msg.toLowerCase();
    const offline =
      code === 'unavailable' ||
      lower.includes('the client is offline') ||
      lower.includes('network') ||
      lower.includes('failed to fetch');
    const quotaExceeded =
      code === 'resource-exhausted' ||
      lower.includes('quota exceeded') ||
      lower.includes('free daily read units');
    const permissionDenied =
      code === 'permission-denied' ||
      lower.includes('missing or insufficient permissions');

    let friendly = msg;
    if (quotaExceeded) {
      friendly =
        'Cuota diaria gratuita de Firebase Spark excedida (Quota exceeded). Se restablece al día siguiente.';
    } else if (permissionDenied) {
      friendly =
        'Permiso denegado en Firestore. Verifique las reglas de seguridad o que su correo esté verificado.';
    } else if (offline) {
      friendly =
        'Sin conexión a internet o el cliente Firestore está fuera de línea.';
    }

    return {
      ok: false,
      projectId: firebaseProjectId,
      databaseId: firebaseDatabaseId,
      error: friendly,
      errorCode: code || undefined,
      offline,
      permissionDenied,
      quotaExceeded,
    };
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  const res = await checkFirestoreServerConnection();
  return res.ok;
}

export { app };
