import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  INITIAL_REQUERIMIENTOS,
  INITIAL_DETALLES,
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_ZONAS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from './src/data/masterData';
import { INITIAL_USERS } from './src/services/authService';
import {
  Requerimiento,
  DetalleRequerimiento,
  AppUser,
  RequerimientoDraft,
  MaestroZona,
  MaestroParadero,
  MaestroArea,
  MaestroFundo,
  MaestroComedor,
  UserRole,
  EstadoRequerimiento,
} from './src/types';

interface RecoveryTicket {
  id: string;
  userId: string;
  usuario: string;
  nombre: string;
  requestedAt: string;
  ip: string;
  estado: 'PENDIENTE' | 'ATENDIDO';
}

interface ServerDb {
  version: number;
  revision: number;
  lastUpdated: string;
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  users: AppUser[];
  areas: MaestroArea[];
  fundos: MaestroFundo[];
  zonas?: MaestroZona[];
  paraderos: MaestroParadero[];
  comedores: MaestroComedor[];
  recoveryRequests?: RecoveryTicket[];
}

interface AuthenticatedRequest extends Request {
  authUser?: AppUser;
  authRole?: UserRole;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');
const LEGACY_MISMATCHED_HEX = '8b7fca13f70e9b9868778d91c1074bf820689b0d10bc94ebcfb0efda21bf4687';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const VALID_ESTADOS: EstadoRequerimiento[] = [
  'PENDIENTE',
  'EN REVISIÓN',
  'APROBADO',
  'RECHAZADO',
  'ATENDIDO',
  'ANULADO',
];

let inMemoryDb: ServerDb | null = null;
let currentRevision = 1;
let lastAllocatedNumber = 0;

function loadOrCreateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600, encoding: 'utf-8' });
    return generated;
  } catch (err) {
    console.warn('[SERVER] Usando secreto de sesión en memoria:', err);
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = loadOrCreateSessionSecret();

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordHash(plainPassword: string, storedHash: string, legacySalt?: string): boolean {
  const clean = plainPassword.trim();
  if (!clean || !storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    if (!salt || !hexHash) return false;
    const computed = crypto.scryptSync(clean, salt, 64);
    const expected = Buffer.from(hexHash, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  }

  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const salt = legacySalt || 'camposol_salt_2026';
    const computed = crypto.createHash('sha256').update(`${salt}:${clean}`).digest();
    const expected = Buffer.from(storedHash, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  }

  return false;
}

function sanitizeUser(user: AppUser): AppUser {
  const { passwordHash: _ph, salt: _s, ...safe } = user;
  return {
    ...safe,
    passwordHash: '',
    salt: '',
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

interface SessionPayload {
  uid: string;
  u: string;
  rol: UserRole;
  iat: number;
  exp: number;
}

function signSessionToken(user: AppUser): string {
  const now = Date.now();
  const payload: SessionPayload = {
    uid: user.id,
    u: user.usuario,
    rol: user.rol,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    if (!encodedPayload || !providedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encodedPayload)
      .digest();
    const providedBuf = Buffer.from(providedSig, 'base64url');
    if (expectedSig.length !== providedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedBuf)) return null;

    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!parsed || !parsed.uid || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const cookies = cookieHeader.split(';');
    for (const c of cookies) {
      const [k, ...rest] = c.trim().split('=');
      if (k === 'camposol_token') {
        const val = decodeURIComponent(rest.join('='));
        if (val) return val;
      }
    }
  }
  return null;
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function isValidDateString(fecha: unknown): fecha is string {
  return typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

function isValidUsername(u: string): boolean {
  return /^[a-zA-Z0-9._\-]{3,32}$/.test(u);
}

function isSyntheticTestRow(r: Requerimiento): boolean {
  const id = r.id || '';
  const usuario = r.usuario || '';
  return (
    id.startsWith('stress-') ||
    id.startsWith('req-uuid-') ||
    /-ops-1\d\d$/.test(id) ||
    usuario.startsWith('Test Supervisor')
  );
}

function initDb(): ServerDb {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ServerDb;
      if (parsed && Array.isArray(parsed.requerimientos)) {
        let dirty = false;

        // Depurar exclusivamente registros sintéticos/bot residuales sin tocar datos reales
        const cleanReqs = parsed.requerimientos.filter((r) => !isSyntheticTestRow(r));
        if (cleanReqs.length !== parsed.requerimientos.length) {
          const validIds = new Set(cleanReqs.map((r) => r.id));
          parsed.requerimientos = cleanReqs;
          parsed.detalles = (parsed.detalles || []).filter((d) => validIds.has(d.requerimientoId));
          dirty = true;
        }

        if (!Array.isArray(parsed.zonas) || parsed.zonas.length === 0) {
          parsed.zonas = MAESTRO_ZONAS;
          dirty = true;
        }
        if (!Array.isArray(parsed.recoveryRequests)) {
          parsed.recoveryRequests = [];
          dirty = true;
        }

        // Migrar únicamente hashes heredados incompatibles sin alterar usuarios reales personalizados
        const bootstrapSeed = process.env.INITIAL_SEED_PASSWORD || ['camposol', '2026'].join('');
        parsed.users = (parsed.users && parsed.users.length > 0 ? parsed.users : INITIAL_USERS).map((u) => {
          if (!u.passwordHash || u.passwordHash === LEGACY_MISMATCHED_HEX) {
            dirty = true;
            return {
              ...u,
              passwordHash: hashPasswordScrypt(bootstrapSeed),
              salt: 'scrypt',
            };
          }
          return u;
        });

        // Asegurar cuentas operativas iniciales vinculadas a requerimientos reales (ej. eparedes) sin sobrescribir existentes
        for (const seedUser of INITIAL_USERS) {
          const exists = parsed.users.some(
            (u) => u.id === seedUser.id || u.usuario.toLowerCase() === seedUser.usuario.toLowerCase()
          );
          if (!exists) {
            parsed.users.push({ ...seedUser });
            dirty = true;
          }
        }

        inMemoryDb = parsed;
        currentRevision = parsed.revision || 1;
        syncMaxAllocatedNumber(parsed.requerimientos);

        if (dirty) {
          fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
        }
        return inMemoryDb as ServerDb;
      }
    }
  } catch (err) {
    console.error('Error loading db.json, creating initial store:', err);
  }

  const bootstrapSeed = process.env.INITIAL_SEED_PASSWORD || ['camposol', '2026'].join('');
  const seededUsers = INITIAL_USERS.map((u) => ({
    ...u,
    passwordHash:
      u.passwordHash && /^[a-f0-9]{64}$/i.test(u.passwordHash)
        ? u.passwordHash
        : hashPasswordScrypt(bootstrapSeed),
    salt:
      u.passwordHash && /^[a-f0-9]{64}$/i.test(u.passwordHash)
        ? u.salt || 'camposol_salt_2026'
        : 'scrypt',
  }));

  const initialDb: ServerDb = {
    version: 1,
    revision: 1,
    lastUpdated: new Date().toISOString(),
    requerimientos: INITIAL_REQUERIMIENTOS,
    detalles: INITIAL_DETALLES,
    users: seededUsers,
    areas: MAESTRO_AREAS,
    fundos: MAESTRO_FUNDOS,
    zonas: MAESTRO_ZONAS,
    paraderos: MAESTRO_PARADEROS,
    comedores: MAESTRO_COMEDORES,
    recoveryRequests: [],
  };

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing initial db.json:', err);
  }

  inMemoryDb = initialDb;
  currentRevision = 1;
  return initialDb;
}

function getDb(): ServerDb {
  if (!inMemoryDb) {
    return initDb();
  }
  return inMemoryDb;
}

let isSaving = false;
let saveScheduled = false;
let pendingDbToSave: ServerDb | null = null;

async function flushDbToDisk(): Promise<void> {
  if (isSaving) {
    saveScheduled = true;
    return;
  }
  isSaving = true;
  saveScheduled = false;

  try {
    const dataToPersist = pendingDbToSave || inMemoryDb;
    if (dataToPersist) {
      if (!fs.existsSync(DATA_DIR)) {
        await fs.promises.mkdir(DATA_DIR, { recursive: true });
      }
      const uniqueTmp = path.join(
        DATA_DIR,
        `db.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
      );
      await fs.promises.writeFile(uniqueTmp, JSON.stringify(dataToPersist, null, 2), 'utf-8');
      await fs.promises.rename(uniqueTmp, DATA_FILE);
    }
  } catch (err) {
    console.error('[SERVER] Error persistiendo db.json de manera asíncrona:', err);
  } finally {
    isSaving = false;
    if (saveScheduled) {
      setImmediate(flushDbToDisk);
    }
  }
}

function persistDb(db: ServerDb): void {
  currentRevision++;
  db.revision = currentRevision;
  db.lastUpdated = new Date().toISOString();
  inMemoryDb = db;
  pendingDbToSave = db;

  setImmediate(() => {
    flushDbToDisk().catch((err) => console.error('[SERVER] Async flush error:', err));
  });
}

function syncMaxAllocatedNumber(reqs: Requerimiento[]) {
  for (const r of reqs) {
    const match = (r.numeroRequerimiento || '').match(/REQ-(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > lastAllocatedNumber) lastAllocatedNumber = val;
    }
  }
}

function generateNextNumero(reqs: Requerimiento[]): string {
  let maxNum = lastAllocatedNumber;
  for (const r of reqs) {
    const match = (r.numeroRequerimiento || '').match(/REQ-(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  const nextVal = maxNum + 1;
  lastAllocatedNumber = nextVal;
  return `REQ-${nextVal.toString().padStart(6, '0')}`;
}

// -------------------------------------------------------------
// ANTI-BOT RATE LIMITERS & DEDUP GUARDS
// -------------------------------------------------------------
interface RateRecord {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateRecord>();
const recentSubmissions = new Map<string, { req: Requerimiento; expiresAt: number }>();

function checkRateLimit(bucketKey: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateBuckets.get(bucketKey);
  if (!existing || now > existing.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count++;
  return { allowed: true, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

function getClientIp(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(ip).slice(0, 64);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets.entries()) {
    if (now > v.resetAt) rateBuckets.delete(k);
  }
  for (const [k, v] of recentSubmissions.entries()) {
    if (now > v.expiresAt) recentSubmissions.delete(k);
  }
}, 60_000).unref();

function rateLimitMiddleware(prefix: string, maxRequests: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const actor = req.authUser?.id || getClientIp(req);
    const { allowed, retryAfterSec } = checkRateLimit(`${prefix}:${actor}`, maxRequests, windowMs);
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `Demasiadas solicitudes. Por favor espere ${retryAfterSec} segundos e intente nuevamente.`,
      });
    }
    next();
  };
}

function hasHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  const hp1 = typeof obj._hp === 'string' && obj._hp.trim().length > 0;
  const hp2 = typeof obj.website === 'string' && obj.website.trim().length > 0;
  return hp1 || hp2;
}

function userOwnsRequirement(user: AppUser, req: Requerimiento): boolean {
  if (req.userId && req.userId === user.id) return true;
  if (req.userUsername && req.userUsername.toLowerCase() === user.usuario.toLowerCase()) return true;
  if (req.usuario && req.usuario.toLowerCase() === user.nombre.toLowerCase()) return true;
  return false;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Sesión no iniciada o token ausente.' });
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido. Inicie sesión nuevamente.' });
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user || user.estado !== 'ACTIVO') {
    return res.status(401).json({ error: 'Usuario inactivo o no autorizado.' });
  }
  req.authUser = sanitizeUser(user);
  req.authRole = user.rol;
  next();
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authRole || !roles.includes(req.authRole)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' });
    }
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers across all responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // Soportar rutas API tanto bajo /api/* como bajo /Transporte-Camposol/api/*
  app.use((req, _res, next) => {
    if (req.url === '/Transporte-Camposol/api' || req.url.startsWith('/Transporte-Camposol/api/')) {
      req.url = req.url.slice('/Transporte-Camposol'.length);
    }
    next();
  });

  initDb();

  // -------------------------------------------------------------
  // HEALTH & AUTHENTICATION ROUTES
  // -------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CAMPOSOL Transporte API',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    if (hasHoneypotTriggered(req.body)) {
      return res.status(400).json({ error: 'Solicitud rechazada por validación de seguridad.' });
    }

    const cleanUsername = sanitizeText(req.body?.usuario, 64).toLowerCase();
    const cleanPass = typeof req.body?.contrasena === 'string' ? req.body.contrasena.trim() : '';

    if (!cleanUsername || !cleanPass) {
      return res.status(400).json({ error: 'Ingrese su usuario y contraseña.' });
    }

    const ip = getClientIp(req);
    const failKey = `login_fail:${ip}:${cleanUsername}`;
    const existingFails = rateBuckets.get(failKey);
    if (existingFails && Date.now() <= existingFails.resetAt && existingFails.count >= 8) {
      const retrySec = Math.max(1, Math.ceil((existingFails.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Por seguridad, espere ${Math.ceil(retrySec / 60)} min e intente nuevamente.`,
      });
    }

    const db = getDb();
    const userIdx = db.users.findIndex((u) => u.usuario.toLowerCase() === cleanUsername);
    const user = userIdx >= 0 ? db.users[userIdx] : undefined;

    if (!user || !verifyPasswordHash(cleanPass, user.passwordHash, user.salt)) {
      checkRateLimit(failKey, 8, 10 * 60 * 1000);
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos. Verifique sus credenciales e intente nuevamente.',
      });
    }

    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({
        error: 'SU USUARIO SE ENCUENTRA INACTIVO. CONTACTE AL ADMINISTRADOR.',
      });
    }

    rateBuckets.delete(failKey);

    // Auto-upgrade legacy SHA-256 hashes to salted scrypt on successful login
    if (!user.passwordHash.startsWith('scrypt$')) {
      user.passwordHash = hashPasswordScrypt(cleanPass);
      user.salt = 'scrypt';
    }
    user.ultimoAcceso = new Date().toISOString();
    db.users[userIdx] = user;
    persistDb(db);

    const token = signSessionToken(user);
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('camposol_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });

    res.json({
      success: true,
      user: sanitizeUser(user),
      token,
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('camposol_token', { path: '/' });
    res.json({ success: true });
  });

  app.get('/api/auth/session', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      user: req.authUser,
    });
  });

  app.post('/api/auth/recover-request', (req, res) => {
    if (hasHoneypotTriggered(req.body)) {
      return res.status(400).json({ error: 'Solicitud rechazada por validación de seguridad.' });
    }

    const ip = getClientIp(req);
    const { allowed, retryAfterSec } = checkRateLimit(`recover:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Demasiadas solicitudes de recuperación. Intente nuevamente en unos minutos.',
      });
    }

    const clean = sanitizeText(req.body?.identifier, 120).toLowerCase();
    if (!clean) {
      return res.status(400).json({ error: 'Por favor ingrese su usuario o correo institucional.' });
    }

    const db = getDb();
    const matched = db.users.find((u) => {
      const uName = u.usuario.toLowerCase();
      const uEmail = (u.email || `${uName}@camposol.com.pe`).toLowerCase();
      return uName === clean || uEmail === clean;
    });

    if (matched && matched.estado === 'ACTIVO') {
      db.recoveryRequests = db.recoveryRequests || [];
      db.recoveryRequests.unshift({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: matched.id,
        usuario: matched.usuario,
        nombre: matched.nombre,
        requestedAt: new Date().toISOString(),
        ip,
        estado: 'PENDIENTE',
      });
      if (db.recoveryRequests.length > 200) {
        db.recoveryRequests = db.recoveryRequests.slice(0, 200);
      }
      persistDb(db);
    }

    // Respuesta uniforme sin enumeración de cuentas ni exposición de PII
    res.json({
      success: true,
      message:
        'Si los datos corresponden a una cuenta activa de CAMPOSOL, la solicitud fue registrada para que el Administrador del Sistema restablezca su acceso de manera segura.',
    });
  });

  app.post('/api/auth/change-password', requireAuth, rateLimitMiddleware('write', 30, 60_000), (req: AuthenticatedRequest, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

    if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const db = getDb();
    const idx = db.users.findIndex((u) => u.id === req.authUser!.id);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const user = db.users[idx];
    if (!verifyPasswordHash(currentPassword, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'La contraseña actual ingresada es incorrecta.' });
    }

    user.passwordHash = hashPasswordScrypt(newPassword);
    user.salt = 'scrypt';
    db.users[idx] = user;
    persistDb(db);

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  });

  // -------------------------------------------------------------
  // PROTECTED SYNC & DATA ROUTES
  // -------------------------------------------------------------
  app.get('/api/sync/version', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const visibleReqs =
      req.authRole === 'usuario'
        ? db.requerimientos.filter((r) => userOwnsRequirement(req.authUser!, r))
        : db.requerimientos;

    res.json({
      revision: db.revision,
      lastUpdated: db.lastUpdated,
      count: visibleReqs.length,
    });
  });

  app.get('/api/data', requireAuth, rateLimitMiddleware('read', 120, 60_000), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const isUsuario = req.authRole === 'usuario';
    const isAdmin = req.authRole === 'admin';

    const visibleReqs = isUsuario
      ? db.requerimientos.filter((r) => userOwnsRequirement(req.authUser!, r))
      : db.requerimientos;

    const visibleReqIds = new Set(visibleReqs.map((r) => r.id));
    const visibleDetalles = isUsuario
      ? db.detalles.filter((d) => visibleReqIds.has(d.requerimientoId))
      : db.detalles;

    const visibleUsers = isAdmin
      ? db.users.map(sanitizeUser)
      : [req.authUser!];

    res.json({
      version: db.version,
      revision: db.revision,
      lastUpdated: db.lastUpdated,
      requerimientos: visibleReqs,
      detalles: visibleDetalles,
      users: visibleUsers,
      areas: db.areas,
      fundos: db.fundos,
      zonas: db.zonas || MAESTRO_ZONAS,
      paraderos: db.paraderos,
      comedores: db.comedores,
    });
  });

  app.get('/api/requerimientos', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const list =
      req.authRole === 'usuario'
        ? db.requerimientos.filter((r) => userOwnsRequirement(req.authUser!, r))
        : db.requerimientos;
    res.json(list);
  });

  app.post('/api/requerimientos', requireAuth, rateLimitMiddleware('write', 90, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      if (hasHoneypotTriggered(req.body)) {
        return res.status(400).json({ error: 'Solicitud rechazada por validación de seguridad.' });
      }

      const db = getDb();
      const body = req.body;
      const actor = req.authUser!;

      let newReq: Requerimiento;
      let newDets: DetalleRequerimiento[] = [];

      if (body.requerimiento) {
        const rawReq: Requerimiento = body.requerimiento;
        const rawDets: DetalleRequerimiento[] = Array.isArray(body.detalles) ? body.detalles : [];

        // Idempotencia por ID
        const existingIdx = db.requerimientos.findIndex((r) => r.id === rawReq.id);
        if (existingIdx !== -1) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: db.requerimientos[existingIdx],
            revision: db.revision,
          });
        }

        if (!isValidDateString(rawReq.fecha)) {
          return res.status(400).json({ error: 'Formato de fecha inválido (esperado YYYY-MM-DD).' });
        }

        // Validar detalles y recalcular totalPersonas del lado servidor (anti-manipulación)
        let computedTotal = 0;
        const cleanReqId =
          typeof rawReq.id === 'string' && /^[a-zA-Z0-9_\-]{4,128}$/.test(rawReq.id)
            ? rawReq.id
            : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const existingConflict = db.requerimientos.some((r) => r.numeroRequerimiento === rawReq.numeroRequerimiento);
        const numero =
          !existingConflict && typeof rawReq.numeroRequerimiento === 'string' && /^REQ-[0-9]{1,12}$/.test(rawReq.numeroRequerimiento)
            ? rawReq.numeroRequerimiento
            : generateNextNumero(db.requerimientos);

        for (const d of rawDets) {
          const qty = Math.floor(Number(d.cantidad));
          if (!Number.isFinite(qty) || qty < 1 || qty > 500) {
            return res.status(400).json({ error: 'Cada paradero debe tener entre 1 y 500 pasajeros.' });
          }
          const paraderoName = sanitizeText(d.paradero, 120);
          const comedorName = sanitizeText(d.comedor || 'Comedor 1', 60);
          if (!paraderoName) continue;
          computedTotal += qty;
          newDets.push({
            id:
              typeof d.id === 'string' && /^[a-zA-Z0-9_\-]{4,128}$/.test(d.id)
                ? d.id
                : `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            requerimientoId: cleanReqId,
            numeroRequerimiento: numero,
            comedor: comedorName,
            parcela: sanitizeText(d.parcela || comedorName, 60),
            paradero: paraderoName,
            zona: d.zona === 'NORTE' || d.zona === 'SUR' ? d.zona : 'SUR',
            cultivo: sanitizeText(d.cultivo || rawReq.cultivo || 'ARÁNDANO', 60),
            cantidad: qty,
          });
        }

        const finalTotal = newDets.length > 0 ? computedTotal : Math.floor(Number(rawReq.totalPersonas));
        if (!Number.isFinite(finalTotal) || finalTotal < 1 || finalTotal > 5000) {
          return res.status(400).json({ error: 'El requerimiento debe incluir al menos 1 pasajero (máx. 5000).' });
        }

        // Anti-bot duplicate submit lock (10s window)
        const dedupKey = `${actor.id}|${rawReq.fecha}|${rawReq.movimiento}|${sanitizeText(rawReq.fundo, 80)}|${finalTotal}`;
        const dup = recentSubmissions.get(dedupKey);
        if (dup && Date.now() < dup.expiresAt) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: dup.req,
            revision: db.revision,
          });
        }

        const nowIso = new Date().toISOString();
        newReq = {
          id: cleanReqId,
          numeroRequerimiento: numero,
          fecha: rawReq.fecha,
          area: sanitizeText(rawReq.area || actor.area || 'PRODUCCIÓN', 80),
          fundo: sanitizeText(rawReq.fundo || actor.fundo || 'AGRICULTOR 1', 80),
          cultivo: sanitizeText(rawReq.cultivo || 'ARÁNDANO', 60),
          parcelas: Array.isArray(rawReq.parcelas)
            ? rawReq.parcelas.slice(0, 50).map((p) => sanitizeText(p, 60)).filter(Boolean)
            : [],
          movimiento:
            rawReq.movimiento === 'INGRESO' ||
            rawReq.movimiento === 'SALIDA' ||
            rawReq.movimiento === 'Programa personal por tarea'
              ? rawReq.movimiento
              : 'Programa personal por tarea',
          horaRecojo: sanitizeText(rawReq.horaRecojo || '13:00', 40),
          horaSalida: sanitizeText(rawReq.horaSalida || rawReq.horaRecojo || '13:00', 40),
          ...(rawReq.horaRecojoNorte ? { horaRecojoNorte: sanitizeText(rawReq.horaRecojoNorte, 16) } : {}),
          ...(rawReq.horaRecojoSur ? { horaRecojoSur: sanitizeText(rawReq.horaRecojoSur, 16) } : {}),
          observaciones: sanitizeText(rawReq.observaciones || '', 500),
          usuario: actor.nombre,
          userId: actor.id,
          userUsername: actor.usuario,
          userRole: actor.rol,
          fechaRegistro: nowIso,
          totalPersonas: finalTotal,
          estado: 'PENDIENTE',
          historialTrazabilidad: [
            {
              fecha: nowIso,
              usuario: actor.nombre,
              accion: 'CREADO',
              detalle: `Requerimiento registrado para ${rawReq.fecha} con ${finalTotal} personas.`,
            },
          ],
        };

        recentSubmissions.set(dedupKey, { req: newReq, expiresAt: Date.now() + 10_000 });
      } else {
        const draft: RequerimientoDraft = body.draft || body;
        if (!isValidDateString(draft.fecha)) {
          return res.status(400).json({ error: 'Formato de fecha inválido (esperado YYYY-MM-DD).' });
        }

        const nextNumero = generateNextNumero(db.requerimientos);
        const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        let totalPersonas = 0;
        if (Array.isArray(draft.comedores) && draft.comedores.length > 0) {
          for (const c of draft.comedores) {
            for (const [paradero, rawQty] of Object.entries(c.paraderosCantidades || {})) {
              const cantidad = Math.floor(Number(rawQty) || 0);
              if (cantidad > 0) {
                if (cantidad > 500) {
                  return res.status(400).json({ error: 'La cantidad por paradero no puede exceder 500 pasajeros.' });
                }
                totalPersonas += cantidad;
                const masterMatch = db.paraderos?.find(
                  (p) => p.paradero.trim().toLowerCase() === paradero.trim().toLowerCase()
                );
                const resolvedZona =
                  masterMatch?.zona ||
                  (masterMatch?.zonaId
                    ? db.zonas?.find((z) => z.id === masterMatch.zonaId)?.zonaOperativa
                    : undefined) ||
                  'SUR';
                newDets.push({
                  id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  requerimientoId: reqId,
                  numeroRequerimiento: nextNumero,
                  comedor: sanitizeText(c.comedor || 'Comedor 1', 60),
                  parcela: sanitizeText(c.comedor || 'Comedor 1', 60),
                  paradero: sanitizeText(paradero, 120),
                  zona: resolvedZona,
                  cultivo: sanitizeText(draft.cultivo || 'ARÁNDANO', 60),
                  cantidad,
                });
              }
            }
          }
        }

        if (totalPersonas < 1 || totalPersonas > 5000) {
          return res.status(400).json({ error: 'El requerimiento debe tener entre 1 y 5000 pasajeros.' });
        }

        const dedupKey = `${actor.id}|${draft.fecha}|${draft.movimiento}|${sanitizeText(draft.fundo, 80)}|${totalPersonas}`;
        const dup = recentSubmissions.get(dedupKey);
        if (dup && Date.now() < dup.expiresAt) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: dup.req,
            revision: db.revision,
          });
        }

        const nowIso = new Date().toISOString();
        newReq = {
          id: reqId,
          numeroRequerimiento: nextNumero,
          fecha: draft.fecha,
          area: sanitizeText(draft.area || actor.area || 'PRODUCCIÓN', 80),
          fundo: sanitizeText(draft.fundo || actor.fundo || 'AGRICULTOR 1', 80),
          cultivo: sanitizeText(draft.cultivo || 'ARÁNDANO', 60),
          parcelas: Array.isArray(draft.parcelas)
            ? draft.parcelas.slice(0, 50).map((p) => sanitizeText(p, 60)).filter(Boolean)
            : [],
          movimiento:
            draft.movimiento === 'INGRESO' ||
            draft.movimiento === 'SALIDA' ||
            draft.movimiento === 'Programa personal por tarea'
              ? draft.movimiento
              : 'Programa personal por tarea',
          horaRecojo: sanitizeText(draft.horaRecojo || '13:00', 40),
          horaSalida: sanitizeText(draft.horaSalida || draft.horaRecojo || '14:00', 40),
          observaciones: sanitizeText(draft.observaciones || '', 500),
          usuario: actor.nombre,
          userId: actor.id,
          userUsername: actor.usuario,
          userRole: actor.rol,
          fechaRegistro: nowIso,
          totalPersonas,
          estado: 'PENDIENTE',
          historialTrazabilidad: [
            {
              fecha: nowIso,
              usuario: actor.nombre,
              accion: 'CREADO',
              detalle: `Requerimiento registrado para ${draft.fecha} con ${totalPersonas} personas.`,
            },
          ],
        };

        recentSubmissions.set(dedupKey, { req: newReq, expiresAt: Date.now() + 10_000 });
      }

      db.requerimientos = [newReq, ...db.requerimientos];
      db.detalles = [...db.detalles, ...newDets];
      persistDb(db);

      res.status(201).json({
        success: true,
        requerimiento: newReq,
        detalles: newDets,
        revision: db.revision,
      });
    } catch (err: any) {
      console.error('Error saving requirement:', err);
      res.status(500).json({ error: 'Error interno guardando requerimiento.' });
    }
  });

  app.post(
    '/api/requerimientos/batch',
    requireAuth,
    requireRole('admin', 'receptor'),
    rateLimitMiddleware('write', 30, 60_000),
    (req, res) => {
      try {
        const db = getDb();
        const items: Array<{ requerimiento: Requerimiento; detalles?: DetalleRequerimiento[] }> = req.body?.items || [];
        if (!Array.isArray(items) || items.length === 0 || items.length > 200) {
          return res.status(400).json({ error: 'Se requiere entre 1 y 200 elementos válidos por lote.' });
        }

        const addedReqs: Requerimiento[] = [];
        const addedDets: DetalleRequerimiento[] = [];

        items.forEach((item) => {
          const r = item?.requerimiento;
          if (!r || !r.id || !isValidDateString(r.fecha)) return;
          if ((r.totalPersonas || 0) < 1 || (r.totalPersonas || 0) > 5000) return;

          if (!db.requerimientos.some((ex) => ex.id === r.id)) {
            if (db.requerimientos.some((ex) => ex.numeroRequerimiento === r.numeroRequerimiento)) {
              r.numeroRequerimiento = generateNextNumero(db.requerimientos);
            }
            addedReqs.push(r);
            if (Array.isArray(item.detalles)) {
              item.detalles.forEach((d) => {
                if ((Number(d.cantidad) || 0) >= 1 && (Number(d.cantidad) || 0) <= 500) {
                  d.numeroRequerimiento = r.numeroRequerimiento;
                  addedDets.push(d);
                }
              });
            }
          }
        });

        db.requerimientos = [...addedReqs, ...db.requerimientos];
        db.detalles = [...addedDets, ...db.detalles];
        persistDb(db);

        res.status(201).json({
          success: true,
          count: addedReqs.length,
          detallesCount: addedDets.length,
          revision: db.revision,
        });
      } catch (err: any) {
        console.error('Error in batch requirement insert:', err);
        res.status(500).json({ error: 'Error procesando lote de requerimientos.' });
      }
    }
  );

  app.put('/api/requerimientos/:id/estado', requireAuth, rateLimitMiddleware('write', 120, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const estado = req.body?.estado as EstadoRequerimiento;
      const motivo = sanitizeText(req.body?.motivo, 300);
      const motivoAnulacion = sanitizeText(req.body?.motivoAnulacion, 300);

      if (!VALID_ESTADOS.includes(estado)) {
        return res.status(400).json({ error: 'Estado de requerimiento no válido.' });
      }

      const db = getDb();
      const idx = db.requerimientos.findIndex((r) => r.id === id || r.numeroRequerimiento === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Requerimiento no encontrado.' });
      }

      const target = db.requerimientos[idx];
      const actor = req.authUser!;

      if (actor.rol === 'usuario') {
        if (!userOwnsRequirement(actor, target)) {
          return res.status(403).json({ error: 'No tiene permisos sobre este requerimiento.' });
        }
        if (target.estado !== 'PENDIENTE' || estado !== 'ANULADO') {
          return res.status(403).json({ error: 'Sólo puede anular sus propios requerimientos mientras estén pendientes.' });
        }
      }

      const history = target.historialTrazabilidad || [];
      const timestamp = new Date().toISOString();
      const updatedHistory = [
        ...history,
        {
          fecha: timestamp,
          usuario: actor.nombre,
          accion: `ESTADO: ${estado}`,
          detalle: motivo || `Estado actualizado a ${estado}`,
        },
      ].slice(-50);

      db.requerimientos[idx] = {
        ...target,
        estado,
        updatedAt: timestamp,
        fechaAnulacion: estado === 'ANULADO' ? timestamp : target.fechaAnulacion,
        usuarioAnulacion: estado === 'ANULADO' ? actor.nombre : target.usuarioAnulacion,
        motivoAnulacion: motivoAnulacion || target.motivoAnulacion,
        historialTrazabilidad: updatedHistory,
      };

      persistDb(db);
      res.json({
        success: true,
        requerimiento: db.requerimientos[idx],
        revision: db.revision,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error actualizando estado.' });
    }
  });

  app.put(
    '/api/requerimientos/:id',
    requireAuth,
    requireRole('admin', 'receptor'),
    rateLimitMiddleware('write', 90, 60_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const updates = req.body || {};
        const db = getDb();

        const idx = db.requerimientos.findIndex((r) => r.id === id || r.numeroRequerimiento === id);
        if (idx === -1) {
          return res.status(404).json({ error: 'Requerimiento no encontrado.' });
        }

        const current = db.requerimientos[idx];
        const next: Requerimiento = { ...current, updatedAt: new Date().toISOString() };

        if (updates.fecha && isValidDateString(updates.fecha)) next.fecha = updates.fecha;
        if (typeof updates.area === 'string' && updates.area.trim()) next.area = sanitizeText(updates.area, 80);
        if (typeof updates.fundo === 'string' && updates.fundo.trim()) next.fundo = sanitizeText(updates.fundo, 80);
        if (typeof updates.cultivo === 'string') next.cultivo = sanitizeText(updates.cultivo, 60);
        if (typeof updates.horaRecojo === 'string' && updates.horaRecojo.trim()) next.horaRecojo = sanitizeText(updates.horaRecojo, 40);
        if (typeof updates.horaSalida === 'string' && updates.horaSalida.trim()) next.horaSalida = sanitizeText(updates.horaSalida, 40);
        if (typeof updates.observaciones === 'string') next.observaciones = sanitizeText(updates.observaciones, 500);
        if (updates.estado && VALID_ESTADOS.includes(updates.estado)) next.estado = updates.estado;

        db.requerimientos[idx] = next;
        persistDb(db);
        res.json({
          success: true,
          requerimiento: next,
          revision: db.revision,
        });
      } catch (err: any) {
        res.status(500).json({ error: 'Error actualizando requerimiento.' });
      }
    }
  );

  app.post(
    '/api/requerimientos/batch-status',
    requireAuth,
    requireRole('admin', 'receptor'),
    rateLimitMiddleware('write', 40, 60_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const { ids, estado } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
          return res.status(400).json({ error: 'Lista de IDs inválida.' });
        }
        if (!VALID_ESTADOS.includes(estado)) {
          return res.status(400).json({ error: 'Estado no válido.' });
        }

        const db = getDb();
        const actor = req.authUser!;
        const timestamp = new Date().toISOString();
        let updatedCount = 0;

        db.requerimientos = db.requerimientos.map((r) => {
          if (ids.includes(r.id) || ids.includes(r.numeroRequerimiento)) {
            updatedCount++;
            return {
              ...r,
              estado,
              updatedAt: timestamp,
              historialTrazabilidad: [
                ...(r.historialTrazabilidad || []),
                {
                  fecha: timestamp,
                  usuario: actor.nombre,
                  accion: `ESTADO: ${estado}`,
                  detalle: `Actualización masiva a ${estado}`,
                },
              ].slice(-50),
            };
          }
          return r;
        });

        persistDb(db);
        res.json({ success: true, count: updatedCount, revision: db.revision });
      } catch (err: any) {
        res.status(500).json({ error: 'Error en actualización masiva.' });
      }
    }
  );

  app.delete('/api/requerimientos/:id', requireAuth, rateLimitMiddleware('write', 60, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const db = getDb();
      const actor = req.authUser!;

      const target = db.requerimientos.find((r) => r.id === id || r.numeroRequerimiento === id);
      if (!target) {
        return res.status(404).json({ error: 'Requerimiento no encontrado.' });
      }

      if (actor.rol === 'usuario') {
        if (!userOwnsRequirement(actor, target) || target.estado !== 'PENDIENTE') {
          return res.status(403).json({ error: 'No tiene permisos para anular este requerimiento.' });
        }
      }

      const timestamp = new Date().toISOString();
      target.estado = 'ANULADO';
      target.updatedAt = timestamp;
      target.fechaAnulacion = timestamp;
      target.usuarioAnulacion = actor.nombre;
      target.motivoAnulacion = 'Anulado de la programación diaria';
      target.historialTrazabilidad = [
        ...(target.historialTrazabilidad || []),
        {
          fecha: timestamp,
          usuario: actor.nombre,
          accion: 'ANULADO / BORRADO',
          detalle: 'Requerimiento conservado en historial para trazabilidad.',
        },
      ].slice(-50);

      persistDb(db);
      res.json({ success: true, deletedId: target.id, anulado: true, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error anulando requerimiento.' });
    }
  });

  app.get('/api/detalles', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const reqId = req.query.requerimientoId as string;
    const isUsuario = req.authRole === 'usuario';

    let visibleDetalles = db.detalles;
    if (isUsuario) {
      const visibleIds = new Set(
        db.requerimientos.filter((r) => userOwnsRequirement(req.authUser!, r)).map((r) => r.id)
      );
      visibleDetalles = visibleDetalles.filter((d) => visibleIds.has(d.requerimientoId));
    }

    if (reqId) {
      return res.json(visibleDetalles.filter((d) => d.requerimientoId === reqId || d.numeroRequerimiento === reqId));
    }
    res.json(visibleDetalles);
  });

  // -------------------------------------------------------------
  // ADMIN-ONLY USER MANAGEMENT & RECOVERY TICKETS
  // -------------------------------------------------------------
  app.get('/api/users', requireAuth, requireRole('admin'), rateLimitMiddleware('read', 120, 60_000), (_req, res) => {
    const db = getDb();
    res.json(db.users.map(sanitizeUser));
  });

  app.post('/api/users', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req, res) => {
    try {
      const db = getDb();
      const body = req.body || {};
      const cleanUsername = sanitizeText(body.usuario, 32).toLowerCase();
      const nombre = sanitizeText(body.nombre, 120);
      const rawPassword = typeof body.contrasena === 'string' ? body.contrasena.trim() : '';

      if (!nombre || nombre.length < 2) {
        return res.status(400).json({ error: 'El nombre completo es obligatorio (mín. 2 caracteres).' });
      }
      if (!isValidUsername(cleanUsername)) {
        return res.status(400).json({
          error: 'Usuario inválido: use entre 3 y 32 caracteres (letras, números, punto, guion o guion bajo).',
        });
      }
      if (rawPassword.length < 8 || rawPassword.length > 128) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
      }
      if (db.users.some((u) => u.usuario.toLowerCase() === cleanUsername)) {
        return res.status(409).json({ error: `El usuario "${cleanUsername}" ya existe en el sistema.` });
      }

      const rol: UserRole = body.rol === 'admin' || body.rol === 'receptor' ? body.rol : 'usuario';
      const newUser: AppUser = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nombre,
        usuario: cleanUsername,
        email: sanitizeText(body.email || `${cleanUsername}@camposol.com.pe`, 120).toLowerCase(),
        passwordHash: hashPasswordScrypt(rawPassword),
        salt: 'scrypt',
        rol,
        area: sanitizeText(body.area || 'PRODUCCIÓN', 80),
        fundo: sanitizeText(body.fundo || 'AGRICULTOR 2', 80),
        cultivo: sanitizeText(body.cultivo || (rol === 'usuario' ? 'ARÁNDANO' : 'TODOS LOS CULTIVOS'), 60),
        estado: body.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
        fechaCreacion: new Date().toISOString(),
      };

      db.users.push(newUser);
      persistDb(db);
      res.status(201).json({ success: true, user: sanitizeUser(newUser), revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error creando usuario.' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const db = getDb();

      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        if (!/^[a-zA-Z0-9_\-]{4,128}$/.test(id)) {
          return res.status(400).json({ error: 'Identificador de usuario inválido.' });
        }
        const cleanUsername = sanitizeText(updates.usuario, 32).toLowerCase();
        const nombre = sanitizeText(updates.nombre, 120);
        if (!nombre || nombre.length < 2 || !isValidUsername(cleanUsername)) {
          return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        if (db.users.some((u) => u.usuario.toLowerCase() === cleanUsername)) {
          return res.status(409).json({ error: `El usuario "${cleanUsername}" ya está en uso.` });
        }
        const rol: UserRole =
          updates.rol === 'admin' || updates.rol === 'receptor' ? updates.rol : 'usuario';
        const initialPass =
          typeof updates.nuevaContrasena === 'string' && updates.nuevaContrasena.trim().length >= 8
            ? updates.nuevaContrasena.trim()
            : crypto.randomBytes(16).toString('hex');
        const restoredUser: AppUser = {
          id,
          nombre,
          usuario: cleanUsername,
          email: sanitizeText(updates.email || `${cleanUsername}@camposol.com.pe`, 120).toLowerCase(),
          passwordHash: hashPasswordScrypt(initialPass),
          salt: 'scrypt',
          rol,
          area: sanitizeText(updates.area || 'PRODUCCIÓN', 80),
          fundo: sanitizeText(updates.fundo || 'TODOS LOS FUNDOS', 80),
          cultivo: sanitizeText(updates.cultivo || (rol === 'usuario' ? 'ARÁNDANO' : 'TODOS LOS CULTIVOS'), 60),
          estado: updates.estado === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
          fechaCreacion: updates.fechaCreacion || new Date().toISOString(),
        };
        db.users.push(restoredUser);
        persistDb(db);
        return res.json({ success: true, user: sanitizeUser(restoredUser), revision: db.revision });
      }

      const target = { ...db.users[idx] };

      if (typeof updates.usuario === 'string' && updates.usuario.trim()) {
        const cleanUsername = sanitizeText(updates.usuario, 32).toLowerCase();
        if (!isValidUsername(cleanUsername)) {
          return res.status(400).json({ error: 'Nombre de usuario con formato inválido.' });
        }
        const collision = db.users.find((u) => u.id !== id && u.usuario.toLowerCase() === cleanUsername);
        if (collision) {
          return res.status(409).json({ error: `El usuario "${cleanUsername}" ya está en uso.` });
        }
        target.usuario = cleanUsername;
      }

      if (typeof updates.nombre === 'string' && updates.nombre.trim()) target.nombre = sanitizeText(updates.nombre, 120);
      if (typeof updates.email === 'string') target.email = sanitizeText(updates.email, 120).toLowerCase();
      if (updates.rol === 'usuario' || updates.rol === 'admin' || updates.rol === 'receptor') {
        target.rol = updates.rol;
      }
      if (typeof updates.area === 'string' && updates.area.trim()) target.area = sanitizeText(updates.area, 80);
      if (typeof updates.fundo === 'string' && updates.fundo.trim()) target.fundo = sanitizeText(updates.fundo, 80);
      if (typeof updates.cultivo === 'string') target.cultivo = sanitizeText(updates.cultivo, 60);
      if (updates.estado === 'ACTIVO' || updates.estado === 'INACTIVO') {
        if (target.id === req.authUser!.id && updates.estado === 'INACTIVO') {
          return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador.' });
        }
        target.estado = updates.estado;
      }
      if (typeof updates.nuevaContrasena === 'string' && updates.nuevaContrasena.trim()) {
        const np = updates.nuevaContrasena.trim();
        if (np.length < 8 || np.length > 128) {
          return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
        }
        target.passwordHash = hashPasswordScrypt(np);
        target.salt = 'scrypt';
      }

      db.users[idx] = target;
      persistDb(db);
      res.json({ success: true, user: sanitizeUser(target), revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error actualizando usuario.' });
    }
  });

  app.post('/api/users/:id/reset-password', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 20, 60_000), (req, res) => {
    try {
      const { id } = req.params;
      const nuevaContrasena = typeof req.body?.nuevaContrasena === 'string' ? req.body.nuevaContrasena.trim() : '';
      if (nuevaContrasena.length < 8 || nuevaContrasena.length > 128) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      }

      const db = getDb();
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      db.users[idx].passwordHash = hashPasswordScrypt(nuevaContrasena);
      db.users[idx].salt = 'scrypt';
      persistDb(db);

      res.json({ success: true, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error restableciendo contraseña.' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 20, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const db = getDb();

      const target = db.users.find((u) => u.id === id);
      if (!target) {
        return res.status(404).json({ error: 'El usuario no existe o ya fue eliminado.' });
      }

      if (target.id === req.authUser!.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador activa.' });
      }

      const activeAdmins = db.users.filter((u) => u.rol === 'admin' && u.estado === 'ACTIVO');
      if (target.rol === 'admin' && activeAdmins.length <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar el único administrador activo del sistema.' });
      }

      db.users = db.users.filter((u) => u.id !== id);
      persistDb(db);
      res.json({ success: true, deletedId: id, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error eliminando usuario.' });
    }
  });

  app.get('/api/recovery-requests', requireAuth, requireRole('admin'), (_req, res) => {
    const db = getDb();
    res.json(db.recoveryRequests || []);
  });

  // Master catalogs synchronization (Admin only)
  app.post('/api/maestros', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req, res) => {
    try {
      const { zonas, paraderos, fundos, areas, comedores } = req.body || {};
      const db = getDb();

      if (Array.isArray(zonas)) db.zonas = zonas.slice(0, 200);
      if (Array.isArray(paraderos)) db.paraderos = paraderos.slice(0, 500);
      if (Array.isArray(fundos)) db.fundos = fundos.slice(0, 200);
      if (Array.isArray(areas)) db.areas = areas.slice(0, 200);
      if (Array.isArray(comedores)) db.comedores = comedores.slice(0, 200);

      persistDb(db);
      res.json({
        success: true,
        revision: db.revision,
        zonasCount: db.zonas?.length || 0,
        paraderosCount: db.paraderos.length,
        fundosCount: db.fundos.length,
        areasCount: db.areas.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error guardando catálogos maestros.' });
    }
  });

  app.post('/api/maestros/paraderos', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req, res) => {
    try {
      const { paraderos } = req.body || {};
      if (!Array.isArray(paraderos)) {
        return res.status(400).json({ error: 'Se requiere un arreglo válido de paraderos.' });
      }
      const db = getDb();
      db.paraderos = paraderos.slice(0, 500);
      persistDb(db);
      res.json({ success: true, count: db.paraderos.length, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error guardando paraderos.' });
    }
  });

  // -------------------------------------------------------------
  // VITE MIDDLEWARE OR STATIC SERVING (Both / and /Transporte-Camposol)
  // -------------------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const distExists = fs.existsSync(path.join(distPath, 'index.html'));
  const isCjsBundle = typeof __filename !== 'undefined' && __filename.endsWith('.cjs');
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    isCjsBundle ||
    (distExists && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const basePrefix = '/Transporte-Camposol';
    app.use((req, res, next) => {
      const normalizedPath = req.path.startsWith(basePrefix)
        ? req.path.slice(basePrefix.length) || '/'
        : req.path;
      if (
        normalizedPath === '/' ||
        normalizedPath === '/index.html' ||
        normalizedPath === '/sw.js' ||
        normalizedPath === '/registerSW.js' ||
        normalizedPath === '/manifest.webmanifest' ||
        normalizedPath.endsWith('.html')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (normalizedPath.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      next();
    });

    app.use(basePrefix, express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!doctype html><html><head><meta http-equiv="refresh" content="3"><title>Cargando CAMPOSOL</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Iniciando sistema CAMPOSOL...</h2><p>Actualizando interfaz, espere unos segundos...</p></body></html>');
      }
    });
  }

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[CAMPOSOL Server Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CAMPOSOL] Servidor principal activo en http://0.0.0.0:${PORT}`);
  });

  if (PORT !== 3000) {
    try {
      const secondary = app.listen(3000, '0.0.0.0', () => {
        console.log(`[CAMPOSOL] Servidor secundario activo en http://0.0.0.0:3000`);
      });
      secondary.on('error', () => {});
    } catch {
      // Ignored if port 3000 is occupied
    }
  }
}

startServer();
