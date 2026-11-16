import {
  Requerimiento,
  DetalleRequerimiento,
  RequerimientoDraft,
  MaestroArea,
  MaestroFundo,
  MaestroZona,
  MaestroParadero,
  MaestroComedor,
  MaestroUnidadBus,
  ProgramacionViajesDia,
  AppUser,
} from '../types';
import {
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_ZONAS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
  MAESTRO_UNIDADES_BUS,
  normalizeParaderoKey,
} from '../data/masterData';
import {
  initializeFirestoreSync,
  registerFirestoreSyncCallback,
  registerFirebaseConnectedCallback,
  registerMasterDataSeedProvider,
  subscribeToFirebaseAuth,
  firestoreSaveRequerimiento,
  firestoreUpdateRequerimientoEstado,
  firestoreDeleteRequerimiento,
  firestoreSaveMasterData,
  firestoreSaveUser,
  firestorePullAllNow,
  firestoreFetchByDateRange,
  isFirestoreAuthenticated,
  getFirebaseUserInfo,
  connectWithGoogleFirebase,
  hasKnownFirestoreReqId,
  hasMasterDataInFirestore,
  formatFriendlyFirestoreError,
} from './firestoreService';
import {
  getAuthHeaders,
  getAuthToken,
  getActiveSessionUser,
  getStoredUsers,
  getApiCandidates,
  markWorkingApiUrl,
  isStaticToken,
  isCookieCheckResponse,
  resetWorkingApiPrefix,
  recoverServerSessionIfPossible,
  isHostedExpressOrigin,
  notifyCookieCheckRequired,
} from './authService';

export { isHostedExpressOrigin };
import {
  idbLoadSnapshot,
  idbPutRequerimientos,
  idbPutDetalles,
  idbDeleteRequerimiento,
  idbPutProgramaciones,
} from './indexedDbStore';

const REQ_STORAGE_KEY = 'camposol_transporte_requerimientos_v1';
const DET_STORAGE_KEY = 'camposol_transporte_detalles_v1';
const AREAS_STORAGE_KEY = 'camposol_maestro_areas_v1';
const FUNDOS_STORAGE_KEY = 'camposol_maestro_fundos_v1';
const ZONAS_STORAGE_KEY = 'camposol_maestro_zonas_v1';
const PARADEROS_STORAGE_KEY = 'camposol_maestro_paraderos_v1';
const COMEDORES_STORAGE_KEY = 'camposol_maestro_comedores_v1';
const UNIDADES_BUS_STORAGE_KEY = 'camposol_maestro_unidades_bus_v1';
const PROGRAMACIONES_VIAJES_KEY = 'camposol_programaciones_viajes_v1';
const USERS_STORAGE_KEY = 'camposol_users_v2';
const LAST_REVISION_KEY = 'camposol_last_revision_v1';
const DRAFT_REQ_STORAGE_KEY = 'camposol_current_req_draft_v1';
const MAX_LS_MIRROR_REQS = 450;

// -------------------------------------------------------------
// LONG-TERM IN-MEMORY + INDEXEDDB CACHE (NO TRUNCATION, 0ms SYNC READS)
// -------------------------------------------------------------
let memInitialized = false;
let memReqs: Requerimiento[] = [];
let memDets: DetalleRequerimiento[] = [];
let memDetsByReqId = new Map<string, DetalleRequerimiento[]>();
let memProgs: ProgramacionViajesDia[] = [];
let knownExpressReqIds = new Set<string>();
let hasLoadedExpressInitial = false;
let serverTotalHistoricalCount: number | null = null;
let serverOldestFecha: string | null = null;

function isLegacyDemoReq(r: Partial<Requerimiento>): boolean {
  return Boolean(r.id?.startsWith('req-uuid-') || /-ops-1\d\d$/.test(r.id || ''));
}

function isLegacyDemoDet(d: Partial<DetalleRequerimiento>): boolean {
  return Boolean(
    d.id?.startsWith('det-001-') ||
      d.id?.startsWith('det-002-') ||
      d.id?.startsWith('det-003-') ||
      d.id?.startsWith('det-179040001') ||
      /-ops-1\d\d$/.test(d.requerimientoId || '')
  );
}

function rebuildDetallesIndex(): void {
  const nextMap = new Map<string, DetalleRequerimiento[]>();
  for (const det of memDets) {
    if (!det.requerimientoId) continue;
    const arr = nextMap.get(det.requerimientoId);
    if (arr) {
      arr.push(det);
    } else {
      nextMap.set(det.requerimientoId, [det]);
    }
  }
  memDetsByReqId = nextMap;
}

function mirrorHotCacheToLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const hotReqs = memReqs.slice(0, MAX_LS_MIRROR_REQS);
    const hotReqIds = new Set(hotReqs.map((r) => r.id));
    const hotDets = memDets.filter((d) => hotReqIds.has(d.requerimientoId));
    localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify(hotReqs));
    localStorage.setItem(DET_STORAGE_KEY, JSON.stringify(hotDets));
  } catch {
    // QuotaExceededError silencioso: el historial completo sigue seguro en mem + IndexedDB
  }
}

function mirrorProgsToLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRAMACIONES_VIAJES_KEY, JSON.stringify(memProgs.slice(0, 120)));
  } catch {
    // IndexedDB conserva el 100%
  }
}

function ensureMemInitialized(): void {
  if (memInitialized || typeof window === 'undefined') return;
  memInitialized = true;

  try {
    const rawReqs = localStorage.getItem(REQ_STORAGE_KEY);
    if (rawReqs) {
      const parsed = JSON.parse(rawReqs);
      if (Array.isArray(parsed)) {
        memReqs = parsed
          .filter((r) => r && r.id && !isLegacyDemoReq(r))
          .sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
      }
    }
  } catch {
    memReqs = [];
  }

  try {
    const rawDets = localStorage.getItem(DET_STORAGE_KEY);
    if (rawDets) {
      const parsed = JSON.parse(rawDets);
      if (Array.isArray(parsed)) {
        memDets = parsed.filter((d) => d && d.id && !isLegacyDemoDet(d));
      }
    }
  } catch {
    memDets = [];
  }
  rebuildDetallesIndex();

  try {
    const rawProgs = localStorage.getItem(PROGRAMACIONES_VIAJES_KEY);
    if (rawProgs) {
      const parsed = JSON.parse(rawProgs);
      if (Array.isArray(parsed)) {
        memProgs = parsed;
      }
    }
  } catch {
    memProgs = [];
  }
}

function buildReqDedupeSig(r: Partial<Requerimiento>): string {
  return [
    String(r.numeroRequerimiento || '').trim().toUpperCase(),
    String(r.fecha || '').trim(),
    String(r.fundo || '').trim().toUpperCase(),
    String(r.totalPersonas || ''),
    String(r.userUsername || r.usuario || '').trim().toLowerCase(),
  ].join('|');
}

function mergeUpsertRequerimientos(incomingReqs: Requerimiento[], persistToIdb: boolean = true): boolean {
  ensureMemInitialized();
  const cleanIncoming = (incomingReqs || []).filter((r) => r && r.id && !isLegacyDemoReq(r));
  if (cleanIncoming.length === 0) return false;

  const byId = new Map<string, Requerimiento>();
  const bySig = new Map<string, Requerimiento>();
  for (const r of memReqs) {
    byId.set(r.id, r);
    if (r.numeroRequerimiento) {
      bySig.set(buildReqDedupeSig(r), r);
    }
  }

  const changedForIdb: Requerimiento[] = [];
  for (const inc of cleanIncoming) {
    const prev = byId.get(inc.id);
    if (prev) {
      const prevStamp = prev.updatedAt || prev.fechaRegistro || '';
      const incStamp = inc.updatedAt || inc.fechaRegistro || '';
      if (incStamp >= prevStamp || inc.estado !== prev.estado || (inc.firebaseUid && !prev.firebaseUid)) {
        byId.set(inc.id, inc);
        if (inc.numeroRequerimiento) bySig.set(buildReqDedupeSig(inc), inc);
        changedForIdb.push(inc);
      }
      continue;
    }

    const sig = inc.numeroRequerimiento ? buildReqDedupeSig(inc) : '';
    const prevBySig = sig ? bySig.get(sig) : undefined;
    if (prevBySig && prevBySig.id !== inc.id) {
      // Evitar duplicados si el mismo requerimiento regresó con distinto ID técnico
      const prevHasCloud = Boolean(prevBySig.firebaseUid || hasKnownFirestoreReqId(prevBySig.id));
      const incHasCloud = Boolean(inc.firebaseUid || hasKnownFirestoreReqId(inc.id));
      if (!prevHasCloud && incHasCloud) {
        byId.delete(prevBySig.id);
        byId.set(inc.id, inc);
        bySig.set(sig, inc);
        changedForIdb.push(inc);
      }
      continue;
    }

    byId.set(inc.id, inc);
    if (sig) bySig.set(sig, inc);
    changedForIdb.push(inc);
  }

  memReqs = Array.from(byId.values()).sort((a, b) =>
    (b.fechaRegistro || '').localeCompare(a.fechaRegistro || '')
  );
  mirrorHotCacheToLocalStorage();
  if (persistToIdb && changedForIdb.length > 0) {
    void idbPutRequerimientos(changedForIdb, false);
  }
  return true;
}

function mergeUpsertDetalles(incomingDets: DetalleRequerimiento[], persistToIdb: boolean = true): boolean {
  ensureMemInitialized();
  const cleanIncoming = (incomingDets || []).filter((d) => d && d.id && !isLegacyDemoDet(d));
  if (cleanIncoming.length === 0) return false;

  const byId = new Map<string, DetalleRequerimiento>();
  for (const d of memDets) {
    byId.set(d.id, d);
  }
  for (const inc of cleanIncoming) {
    byId.set(inc.id, inc);
  }

  memDets = Array.from(byId.values());
  rebuildDetallesIndex();
  mirrorHotCacheToLocalStorage();
  if (persistToIdb) {
    void idbPutDetalles(cleanIncoming, false);
  }
  return true;
}

