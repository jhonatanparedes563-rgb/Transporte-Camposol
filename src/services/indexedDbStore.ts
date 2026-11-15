import { Requerimiento, DetalleRequerimiento, ProgramacionViajesDia } from '../types';

const IDB_NAME = 'camposol_tdp_longterm_v2';
const IDB_VERSION = 1;

const STORE_REQS = 'requerimientos';
const STORE_DETS = 'detalles';
const STORE_PROGS = 'programaciones';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_REQS)) {
          const reqStore = db.createObjectStore(STORE_REQS, { keyPath: 'id' });
          reqStore.createIndex('fecha', 'fecha', { unique: false });
          reqStore.createIndex('fechaRegistro', 'fechaRegistro', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DETS)) {
          const detStore = db.createObjectStore(STORE_DETS, { keyPath: 'id' });
          detStore.createIndex('requerimientoId', 'requerimientoId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PROGS)) {
          const progStore = db.createObjectStore(STORE_PROGS, { keyPath: 'id' });
          progStore.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function idbLoadSnapshot(): Promise<{
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  programaciones: ProgramacionViajesDia[];
} | null> {
  const db = await openIndexedDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_REQS, STORE_DETS, STORE_PROGS], 'readonly');
      const rReq = tx.objectStore(STORE_REQS).getAll();
      const dReq = tx.objectStore(STORE_DETS).getAll();
      const pReq = tx.objectStore(STORE_PROGS).getAll();

      tx.oncomplete = () => {
        const reqs = Array.isArray(rReq.result) ? (rReq.result as Requerimiento[]) : [];
        const dets = Array.isArray(dReq.result) ? (dReq.result as DetalleRequerimiento[]) : [];
        const progs = Array.isArray(pReq.result) ? (pReq.result as ProgramacionViajesDia[]) : [];
        reqs.sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
        resolve({ requerimientos: reqs, detalles: dets, programaciones: progs });
      };
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbPutRequerimientos(reqs: Requerimiento[], replaceAll: boolean = false): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_REQS], 'readwrite');
      const store = tx.objectStore(STORE_REQS);
      if (replaceAll) {
        store.clear();
      }
      for (const r of reqs) {
        if (r && r.id) store.put(r);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbPutDetalles(dets: DetalleRequerimiento[], replaceAll: boolean = false): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_DETS], 'readwrite');
      const store = tx.objectStore(STORE_DETS);
      if (replaceAll) {
        store.clear();
      }
      for (const d of dets) {
        if (d && d.id) store.put(d);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbDeleteRequerimiento(id: string): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_REQS, STORE_DETS], 'readwrite');
      tx.objectStore(STORE_REQS).delete(id);
      const detIndex = tx.objectStore(STORE_DETS).index('requerimientoId');
      const cursorReq = detIndex.openCursor(IDBKeyRange.only(id));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function idbPutProgramaciones(progs: ProgramacionViajesDia[], replaceAll: boolean = true): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PROGS], 'readwrite');
      const store = tx.objectStore(STORE_PROGS);
      if (replaceAll) {
        store.clear();
      }
      for (const p of progs) {
        if (p && p.id) store.put(p);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
