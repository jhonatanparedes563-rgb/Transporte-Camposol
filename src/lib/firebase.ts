import { initializeApp, getApps, getApp } from 'firebase/app';
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
  
  // En entornos de navegador, habilitar caché persistente multi-pestaña para
  // resistir alta concurrencia y conexiones inestables en campo
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
      // Si ya fue inicializado o no soporta IndexedDB multi-tab, obtener instancia existente
      return dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  }

  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

export const db: Firestore = createFirestoreInstance();

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_metadata', 'connection_test'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('[Firebase] Modo offline activo o base de datos conectando.');
    }
    return false;
  }
}

export { app };