function removeRequerimientoFromMem(id: string): boolean {
  ensureMemInitialized();
  const target = memReqs.find((r) => r.id === id || r.numeroRequerimiento === id);
  if (!target) return false;
  memReqs = memReqs.filter((r) => r.id !== target.id && r.numeroRequerimiento !== target.numeroRequerimiento);
  memDets = memDets.filter(
    (d) => d.requerimientoId !== target.id && d.numeroRequerimiento !== target.numeroRequerimiento
  );
  rebuildDetallesIndex();
  mirrorHotCacheToLocalStorage();
  void idbDeleteRequerimiento(target.id);
  return true;
}

async function bridgeFirestoreReqsToExpressIfAdmin(reqs: Requerimiento[]): Promise<void> {
  if (!hasLoadedExpressInitial || reqs.length === 0) return;
  const sessionUser = getActiveSessionUser();
  const token = getAuthToken();
  if (!sessionUser || (sessionUser.rol !== 'admin' && sessionUser.rol !== 'receptor')) return;
  if (!token || token.startsWith('static.')) return;

  const missing = reqs.filter((r) => r.id && !knownExpressReqIds.has(r.id)).slice(0, 100);
  if (missing.length === 0) return;

  const batchItems = missing.map((r) => ({
    requerimiento: r,
    detalles: getDetallesByRequerimientoId(r.id),
  }));

  try {
    const res = await apiFetch(
      '/api/requerimientos/batch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ items: batchItems }),
      },
      10000
    );
    if (res.ok) {
      missing.forEach((r) => knownExpressReqIds.add(r.id));
    }
  } catch {
    // retry on future sync if needed
  }
}

export function getStoredRequirementDraft(): RequerimientoDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_REQ_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function saveStoredRequirementDraft(draft: RequerimientoDraft): void {
  try {
    localStorage.setItem(DRAFT_REQ_STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    console.error('Error saving requirement draft:', err);
  }
}

export function clearStoredRequirementDraft(): void {
  try {
    localStorage.removeItem(DRAFT_REQ_STORAGE_KEY);
  } catch (err) {
    // ignore
  }
}

// Internal sync state
let isSyncing = false;
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
let expressSessionRejected = false;
let lastSyncDate: Date | null = null;
let broadcastChannel: BroadcastChannel | null = null;

export function resetExpressSyncSessionState(): void {
  expressSessionRejected = false;
}

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

// Hidratar historial completo desde IndexedDB al iniciar y conectar Firestore en tiempo real
if (typeof window !== 'undefined') {
  ensureMemInitialized();
  idbLoadSnapshot()
    .then((snap) => {
      if (!snap) return;
      let changed = false;
      if (snap.requerimientos.length > 0) {
        if (mergeUpsertRequerimientos(snap.requerimientos, false)) changed = true;
      }
      if (snap.detalles.length > 0) {
        if (mergeUpsertDetalles(snap.detalles, false)) changed = true;
      }
      if (snap.programaciones.length > 0) {
        const byId = new Map<string, ProgramacionViajesDia>();
        memProgs.forEach((p) => byId.set(p.id, p));
        snap.programaciones.forEach((p) => byId.set(p.id, p));
        memProgs = Array.from(byId.values()).sort((a, b) =>
          (b.fechaGeneracion || '').localeCompare(a.fechaGeneracion || '')
        );
        changed = true;
      }
      if (changed) {
        notifyListeners();
      }
    })
    .catch(() => {
      // IndexedDB unavailable
    });

  registerMasterDataSeedProvider(() => ({
    areas: getStoredAreas(),
    fundos: getStoredFundos(),
    zonas: getStoredZonas(),
    paraderos: getStoredParaderos(),
    comedores: getStoredComedores(),
    unidadesBus: getStoredUnidadesBus(),
  }));

  registerFirestoreSyncCallback((payload) => {
    let changed = false;

    if (payload.requerimientos && Array.isArray(payload.requerimientos)) {
      payload.requerimientos.forEach((r) => {
        if (r?.id && hasKnownFirestoreReqId(r.id)) {
          setRequirementSyncStatusRecord(r.id, {
            status: 'Sincronizado',
            syncedVia: 'firestore',
            error: undefined,
          });
        }
      });
      if (mergeUpsertRequerimientos(payload.requerimientos, true)) changed = true;
      void bridgeFirestoreReqsToExpressIfAdmin(payload.requerimientos);
    }
    if (payload.detalles && Array.isArray(payload.detalles)) {
      if (mergeUpsertDetalles(payload.detalles, true)) changed = true;
    }
    if (payload.users && Array.isArray(payload.users)) {
      const localUsers = getStoredUsers();
      const byId = new Map<string, AppUser>();
      localUsers.forEach((u) => byId.set(u.id, u));
      payload.users.forEach((u) => byId.set(u.id, u));
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(Array.from(byId.values())));
      changed = true;
    }
    const pendingMaster = getPendingMasterSyncKeys();
    if (payload.areas && Array.isArray(payload.areas) && !pendingMaster.has('areas')) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(payload.areas));
      changed = true;
    }
    if (payload.fundos && Array.isArray(payload.fundos) && !pendingMaster.has('fundos')) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(payload.fundos));
      changed = true;
    }
    if (payload.zonas && Array.isArray(payload.zonas) && !pendingMaster.has('zonas')) {
      localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(payload.zonas));
      changed = true;
    }
    if (payload.paraderos && Array.isArray(payload.paraderos) && !pendingMaster.has('paraderos')) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(payload.paraderos));
      changed = true;
    }
    if (payload.comedores && Array.isArray(payload.comedores) && !pendingMaster.has('comedores')) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(payload.comedores));
      changed = true;
    }
    if (payload.unidadesBus && Array.isArray(payload.unidadesBus) && !pendingMaster.has('unidadesBus')) {
      localStorage.setItem(UNIDADES_BUS_STORAGE_KEY, JSON.stringify(payload.unidadesBus));
      changed = true;
    }
    if (changed || getFirebaseUserInfo().serverVerified) {
      isOnline = true;
      lastSyncDate = new Date();
      notifyListeners();
    }
  });

  registerFirebaseConnectedCallback(async (info) => {
    try {
      await firestorePullAllNow();
      await processPendingSyncQueue(true);

      if (info.isBootstrappedAdmin) {
        if (!hasMasterDataInFirestore()) {
          await firestoreSaveMasterData({
            areas: getStoredAreas(),
            fundos: getStoredFundos(),
            zonas: getStoredZonas(),
            paraderos: getStoredParaderos(),
            comedores: getStoredComedores(),
            unidadesBus: getStoredUnidadesBus(),
          }).catch(() => false);
        }

        const localReqs = getStoredRequerimientos()
          .filter((req) => req?.id && !hasKnownFirestoreReqId(req.id))
          .slice(0, 100);
        for (const req of localReqs) {
          const reqDets = getDetallesByRequerimientoId(req.id);
          const ok = await firestoreSaveRequerimiento(req, reqDets, true).catch(() => false);
          if (ok) {
            setRequirementSyncStatusRecord(req.id, {
              status: 'Sincronizado',
              syncedVia: 'firestore',
              error: undefined,
            });
          }
        }
        const localUsers = getStoredUsers();
        for (const u of localUsers) {
          await firestoreSaveUser(u).catch(() => false);
        }
      }
      notifyListeners();
    } catch {
      // ignore non-fatal bootstrap sync errors
    }
  });

  subscribeToFirebaseAuth(() => {
    notifyListeners();
  });

  initializeFirestoreSync().catch((err) => {
    console.warn('[Firestore] Inicialización diferida:', err);
  });
}

async function apiFetch(
  endpoint: string,
  init: RequestInit = {},
  timeoutMs: number = 8000
): Promise<Response> {
  const candidates = getApiCandidates(endpoint);
  let lastRes: Response | null = null;
  let lastErr: unknown = null;

  for (const url of candidates) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, {
        credentials: init.credentials || 'include',
        ...init,
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (timer) clearTimeout(timer);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (isCookieCheckResponse(res, ct)) {
        notifyCookieCheckRequired();
      }
      if (ct.includes('application/json')) {
        markWorkingApiUrl(url, endpoint);
        return res;
      }
      resetWorkingApiPrefix();
      lastRes = res;
    } catch (err) {
      if (timer) clearTimeout(timer);
      resetWorkingApiPrefix();
      lastErr = err;
    }
  }

  if (lastRes) return lastRes;
  throw lastErr || new Error('No se pudo conectar con el servidor API.');
}

// -------------------------------------------------------------
// REAL-TIME SSE STREAM (<200ms PUSH) & INCREMENTAL DELTA ENGINE
// -------------------------------------------------------------
let activeEventSource: EventSource | null = null;
let sseConnected = false;
let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sseCandidateIndex = 0;
let knownServerBootId: string | null = null;
const BOOT_RELOAD_STORAGE_KEY = 'camposol_boot_reloaded';

function isUserActivelyEditing(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  return Boolean(active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
}

function handleServerBootId(bootId?: unknown): void {
  if (typeof window === 'undefined' || typeof bootId !== 'string' || !bootId) return;
  if (!knownServerBootId) {
    knownServerBootId = bootId;
    return;
  }
  if (knownServerBootId === bootId) return;
  try {
    if (sessionStorage.getItem(BOOT_RELOAD_STORAGE_KEY) === bootId) {
      knownServerBootId = bootId;
      return;
    }
    if (isUserActivelyEditing()) {
      return;
    }
    knownServerBootId = bootId;
    sessionStorage.setItem(BOOT_RELOAD_STORAGE_KEY, bootId);
    window.location.reload();
  } catch {
    knownServerBootId = bootId;
  }
}

function closeRealtimeSse(): void {
  sseConnected = false;
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }
  if (activeEventSource) {
    try {
      activeEventSource.close();
    } catch {
      // ignore
    }
    activeEventSource = null;
  }
}

