import {
  Requerimiento,
  DetalleRequerimiento,
  RequerimientoDraft,
  MaestroArea,
  MaestroFundo,
  MaestroParadero,
  MaestroComedor,
  AppUser,
} from '../types';
import {
  INITIAL_REQUERIMIENTOS,
  INITIAL_DETALLES,
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from '../data/masterData';
import {
  initializeFirestoreSync,
  registerFirestoreSyncCallback,
  firestoreSaveRequerimiento,
  firestoreUpdateRequerimientoEstado,
  firestoreDeleteRequerimiento,
  firestoreSaveMasterData,
} from './firestoreService';

const REQ_STORAGE_KEY = 'camposol_transporte_requerimientos_v1';
const DET_STORAGE_KEY = 'camposol_transporte_detalles_v1';
const AREAS_STORAGE_KEY = 'camposol_maestro_areas_v1';
const FUNDOS_STORAGE_KEY = 'camposol_maestro_fundos_v1';
const PARADEROS_STORAGE_KEY = 'camposol_maestro_paraderos_v1';
const COMEDORES_STORAGE_KEY = 'camposol_maestro_comedores_v1';
const USERS_STORAGE_KEY = 'camposol_users_v2';
const LAST_REVISION_KEY = 'camposol_last_revision_v1';

// Internal sync state
let isSyncing = false;
let isOnline = true;
let lastSyncDate: Date | null = null;
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('camposol_cloud_sync_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_EVENT') {
        notifyListeners();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel not supported or restricted:', e);
  }
}

// Global listeners for data updates
const listeners: Array<() => void> = [];
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeToDataChanges(callback: () => void): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
  }
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('camposol_data_changed'));
    }
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in sync listener callback:', e);
      }
    });
  }, 60);
}

function broadcastLocalChange(): void {
  notifyListeners();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'SYNC_EVENT', timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
}

// Conexión y sincronización en tiempo real con Firebase Firestore
if (typeof window !== 'undefined') {
  registerFirestoreSyncCallback((payload) => {
    let changed = false;
    if (payload.requerimientos && Array.isArray(payload.requerimientos)) {
      localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(payload.requerimientos));
      changed = true;
    }
    if (payload.detalles && Array.isArray(payload.detalles)) {
      localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(payload.detalles));
      changed = true;
    }
    if (payload.users && Array.isArray(payload.users)) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(payload.users));
      changed = true;
    }
    if (payload.areas && Array.isArray(payload.areas)) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(payload.areas));
      changed = true;
    }
    if (payload.fundos && Array.isArray(payload.fundos)) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(payload.fundos));
      changed = true;
    }
    if (payload.paraderos && Array.isArray(payload.paraderos)) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(payload.paraderos));
      changed = true;
    }
    if (payload.comedores && Array.isArray(payload.comedores)) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(payload.comedores));
      changed = true;
    }
    if (changed) {
      isOnline = true;
      lastSyncDate = new Date();
      notifyListeners();
    }
  });

  // Iniciar la escucha en segundo plano
  initializeFirestoreSync().catch((err) => {
    console.warn('[Firestore] Inicialización diferida:', err);
  });
}

// -------------------------------------------------------------
// CLOUD SERVER SYNC ENGINE
// -------------------------------------------------------------
export async function syncWithServerNow(): Promise<boolean> {
  if (typeof window === 'undefined' || isSyncing) return false;
  isSyncing = true;

  try {
    const res = await fetch('/api/data', {
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!res.ok) {
      isOnline = false;
      isSyncing = false;
      return false;
    }

    const data = await res.json();
    isOnline = true;
    lastSyncDate = new Date();

    if (data.requerimientos && Array.isArray(data.requerimientos)) {
      localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(data.requerimientos));
    }
    if (data.detalles && Array.isArray(data.detalles)) {
      localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(data.detalles));
    }
    if (data.users && Array.isArray(data.users)) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data.users));
    }
    if (data.areas && Array.isArray(data.areas)) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(data.areas));
    }
    if (data.fundos && Array.isArray(data.fundos)) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(data.fundos));
    }
    if (data.paraderos && Array.isArray(data.paraderos)) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(data.paraderos));
    }
    if (data.comedores && Array.isArray(data.comedores)) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(data.comedores));
    }
    if (data.revision) {
      localStorage.setItem(LAST_REVISION_KEY, String(data.revision));
    }

    notifyListeners();
    isSyncing = false;
    return true;
  } catch (err) {
    isOnline = false;
    isSyncing = false;
    return false;
  }
}

