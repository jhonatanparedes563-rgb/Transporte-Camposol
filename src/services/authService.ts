import { AppUser, UserRole, UserStatus } from '../types';
import { firestoreSaveUser, firestoreDeleteUser } from './firestoreService';

const USERS_STORAGE_KEY = 'camposol_users_v2';
const SESSION_STORAGE_KEY = 'camposol_session_user_v2';
const AUTH_TOKEN_STORAGE_KEY = 'camposol_auth_token_v1';
const DEFAULT_SALT = 'camposol_salt_2026';

const LEGACY_MISMATCHED_HEX = '8b7fca13f70e9b9868778d91c1074bf820689b0d10bc94ebcfb0efda21bf4687';

function normalizeCredentialText(value: string): string {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim();
}

// Implementación estándar FIPS 180-4 SHA-256 para entornos móviles/WebView sin crypto.subtle (HTTP local / APK)
function sha256HexPure(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return Array.from(H)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

// Hash SHA-256 usando Web Crypto API con respaldo matemático SHA-256 idéntico para WebViews/HTTP móvil
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const normalized = normalizeCredentialText(password);
  const input = `${salt}:${normalized}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Continuar con cálculo SHA-256 estándar en JS
    }
  }
  return sha256HexPure(input);
}

// Cuentas iniciales operativas (las contraseñas reales se gestionan en el servidor con scrypt)
export const INITIAL_USERS: AppUser[] = [
  {
    id: 'usr-admin-01',
    nombre: 'Administrador del Sistema',
    usuario: 'admin',
    email: 'admin@camposol.com.pe',
    passwordHash: '6620edc65886f1eb068e77323d7116dcdde2942fb3192b61df14ab24e614f238',
    salt: DEFAULT_SALT,
    rol: 'admin',
    area: 'TDP',
    fundo: 'SEDE CENTRAL',
    cultivo: 'TODOS LOS CULTIVOS',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-rec-01',
    nombre: 'Roberto Gonzáles',
    usuario: 'receptor',
    email: 'rgonzales@camposol.com.pe',
    passwordHash: '6620edc65886f1eb068e77323d7116dcdde2942fb3192b61df14ab24e614f238',
    salt: DEFAULT_SALT,
    rol: 'receptor',
    area: 'LOGÍSTICA',
    fundo: 'TODOS LOS FUNDOS',
    cultivo: 'TODOS LOS CULTIVOS',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-user-01',
    nombre: 'Juan Pérez',
    usuario: 'jperez',
    email: 'jperez@camposol.com.pe',
    passwordHash: '6620edc65886f1eb068e77323d7116dcdde2942fb3192b61df14ab24e614f238',
    salt: DEFAULT_SALT,
    rol: 'usuario',
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 2',
    cultivo: 'ARÁNDANO',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-user-02',
    nombre: 'María Salazar',
    usuario: 'msalazar',
    email: 'msalazar@camposol.com.pe',
    passwordHash: '6620edc65886f1eb068e77323d7116dcdde2942fb3192b61df14ab24e614f238',
    salt: DEFAULT_SALT,
    rol: 'usuario',
    area: 'EMPAQUE',
    fundo: 'MAR VERDE',
    cultivo: 'PALTO',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-user-03',
    nombre: 'Carlos Mendoza',
    usuario: 'cmendoza',
    email: 'cmendoza@camposol.com.pe',
    passwordHash: '6620edc65886f1eb068e77323d7116dcdde2942fb3192b61df14ab24e614f238',
    salt: DEFAULT_SALT,
    rol: 'usuario',
    area: 'COSECHA',
    fundo: 'ARENAL',
    cultivo: 'ESPÁRRAGO',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
  {
    id: 'usr-1790015788736-kxw1',
    nombre: 'Esther Paredes Rodríguez',
    usuario: 'eparedes',
    email: 'eparedes@camposol.com.pe',
    passwordHash: 'b523dee8452452e32dd5bd63b3b158264e31f6fadb6ed88008b14eaf8a3c00d6',
    salt: DEFAULT_SALT,
    rol: 'usuario',
    area: 'PRODUCCIÓN',
    fundo: 'AGRICULTOR 1',
    cultivo: 'ARÁNDANO',
    estado: 'ACTIVO',
    fechaCreacion: '2026-09-01T08:00:00Z',
  },
];

function stripSensitiveFields(user: AppUser): AppUser {
  const { passwordHash: _ph, salt: _s, ...rest } = user;
  return {
    ...rest,
    passwordHash: '',
    salt: '',
  };
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const STATIC_CREDS_STORAGE_KEY = 'camposol_static_creds_v1';

type StaticCredEntry = { passwordHash: string; salt: string; adminUpdated?: boolean };
type StaticCredMap = Record<string, StaticCredEntry>;

function isValidSha256Hex(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash) && hash.toLowerCase() !== LEGACY_MISMATCHED_HEX;
}

function readStaticCreds(): StaticCredMap {
  try {
    const raw = localStorage.getItem(STATIC_CREDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: StaticCredMap = {};
    let pruned = false;
    for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
      if (v && isValidSha256Hex(v.passwordHash)) {
        clean[k] = {
          passwordHash: v.passwordHash,
          salt: typeof v.salt === 'string' && v.salt ? v.salt : DEFAULT_SALT,
          ...(v.adminUpdated ? { adminUpdated: true } : {}),
        };
      } else {
        pruned = true;
      }
    }
    if (pruned) {
      writeStaticCreds(clean);
    }
    return clean;
  } catch {
    return {};
  }
}

function writeStaticCreds(map: StaticCredMap): void {
  try {
    localStorage.setItem(STATIC_CREDS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function migrateLegacyHashesFromRawUsers(): void {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return;
    const users = JSON.parse(raw) as AppUser[];
    if (!Array.isArray(users)) return;
    const creds = readStaticCreds();
    let changed = false;
    for (const u of users) {
      if (u && u.id && isValidSha256Hex(u.passwordHash) && !creds[u.id]) {
        creds[u.id] = { passwordHash: u.passwordHash, salt: u.salt || DEFAULT_SALT };
        changed = true;
      }
    }
    if (changed) {
      writeStaticCreds(creds);
    }
  } catch {
    // ignore
  }
}

// Obtener usuarios cacheados localmente (sin credenciales sensibles)
export function getStoredUsers(): AppUser[] {
  try {
    migrateLegacyHashesFromRawUsers();
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      return INITIAL_USERS.map(stripSensitiveFields);
    }
    const users: AppUser[] = JSON.parse(raw);
    if (!Array.isArray(users) || users.length === 0) {
      return INITIAL_USERS.map(stripSensitiveFields);
    }
    return users.map(stripSensitiveFields);
  } catch {
    return INITIAL_USERS.map(stripSensitiveFields);
  }
}

export function saveStoredUsers(users: AppUser[]): void {
  try {
    migrateLegacyHashesFromRawUsers();
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.map(stripSensitiveFields)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('camposol_data_changed'));
    }
  } catch {
    // ignore
  }
}

// Obtener usuario con sesión activa (requiere token vigente + usuario activo)
export function getActiveSessionUser(): AppUser | null {
  try {
    const token = getAuthToken();
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!token || !raw) {
      return null;
    }
    const sessionUser: AppUser = JSON.parse(raw);
    if (!sessionUser || !sessionUser.id || sessionUser.estado !== 'ACTIVO') {
      clearActiveSession();
      return null;
    }
    return stripSensitiveFields(sessionUser);
  } catch {
    return null;
  }
}

export function setActiveSessionUser(user: AppUser): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stripSensitiveFields(user)));
  } catch {
    // ignore
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const getCurrentSession = getActiveSessionUser;

export function logoutSession(): void {
  clearActiveSession();
  if (typeof fetch !== 'undefined') {
    fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
  }
}

const STATIC_FAIL_KEY = 'camposol_static_login_fails_v1';

function isStaticToken(token: string | null): boolean {
  return Boolean(token && token.startsWith('static.'));
}

function getApiCandidates(endpoint: string): string[] {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const candidates = [clean];
  const baseUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL
      ? String((import.meta as any).env.BASE_URL)
      : '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  if (normalizedBase && normalizedBase !== '') {
    const prefixed = `${normalizedBase}${clean}`;
    if (!candidates.includes(prefixed)) {
      candidates.push(prefixed);
    }
  }
  return candidates;
}

async function fetchJsonApi(
  endpoint: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    auth?: boolean;
  } = {}
): Promise<{ reachableJson: boolean; res?: Response; data?: any }> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth) {
    Object.assign(headers, getAuthHeaders());
  }

  for (const url of getApiCandidates(endpoint)) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (timer) clearTimeout(timer);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        return { reachableJson: true, res, data };
      }
    } catch {
      if (timer) clearTimeout(timer);
      // Error de red, timeout o ruta no disponible en este origen
    }
  }
  return { reachableJson: false };
}

async function postJsonApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ reachableJson: boolean; res?: Response; data?: any }> {
  return fetchJsonApi(endpoint, { method: 'POST', body });
}

function checkStaticRateLimit(username: string): string | null {
  try {
    const raw = sessionStorage.getItem(STATIC_FAIL_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { count: number; resetAt: number }>;
    const rec = map[username];
    if (rec && Date.now() <= rec.resetAt && rec.count >= 8) {
      const mins = Math.max(1, Math.ceil((rec.resetAt - Date.now()) / 60000));
      return `Demasiados intentos fallidos. Por seguridad, espere ${mins} min e intente nuevamente.`;
    }
  } catch {
    // ignore
  }
  return null;
}

function recordStaticLoginFail(username: string, reset: boolean = false): void {
  try {
    const raw = sessionStorage.getItem(STATIC_FAIL_KEY);
    const map: Record<string, { count: number; resetAt: number }> = raw ? JSON.parse(raw) : {};
    if (reset) {
      delete map[username];
    } else {
      const cur = map[username];
      if (!cur || Date.now() > cur.resetAt) {
        map[username] = { count: 1, resetAt: Date.now() + 10 * 60 * 1000 };
      } else {
        cur.count += 1;
      }
    }
    sessionStorage.setItem(STATIC_FAIL_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// Validar sesión activa en segundo plano contra el servidor
export async function verifySessionWithServer(): Promise<AppUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  if (isStaticToken(token)) {
    return getActiveSessionUser();
  }
  for (const url of getApiCandidates('/api/auth/session')) {
    try {
      const res = await fetch(url, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache',
        },
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('application/json')) continue;

      if (res.status === 401 || res.status === 403) {
        clearActiveSession();
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          const sanitized = stripSensitiveFields(data.user);
          setActiveSessionUser(sanitized);
          return sanitized;
        }
      }
      return getActiveSessionUser();
    } catch {
      // Si está sin conexión en campo, mantener la sesión local válida hasta recuperar red
    }
  }
  return getActiveSessionUser();
}

// Inicio de sesión estricto contra servidor Express (y respaldo SHA-256 verificado sólo si el host es estático/sin backend o sin red)
export async function authenticateUser(
  usuario: string,
  contrasena: string,
  honeypot: string = ''
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  if (honeypot.trim().length > 0) {
    return { success: false, error: 'Solicitud rechazada por validación de seguridad.' };
  }

  const cleanUsername = normalizeCredentialText(usuario).toLowerCase();
  const cleanPass = normalizeCredentialText(contrasena);

  if (!cleanUsername || !cleanPass) {
    return { success: false, error: 'Ingrese su usuario y contraseña.' };
  }

  const apiAttempt = await postJsonApi('/api/auth/login', {
    usuario: cleanUsername,
    contrasena: cleanPass,
    _hp: honeypot,
  });

  if (apiAttempt.reachableJson && apiAttempt.res) {
    const { res, data } = apiAttempt;
    if (res.ok && data?.success && data?.user && data?.token) {
      const safeUser = stripSensitiveFields(data.user);
      setAuthToken(data.token);
      setActiveSessionUser(safeUser);
      return { success: true, user: safeUser };
    }

    return {
      success: false,
      error: data?.error || 'Usuario o contraseña incorrectos. Verifique sus credenciales e intente nuevamente.',
    };
  }

  // Solo si el servidor backend no existe en este entorno (ej. despliegue estático / offline sin API JSON)
  const cooldownMsg = checkStaticRateLimit(cleanUsername);
  if (cooldownMsg) {
    return { success: false, error: cooldownMsg };
  }

  migrateLegacyHashesFromRawUsers();
  const credsMap = readStaticCreds();
  const storedUsers = getStoredUsers();
  const mergedCandidates: AppUser[] = [...storedUsers];
  for (const seed of INITIAL_USERS) {
    if (!mergedCandidates.some((u) => u.usuario.toLowerCase() === seed.usuario.toLowerCase())) {
      mergedCandidates.push(seed);
    }
  }

  const staticMatch = mergedCandidates.find((u) => u.usuario.toLowerCase() === cleanUsername);
  if (staticMatch) {
    const seedMatch = INITIAL_USERS.find(
      (u) => u.id === staticMatch.id || u.usuario.toLowerCase() === cleanUsername
    );
    const localCred = credsMap[staticMatch.id] || (seedMatch ? credsMap[seedMatch.id] : undefined);
    const candidateCreds: StaticCredEntry[] = [];
    if (localCred && isValidSha256Hex(localCred.passwordHash)) {
      candidateCreds.push(localCred);
    }
    if (seedMatch && isValidSha256Hex(seedMatch.passwordHash) && !localCred?.adminUpdated) {
      candidateCreds.push({ passwordHash: seedMatch.passwordHash, salt: seedMatch.salt });
    }

    let matched = false;
    for (const cred of candidateCreds) {
      try {
        const computed = await hashPassword(cleanPass, cred.salt || DEFAULT_SALT);
        if (computed === cred.passwordHash) {
          matched = true;
          break;
        }
      } catch {
        // ignore crypto error
      }
    }

    if (matched) {
      if (staticMatch.estado !== 'ACTIVO') {
        return {
          success: false,
          error: 'SU USUARIO SE ENCUENTRA INACTIVO. CONTACTE AL ADMINISTRADOR.',
        };
      }
      if (localCred && !localCred.adminUpdated && seedMatch) {
        delete credsMap[staticMatch.id];
        writeStaticCreds(credsMap);
      }
      recordStaticLoginFail(cleanUsername, true);
      const safeUser = stripSensitiveFields({
        ...staticMatch,
        ultimoAcceso: new Date().toISOString(),
      });
      setAuthToken(`static.${safeUser.id}.${Date.now()}`);
      setActiveSessionUser(safeUser);
      return { success: true, user: safeUser };
    }
  }

  recordStaticLoginFail(cleanUsername, false);
  return {
    success: false,
    error: 'Usuario o contraseña incorrectos. Verifique sus datos e intente nuevamente.',
  };
}

const ADMIN_REQUIRED_MSG = 'Se requiere sesión de Administrador activa para realizar esta acción.';

function getAuthorizedLocalAdmin(): AppUser | null {
  const actor = getActiveSessionUser();
  if (!actor || actor.rol !== 'admin' || actor.estado !== 'ACTIVO') {
    return null;
  }
  return actor;
}

// Crear nuevo usuario (Solo Administrador vía API autenticada o modo estático verificado)
export async function createNewUser(data: {
  nombre: string;
  usuario: string;
  email?: string;
  contrasena: string;
  rol: UserRole;
  area: string;
  fundo: string;
  cultivo?: string;
  estado: UserStatus;
}): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const cleanUsername = data.usuario.trim().toLowerCase();
  const cleanNombre = data.nombre.trim();
  const cleanPass = data.contrasena.trim();

  if (!cleanNombre || cleanNombre.length < 2) {
    return { success: false, error: 'El nombre completo es obligatorio (mín. 2 caracteres).' };
  }
  if (!/^[a-zA-Z0-9._\-]{3,32}$/.test(cleanUsername)) {
    return { success: false, error: 'El usuario debe tener entre 3 y 32 caracteres válidos.' };
  }
  if (cleanPass.length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  const token = getAuthToken();
  if (!isStaticToken(token)) {
    const attempt = await fetchJsonApi('/api/users', {
      method: 'POST',
      auth: true,
      body: data as unknown as Record<string, unknown>,
    });

    if (attempt.reachableJson && attempt.res) {
      if (!attempt.res.ok || !attempt.data?.success) {
        return { success: false, error: attempt.data?.error || 'No se pudo crear el usuario.' };
      }
      const safeUser = stripSensitiveFields(attempt.data.user);
      const existing = getStoredUsers();
      saveStoredUsers([...existing, safeUser]);
      firestoreSaveUser(safeUser).catch(() => {});
      return { success: true, user: safeUser };
    }
  }

  const localAdmin = getAuthorizedLocalAdmin();
  if (!localAdmin) return { success: false, error: ADMIN_REQUIRED_MSG };

  const currentUsers = getStoredUsers();
  if (currentUsers.some((u) => u.usuario.toLowerCase() === cleanUsername)) {
    return { success: false, error: `El usuario "${cleanUsername}" ya existe en el sistema.` };
  }

  const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const passwordHash = await hashPassword(cleanPass, DEFAULT_SALT);
  const creds = readStaticCreds();
  creds[newId] = { passwordHash, salt: DEFAULT_SALT, adminUpdated: true };
  writeStaticCreds(creds);

  const safeUser = stripSensitiveFields({
    id: newId,
    nombre: cleanNombre,
    usuario: cleanUsername,
    email: (data.email || `${cleanUsername}@camposol.com.pe`).trim().toLowerCase(),
    passwordHash: '',
    salt: '',
    rol: data.rol,
    area: data.area || 'PRODUCCIÓN',
    fundo: data.fundo || 'AGRICULTOR 2',
    cultivo: data.cultivo || (data.rol === 'usuario' ? 'ARÁNDANO' : 'TODOS LOS CULTIVOS'),
    estado: data.estado || 'ACTIVO',
    fechaCreacion: new Date().toISOString(),
  });

  saveStoredUsers([...currentUsers, safeUser]);
  firestoreSaveUser(safeUser).catch(() => {});
  return { success: true, user: safeUser };
}

// Actualizar usuario existente (Solo Administrador vía API autenticada o modo estático verificado)
export async function updateExistingUser(
  userId: string,
  updates: Partial<Omit<AppUser, 'id' | 'passwordHash' | 'salt'>> & { nuevaContrasena?: string }
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const token = getAuthToken();
  if (!isStaticToken(token)) {
    const attempt = await fetchJsonApi(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      auth: true,
      body: updates as unknown as Record<string, unknown>,
    });

    if (attempt.reachableJson && attempt.res) {
      if (!attempt.res.ok || !attempt.data?.success) {
        return { success: false, error: attempt.data?.error || 'No se pudo actualizar el usuario.' };
      }

      const safeUser = stripSensitiveFields(attempt.data.user);
      const list = getStoredUsers();
      const existsLocally = list.some((u) => u.id === userId);
      const updatedList = existsLocally
        ? list.map((u) => (u.id === userId ? safeUser : u))
        : [...list, safeUser];
      saveStoredUsers(updatedList);
      firestoreSaveUser(safeUser).catch(() => {});

      const currentSession = getActiveSessionUser();
      if (currentSession && currentSession.id === userId) {
        setActiveSessionUser(safeUser);
      }

      return { success: true, user: safeUser };
    }
  }

  const localAdmin = getAuthorizedLocalAdmin();
  if (!localAdmin) return { success: false, error: ADMIN_REQUIRED_MSG };

  const currentUsers = getStoredUsers();
  const target = currentUsers.find((u) => u.id === userId);
  if (!target) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  const cleanUsername = updates.usuario ? updates.usuario.trim().toLowerCase() : target.usuario;
  if (!/^[a-zA-Z0-9._\-]{3,32}$/.test(cleanUsername)) {
    return { success: false, error: 'Nombre de usuario con formato inválido.' };
  }
  if (currentUsers.some((u) => u.id !== userId && u.usuario.toLowerCase() === cleanUsername)) {
    return { success: false, error: `El usuario "${cleanUsername}" ya está en uso.` };
  }
  if (target.id === localAdmin.id && updates.estado === 'INACTIVO') {
    return { success: false, error: 'No puedes desactivar tu propia cuenta de administrador.' };
  }

  if (updates.nuevaContrasena && updates.nuevaContrasena.trim()) {
    const np = updates.nuevaContrasena.trim();
    if (np.length < 8) {
      return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    const creds = readStaticCreds();
    creds[userId] = { passwordHash: await hashPassword(np, DEFAULT_SALT), salt: DEFAULT_SALT, adminUpdated: true };
    writeStaticCreds(creds);
  }

  const safeUser = stripSensitiveFields({
    ...target,
    ...updates,
    id: target.id,
    usuario: cleanUsername,
    nombre: updates.nombre !== undefined ? updates.nombre.trim() : target.nombre,
    email: updates.email !== undefined ? updates.email.trim().toLowerCase() : target.email,
    passwordHash: '',
    salt: '',
  });

  saveStoredUsers(currentUsers.map((u) => (u.id === userId ? safeUser : u)));
  firestoreSaveUser(safeUser).catch(() => {});

  const currentSession = getActiveSessionUser();
  if (currentSession && currentSession.id === userId) {
    setActiveSessionUser(safeUser);
  }

  return { success: true, user: safeUser };
}

// Activar o Desactivar usuario (Solo Administrador)
export async function toggleUserStatus(
  userId: string
): Promise<{ success: boolean; newStatus?: UserStatus; error?: string }> {
  const current = getStoredUsers().find((u) => u.id === userId);
  if (!current) {
    return { success: false, error: 'Usuario no encontrado.' };
  }
  const nextStatus: UserStatus = current.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  const res = await updateExistingUser(userId, { estado: nextStatus });
  if (!res.success || !res.user) {
    return { success: false, error: res.error };
  }
  return { success: true, newStatus: res.user.estado };
}

// Eliminar usuario del sistema (Solo Administrador vía API autenticada o modo estático verificado)
export async function deleteStoredUser(
  userId: string,
  currentAdminId?: string
): Promise<{ success: boolean; error?: string }> {
  if (currentAdminId && userId === currentAdminId) {
    return { success: false, error: 'No puedes eliminar tu propia cuenta de administrador en sesión.' };
  }

  const token = getAuthToken();
  if (!isStaticToken(token)) {
    const attempt = await fetchJsonApi(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      auth: true,
    });

    if (attempt.reachableJson && attempt.res) {
      if (!attempt.res.ok || !attempt.data?.success) {
        return { success: false, error: attempt.data?.error || 'No fue posible eliminar el usuario.' };
      }

      const remaining = getStoredUsers().filter((u) => u.id !== userId);
      saveStoredUsers(remaining);
      firestoreDeleteUser(userId).catch(() => {});
      return { success: true };
    }
  }

  const localAdmin = getAuthorizedLocalAdmin();
  if (!localAdmin) return { success: false, error: ADMIN_REQUIRED_MSG };
  if (userId === localAdmin.id) {
    return { success: false, error: 'No puedes eliminar tu propia cuenta de administrador en sesión.' };
  }

  const creds = readStaticCreds();
  delete creds[userId];
  writeStaticCreds(creds);

  const remaining = getStoredUsers().filter((u) => u.id !== userId);
  saveStoredUsers(remaining);
  firestoreDeleteUser(userId).catch(() => {});
  return { success: true };
}

// Restablecer contraseña de usuario (Solo Administrador vía API autenticada o modo estático verificado)
export async function resetUserPassword(
  userId: string,
  nuevaContrasena: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPass = nuevaContrasena.trim();
  if (cleanPass.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  const token = getAuthToken();
  if (!isStaticToken(token)) {
    const attempt = await fetchJsonApi(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      auth: true,
      body: { nuevaContrasena: cleanPass },
    });

    if (attempt.reachableJson && attempt.res) {
      if (!attempt.res.ok || !attempt.data?.success) {
        return { success: false, error: attempt.data?.error || 'No se pudo restablecer la contraseña.' };
      }
      return { success: true };
    }
  }

  const localAdmin = getAuthorizedLocalAdmin();
  if (!localAdmin) return { success: false, error: ADMIN_REQUIRED_MSG };

  const target = getStoredUsers().find((u) => u.id === userId);
  if (!target) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  const creds = readStaticCreds();
  creds[userId] = { passwordHash: await hashPassword(cleanPass, DEFAULT_SALT), salt: DEFAULT_SALT, adminUpdated: true };
  writeStaticCreds(creds);
  return { success: true };
}

// Solicitar recuperación segura de contraseña (sin enumeración ni inicio de sesión directo)
export async function requestPasswordRecovery(
  identifier: string,
  honeypot: string = ''
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (honeypot.trim().length > 0) {
    return { success: false, error: 'Solicitud rechazada por validación de seguridad.' };
  }

  const clean = identifier.trim().toLowerCase();
  if (!clean) {
    return {
      success: false,
      error: 'Por favor ingrese su usuario o correo electrónico registrado.',
    };
  }

  const attempt = await postJsonApi('/api/auth/recover-request', {
    identifier: clean,
    _hp: honeypot,
  });

  if (attempt.reachableJson && attempt.res) {
    if (!attempt.res.ok || !attempt.data?.success) {
      return {
        success: false,
        error: attempt.data?.error || 'No se pudo procesar la solicitud en este momento.',
      };
    }
    return {
      success: true,
      message: attempt.data.message,
    };
  }

  // En despliegue estático sin backend API, devolver respuesta uniforme sin enumeración ni fuga de datos
  return {
    success: true,
    message:
      'Si los datos corresponden a una cuenta activa de CAMPOSOL, comuníquese con el Administrador del Sistema de Transporte para restablecer su acceso de forma segura.',
  };
}