function applyDeltaEvent(ev: {
  revision?: number;
  kind?: string;
  entityId?: string;
  payload?: {
    requerimiento?: Requerimiento;
    detalles?: DetalleRequerimiento[];
  };
  requerimiento?: Requerimiento;
  detalles?: DetalleRequerimiento[];
}): void {
  if (ev.revision) {
    const prev = Number(localStorage.getItem(LAST_REVISION_KEY) || '0');
    if (ev.revision > prev) {
      localStorage.setItem(LAST_REVISION_KEY, String(ev.revision));
    }
  }

  const reqObj = ev.requerimiento || ev.payload?.requerimiento;
  const detsObj = ev.detalles || ev.payload?.detalles;

  if (ev.kind === 'REQ_UPSERT' && reqObj) {
    knownExpressReqIds.add(reqObj.id);
    mergeUpsertRequerimientos([reqObj], true);
    if (Array.isArray(detsObj) && detsObj.length > 0) {
      mergeUpsertDetalles(detsObj, true);
    }
    if (isFirestoreAuthenticated() && getFirebaseUserInfo().isBootstrappedAdmin) {
      if (hasKnownFirestoreReqId(reqObj.id)) {
        void firestoreUpdateRequerimientoEstado(reqObj.id, reqObj.estado, {
          updatedAt: reqObj.updatedAt,
          fechaAnulacion: reqObj.fechaAnulacion,
          usuarioAnulacion: reqObj.usuarioAnulacion,
          motivoAnulacion: reqObj.motivoAnulacion,
          historialTrazabilidad: reqObj.historialTrazabilidad,
        }).catch(() => false);
      } else {
        const detsForCloud = Array.isArray(detsObj) && detsObj.length > 0
          ? detsObj
          : getDetallesByRequerimientoId(reqObj.id);
        void firestoreSaveRequerimiento(reqObj, detsForCloud, true).catch(() => false);
      }
    }
    lastSyncDate = new Date();
    isOnline = true;
    notifyListeners();
  } else if (ev.kind === 'REQ_DELETE' && ev.entityId) {
    removeRequerimientoFromMem(ev.entityId);
    lastSyncDate = new Date();
    notifyListeners();
  } else if (ev.kind === 'MAESTROS_UPDATE' || ev.kind === 'USERS_UPDATE') {
    void syncWithServerNow(true);
  }
}

function ensureRealtimeSseConnected(): void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  const token = getAuthToken();
  if (!token || token.startsWith('static.')) {
    closeRealtimeSse();
    return;
  }
  if (activeEventSource && activeEventSource.readyState !== EventSource.CLOSED) {
    return;
  }

  const candidates = getApiCandidates(`/api/sync/stream?token=${encodeURIComponent(token)}`);
  const streamUrl = candidates[sseCandidateIndex % candidates.length] || candidates[0];
  if (!streamUrl) return;

  try {
    const es = new EventSource(streamUrl, { withCredentials: true });
    activeEventSource = es;

    es.addEventListener('ready', (evt: MessageEvent) => {
      sseConnected = true;
      sseCandidateIndex = 0;
      isOnline = true;
      try {
        const data = JSON.parse(evt.data || '{}');
        handleServerBootId(data.bootId);
        const localRev = Number(localStorage.getItem(LAST_REVISION_KEY) || '0');
        if (data.revision && data.revision > localRev && localRev > 0) {
          void syncDeltaSince(localRev);
        }
      } catch {
        // ignore
      }
    });

    es.addEventListener('sync', (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(evt.data);
        applyDeltaEvent(parsed);
      } catch {
        // ignore malformed frame
      }
    });

    es.onerror = () => {
      sseConnected = false;
      sseCandidateIndex = (sseCandidateIndex + 1) % Math.max(candidates.length, 1);
      try {
        es.close();
      } catch {
        // ignore
      }
      if (activeEventSource === es) {
        activeEventSource = null;
      }
      if (!sseReconnectTimer && getAuthToken() && !getAuthToken()!.startsWith('static.')) {
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          ensureRealtimeSseConnected();
        }, 4000);
      }
    };
  } catch {
    sseConnected = false;
  }
}

async function syncDeltaSince(sinceRev: number): Promise<boolean> {
  const token = getAuthToken();
  if (!token || isStaticToken(token)) return false;

  try {
    const res = await apiFetch(
      `/api/sync/delta?since=${encodeURIComponent(String(sinceRev))}`,
      {
        headers: {
          'Cache-Control': 'no-cache',
          ...getAuthHeaders(),
        },
      },
      6000
    );
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
      expressSessionRejected = true;
      closeRealtimeSse();
      notifyListeners();
      return false;
    }
    if (!res.ok || !ct.includes('application/json')) return false;

    const delta = await res.json();
    if (delta.fullSyncRequired || !Array.isArray(delta.events)) {
      return syncWithServerNow();
    }

    for (const ev of delta.events) {
      applyDeltaEvent(ev);
    }
    const nextRev = delta.revision || delta.currentRevision;
    if (nextRev) {
      localStorage.setItem(LAST_REVISION_KEY, String(nextRev));
    }
    lastSyncDate = new Date();
    isOnline = true;
    return true;
  } catch {
    return false;
  }
}

export type SyncOutcomeReason = 'ok' | 'no_session' | 'session_expired' | 'cookie_check' | 'network' | 'firestore_error';
export type SyncVisualState = 'Pendiente' | 'Sincronizado' | 'Error';

let inFlightSyncPromise: Promise<{ ok: boolean; reason: SyncOutcomeReason }> | null = null;
let lastMasterSyncError: string | null = null;

// -------------------------------------------------------------
// CLOUD SERVER & FIRESTORE SYNC ENGINE
// -------------------------------------------------------------
export async function connectCloudSyncWithGoogle(): Promise<{
  success: boolean;
  email?: string | null;
  error?: string;
}> {
  const res = await connectWithGoogleFirebase();
  if (res.success) {
    await processPendingSyncQueue(true);
    await syncWithServerNow(true);
    notifyListeners();
  }
  return res;
}

export function getCloudSyncStatus(): {
  state: SyncVisualState;
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  lastError: string | null;
  firebaseConnected: boolean;
  firebaseServerVerified: boolean;
  firebaseEmail: string | null;
  projectId: string;
  hasServerSession: boolean;
  pendingOutboxCount: number;
  errorOutboxCount: number;
  masterPendingCount: number;
} {
  const fb = getFirebaseUserInfo();
  const token = getAuthToken();
  const hasServerSession = Boolean(token && !isStaticToken(token) && !expressSessionRejected);
  const browserOnline = typeof navigator === 'undefined' ? isOnline : navigator.onLine !== false;
  const effectiveOnline = isOnline && browserOnline;
  const queue = getSyncQueue();
  const statusMap = readSyncStatusMap();
  const masterPending = getPendingMasterSyncKeys();

  let errorOutboxCount = 0;
  let firstOutboxError: string | null = null;
  for (const item of queue) {
    const st = statusMap[item.id];
    if (st?.status === 'Error') {
      errorOutboxCount++;
      if (!firstOutboxError && st.error) firstOutboxError = st.error;
    }
  }

  const lastError = fb.lastError || lastMasterSyncError || firstOutboxError || null;

  let state: SyncVisualState = 'Pendiente';
  if (!effectiveOnline) {
    state = 'Pendiente';
  } else if (errorOutboxCount > 0 || Boolean(fb.lastError) || Boolean(lastMasterSyncError)) {
    state = 'Error';
  } else if (queue.length > 0 || masterPending.size > 0) {
    state = 'Pendiente';
  } else if (fb.connected && (fb.serverVerified || lastSyncDate !== null)) {
    state = 'Sincronizado';
  } else if (hasServerSession && lastSyncDate !== null) {
    state = 'Sincronizado';
  } else {
    state = 'Pendiente';
  }

  return {
    state,
    isOnline: effectiveOnline,
    isSyncing,
    lastSync: lastSyncDate,
    lastError,
    firebaseConnected: fb.connected,
    firebaseServerVerified: fb.serverVerified,
    firebaseEmail: fb.email,
    projectId: fb.projectId,
    hasServerSession,
    pendingOutboxCount: queue.length,
    errorOutboxCount,
    masterPendingCount: masterPending.size,
  };
}

export async function syncWithServerDetailed(force: boolean = false): Promise<{
  ok: boolean;
  reason: SyncOutcomeReason;
}> {
  if (typeof window === 'undefined') return { ok: false, reason: 'network' };

  if (inFlightSyncPromise) {
    if (!force) return inFlightSyncPromise;
    try {
      await inFlightSyncPromise;
    } catch {
      // ignore prior sync error and run fresh
    }
  }
  isSyncing = true;

  const runSync = async (): Promise<{ ok: boolean; reason: SyncOutcomeReason }> => {
    let token = getAuthToken();
    const fbConnected = isFirestoreAuthenticated();
    let hasServerToken = Boolean(token && !isStaticToken(token) && !expressSessionRejected);

    if (!hasServerToken) {
      const recovery = await recoverServerSessionIfPossible({ clearIfExpired: false });
      if (recovery.hasValidServerToken) {
        expressSessionRejected = false;
        token = getAuthToken();
        hasServerToken = Boolean(token && !isStaticToken(token));
      } else if (!fbConnected) {
        closeRealtimeSse();
        if (recovery.cookieCheckRequired) {
          return { ok: false, reason: 'cookie_check' };
        }
        if (recovery.expiredOnExpress) {
          return { ok: false, reason: 'session_expired' };
        }
        return { ok: false, reason: 'no_session' };
      }
    }

    let expressOk = false;
    let firestoreOk = false;
    let failReason: SyncOutcomeReason = 'network';
    try {
      const queueStatus = await processPendingSyncQueueInternal(force);
      if (queueStatus === 'session_expired' && !fbConnected) {
        closeRealtimeSse();
        return { ok: false, reason: 'session_expired' };
      }
      if (queueStatus === 'cookie_check') {
        failReason = 'cookie_check';
      }

      if (hasServerToken && !expressSessionRejected) {
        try {
          const res = await apiFetch('/api/data', {
            headers: {
              'Cache-Control': 'no-cache',
              ...getAuthHeaders(),
            },
          });
          const ct = (res.headers.get('content-type') || '').toLowerCase();

          if (isCookieCheckResponse(res, ct)) {
            notifyCookieCheckRequired();
            failReason = 'cookie_check';
          } else if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
            expressSessionRejected = true;
            closeRealtimeSse();
            failReason = 'session_expired';
          } else if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            expressOk = true;
            expressSessionRejected = false;

            if (typeof data.totalHistoricalCount === 'number') {
              serverTotalHistoricalCount = data.totalHistoricalCount;
            }
            if (typeof data.oldestFecha === 'string' || data.oldestFecha === null) {
              serverOldestFecha = data.oldestFecha;
            }

            if (data.requerimientos && Array.isArray(data.requerimientos)) {
              const serverReqs: Requerimiento[] = data.requerimientos;
              serverReqs.forEach((r) => knownExpressReqIds.add(r.id));
              hasLoadedExpressInitial = true;
              mergeUpsertRequerimientos(serverReqs, true);
            }
            if (data.detalles && Array.isArray(data.detalles)) {
              const serverDets: DetalleRequerimiento[] = data.detalles;
              mergeUpsertDetalles(serverDets, true);
            }
            if (data.users && Array.isArray(data.users)) {
              const safeUsers = data.users.map((u: AppUser) => ({ ...u, passwordHash: '', salt: '' }));
              localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(safeUsers));
            }
            const pendingMaster = getPendingMasterSyncKeys();
            if (data.areas && Array.isArray(data.areas) && !pendingMaster.has('areas')) {
              localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(data.areas));
            }
            if (data.fundos && Array.isArray(data.fundos) && !pendingMaster.has('fundos')) {
              localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(data.fundos));
            }
            if (data.zonas && Array.isArray(data.zonas) && !pendingMaster.has('zonas')) {
              localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(data.zonas));
            }
            if (data.paraderos && Array.isArray(data.paraderos) && !pendingMaster.has('paraderos')) {
              localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(data.paraderos));
            }
            if (data.comedores && Array.isArray(data.comedores) && !pendingMaster.has('comedores')) {
              localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(data.comedores));
            }
            if (data.revision) {
              localStorage.setItem(LAST_REVISION_KEY, String(data.revision));
            }

            ensureRealtimeSseConnected();
          }
        } catch {
          // Express unreachable; continue to Cloud Firestore
        }
      }

      if (isFirestoreAuthenticated() && (failReason !== 'session_expired' || isFirestoreAuthenticated())) {
        firestoreOk = await firestorePullAllNow();
      }

      const anySuccess = expressOk || firestoreOk;
      isOnline = anySuccess || (typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
      if (anySuccess) {
        lastSyncDate = new Date();
        notifyListeners();
        return { ok: true, reason: 'ok' };
      }
      notifyListeners();
      return { ok: false, reason: failReason };
    } catch {
      isOnline = false;
      notifyListeners();
      return { ok: false, reason: failReason };
    } finally {
      isSyncing = false;
      inFlightSyncPromise = null;
    }
  };

  inFlightSyncPromise = runSync();
  return inFlightSyncPromise;
}