export function getSyncInfo() {
  return {
    isOnline,
    isSyncing,
    lastSync: lastSyncDate,
    revision: Number(localStorage.getItem(LAST_REVISION_KEY) || '1'),
  };
}

// Background poller: Checks every 3.5s if the web database has been updated by other users/devices
if (typeof window !== 'undefined') {
  let isChecking = false;

  const pollServer = async () => {
    if (isChecking || isSyncing) return;
    isChecking = true;

    try {
      const res = await fetch('/api/sync/version', {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.ok) {
        isOnline = true;
        const info = await res.json();
        const localRev = Number(localStorage.getItem(LAST_REVISION_KEY) || '0');

        if (info.revision && info.revision > localRev) {
          console.log('[SYNC] Nueva versión detectada en la web:', info.revision, 'Sincronizando...');
          await syncWithServerNow();
        }
      }
    } catch {
      // Ignore network errors in background polling
    } finally {
      isChecking = false;
    }
  };

  // Run initial sync shortly after load
  setTimeout(() => {
    syncWithServerNow();
  }, 400);

  // Periodic poll
  setInterval(pollServer, 20000);

  // Sync when window regains focus or reconnects
  window.addEventListener('focus', () => {
    pollServer();
  });
  window.addEventListener('online', () => {
    isOnline = true;
    syncWithServerNow();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

// -------------------------------------------------------------
// REQUERIMIENTOS & DETALLES
// -------------------------------------------------------------
export function getStoredRequerimientos(): Requerimiento[] {
  try {
    const raw = localStorage.getItem(REQ_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(INITIAL_REQUERIMIENTOS));
      return INITIAL_REQUERIMIENTOS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading requerimientos:', err);
    return INITIAL_REQUERIMIENTOS;
  }
}

export function getStoredDetalles(): DetalleRequerimiento[] {
  try {
    const raw = localStorage.getItem(DET_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(INITIAL_DETALLES));
      return INITIAL_DETALLES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading detalles:', err);
    return INITIAL_DETALLES;
  }
}

export function getDetallesByRequerimientoId(requerimientoId: string): DetalleRequerimiento[] {
  const allDetalles = getStoredDetalles();
  return allDetalles.filter((d) => d.requerimientoId === requerimientoId);
}

// Genera automáticamente números consecutivos: REQ-000001, REQ-000002...
export function generateNextNumeroRequerimiento(): string {
  const reqs = getStoredRequerimientos();
  let maxNum = 0;
  for (const r of reqs) {
    const match = r.numeroRequerimiento.match(/REQ-(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  const nextVal = maxNum + 1;
  return `REQ-${nextVal.toString().padStart(6, '0')}`;
}

// Guardar nuevo requerimiento y sus registros de detalle independientes
export function saveNewRequerimiento(
  draft: RequerimientoDraft,
  currentUser?: AppUser | string
): {
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
} {
  const nextNumero = generateNextNumeroRequerimiento();
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Calculate total personas and generate detalles
  let totalPersonas = 0;
  const newDetalles: DetalleRequerimiento[] = [];

  if (draft.comedores && draft.comedores.length > 0) {
    draft.comedores.forEach((c) => {
      Object.entries(c.paraderosCantidades || {}).forEach(([paradero, rawQty]) => {
        const cantidad = Number(rawQty) || 0;
        if (cantidad > 0) {
          totalPersonas += cantidad;
          newDetalles.push({
            id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            requerimientoId: reqId,
            numeroRequerimiento: nextNumero,
            comedor: c.comedor || 'Comedor 1',
            parcela: c.comedor || 'Comedor 1',
            paradero: paradero,
            zona: inferParaderoZona(paradero),
            cultivo: draft.cultivo || 'ARÁNDANO',
            cantidad: cantidad,
          });
        }
      });
    });
  } else if (draft.cantidadesPorParadero && Object.keys(draft.cantidadesPorParadero).length > 0) {
    Object.entries(draft.cantidadesPorParadero).forEach(([paradero, rawQty]) => {
      const cantidad = Number(rawQty) || 0;
      if (cantidad > 0) {
        totalPersonas += cantidad;
        const z = inferParaderoZona(paradero);
        newDetalles.push({
          id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          requerimientoId: reqId,
          numeroRequerimiento: nextNumero,
          comedor: 'Comedor General',
          paradero: paradero,
          zona: z,
          cultivo: draft.cultivo || 'ARÁNDANO',
          cantidad: cantidad,
        });
      }
    });
  } else if (draft.matrizCantidades && Object.keys(draft.matrizCantidades).length > 0) {
    Object.entries(draft.matrizCantidades).forEach(([paradero, parcelasMap]) => {
      const z = inferParaderoZona(paradero);
      Object.entries(parcelasMap).forEach(([parcela, cantidad]) => {
        if (cantidad > 0) {
          totalPersonas += cantidad;
          newDetalles.push({
            id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            requerimientoId: reqId,
            numeroRequerimiento: nextNumero,
            comedor: parcela,
            parcela: parcela,
            paradero: paradero,
            zona: z,
            cultivo: draft.cultivo || 'ARÁNDANO',
            cantidad: cantidad,
          });
        }
      });
    });
  }

  const isUserObj = typeof currentUser === 'object' && currentUser !== null;
  const userName = isUserObj
    ? currentUser.nombre
    : typeof currentUser === 'string' && currentUser.trim()
    ? currentUser
    : 'Supervisor de Campo';
  const userId = isUserObj ? currentUser.id : undefined;
  const userUsername = isUserObj ? currentUser.usuario : undefined;

  const newRequerimiento: Requerimiento = {
    id: reqId,
    numeroRequerimiento: nextNumero,
    fecha: draft.fecha,
    area: draft.area || 'PRODUCCIÓN',
    fundo: draft.fundo,
    cultivo: draft.cultivo || 'ARÁNDANO',
    parcelas: draft.parcelas || [],
    movimiento: draft.movimiento,
    horaRecojo: draft.horaRecojo,
    horaSalida: draft.horaSalida || draft.horaRecojo,
    observaciones: draft.observaciones.trim(),
    usuario: userName,
    userId: userId,
    userUsername: userUsername,
    userRole: isUserObj ? currentUser.rol : undefined,
    fechaRegistro: new Date().toISOString(),
    totalPersonas: totalPersonas,
    estado: 'PENDIENTE',
  };

  // 1. Guardar de inmediato en localStorage para respuesta instantánea
  const existingReqs = getStoredRequerimientos();
  const updatedReqs = [newRequerimiento, ...existingReqs];
  localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(updatedReqs));

  const existingDets = getStoredDetalles();
  const updatedDets = [...existingDets, ...newDetalles];
  localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(updatedDets));

  // Notificar cambios localmente
  broadcastLocalChange();

  // 2. Persistir en la base de datos Cloud de Firebase Firestore
  firestoreSaveRequerimiento(newRequerimiento, newDetalles).catch((err) => {
    console.warn('[Firestore] Error guardando en la nube:', err);
  });

  // 3. Persistir también en el servidor web (Cloud Express Backup)
  fetch('/api/requerimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requerimiento: newRequerimiento,
      detalles: newDetalles,
      currentUser,
    }),
  })
    .then(async (res) => {
      if (res.ok) {
        const json = await res.json();
        if (json.revision) {
          localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
        }
        console.log('[SYNC] Requerimiento transmitido con éxito al servidor web:', newRequerimiento.numeroRequerimiento);
      }
    })
    .catch((err) => {
      console.warn('[SYNC] Servidor web no accesible temporalmente, almacenado en cola local:', err);
    });

  return {
    requerimiento: newRequerimiento,
    detalles: newDetalles,
  };
}

export function updateRequerimientoEstado(id: string, nuevoEstado: Requerimiento['estado']) {
  const reqs = getStoredRequerimientos();
  const updated = reqs.map((r) => (r.id === id ? { ...r, estado: nuevoEstado } : r));
  localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(updated));

  broadcastLocalChange();

  // Actualizar en Firebase Firestore
  firestoreUpdateRequerimientoEstado(id, nuevoEstado).catch((err) => {
    console.warn('[Firestore] Error actualizando estado en Firestore:', err);
  });

  fetch(`/api/requerimientos/${encodeURIComponent(id)}/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: nuevoEstado }),
  })
    .then(async (res) => {
      if (res.ok) {
        const json = await res.json();
        if (json.revision) {
          localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
        }
      }
    })
    .catch((err) => {
      console.warn('[SYNC] Error actualizando estado en servidor:', err);
    });
}

// Eliminar un requerimiento del almacenamiento local y del servidor web
export function deleteRequerimiento(id: string): boolean {
  try {
    const reqs = getStoredRequerimientos();
    const target = reqs.find((r) => r.id === id || r.numeroRequerimiento === id);
    if (!target) return false;

    const filteredReqs = reqs.filter((r) => r.id !== target.id && r.numeroRequerimiento !== target.numeroRequerimiento);
    localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(filteredReqs));

    const dets = getStoredDetalles();
    const filteredDets = dets.filter(
      (d) => d.requerimientoId !== target.id && d.numeroRequerimiento !== target.numeroRequerimiento
    );
    localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(filteredDets));

    broadcastLocalChange();

    // Eliminar en Firebase Firestore
    firestoreDeleteRequerimiento(target.id, target.numeroRequerimiento).catch((err) => {
      console.warn('[Firestore] Error eliminando en Firestore:', err);
    });

    // Eliminar también en el servidor web (Cloud)
    fetch(`/api/requerimientos/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
    })
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          if (json.revision) {
            localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
          }
          console.log('[SYNC] Requerimiento eliminado del servidor web:', target.numeroRequerimiento);
        }
      })
      .catch((err) => {
        console.warn('[SYNC] Error al eliminar en el servidor web:', err);
      });

    return true;
  } catch (err) {
    console.error('Error al eliminar requerimiento:', err);
    return false;
  }
}

