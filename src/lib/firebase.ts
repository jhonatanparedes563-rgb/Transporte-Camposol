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

export async function testFirestoreConnection(): Promise<boolean> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'system_metadata', 'master_data'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('[Firebase] Modo offline activo o base de datos conectando.');
    }
    return false;
  }
}

export { app };