export async function syncWithServerNow(force: boolean = false): Promise<boolean> {
  const res = await syncWithServerDetailed(force);
  return res.ok;
}

const loadedRangesCache = new Map<string, number>();
const inFlightRangeRequests = new Map<string, Promise<void>>();

export async function ensureDateRangeLoaded(desde?: string, hasta?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const dCutoff = new Date();
  dCutoff.setDate(dCutoff.getDate() - 14);
  const cutoff14 = `${dCutoff.getFullYear()}-${String(dCutoff.getMonth() + 1).padStart(2, '0')}-${String(
    dCutoff.getDate()
  ).padStart(2, '0')}`;

  if (desde && desde >= cutoff14) {
    return;
  }

  const key = `${desde || 'MIN'}..${hasta || 'MAX'}`;
  const lastFetched = loadedRangesCache.get(key) || 0;
  if (Date.now() - lastFetched < 60_000) {
    return;
  }
  const existingPromise = inFlightRangeRequests.get(key);
  if (existingPromise) return existingPromise;

  const task = (async () => {
    const token = getAuthToken();
    const hasServerToken = Boolean(token && !token.startsWith('static.'));
    const fbConnected = isFirestoreAuthenticated();

    const qs = new URLSearchParams();
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
    const rangeEndpoint = `/api/requerimientos/range${qs.toString() ? `?${qs.toString()}` : ''}`;

    const expressPromise = hasServerToken
      ? apiFetch(
          rangeEndpoint,
          {
            headers: {
              'Cache-Control': 'no-cache',
              ...getAuthHeaders(),
            },
          },
          10000
        )
          .then(async (res) => {
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (res.ok && ct.includes('application/json')) {
              return res.json();
            }
            return null;
          })
          .catch(() => null)
      : Promise.resolve(null);

    const firestorePromise = fbConnected
      ? firestoreFetchByDateRange(desde, hasta).catch(() => null)
      : Promise.resolve(null);

    const [expData, fbData] = await Promise.all([expressPromise, firestorePromise]);
    let mergedAny = false;

    if (expData && Array.isArray(expData.requerimientos)) {
      if (mergeUpsertRequerimientos(expData.requerimientos, true)) mergedAny = true;
      if (Array.isArray(expData.detalles) && mergeUpsertDetalles(expData.detalles, true)) {
        mergedAny = true;
      }
    }
    if (fbData && Array.isArray(fbData.requerimientos)) {
      if (mergeUpsertRequerimientos(fbData.requerimientos, true)) mergedAny = true;
      if (Array.isArray(fbData.detalles) && mergeUpsertDetalles(fbData.detalles, true)) {
        mergedAny = true;
      }
    }

    loadedRangesCache.set(key, Date.now());
    if (mergedAny) {
      notifyListeners();
    }
  })().finally(() => {
    inFlightRangeRequests.delete(key);
  });

  inFlightRangeRequests.set(key, task);
  return task;
}

export function getSyncInfo() {
  return {
    isOnline,
    isSyncing,
    lastSync: lastSyncDate,
    revision: Number(localStorage.getItem(LAST_REVISION_KEY) || '1'),
  };
}

// Background poller: uses delta sync & slows down automatically when real-time SSE stream is active
if (typeof window !== 'undefined') {
  let isChecking = false;
  let pollTick = 0;

  const pollServer = async (forceCheck: boolean = false) => {
    const token = getAuthToken();
    const fbConnected = isFirestoreAuthenticated();
    if (
      isChecking ||
      isSyncing ||
      (!token && !fbConnected) ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    ) {
      return;
    }

    if (!token || isStaticToken(token) || expressSessionRejected) {
      pollTick++;
      if (forceCheck || pollTick % 12 === 1) {
        isChecking = true;
        try {
          if (fbConnected && forceCheck) {
            await processPendingSyncQueue(true);
            await firestorePullAllNow();
          }
          const rec = await recoverServerSessionIfPossible({ clearIfExpired: false });
          if (rec.hasValidServerToken) {
            expressSessionRejected = false;
            await processPendingSyncQueue(true);
            await syncWithServerNow(true);
          }
        } finally {
          isChecking = false;
        }
      }
      return;
    }

    pollTick++;
    if (!forceCheck && sseConnected && pollTick % 6 !== 0) {
      return;
    }

    ensureRealtimeSseConnected();
    isChecking = true;

    try {
      const res = await apiFetch(
        '/api/sync/version',
        {
          headers: {
            'Cache-Control': 'no-cache',
            ...getAuthHeaders(),
          },
        },
        4000
      );
      const ct = (res.headers.get('content-type') || '').toLowerCase();

      if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
        expressSessionRejected = true;
        closeRealtimeSse();
        notifyListeners();
        return;
      }

      if (isCookieCheckResponse(res, ct)) {
        notifyCookieCheckRequired();
        return;
      }

      if (res.ok && ct.includes('application/json')) {
        isOnline = true;
        const info = await res.json();
        handleServerBootId(info.bootId);
        const localRev = Number(localStorage.getItem(LAST_REVISION_KEY) || '0');

        if (info.revision && info.revision > localRev) {
          if (localRev > 0) {
            await syncDeltaSince(localRev);
          } else {
            await syncWithServerNow();
          }
        }
      }
    } catch {
      // Ignore network errors in background polling
    } finally {
      isChecking = false;
    }
  };

  setTimeout(() => {
    if (getAuthToken() || isFirestoreAuthenticated()) {
      processPendingSyncQueue(true).finally(() => {
        syncWithServerNow(true);
      });
    }
  }, 250);

  setInterval(() => pollServer(false), 2500);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        ensureRealtimeSseConnected();
        void processPendingSyncQueue(true);
        void pollServer(true);
      }
    });
  }
  window.addEventListener('focus', () => {
    ensureRealtimeSseConnected();
    void processPendingSyncQueue(true);
    void pollServer(true);
  });
  window.addEventListener('online', () => {
    isOnline = true;
    notifyListeners();
    if (getAuthToken() || isFirestoreAuthenticated()) {
      ensureRealtimeSseConnected();
      processPendingSyncQueue(true).finally(() => {
        syncWithServerNow(true);
      });
    }
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    closeRealtimeSse();
    notifyListeners();
  });
}

// -------------------------------------------------------------
// REQUERIMIENTOS & DETALLES (MEMORIA + INDEXEDDB ILIMITADO)
// -------------------------------------------------------------
export function getStoredRequerimientos(): Requerimiento[] {
  ensureMemInitialized();
  return memReqs;
}

export function getStoredDetalles(): DetalleRequerimiento[] {
  ensureMemInitialized();
  return memDets;
}

export function getDetallesByRequerimientoId(requerimientoId: string): DetalleRequerimiento[] {
  ensureMemInitialized();
  return memDetsByReqId.get(requerimientoId) || [];
}

let localAllocatedMax = 0;