// Eliminar múltiples requerimientos en lote
export function deleteBatchRequerimientos(ids: string[]): number {
  if (!ids || ids.length === 0) return 0;
  let deletedCount = 0;
  ids.forEach((id) => {
    if (deleteRequerimiento(id)) {
      deletedCount++;
    }
  });
  return deletedCount;
}

// Reset data to initial state for testing
export function resetDataToDefault(): void {
  localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(INITIAL_REQUERIMIENTOS));
  localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(INITIAL_DETALLES));
  broadcastLocalChange();

  fetch('/api/data/reset-demo', { method: 'POST' }).catch(() => {});
}

// -------------------------------------------------------------
// GESTIÓN DE MAESTROS (ÁREAS, FUNDOS, PARADEROS, COMEDORES)
// -------------------------------------------------------------
export function getStoredAreas(): MaestroArea[] {
  try {
    const raw = localStorage.getItem(AREAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(MAESTRO_AREAS));
      return MAESTRO_AREAS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading areas:', err);
    return MAESTRO_AREAS;
  }
}

export async function serverSaveMasterData(data: {
  areas?: MaestroArea[];
  fundos?: MaestroFundo[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
}): Promise<void> {
  try {
    const res = await fetch('/api/maestros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const resJson = await res.json();
      if (resJson.revision) {
        localStorage.setItem(LAST_REVISION_KEY, String(resJson.revision));
      }
      console.log('[ServerSync] Catálogos maestros persistidos en servidor para la versión publicada.');
    }
  } catch (err) {
    console.warn('[ServerSync] No se pudo enviar catálogos maestros al servidor:', err);
  }
}

export function saveStoredAreas(areas: MaestroArea[]): void {
  localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
  broadcastLocalChange();
  serverSaveMasterData({ areas });
  firestoreSaveMasterData({ areas }).catch((err) => {
    console.warn('[Firestore] Error guardando áreas:', err);
  });
}

export function getStoredFundos(): MaestroFundo[] {
  try {
    const raw = localStorage.getItem(FUNDOS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(MAESTRO_FUNDOS));
      return MAESTRO_FUNDOS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading fundos:', err);
    return MAESTRO_FUNDOS;
  }
}

export function saveStoredFundos(fundos: MaestroFundo[]): void {
  localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(fundos));
  broadcastLocalChange();
  serverSaveMasterData({ fundos });
  firestoreSaveMasterData({ fundos }).catch((err) => {
    console.warn('[Firestore] Error guardando fundos:', err);
  });
}

