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

// Validar sesión activa en segundo plano contra el servidor
export async function verifySessionWithServer(): Promise<AppUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/session', {
      headers: {
        ...getAuthHeaders(),
        'Cache-Control': 'no-cache',
      },
    });
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
    return getActiveSessionUser();
  }
}

// Inicio de sesión estricto contra servidor (con respaldo offline SHA-256 sólo si no hay red)
export async function authenticateUser(
  usuario: string,
  contrasena: string,
  honeypot: string = ''
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  const cleanUsername = usuario.trim().toLowerCase();
  const cleanPass = contrasena.trim();

  if (!cleanUsername || !cleanPass) {
    return { success: false, error: 'Ingrese su usuario y contraseña.' };
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: cleanUsername,
        contrasena: cleanPass,
        _hp: honeypot,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.success && data?.user && data?.token) {
      const safeUser = stripSensitiveFields(data.user);
      setAuthToken(data.token);
      setActiveSessionUser(safeUser);
      return { success: true, user: safeUser };
    }

    return {
      success: false,
      error: data?.error || 'Usuario o contraseña incorrectos. Verifique sus datos e intente nuevamente.',
    };
  } catch {
    // Fallback estrictamente cuando no hay conectividad de red con el servidor
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      return {
        success: false,
        error: 'No se pudo conectar con el servicio de autenticación. Intente nuevamente.',
      };
    }

    const offlineMatch = INITIAL_USERS.find((u) => u.usuario.toLowerCase() === cleanUsername);
    if (offlineMatch && offlineMatch.estado === 'ACTIVO') {
      try {
        const computed = await hashPassword(cleanPass, offlineMatch.salt);
        if (computed === offlineMatch.passwordHash) {
          const safeUser = stripSensitiveFields(offlineMatch);
          setActiveSessionUser(safeUser);
          return { success: true, user: safeUser };
        }
      } catch {
        // ignore
      }
    }

    return {
      success: false,
      error: 'Sin conexión a internet. Conéctese a la red para iniciar sesión por primera vez.',
    };
  }
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