// Genera automáticamente números consecutivos: REQ-000001, REQ-000002...
export function generateNextNumeroRequerimiento(): string {
  const reqs = getStoredRequerimientos();
  let maxNum = localAllocatedMax;
  for (const r of reqs) {
    const match = r.numeroRequerimiento.match(/REQ-(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  const nextVal = maxNum + 1;
  localAllocatedMax = nextVal;
  return `REQ-${nextVal.toString().padStart(6, '0')}`;
}

// -------------------------------------------------------------
// COLA DE SINCRONIZACIÓN PERSISTENTE (OUTBOX) PARA ALTA CONCURRENCIA Y BACKOFF
// -------------------------------------------------------------
const SYNC_QUEUE_KEY = 'camposol_sync_queue_v1';
const SYNC_ITEM_STATUS_KEY = 'camposol_sync_item_status_v1';
const MASTER_SYNC_PENDING_KEY = 'camposol_master_sync_pending_v1';
const BACKOFF_SCHEDULE_MS = [5000, 15000, 30000, 60000, 120000, 300000];

export interface RequirementSyncState {
  status: SyncVisualState;
  error?: string;
  attempts?: number;
  lastAttemptAt?: string;
  syncedVia?: 'firestore' | 'express' | 'both';
}

interface StoredSyncStatusRecord extends RequirementSyncState {
  updatedAt?: string;
}

interface QueuedSyncItem {
  id: string;
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
  attempts: number;
  addedAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: number;
  lastError?: string;
}

type MasterCatalogKey = 'areas' | 'fundos' | 'zonas' | 'paraderos' | 'comedores' | 'unidadesBus';

function getPendingMasterSyncKeys(): Set<MasterCatalogKey> {
  try {
    const raw = localStorage.getItem(MASTER_SYNC_PENDING_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as MasterCatalogKey[]) : new Set();
  } catch {
    return new Set();
  }
}

function addPendingMasterSyncKey(key: MasterCatalogKey): void {
  try {
    const cur = getPendingMasterSyncKeys();
    cur.add(key);
    localStorage.setItem(MASTER_SYNC_PENDING_KEY, JSON.stringify(Array.from(cur)));
  } catch {
    // ignore
  }
}

function clearPendingMasterSyncKeys(keys: MasterCatalogKey[]): void {
  try {
    const cur = getPendingMasterSyncKeys();
    keys.forEach((k) => cur.delete(k));
    if (cur.size === 0) {
      localStorage.removeItem(MASTER_SYNC_PENDING_KEY);
    } else {
      localStorage.setItem(MASTER_SYNC_PENDING_KEY, JSON.stringify(Array.from(cur)));
    }
  } catch {
    // ignore
  }
}

function readSyncStatusMap(): Record<string, StoredSyncStatusRecord> {
  try {
    const raw = localStorage.getItem(SYNC_ITEM_STATUS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setRequirementSyncStatusRecord(reqId: string, record: StoredSyncStatusRecord): void {
  try {
    const map = readSyncStatusMap();
    map[reqId] = { ...record, updatedAt: new Date().toISOString() };
    const entries = Object.entries(map);
    if (entries.length > 500) {
      entries.sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''));
      const trimmed = Object.fromEntries(entries.slice(0, 450));
      localStorage.setItem(SYNC_ITEM_STATUS_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(SYNC_ITEM_STATUS_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore
  }
}

export function getRequirementSyncState(reqId: string): RequirementSyncState {
  const queue = getSyncQueue();
  const queued = queue.find((q) => q.id === reqId);
  const statusMap = readSyncStatusMap();
  const saved = statusMap[reqId];

  if (queued) {
    if (saved?.status === 'Error') {
      return {
        status: 'Error',
        error: saved.error || queued.lastError,
        attempts: queued.attempts,
        lastAttemptAt: saved.lastAttemptAt || queued.lastAttemptAt,
      };
    }
    return {
      status: 'Pendiente',
      error: saved?.error || queued.lastError,
      attempts: queued.attempts,
      lastAttemptAt: saved?.lastAttemptAt || queued.lastAttemptAt,
    };
  }

  if (saved?.status === 'Error') {
    return {
      status: 'Error',
      error: saved.error,
      attempts: saved.attempts,
      lastAttemptAt: saved.lastAttemptAt,
    };
  }

  if (saved?.status === 'Pendiente') {
    return {
      status: 'Pendiente',
      error: saved.error,
      attempts: saved.attempts,
      lastAttemptAt: saved.lastAttemptAt,
    };
  }

  return {
    status: 'Sincronizado',
    syncedVia: saved?.syncedVia || (hasKnownFirestoreReqId(reqId) ? 'firestore' : 'express'),
  };
}

function getSyncQueue(): QueuedSyncItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue: QueuedSyncItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

function addToSyncQueue(requerimiento: Requerimiento, detalles: DetalleRequerimiento[]): void {
  try {
    const queue = getSyncQueue();
    if (!queue.some((q) => q.id === requerimiento.id)) {
      queue.push({
        id: requerimiento.id,
        requerimiento,
        detalles,
        attempts: 0,
        addedAt: new Date().toISOString(),
      });
      saveSyncQueue(queue);
    }
    setRequirementSyncStatusRecord(requerimiento.id, {
      status: 'Pendiente',
      attempts: 0,
    });
  } catch {
    // ignore
  }
}

function updateQueuedItemRetry(id: string, patch: Partial<QueuedSyncItem>): void {
  try {
    const queue = getSyncQueue();
    const updated = queue.map((q) => (q.id === id ? { ...q, ...patch } : q));
    saveSyncQueue(updated);
  } catch {
    // ignore
  }
}

function removeFromSyncQueue(id: string): void {
  try {
    const queue = getSyncQueue().filter((q) => q.id !== id);
    saveSyncQueue(queue);
  } catch {
    // ignore
  }
}

function reconcileLocalRequirement(
  localId: string,
  serverReq?: Requerimiento,
  serverDets?: DetalleRequerimiento[]
): void {
  if (!serverReq) return;
  try {
    ensureMemInitialized();
    const idx = memReqs.findIndex((r) => r.id === localId || r.id === serverReq.id);
    if (idx !== -1) {
      memReqs = [...memReqs];
      memReqs[idx] = serverReq;
    } else {
      memReqs = [serverReq, ...memReqs];
    }

    if (Array.isArray(serverDets) && serverDets.length > 0) {
      const existingDets = memDets.filter(
        (d) => d.requerimientoId !== localId && d.requerimientoId !== serverReq.id
      );
      memDets = [...existingDets, ...serverDets];
      rebuildDetallesIndex();
      void idbPutDetalles(serverDets, false);
    }

    mirrorHotCacheToLocalStorage();
    void idbPutRequerimientos([serverReq], false);
    broadcastLocalChange();
  } catch {
    // ignore
  }
}

let isFlushingQueue = false;

async function flushPendingMasterDataToFirestore(): Promise<void> {
  const pending = getPendingMasterSyncKeys();
  if (pending.size === 0 || !isFirestoreAuthenticated()) return;
  const payload: Parameters<typeof firestoreSaveMasterData>[0] = {};
  const keys = Array.from(pending);
  if (pending.has('areas')) payload.areas = getStoredAreas();
  if (pending.has('fundos')) payload.fundos = getStoredFundos();
  if (pending.has('zonas')) payload.zonas = getStoredZonas();
  if (pending.has('paraderos')) payload.paraderos = getStoredParaderos();
  if (pending.has('comedores')) payload.comedores = getStoredComedores();
  if (pending.has('unidadesBus')) payload.unidadesBus = getStoredUnidadesBus();
  try {
    const ok = await firestoreSaveMasterData(payload);
    if (ok) {
      clearPendingMasterSyncKeys(keys);
      lastMasterSyncError = null;
    }
  } catch (err) {
    lastMasterSyncError = formatFriendlyFirestoreError(err);
  }
}

async function processPendingSyncQueueInternal(force: boolean = false): Promise<SyncOutcomeReason> {
  if (typeof window === 'undefined' || isFlushingQueue) {
    return 'ok';
  }
  if (!navigator.onLine) {
    isOnline = false;
    return 'network';
  }

  const pendingMasters = getPendingMasterSyncKeys();
  const queue = getSyncQueue();
  if (queue.length === 0 && pendingMasters.size === 0) return 'ok';

  let token = getAuthToken();
  const fbConnected = isFirestoreAuthenticated();
  let hasServerToken = Boolean(token && !isStaticToken(token) && !expressSessionRejected);

  if (!hasServerToken && !fbConnected) {
    const recovery = await recoverServerSessionIfPossible({ clearIfExpired: false });
    if (recovery.hasValidServerToken) {
      expressSessionRejected = false;
      token = getAuthToken();
      hasServerToken = Boolean(token && !isStaticToken(token));
    } else if (recovery.cookieCheckRequired) {
      return 'cookie_check';
    } else if (recovery.expiredOnExpress) {
      return 'session_expired';
    } else {
      return 'no_session';
    }
  }

  isFlushingQueue = true;
  let flushedAny = false;
  let stopReason: SyncOutcomeReason = 'ok';
  const now = Date.now();

  try {
    if (fbConnected && pendingMasters.size > 0) {
      await flushPendingMasterDataToFirestore();
    }
    if (hasServerToken && !expressSessionRejected && pendingMasters.size > 0) {
      await serverSaveMasterData({
        ...(pendingMasters.has('areas') ? { areas: getStoredAreas() } : {}),
        ...(pendingMasters.has('fundos') ? { fundos: getStoredFundos() } : {}),
        ...(pendingMasters.has('zonas') ? { zonas: getStoredZonas() } : {}),
        ...(pendingMasters.has('paraderos') ? { paraderos: getStoredParaderos() } : {}),
        ...(pendingMasters.has('comedores') ? { comedores: getStoredComedores() } : {}),
      });
    }

    for (const item of queue) {
      if (!force && item.nextRetryAt && now < item.nextRetryAt) {
        continue;
      }

      let firestoreOk = false;
      let expressOk = false;
      let itemErr: string | undefined;

      if (fbConnected) {
        try {
          firestoreOk = await firestoreSaveRequerimiento(item.requerimiento, item.detalles, false);
        } catch (err) {
          firestoreOk = false;
          itemErr = formatFriendlyFirestoreError(err);
          stopReason = 'firestore_error';
        }
      }

      if (hasServerToken && !expressSessionRejected) {
        try {
          const res = await apiFetch(
            '/api/requerimientos',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
              },
              body: JSON.stringify({
                requerimiento: item.requerimiento,
                detalles: item.detalles,
              }),
              keepalive: true,
            },
            8000
          );
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (isCookieCheckResponse(res, ct)) {
            notifyCookieCheckRequired();
            stopReason = 'cookie_check';
            break;
          }
          if (res.ok && ct.includes('application/json')) {
            const json = await res.json().catch(() => ({}));
            if (json.revision) {
              localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
            }
            if (json.requerimiento) {
              knownExpressReqIds.add(json.requerimiento.id);
              reconcileLocalRequirement(item.id, json.requerimiento, json.detalles);
            }
            expressOk = true;
          } else if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
            expressSessionRejected = true;
            closeRealtimeSse();
            stopReason = 'session_expired';
            break;
          } else if (res.status === 400) {
            itemErr = itemErr || 'El requerimiento no cumplió con las validaciones del servidor.';
          }
        } catch {
          stopReason = 'network';
        }
      }

      if (firestoreOk || (expressOk && !fbConnected)) {
        removeFromSyncQueue(item.id);
        setRequirementSyncStatusRecord(item.id, {
          status: 'Sincronizado',
          syncedVia: firestoreOk && expressOk ? 'both' : firestoreOk ? 'firestore' : 'express',
          attempts: item.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });
        flushedAny = true;
      } else {
        const nextAttempts = (item.attempts || 0) + 1;
        const backoff =
          BACKOFF_SCHEDULE_MS[Math.min(nextAttempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
        const finalErr =
          itemErr ||
          (!fbConnected
            ? 'Pendiente de conexión con la nube.'
            : 'Error de red o permiso al sincronizar.');
        updateQueuedItemRetry(item.id, {
          attempts: nextAttempts,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: Date.now() + backoff,
          lastError: finalErr,
        });
        setRequirementSyncStatusRecord(item.id, {
          status: itemErr ? 'Error' : 'Pendiente',
          error: finalErr,
          attempts: nextAttempts,
          lastAttemptAt: new Date().toISOString(),
        });
      }
    }

    if (flushedAny) {
      lastSyncDate = new Date();
      isOnline = true;
    }
    notifyListeners();
  } finally {
    isFlushingQueue = false;
  }
  return stopReason;
}

export async function processPendingSyncQueue(force: boolean = false): Promise<void> {
  await processPendingSyncQueueInternal(force);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processPendingSyncQueue(true);
  });
  setInterval(() => {
    void processPendingSyncQueue(false);
  }, 5000);
}

function buildAndPersistLocalRequerimiento(
  draft: RequerimientoDraft,
  currentUser?: AppUser | string
): {
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
} {
  const nextNumero = generateNextNumeroRequerimiento();
  const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.floor(Math.random() * 1000)}`;

  // Calculate total personas and generate detalles
  let totalPersonas = 0;
  const newDetalles: DetalleRequerimiento[] = [];

  if (draft.comedores && draft.comedores.length > 0) {
    draft.comedores.forEach((c) => {
      Object.entries(c.paraderosCantidades || {}).forEach(([paradero, rawQty]) => {
        const cantidad = Math.min(Math.max(Math.floor(Number(rawQty) || 0), 0), 500);
        if (cantidad > 0) {
          totalPersonas += cantidad;
          newDetalles.push({
            id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.floor(Math.random() * 1000)}`,
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
      const cantidad = Math.min(Math.max(Math.floor(Number(rawQty) || 0), 0), 500);
      if (cantidad > 0) {
        totalPersonas += cantidad;
        const z = inferParaderoZona(paradero);
        newDetalles.push({
          id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.floor(Math.random() * 1000)}`,
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
      Object.entries(parcelasMap).forEach(([parcela, rawQty]) => {
        const cantidad = Math.min(Math.max(Math.floor(Number(rawQty) || 0), 0), 500);
        if (cantidad > 0) {
          totalPersonas += cantidad;
          newDetalles.push({
            id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.floor(Math.random() * 1000)}`,
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

  if (totalPersonas <= 0) {
    throw new Error('El requerimiento debe incluir al menos 1 pasajero.');
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
    horaRecojoNorte: draft.horaRecojoNorte,
    horaRecojoSur: draft.horaRecojoSur,
    observaciones: draft.observaciones.trim(),
    usuario: userName,
    userId: userId,
    userUsername: userUsername,
    userRole: isUserObj ? currentUser.rol : undefined,
    fechaRegistro: new Date().toISOString(),
    totalPersonas: totalPersonas,
    estado: 'PENDIENTE',
    historialTrazabilidad: [
      {
        fecha: new Date().toISOString(),
        usuario: userName,
        accion: 'CREADO',
        detalle: `Requerimiento registrado para el servicio del ${draft.fecha} con ${totalPersonas} personas.`,
      },
    ],
  };

  // 1. Guardar sin límite en memoria + IndexedDB + espejo reciente en localStorage (0ms de latencia)
  ensureMemInitialized();
  memReqs = [newRequerimiento, ...memReqs];
  memDets = [...memDets, ...newDetalles];
  rebuildDetallesIndex();
  mirrorHotCacheToLocalStorage();
  void idbPutRequerimientos([newRequerimiento], false);
  void idbPutDetalles(newDetalles, false);

  // Encolar preventivamente en Outbox hasta confirmar 200/201 del servidor
  addToSyncQueue(newRequerimiento, newDetalles);

  // Notificar cambios localmente
  broadcastLocalChange();

  return {
    requerimiento: newRequerimiento,
    detalles: newDetalles,
  };
}

async function pushRequerimientoToCloud(
  newRequerimiento: Requerimiento,
  newDetalles: DetalleRequerimiento[]
): Promise<{
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
  syncedToServer: boolean;
  syncReason?: SyncOutcomeReason;
  authError?: string;
}> {
  let token = getAuthToken();
  let hasServerToken = Boolean(token && !isStaticToken(token) && !expressSessionRejected);
  const fbConnected = isFirestoreAuthenticated();

  let preReason: SyncOutcomeReason | undefined;
  let preAuthError: string | undefined;

  if (!hasServerToken && !fbConnected) {
    const recovery = await recoverServerSessionIfPossible({ clearIfExpired: false });
    if (recovery.hasValidServerToken) {
      expressSessionRejected = false;
      token = getAuthToken();
      hasServerToken = Boolean(token && !isStaticToken(token));
    } else if (recovery.cookieCheckRequired) {
      preReason = 'cookie_check';
    } else if (recovery.expiredOnExpress) {
      preReason = 'session_expired';
    } else {
      preReason = 'no_session';
    }
  }

  let firestoreErrorMsg: string | undefined;

  // Ejecutar en paralelo Firebase Cloud Firestore y el servidor Express cuando apliquen
  const firestorePromise: Promise<boolean> = fbConnected
    ? firestoreSaveRequerimiento(newRequerimiento, newDetalles).catch((err) => {
        firestoreErrorMsg = formatFriendlyFirestoreError(err);
        return false;
      })
    : Promise.resolve(false);

  const expressPromise: Promise<{
    ok: boolean;
    reason?: SyncOutcomeReason;
    authError?: string;
    req?: Requerimiento;
    dets?: DetalleRequerimiento[];
  }> = hasServerToken
    ? apiFetch(
        '/api/requerimientos',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            requerimiento: newRequerimiento,
            detalles: newDetalles,
          }),
          keepalive: true,
        },
        8000
      )
        .then(async (res) => {
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (isCookieCheckResponse(res, ct)) {
            notifyCookieCheckRequired();
            return {
              ok: false,
              reason: 'cookie_check' as SyncOutcomeReason,
            };
          }
          if (res.ok && ct.includes('application/json')) {
            const json = await res.json();
            if (json.revision) {
              localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
            }
            return {
              ok: true,
              req: (json.requerimiento || newRequerimiento) as Requerimiento,
              dets: Array.isArray(json.detalles)
                ? (json.detalles as DetalleRequerimiento[])
                : newDetalles,
            };
          }
          if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
            expressSessionRejected = true;
            closeRealtimeSse();
            return {
              ok: false,
              reason: 'session_expired' as SyncOutcomeReason,
            };
          }
          return { ok: false, reason: 'network' as SyncOutcomeReason };
        })
        .catch(() => ({ ok: false, reason: 'network' as SyncOutcomeReason }))
    : Promise.resolve({ ok: false, reason: preReason, authError: preAuthError });

  const [firestoreOk, expressResult] = await Promise.all([firestorePromise, expressPromise]);

  if (firestoreOk || (expressResult.ok && !fbConnected)) {
    removeFromSyncQueue(newRequerimiento.id);
    const authReq = expressResult.req || newRequerimiento;
    const authDets = expressResult.dets || newDetalles;
    setRequirementSyncStatusRecord(authReq.id, {
      status: 'Sincronizado',
      syncedVia: firestoreOk && expressResult.ok ? 'both' : firestoreOk ? 'firestore' : 'express',
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    });
    reconcileLocalRequirement(newRequerimiento.id, authReq, authDets);
    return {
      requerimiento: authReq,
      detalles: authDets,
      syncedToServer: true,
      syncReason: 'ok',
    };
  }

  const realError = firestoreErrorMsg || expressResult.authError || preAuthError;
  const resolvedReason: SyncOutcomeReason = firestoreErrorMsg
    ? 'firestore_error'
    : expressResult.reason || preReason || 'network';

  updateQueuedItemRetry(newRequerimiento.id, {
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: Date.now() + BACKOFF_SCHEDULE_MS[0],
    lastError: realError,
  });
  setRequirementSyncStatusRecord(newRequerimiento.id, {
    status: firestoreErrorMsg ? 'Error' : 'Pendiente',
    error: realError,
    attempts: 1,
    lastAttemptAt: new Date().toISOString(),
  });
  notifyListeners();

  return {
    requerimiento: newRequerimiento,
    detalles: newDetalles,
    syncedToServer: false,
    syncReason: resolvedReason,
    ...(realError ? { authError: realError } : {}),
  };
}

// Guardar nuevo requerimiento y sus registros de detalle independientes (sincrónico + push background)
export function saveNewRequerimiento(
  draft: RequerimientoDraft,
  currentUser?: AppUser | string
): {
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
} {
  const created = buildAndPersistLocalRequerimiento(draft, currentUser);
  void pushRequerimientoToCloud(created.requerimiento, created.detalles);
  return created;
}

// Guardar nuevo requerimiento esperando confirmación real del servidor web (<500ms habitual)
export async function saveNewRequerimientoAsync(
  draft: RequerimientoDraft,
  currentUser?: AppUser | string
): Promise<{
  requerimiento: Requerimiento;
  detalles: DetalleRequerimiento[];
  syncedToServer: boolean;
  syncReason?: SyncOutcomeReason;
  authError?: string;
}> {
  const created = buildAndPersistLocalRequerimiento(draft, currentUser);
  return pushRequerimientoToCloud(created.requerimiento, created.detalles);
}

export function updateRequerimientoEstado(
  id: string,
  nuevoEstado: Requerimiento['estado'],
  usuario?: string,
  motivo?: string
) {
  ensureMemInitialized();
  const timestamp = new Date().toISOString();
  const userLabel = usuario || 'Admin / Transporte';
  let targetDocId = id;
  let updatedHistoryForFirestore: Requerimiento['historialTrazabilidad'] | undefined;
  let changedReq: Requerimiento | null = null;

  memReqs = memReqs.map((r) => {
    if (r.id === id || r.numeroRequerimiento === id) {
      targetDocId = r.id;
      const history = r.historialTrazabilidad || [];
      const isAnulando = nuevoEstado === 'ANULADO';
      const nextHistory = [
        ...history,
        {
          fecha: timestamp,
          usuario: userLabel,
          accion: `ESTADO: ${nuevoEstado}`,
          detalle: motivo || `Estado operacional actualizado a ${nuevoEstado}.`,
        },
      ].slice(-50);
      updatedHistoryForFirestore = nextHistory;
      changedReq = {
        ...r,
        estado: nuevoEstado,
        updatedAt: timestamp,
        fechaAnulacion: isAnulando ? timestamp : r.fechaAnulacion,
        usuarioAnulacion: isAnulando ? userLabel : r.usuarioAnulacion,
        motivoAnulacion: isAnulando ? (motivo || 'Anulado/borrado de la programación') : r.motivoAnulacion,
        historialTrazabilidad: nextHistory,
      };
      return changedReq;
    }
    return r;
  });
  mirrorHotCacheToLocalStorage();
  if (changedReq) {
    void idbPutRequerimientos([changedReq], false);
  }

  broadcastLocalChange();

  // Actualizar en Firebase Firestore
  firestoreUpdateRequerimientoEstado(targetDocId, nuevoEstado, {
    updatedAt: timestamp,
    ...(nuevoEstado === 'ANULADO'
      ? {
          fechaAnulacion: timestamp,
          usuarioAnulacion: userLabel,
          motivoAnulacion: motivo || 'Anulado/borrado de la programación',
        }
      : {}),
    ...(updatedHistoryForFirestore ? { historialTrazabilidad: updatedHistoryForFirestore } : {}),
  }).catch((err) => {
    console.warn('[Firestore] Error actualizando estado en Firestore:', err);
  });

  apiFetch(`/api/requerimientos/${encodeURIComponent(id)}/estado`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ 
      estado: nuevoEstado,
      usuario: userLabel,
      motivo,
      fechaAnulacion: nuevoEstado === 'ANULADO' ? timestamp : undefined,
      usuarioAnulacion: nuevoEstado === 'ANULADO' ? userLabel : undefined,
      motivoAnulacion: nuevoEstado === 'ANULADO' ? (motivo || 'Anulado de la programación') : undefined
    }),
    keepalive: true,
  })
    .then(async (res) => {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
        expressSessionRejected = true;
        closeRealtimeSse();
        notifyListeners();
        return;
      }
      if (res.ok && ct.includes('application/json')) {
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

// Anular o eliminar un requerimiento conservando trazabilidad en el historial de los días
export function deleteRequerimiento(id: string, usuario?: string, motivo?: string): boolean {
  try {
    const reqs = getStoredRequerimientos();
    const target = reqs.find((r) => r.id === id || r.numeroRequerimiento === id);
    if (!target) return false;

    const fechaHoraAnulacion = new Date().toISOString();
    const userLabel = usuario || 'Usuario / Admin';
    const motivoText = motivo || 'Anulado/borrado de la programación diaria';
    let updatedHistoryForFirestore: Requerimiento['historialTrazabilidad'] | undefined;

    // Para mantener la trazabilidad histórica de los días:
    // Se preserva el registro intacto en el historial marcado como ANULADO con toda su auditoría
    let changedReq: Requerimiento | null = null;
    memReqs = reqs.map((r) => {
      if (r.id === target.id || r.numeroRequerimiento === target.numeroRequerimiento) {
        const history = r.historialTrazabilidad || [];
        const nextHistory = [
          ...history,
          {
            fecha: fechaHoraAnulacion,
            usuario: userLabel,
            accion: 'ANULADO / BORRADO',
            detalle: `${motivoText}. Registrado originalmente para la fecha ${r.fecha} (${r.totalPersonas} personas solicitadas).`,
          },
        ].slice(-50);
        updatedHistoryForFirestore = nextHistory;
        changedReq = {
          ...r,
          estado: 'ANULADO' as const,
          updatedAt: fechaHoraAnulacion,
          fechaAnulacion: fechaHoraAnulacion,
          usuarioAnulacion: userLabel,
          motivoAnulacion: motivoText,
          historialTrazabilidad: nextHistory,
        };
        return changedReq;
      }
      return r;
    });

    mirrorHotCacheToLocalStorage();
    if (changedReq) {
      void idbPutRequerimientos([changedReq], false);
    }
    broadcastLocalChange();

    // Actualizar en Firebase Firestore conservando el documento en historial
    firestoreUpdateRequerimientoEstado(target.id, 'ANULADO', {
      updatedAt: fechaHoraAnulacion,
      fechaAnulacion: fechaHoraAnulacion,
      usuarioAnulacion: userLabel,
      motivoAnulacion: motivoText,
      ...(updatedHistoryForFirestore ? { historialTrazabilidad: updatedHistoryForFirestore } : {}),
    }).catch((err) => {
      console.warn('[Firestore] Error actualizando anulación en Firestore:', err);
    });

    // Actualizar en el servidor web (Cloud)
    apiFetch(`/api/requerimientos/${encodeURIComponent(target.id)}/estado`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ 
        estado: 'ANULADO',
        fechaAnulacion: fechaHoraAnulacion,
        usuarioAnulacion: userLabel,
        motivoAnulacion: motivoText
      }),
      keepalive: true,
    })
      .then(async (res) => {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
          expressSessionRejected = true;
          closeRealtimeSse();
          notifyListeners();
          return;
        }
        if (res.ok && ct.includes('application/json')) {
          const json = await res.json();
          if (json.revision) {
            localStorage.setItem(LAST_REVISION_KEY, String(json.revision));
          }
        }
      })
      .catch((err) => {
        console.warn('[SYNC] Error al sincronizar anulación en el servidor web:', err);
      });

    return true;
  } catch (err) {
    console.error('Error al registrar anulación del requerimiento:', err);
    return false;
  }
}