export function inferParaderoZona(name: string): 'NORTE' | 'SUR' {
  const cleanName = (name || '').trim().toLowerCase();
  try {
    const raw = localStorage.getItem(PARADEROS_STORAGE_KEY);
    if (raw) {
      const list: MaestroParadero[] = JSON.parse(raw);
      // 1. Coincidencia exacta
      const found = list.find((p) => p.paradero.trim().toLowerCase() === cleanName);
      if (found?.zona === 'NORTE' || found?.zona === 'SUR') {
        return found.zona;
      }

      // 2. Coincidencia normalizada (sin tildes, signos ni espacios extras)
      const normalize = (s: string) =>
        (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const cleanNorm = normalize(cleanName);
      const foundNorm = list.find((p) => normalize(p.paradero) === cleanNorm);
      if (foundNorm?.zona === 'NORTE' || foundNorm?.zona === 'SUR') {
        return foundNorm.zona;
      }

      // 3. Coincidencia parcial o substring en maestro
      const foundPartial = list.find((p) => {
        const pNorm = normalize(p.paradero);
        return (pNorm.length >= 3 && cleanNorm.includes(pNorm)) || (cleanNorm.length >= 3 && pNorm.includes(cleanNorm));
      });
      if (foundPartial?.zona === 'NORTE' || foundPartial?.zona === 'SUR') {
        return foundPartial.zona;
      }
    }
  } catch {
    // fallback
  }

  const upper = (name || '').toUpperCase();
  if (
    upper.includes('CHAO') ||
    upper.includes('VALLE DE DIOS') ||
    upper.includes('REST') ||
    upper.includes('MV')
  ) {
    return 'SUR';
  }
  return 'NORTE';
}

export function getStoredParaderos(): MaestroParadero[] {
  try {
    const raw = localStorage.getItem(PARADEROS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(MAESTRO_PARADEROS));
      return MAESTRO_PARADEROS;
    }
    const parsed: MaestroParadero[] = JSON.parse(raw);
    const withZona = parsed.map((p) => {
      if (p.zona === 'NORTE' || p.zona === 'SUR') return p;
      const matched = MAESTRO_PARADEROS.find((m) => m.paradero === p.paradero || m.id === p.id);
      return {
        ...p,
        zona: matched?.zona || inferParaderoZona(p.paradero),
      };
    });
    return withZona;
  } catch (err) {
    console.error('Error loading paraderos:', err);
    return MAESTRO_PARADEROS;
  }
}

