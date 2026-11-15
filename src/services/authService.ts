import { AppUser, UserRole, UserStatus } from '../types';
import { firestoreSaveUser, firestoreDeleteUser } from './firestoreService';

const USERS_STORAGE_KEY = 'camposol_users_v2';
const SESSION_STORAGE_KEY = 'camposol_session_user_v2';
const AUTH_TOKEN_STORAGE_KEY = 'camposol_auth_token_v1';
const DEFAULT_SALT = 'camposol_salt_2026';

// Hash SHA-256 usando Web Crypto API (sin fallbacks inseguros)
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const normalized = password.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${normalized}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Entorno sin soporte criptográfico seguro.');
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

// Obtener usuarios cacheados localmente (sin credenciales sensibles)
export function getStoredUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const users: AppUser[] = JSON.parse(raw);
    if (!Array.isArray(users)) {
      return [];
    }
    return users.map(stripSensitiveFields);
  } catch {
    return [];
  }
}

export function saveStoredUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.map(stripSensitiveFields)));
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

async function postJsonApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ reachableJson: boolean; res?: Response; data?: any }> {
  for (const url of getApiCandidates(endpoint)) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        return { reachableJson: true, res, data };
      }
      // Si respondió 404/405 HTML (posible proxy de subruta o hosting estático), probar siguiente ruta
    } catch {
      // Error de red en esta ruta
    }
  }
  return { reachableJson: false };
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

  const cleanUsername = usuario.trim().toLowerCase();
  const cleanPass = contrasena.trim();

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

  const staticMatch = INITIAL_USERS.find((u) => u.usuario.toLowerCase() === cleanUsername);
  if (staticMatch) {
    try {
      const computed = await hashPassword(cleanPass, staticMatch.salt);
      if (computed === staticMatch.passwordHash) {
        if (staticMatch.estado !== 'ACTIVO') {
          return {
            success: false,
            error: 'SU USUARIO SE ENCUENTRA INACTIVO. CONTACTE AL ADMINISTRADOR.',
          };
        }
        recordStaticLoginFail(cleanUsername, true);
        const safeUser = stripSensitiveFields(staticMatch);
        setAuthToken(`static.${safeUser.id}.${Date.now()}`);
        setActiveSessionUser(safeUser);
        return { success: true, user: safeUser };
      }
    } catch {
      // ignore crypto error
    }
  }

  recordStaticLoginFail(cleanUsername, false);
  return {
    success: false,
    error: 'Usuario o contraseña incorrectos. Verifique sus datos e intente nuevamente.',
  };
}

// Crear nuevo usuario (Solo Administrador vía API autenticada)
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
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'No se pudo crear el usuario.' };
    }

    const safeUser = stripSensitiveFields(json.user);
    const updated = [...getStoredUsers(), safeUser];
    saveStoredUsers(updated);
    firestoreSaveUser(safeUser).catch(() => {});

    return { success: true, user: safeUser };
  } catch {
    return { success: false, error: 'Error de red al crear el usuario.' };
  }
}

// Actualizar usuario existente (Solo Administrador vía API autenticada)
export async function updateExistingUser(
  userId: string,
  updates: Partial<Omit<AppUser, 'id' | 'passwordHash' | 'salt'>> & { nuevaContrasena?: string }
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(updates),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'No se pudo actualizar el usuario.' };
    }

    const safeUser = stripSensitiveFields(json.user);
    const updatedList = getStoredUsers().map((u) => (u.id === userId ? safeUser : u));
    saveStoredUsers(updatedList);
    firestoreSaveUser(safeUser).catch(() => {});

    const currentSession = getActiveSessionUser();
    if (currentSession && currentSession.id === userId) {
      setActiveSessionUser(safeUser);
    }

    return { success: true, user: safeUser };
  } catch {
    return { success: false, error: 'Error de red al actualizar usuario.' };
  }
}

// Activar o Desactivar usuario (Solo Administrador vía API autenticada)
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

// Eliminar usuario del sistema (Solo Administrador vía API autenticada)
export async function deleteStoredUser(
  userId: string,
  currentAdminId?: string
): Promise<{ success: boolean; error?: string }> {
  if (currentAdminId && userId === currentAdminId) {
    return { success: false, error: 'No puedes eliminar tu propia cuenta de administrador en sesión.' };
  }

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'No fue posible eliminar el usuario.' };
    }

    const remaining = getStoredUsers().filter((u) => u.id !== userId);
    saveStoredUsers(remaining);
    firestoreDeleteUser(userId).catch(() => {});
    return { success: true };
  } catch {
    return { success: false, error: 'Error de red al eliminar usuario.' };
  }
}

// Restablecer contraseña de usuario (Solo Administrador vía API autenticada)
export async function resetUserPassword(
  userId: string,
  nuevaContrasena: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPass = nuevaContrasena.trim();
  if (cleanPass.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' };
  }

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ nuevaContrasena: cleanPass }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return { success: false, error: json?.error || 'No se pudo restablecer la contraseña.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Error de red al restablecer contraseña.' };
  }
}

// Solicitar recuperación segura de contraseña (sin enumeración ni inicio de sesión directo)
export async function requestPasswordRecovery(
  identifier: string,
  honeypot: string = ''
): Promise<{ success: boolean; error?: string; message?: string }> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) {
    return {
      success: false,
      error: 'Por favor ingrese su usuario o correo electrónico registrado.',
    };
  }

  try {
    const res = await fetch('/api/auth/recover-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clean, _hp: honeypot }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || 'No se pudo procesar la solicitud en este momento.',
      };
    }
    return {
      success: true,
      message: json.message,
    };
  } catch {
    return {
      success: false,
      error: 'Se requiere conexión a internet para enviar una solicitud de recuperación.',
    };
  }
}