// Eliminación forzada/física si fuese estrictamente necesario para depuración
export function hardDeleteRequerimiento(id: string): boolean {
  try {
    ensureMemInitialized();
    const target = memReqs.find((r) => r.id === id || r.numeroRequerimiento === id);
    if (!target) return false;

    removeRequerimientoFromMem(target.id);
    broadcastLocalChange();

    firestoreDeleteRequerimiento(target.id, target.numeroRequerimiento).catch((err) => {
      console.warn('[Firestore] Error purgando en Firestore:', err);
    });

    apiFetch(`/api/requerimientos/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      keepalive: true,
    }).catch(() => {});
    return true;
  } catch (err) {
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

// Reset data to clean empty state (no demo data)
export function resetDataToDefault(): void {
  ensureMemInitialized();
  memReqs = [];
  memDets = [];
  rebuildDetallesIndex();
  localStorage.setItem(REQ_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem(DET_STORAGE_KEY, JSON.stringify([]));
  void idbPutRequerimientos([], true);
  void idbPutDetalles([], true);
  broadcastLocalChange();
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
  zonas?: MaestroZona[];
  paraderos?: MaestroParadero[];
  comedores?: MaestroComedor[];
}): Promise<void> {
  try {
    const res = await apiFetch('/api/maestros', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
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

function persistMasterCatalogToFirestore(
  key: MasterCatalogKey,
  payload: Parameters<typeof firestoreSaveMasterData>[0]
): void {
  if (!isFirestoreAuthenticated()) {
    addPendingMasterSyncKey(key);
    notifyListeners();
    return;
  }
  firestoreSaveMasterData(payload)
    .then((ok) => {
      if (ok) {
        clearPendingMasterSyncKeys([key]);
        lastMasterSyncError = null;
      } else {
        addPendingMasterSyncKey(key);
      }
      notifyListeners();
    })
    .catch((err) => {
      addPendingMasterSyncKey(key);
      lastMasterSyncError = formatFriendlyFirestoreError(err);
      notifyListeners();
    });
}

export function saveStoredAreas(areas: MaestroArea[]): void {
  localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
  broadcastLocalChange();
  serverSaveMasterData({ areas });
  persistMasterCatalogToFirestore('areas', { areas });
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
  persistMasterCatalogToFirestore('fundos', { fundos });
}

function normalizeZoneKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function getStoredZonas(): MaestroZona[] {
  try {
    const raw = localStorage.getItem(ZONAS_STORAGE_KEY);
    if (!raw) {
      // Construir catálogo inicial combinando MAESTRO_ZONAS con cualquier zona específica ya presente en paraderos guardados
      const initial: MaestroZona[] = [...MAESTRO_ZONAS];
      const existingParaderos = getStoredParaderos();
      existingParaderos.forEach((p) => {
        const zName = (p.zonaEspecifica || '').trim();
        if (!zName || zName.toUpperCase() === 'NORTE' || zName.toUpperCase() === 'SUR') return;
        const already = initial.some(
          (z) => normalizeZoneKey(z.zona) === normalizeZoneKey(zName)
        );
        if (!already) {
          initial.push({
            id: `ZON-${Date.now()}-${initial.length + 1}`,
            zona: zName.toUpperCase(),
            macrozona: p.macrozona || undefined,
            agrupado: p.agrupador || undefined,
            zonaOperativa:
              p.zona ||
              (zName.toUpperCase().includes('CHAO') ? 'SUR' : 'NORTE'),
          });
        }
      });
      localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: MaestroZona[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return MAESTRO_ZONAS;
    }
    return parsed;
  } catch (err) {
    console.error('Error loading zonas:', err);
    return MAESTRO_ZONAS;
  }
}

export function saveStoredZonas(zonas: MaestroZona[]): void {
  localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(zonas));
  broadcastLocalChange();
  serverSaveMasterData({ zonas });
  persistMasterCatalogToFirestore('zonas', { zonas });
}

export interface ParaderoZonaInfo {
  zona: 'NORTE' | 'SUR';
  zonaId?: string;
  zonaEspecifica: string;
  macrozona: string;
  agrupador?: string;
  codigo?: string;
  referencia?: string;
}

export function getParaderoZonaInfo(name: string): ParaderoZonaInfo {
  const cleanName = (name || '').trim().toLowerCase();
  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();

  let matchedParadero: MaestroParadero | undefined;
  let zonasList: MaestroZona[] = MAESTRO_ZONAS;

  try {
    const rawZonas = localStorage.getItem(ZONAS_STORAGE_KEY);
    if (rawZonas) {
      const parsedZ = JSON.parse(rawZonas);
      if (Array.isArray(parsedZ) && parsedZ.length > 0) zonasList = parsedZ;
    }
  } catch {
    // fallback
  }

  try {
    const raw = localStorage.getItem(PARADEROS_STORAGE_KEY);
    const list: MaestroParadero[] = raw ? JSON.parse(raw) : MAESTRO_PARADEROS;
    if (Array.isArray(list) && list.length > 0) {
      const canonTarget = normalizeParaderoKey(name);
      matchedParadero =
        list.find((p) => p.paradero.trim().toLowerCase() === cleanName) ||
        list.find((p) => normalize(p.paradero) === normalize(cleanName)) ||
        list.find((p) => normalizeParaderoKey(p.paradero) === canonTarget) ||
        list.find((p) => {
          const pNorm = normalize(p.paradero);
          const cNorm = normalize(cleanName);
          return (
            (pNorm.length >= 3 && cNorm.includes(pNorm)) ||
            (cNorm.length >= 3 && pNorm.includes(cNorm))
          );
        });
    }
  } catch {
    // fallback
  }

  if (matchedParadero) {
    const matchedZonaObj = zonasList.find(
      (z) =>
        (matchedParadero!.zonaId && z.id === matchedParadero!.zonaId) ||
        (matchedParadero!.zonaEspecifica &&
          normalizeZoneKey(z.zona) === normalizeZoneKey(matchedParadero!.zonaEspecifica))
    );
    const zonaOp: 'NORTE' | 'SUR' =
      matchedParadero.zona ||
      matchedZonaObj?.zonaOperativa ||
      inferFallbackZonaFromKeyword(name);
    return {
      zona: zonaOp,
      zonaId: matchedZonaObj?.id || matchedParadero.zonaId,
      zonaEspecifica: matchedZonaObj?.zona || matchedParadero.zonaEspecifica || zonaOp,
      macrozona: matchedParadero.macrozona || matchedZonaObj?.macrozona || '',
      agrupador: matchedParadero.agrupador || matchedZonaObj?.agrupado,
      codigo: matchedParadero.codigo,
      referencia: matchedParadero.referencia,
    };
  }

  const fallbackOp = inferFallbackZonaFromKeyword(name);
  return {
    zona: fallbackOp,
    zonaEspecifica: fallbackOp,
    macrozona: '',
  };
}

function inferFallbackZonaFromKeyword(name: string): 'NORTE' | 'SUR' {
  const upper = (name || '').toUpperCase();
  if (
    upper.includes('CHAO') ||
    upper.includes('VALLE DE DIOS') ||
    upper.includes('REST') ||
    upper.includes('28') ||
    upper.includes('MV') ||
    upper.includes('MAR VERDE') ||
    upper.includes('GRAN CHIMU') ||
    upper.includes('GRIFO CHIMU') ||
    upper.includes('BOTICA') ||
    upper.includes('SEGUNDO PARADERO')
  ) {
    return 'SUR';
  }
  return 'NORTE';
}

export function inferParaderoZona(name: string): 'NORTE' | 'SUR' {
  return getParaderoZonaInfo(name).zona;
}

export function getStoredParaderos(): MaestroParadero[] {
  try {
    const raw = localStorage.getItem(PARADEROS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(MAESTRO_PARADEROS));
      return MAESTRO_PARADEROS;
    }
    const parsed: MaestroParadero[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return MAESTRO_PARADEROS;
    }
    return parsed;
  } catch (err) {
    console.error('Error loading paraderos:', err);
    return MAESTRO_PARADEROS;
  }
}

export function saveStoredParaderos(paraderos: MaestroParadero[]): void {
  localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(paraderos));
  broadcastLocalChange();
  serverSaveMasterData({ paraderos });
  persistMasterCatalogToFirestore('paraderos', { paraderos });
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
  persistMasterCatalogToFirestore('comedores', { comedores });
}

export function getStoredUnidadesBus(): MaestroUnidadBus[] {
  try {
    const raw = localStorage.getItem(UNIDADES_BUS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(UNIDADES_BUS_STORAGE_KEY, JSON.stringify(MAESTRO_UNIDADES_BUS));
      return MAESTRO_UNIDADES_BUS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return MAESTRO_UNIDADES_BUS;
    }
    return parsed;
  } catch (err) {
    console.error('Error loading unidades bus:', err);
    return MAESTRO_UNIDADES_BUS;
  }
}

export function saveStoredUnidadesBus(unidades: MaestroUnidadBus[]): void {
  localStorage.setItem(UNIDADES_BUS_STORAGE_KEY, JSON.stringify(unidades));
  broadcastLocalChange();
  persistMasterCatalogToFirestore('unidadesBus', { unidadesBus: unidades });
}

export function getStoredProgramacionesViajes(): ProgramacionViajesDia[] {
  ensureMemInitialized();
  return memProgs;
}

export function saveStoredProgramacionViaje(prog: ProgramacionViajesDia): void {
  try {
    ensureMemInitialized();
    const existingIndex = memProgs.findIndex((p) => p.id === prog.id);
    if (existingIndex >= 0) {
      memProgs = [...memProgs];
      memProgs[existingIndex] = prog;
    } else {
      memProgs = [prog, ...memProgs];
    }
    mirrorProgsToLocalStorage();
    void idbPutProgramaciones([prog], false);
    broadcastLocalChange();
  } catch (err) {
    console.error('Error saving programacion viaje:', err);
  }
}

export function deleteStoredProgramacionViaje(id: string): void {
  try {
    ensureMemInitialized();
    memProgs = memProgs.filter((p) => p.id !== id);
    mirrorProgsToLocalStorage();
    void idbPutProgramaciones(memProgs, true);
    broadcastLocalChange();
  } catch (err) {
    console.error('Error deleting programacion viaje:', err);
  }
}

export function resetMasterDataToDefault(): {
  areas: MaestroArea[];
  fundos: MaestroFundo[];
  zonas: MaestroZona[];
  paraderos: MaestroParadero[];
  comedores: MaestroComedor[];
  unidadesBus: MaestroUnidadBus[];
} {
  localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(MAESTRO_AREAS));
  localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(MAESTRO_FUNDOS));
  localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(MAESTRO_ZONAS));
  localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(MAESTRO_PARADEROS));
  localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(MAESTRO_COMEDORES));
  localStorage.setItem(UNIDADES_BUS_STORAGE_KEY, JSON.stringify(MAESTRO_UNIDADES_BUS));
  broadcastLocalChange();
  return {
    areas: MAESTRO_AREAS,
    fundos: MAESTRO_FUNDOS,
    zonas: MAESTRO_ZONAS,
    paraderos: MAESTRO_PARADEROS,
    comedores: MAESTRO_COMEDORES,
    unidadesBus: MAESTRO_UNIDADES_BUS,
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
// RESPALDO Y GESTIÓN INTEGRAL DE LA BASE DE DATOS LOCAL / HISTÓRICA
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
  serverHistoricalCount?: number | null;
  oldestFecha?: string | null;
}

export function getDatabaseStats(): DatabaseStats {
  const reqs = getStoredRequerimientos();
  const dets = getStoredDetalles();
  const areas = getStoredAreas();
  const fundos = getStoredFundos();
  const paraderos = getStoredParaderos();
  const comedores = getStoredComedores();

  const estimatedBytes =
    reqs.length * 680 +
    dets.length * 220 +
    (areas.length + fundos.length + paraderos.length + comedores.length) * 140;

  return {
    requerimientosCount: Math.max(reqs.length, serverTotalHistoricalCount || 0),
    detallesCount: dets.length,
    areasCount: areas.length,
    fundosCount: fundos.length,
    paraderosCount: paraderos.length,
    comedoresCount: comedores.length,
    totalSizeKB: Math.round((estimatedBytes / 1024) * 10) / 10,
    lastUpdated: reqs[0]?.fechaRegistro || new Date().toISOString(),
    serverHistoricalCount: serverTotalHistoricalCount,
    oldestFecha: serverOldestFecha,
  };
}

export function exportFullDatabaseBackup(): void {
  const backup = {
    sistema: 'CAMPOSOL - Sistema de Gestión y Requerimiento de Transporte',
    version: '2.0.0',
    fechaExportacion: new Date().toISOString(),
    datos: {
      requerimientos: getStoredRequerimientos(),
      detalles: getStoredDetalles(),
      areas: getStoredAreas(),
      fundos: getStoredFundos(),
      zonas: getStoredZonas(),
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
    ensureMemInitialized();
    const parsed = JSON.parse(rawJson);
    const data = parsed.datos || parsed;

    if (!data.requerimientos || !Array.isArray(data.requerimientos)) {
      return { success: false, message: 'El archivo no contiene un formato de requerimientos válido.' };
    }

    memReqs = (data.requerimientos as Requerimiento[])
      .filter((r) => r && r.id && !isLegacyDemoReq(r))
      .sort((a, b) => (b.fechaRegistro || '').localeCompare(a.fechaRegistro || ''));
    void idbPutRequerimientos(memReqs, true);

    if (Array.isArray(data.detalles)) {
      memDets = (data.detalles as DetalleRequerimiento[]).filter((d) => d && d.id && !isLegacyDemoDet(d));
      rebuildDetallesIndex();
      void idbPutDetalles(memDets, true);
    }
    mirrorHotCacheToLocalStorage();

    if (Array.isArray(data.areas)) {
      localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(data.areas));
    }
    if (Array.isArray(data.fundos)) {
      localStorage.setItem(FUNDOS_STORAGE_KEY, JSON.stringify(data.fundos));
    }
    if (Array.isArray(data.zonas)) {
      localStorage.setItem(ZONAS_STORAGE_KEY, JSON.stringify(data.zonas));
    }
    if (Array.isArray(data.paraderos)) {
      localStorage.setItem(PARADEROS_STORAGE_KEY, JSON.stringify(data.paraderos));
    }
    if (Array.isArray(data.comedores)) {
      localStorage.setItem(COMEDORES_STORAGE_KEY, JSON.stringify(data.comedores));
    }

    broadcastLocalChange();
    return { success: true, message: `Base de datos restaurada con éxito (${memReqs.length} requerimientos).` };
  } catch (err) {
    return { success: false, message: 'Error al procesar el archivo JSON: ' + (err instanceof Error ? err.message : String(err)) };
  }
}