export function saveStoredParaderos(paraderos: MaestroParadero[]): void {
  localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(paraderos));
  broadcastLocalChange();
  serverSaveMasterData({ paraderos });
  firestoreSaveMasterData({ paraderos }).catch((err) => {
    console.warn('[Firestore] Error guardando paraderos:', err);
  });
}

export function getStoredComedores(): MaestroComedor[] {
  try {
    const raw = localStorage.getItem(COMEDORES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(MAESTRO_COMEDORES));
      return MAESTRO_COMEDORES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading comedores:', err);
    return MAESTRO_COMEDORES;
  }
}

export function saveStoredComedores(comedores: MaestroComedor[]): void {
  localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(comedores));
  broadcastLocalChange();
  serverSaveMasterData({ comedores });
  firestoreSaveMasterData({ comedores }).catch((err) => {
    console.warn('[Firestore] Error guardando comedores:', err);
  });
}

export function resetMasterDataToDefault(): {
  areas: MaestroArea[];
  fundos: MaestroFundo[];
  paraderos: MaestroParadero[];
  comedores: MaestroComedor[];
} {
  localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(MAESTRO_AREAS));
  localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(MAESTRO_FUNDOS));
  localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(MAESTRO_PARADEROS));
  localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(MAESTRO_COMEDORES));
  broadcastLocalChange();
  return {
    areas: MAESTRO_AREAS,
    fundos: MAESTRO_FUNDOS,
    paraderos: MAESTRO_PARADEROS,
    comedores: MAESTRO_COMEDORES,
  };
}

// Power BI / Excel CSV Exporter Helper
export function exportToCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows || !rows.length) return;
  const separator = ';';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            const val = row[k];
            let cell = val === null || val === undefined ? '' : val instanceof Date ? val.toLocaleString() : String(val);
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n|;)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// -------------------------------------------------------------
// RESPALDO Y GESTIÓN INTEGRAL DE LA BASE DE DATOS LOCAL
// -------------------------------------------------------------
export interface DatabaseStats {
  requerimientosCount: number;
  detallesCount: number;
  areasCount: number;
  fundosCount: number;
  paraderosCount: number;
  comedoresCount: number;
  totalSizeKB: number;
  lastUpdated: string;
}

export function getDatabaseStats(): DatabaseStats {
  const reqs = getStoredRequerimientos();
  const dets = getStoredDetalles();
  const areas = getStoredAreas();
  const fundos = getStoredFundos();
  const paraderos = getStoredParaderos();
  const comedores = getStoredComedores();

  let totalChars = 0;
  [REQ_STORAGE_KEY, DET_STORAGE_KEY, AREAS_STORAGE_KEY, FUNDOS_STORAGE_KEY, PARADEROS_STORAGE_KEY, COMEDORES_STORAGE_KEY].forEach((k) => {
    const item = localStorage.getItem(k);
    if (item) totalChars += item.length;
  });

  return {
    requerimientosCount: reqs.length,
    detallesCount: dets.length,
    areasCount: areas.length,
    fundosCount: fundos.length,
    paraderosCount: paraderos.length,
    comedoresCount: comedores.length,
    totalSizeKB: Math.round((totalChars * 2) / 1024 * 10) / 10,
    lastUpdated: reqs[0]?.fechaRegistro || new Date().toISOString(),
  };
}

export function exportFullDatabaseBackup(): void {
  const backup = {
    sistema: 'CAMPOSOL - Sistema de Gestión y Requerimiento de Transporte',
    version: '1.0.0',
    fechaExportacion: new Date().toISOString(),
    datos: {
      requerimientos: getStoredRequerimientos(),
      detalles: getStoredDetalles(),
      areas: getStoredAreas(),
      fundos: getStoredFundos(),
      paraderos: getStoredParaderos(),
      comedores: getStoredComedores(),
    },
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CAMPOSOL_BaseDeDatos_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importFullDatabaseBackup(rawJson: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(rawJson);
    const data = parsed.datos || parsed;

    if (!data.requerimientos || !Array.isArray(data.requerimientos)) {
      return { success: false, message: 'El archivo no contiene un formato de requerimientos válido.' };
    }

    localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(data.requerimientos));
    if (Array.isArray(data.detalles)) {
      localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(data.detalles));
    }
    if (Array.isArray(data.areas)) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(data.areas));
    }
    if (Array.isArray(data.fundos)) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(data.fundos));
    }
    if (Array.isArray(data.paraderos)) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(data.paraderos));
    }
    if (Array.isArray(data.comedores)) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(data.comedores));
    }

    broadcastLocalChange();
    return { success: true, message: `Base de datos restaurada con éxito (${data.requerimientos.length} requerimientos).` };
  } catch (err) {
    return { success: false, message: 'Error al procesar el archivo JSON: ' + (err instanceof Error ? err.message : String(err)) };
  }
}
