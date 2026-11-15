import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  MAESTRO_ZONAS,
} from './src/data/masterData';
import {
  Requerimiento,
  DetalleRequerimiento,
  AppUser,
  RequerimientoDraft,
  UserRole,
  EstadoRequerimiento,
} from './src/types';
import { SqlitePersistence } from './src/server/sqliteDb';

interface AuthenticatedRequest extends Request {
  authUser?: AppUser;
  authRole?: UserRole;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');
const SERVER_BOOT_ID = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días operativos con renovación deslizante
const VALID_ESTADOS: EstadoRequerimiento[] = [
  'PENDIENTE',
  'EN REVISIÓN',
  'APROBADO',
  'RECHAZADO',
  'ATENDIDO',
  'ANULADO',
];

let persistence: SqlitePersistence | null = null;

function getStore(): SqlitePersistence {
  if (!persistence) {
    persistence = new SqlitePersistence(DATA_DIR, DATA_FILE);
  }
  return persistence;
}

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
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (queryToken) {
    return queryToken;
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

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// -------------------------------------------------------------
// REAL-TIME SERVER-SENT EVENTS (SSE) HUB (<200ms Mobile -> Web)
// -------------------------------------------------------------
interface SseClient {
  res: Response;
  user: AppUser;
  role: UserRole;
}

const sseClients = new Set<SseClient>();

function broadcastRealtimeEvent(evt: {
  revision: number;
  kind: 'REQ_UPSERT' | 'REQ_DELETE' | 'MAESTROS_UPDATE' | 'USERS_UPDATE';
  entityId?: string;
  requerimiento?: Requerimiento;
  detalles?: DetalleRequerimiento[];
}): void {
  if (sseClients.size === 0) return;

  for (const client of sseClients) {
    try {
      if (client.role === 'usuario') {
        if (evt.kind === 'USERS_UPDATE') continue;
        if (evt.requerimiento && !userOwnsRequirement(client.user, evt.requerimiento)) {
          continue;
        }
      }
      client.res.write(`event: sync\ndata: ${JSON.stringify(evt)}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

setInterval(() => {
  for (const client of sseClients) {
    try {
      client.res.write(': keepalive\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 20_000).unref();

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
  const meta = getStore().getMeta();
  const user = meta.users.find((u) => u.id === payload.uid);
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

  // Security headers & CORS across API responses (allows GitHub Pages / PWA origins to talk to Cloud Run backend)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
    const isSameHostOrigin = Boolean(
      origin &&
        rawHost &&
        (origin.toLowerCase() === `https://${rawHost}` || origin.toLowerCase() === `http://${rawHost}`)
    );
    const isAllowedOrigin =
      Boolean(origin) &&
      (isSameHostOrigin ||
        /^https:\/\/[a-z0-9\-]+\.github\.io$/i.test(origin) ||
        /^https:\/\/[a-z0-9\-]+(\.[a-z0-9\-]+)*\.run\.app$/i.test(origin) ||
        /^https:\/\/[a-z0-9\-]+\.web\.app$/i.test(origin) ||
        /^https:\/\/[a-z0-9\-]+\.firebaseapp\.com$/i.test(origin) ||
        /^http:\/\/localhost(:\d+)?$/i.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
        /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[0-1]))\.[0-9.]+(:\d+)?$/i.test(origin));

    if (isAllowedOrigin && (req.url.startsWith('/api/') || req.url.startsWith('/Transporte-Camposol/api/'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    }
    next();
  });

  app.use(express.json({ limit: '5mb' }));

  // Soportar rutas API tanto bajo /api/* como bajo /Transporte-Camposol/api/*
  app.use((req, _res, next) => {
    if (req.url === '/Transporte-Camposol/api' || req.url.startsWith('/Transporte-Camposol/api/')) {
      req.url = req.url.slice('/Transporte-Camposol'.length);
    }
    next();
  });

  // Registro diagnóstico liviano para tráfico /api/* (sin credenciales, tokens ni PII)
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    res.on('finish', () => {
      if (reqPath === '/sync/version' && res.statusCode < 400) return;
      const hasBearer = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
      const hasCookie = typeof req.headers.cookie === 'string' && req.headers.cookie.includes('camposol_token=');
      const origin = req.headers.origin || '-';
      console.log(
        `[API] ${req.method} /api${reqPath} -> ${res.statusCode} (${Date.now() - start}ms) bearer=${hasBearer} cookie=${hasCookie} origin=${origin}`
      );
    });
    next();
  });

  const store = getStore();

  // -------------------------------------------------------------
  // HEALTH & AUTHENTICATION ROUTES
  // -------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CAMPOSOL Transporte API',
      bootId: SERVER_BOOT_ID,
      timestamp: new Date().toISOString(),
      stats: getStore().getTotalStats(),
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

    const dbStore = getStore();
    const meta = dbStore.getMeta();
    const userIdx = meta.users.findIndex((u) => u.usuario.toLowerCase() === cleanUsername);
    const user = userIdx >= 0 ? meta.users[userIdx] : undefined;

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

    if (!user.passwordHash.startsWith('scrypt$')) {
      user.passwordHash = hashPasswordScrypt(cleanPass);
      user.salt = 'scrypt';
    }
    user.ultimoAcceso = new Date().toISOString();
    meta.users[userIdx] = user;
    dbStore.saveUsers(meta.users, false);

    const token = signSessionToken(user);
    const fwdProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const isHttps = req.secure || fwdProto.includes('https');
    res.cookie('camposol_token', token, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
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
    const refreshedToken = signSessionToken(req.authUser!);
    const fwdProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    const isHttps = req.secure || fwdProto.includes('https');
    res.cookie('camposol_token', refreshedToken, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
    res.json({
      success: true,
      user: req.authUser,
      token: refreshedToken,
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

    const dbStore = getStore();
    const meta = dbStore.getMeta();
    const matched = meta.users.find((u) => {
      const uName = u.usuario.toLowerCase();
      const uEmail = (u.email || `${uName}@camposol.com.pe`).toLowerCase();
      return uName === clean || uEmail === clean;
    });

    if (matched && matched.estado === 'ACTIVO') {
      const list = [...(meta.recoveryRequests || [])];
      list.unshift({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: matched.id,
        usuario: matched.usuario,
        nombre: matched.nombre,
        requestedAt: new Date().toISOString(),
        ip,
        estado: 'PENDIENTE',
      });
      dbStore.saveRecoveryRequests(list.slice(0, 200));
    }

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

    const dbStore = getStore();
    const meta = dbStore.getMeta();
    const idx = meta.users.findIndex((u) => u.id === req.authUser!.id);
    if (idx === -1) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const user = meta.users[idx];
    if (!verifyPasswordHash(currentPassword, user.passwordHash, user.salt)) {
      return res.status(401).json({ error: 'La contraseña actual ingresada es incorrecta.' });
    }

    user.passwordHash = hashPasswordScrypt(newPassword);
    user.salt = 'scrypt';
    meta.users[idx] = user;
    dbStore.saveUsers(meta.users, false);

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  });

  // -------------------------------------------------------------
  // PROTECTED REAL-TIME SSE, DELTA SYNC & ARCHIVE DATA ROUTES
  // -------------------------------------------------------------
  app.get('/api/sync/stream', requireAuth, (req: AuthenticatedRequest, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const client: SseClient = {
      res,
      user: req.authUser!,
      role: req.authRole!,
    };
    sseClients.add(client);

    res.write(
      `event: ready\ndata: ${JSON.stringify({ revision: getStore().getRevision(), bootId: SERVER_BOOT_ID, connectedAt: new Date().toISOString() })}\n\n`
    );

    req.on('close', () => {
      sseClients.delete(client);
    });
  });

  app.get('/api/sync/version', requireAuth, rateLimitMiddleware('read', 600, 60_000), (req: AuthenticatedRequest, res) => {
    const dbStore = getStore();
    res.json({
      revision: dbStore.getRevision(),
      bootId: SERVER_BOOT_ID,
      lastUpdated: dbStore.getLastUpdated(),
      count: dbStore.getTotalStats().totalRequerimientos,
    });
  });

  app.get('/api/sync/delta', requireAuth, rateLimitMiddleware('read', 600, 60_000), (req: AuthenticatedRequest, res) => {
    const since = Math.max(0, parseInt(String(req.query.since || '0'), 10) || 0);
    const dbStore = getStore();
    const delta = dbStore.getDeltasSince(since);

    if (req.authRole === 'usuario') {
      delta.events = delta.events.filter((ev) => {
        if (ev.kind === 'USERS_UPDATE') return false;
        if (ev.kind === 'REQ_UPSERT' && ev.payload?.requerimiento) {
          return userOwnsRequirement(req.authUser!, ev.payload.requerimiento as Requerimiento);
        }
        return true;
      });
    }

    res.json(delta);
  });

  app.get('/api/data', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const dbStore = getStore();
    const meta = dbStore.getMeta();
    const isUsuario = req.authRole === 'usuario';
    const isAdmin = req.authRole === 'admin';

    const desdeParam = typeof req.query.desde === 'string' && isValidDateString(req.query.desde) ? req.query.desde : undefined;
    const hastaParam = typeof req.query.hasta === 'string' && isValidDateString(req.query.hasta) ? req.query.hasta : undefined;
    const loadAll = req.query.all === '1';

    const stats = dbStore.getTotalStats();
    const effectiveDesde =
      desdeParam ||
      (!loadAll && stats.totalRequerimientos > 4500 ? getDateDaysAgo(60) : undefined);

    let visibleReqs = dbStore.queryRequerimientos({
      desde: effectiveDesde,
      hasta: hastaParam,
      limit: loadAll ? undefined : 20000,
    });

    if (isUsuario) {
      visibleReqs = visibleReqs.filter((r) => userOwnsRequirement(req.authUser!, r));
    }

    const visibleReqIds = visibleReqs.map((r) => r.id);
    const visibleDetalles = dbStore.getDetallesForRequerimientos(visibleReqIds);

    const visibleUsers = isAdmin
      ? meta.users.map(sanitizeUser)
      : [req.authUser!];

    res.json({
      version: meta.version,
      revision: meta.revision,
      lastUpdated: meta.lastUpdated,
      requerimientos: visibleReqs,
      detalles: visibleDetalles,
      users: visibleUsers,
      areas: meta.areas,
      fundos: meta.fundos,
      zonas: meta.zonas || MAESTRO_ZONAS,
      paraderos: meta.paraderos,
      comedores: meta.comedores,
      windowDesde: effectiveDesde || null,
      totalHistoricalCount: stats.totalRequerimientos,
      oldestFecha: stats.oldestFecha,
    });
  });

  app.get('/api/requerimientos/range', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const dbStore = getStore();
    const desde = typeof req.query.desde === 'string' && isValidDateString(req.query.desde) ? req.query.desde : undefined;
    const hasta = typeof req.query.hasta === 'string' && isValidDateString(req.query.hasta) ? req.query.hasta : undefined;

    let reqs = dbStore.queryRequerimientos({ desde, hasta, limit: 30000 });
    if (req.authRole === 'usuario') {
      reqs = reqs.filter((r) => userOwnsRequirement(req.authUser!, r));
    }
    const dets = dbStore.getDetallesForRequerimientos(reqs.map((r) => r.id));

    res.json({
      requerimientos: reqs,
      detalles: dets,
      revision: dbStore.getRevision(),
    });
  });

  app.get('/api/requerimientos', requireAuth, rateLimitMiddleware('read', 300, 60_000), (req: AuthenticatedRequest, res) => {
    const dbStore = getStore();
    const desde = typeof req.query.desde === 'string' && isValidDateString(req.query.desde) ? req.query.desde : undefined;
    const hasta = typeof req.query.hasta === 'string' && isValidDateString(req.query.hasta) ? req.query.hasta : undefined;

    let list = dbStore.queryRequerimientos({ desde, hasta, limit: 25000 });
    if (req.authRole === 'usuario') {
      list = list.filter((r) => userOwnsRequirement(req.authUser!, r));
    }
    res.json(list);
  });

  app.post('/api/requerimientos', requireAuth, rateLimitMiddleware('write', 180, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      if (hasHoneypotTriggered(req.body)) {
        return res.status(400).json({ error: 'Solicitud rechazada por validación de seguridad.' });
      }

      const dbStore = getStore();
      const meta = dbStore.getMeta();
      const body = req.body;
      const actor = req.authUser!;

      let newReq: Requerimiento;
      let newDets: DetalleRequerimiento[] = [];

      if (body.requerimiento) {
        const rawReq: Requerimiento = body.requerimiento;
        const rawDets: DetalleRequerimiento[] = Array.isArray(body.detalles) ? body.detalles : [];

        // Idempotencia por ID
        const existing = dbStore.getRequerimientoById(rawReq.id);
        if (existing) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: existing,
            detalles: dbStore.getDetallesForRequerimientos([existing.id]),
            revision: dbStore.getRevision(),
          });
        }

        if (!isValidDateString(rawReq.fecha)) {
          return res.status(400).json({ error: 'Formato de fecha inválido (esperado YYYY-MM-DD).' });
        }

        let computedTotal = 0;
        const cleanReqId =
          typeof rawReq.id === 'string' && /^[a-zA-Z0-9_\-]{4,128}$/.test(rawReq.id)
            ? rawReq.id
            : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const hasValidNum =
          typeof rawReq.numeroRequerimiento === 'string' && /^REQ-[0-9]{1,12}$/.test(rawReq.numeroRequerimiento);
        const numero =
          hasValidNum && !dbStore.findNumeroExists(rawReq.numeroRequerimiento)
            ? rawReq.numeroRequerimiento
            : dbStore.generateNextNumero();

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

        const stopsSig = newDets
          .map((d) => `${d.comedor}:${d.paradero}:${d.cantidad}`)
          .sort()
          .join('|');
        const dedupKey = `${actor.id}|${rawReq.fecha}|${rawReq.movimiento}|${sanitizeText(rawReq.fundo, 80)}|${finalTotal}|${stopsSig}`;
        const dup = recentSubmissions.get(dedupKey);
        if (dup && Date.now() < dup.expiresAt) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: dup.req,
            revision: dbStore.getRevision(),
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

        recentSubmissions.set(dedupKey, { req: newReq, expiresAt: Date.now() + 5_000 });
      } else {
        const draft: RequerimientoDraft = body.draft || body;
        if (!isValidDateString(draft.fecha)) {
          return res.status(400).json({ error: 'Formato de fecha inválido (esperado YYYY-MM-DD).' });
        }

        const nextNumero = dbStore.generateNextNumero();
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
                const masterMatch = meta.paraderos?.find(
                  (p) => p.paradero.trim().toLowerCase() === paradero.trim().toLowerCase()
                );
                const resolvedZona =
                  masterMatch?.zona ||
                  (masterMatch?.zonaId
                    ? meta.zonas?.find((z) => z.id === masterMatch.zonaId)?.zonaOperativa
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
            revision: dbStore.getRevision(),
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

      const revision = dbStore.insertRequerimiento(newReq, newDets);
      broadcastRealtimeEvent({
        revision,
        kind: 'REQ_UPSERT',
        entityId: newReq.id,
        requerimiento: newReq,
        detalles: newDets,
      });

      res.status(201).json({
        success: true,
        requerimiento: newReq,
        detalles: newDets,
        revision,
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
    rateLimitMiddleware('write', 60, 60_000),
    (req, res) => {
      try {
        const dbStore = getStore();
        const items: Array<{ requerimiento: Requerimiento; detalles?: DetalleRequerimiento[] }> = req.body?.items || [];
        if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
          return res.status(400).json({ error: 'Se requiere entre 1 y 500 elementos válidos por lote.' });
        }

        const validBatch: Array<{ requerimiento: Requerimiento; detalles: DetalleRequerimiento[] }> = [];

        items.forEach((item) => {
          const r = item?.requerimiento;
          if (!r || !r.id || !isValidDateString(r.fecha)) return;
          if ((r.totalPersonas || 0) < 1 || (r.totalPersonas || 0) > 5000) return;

          if (!dbStore.getRequerimientoById(r.id)) {
            if (dbStore.findNumeroExists(r.numeroRequerimiento)) {
              r.numeroRequerimiento = dbStore.generateNextNumero();
            }
            const validDets: DetalleRequerimiento[] = [];
            if (Array.isArray(item.detalles)) {
              item.detalles.forEach((d) => {
                if ((Number(d.cantidad) || 0) >= 1 && (Number(d.cantidad) || 0) <= 500) {
                  d.numeroRequerimiento = r.numeroRequerimiento;
                  validDets.push(d);
                }
              });
            }
            validBatch.push({ requerimiento: r, detalles: validDets });
          }
        });

        let revision = dbStore.getRevision();
        if (validBatch.length > 0) {
          revision = dbStore.insertBatchRequerimientos(validBatch);
          for (const item of validBatch) {
            broadcastRealtimeEvent({
              revision,
              kind: 'REQ_UPSERT',
              entityId: item.requerimiento.id,
              requerimiento: item.requerimiento,
              detalles: item.detalles,
            });
          }
        }

        const totalDets = validBatch.reduce((acc, x) => acc + x.detalles.length, 0);
        res.status(201).json({
          success: true,
          count: validBatch.length,
          detallesCount: totalDets,
          revision,
        });
      } catch (err: any) {
        console.error('Error in batch requirement insert:', err);
        res.status(500).json({ error: 'Error procesando lote de requerimientos.' });
      }
    }
  );

  app.put('/api/requerimientos/:id/estado', requireAuth, rateLimitMiddleware('write', 180, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const estado = req.body?.estado as EstadoRequerimiento;
      const motivo = sanitizeText(req.body?.motivo, 300);
      const motivoAnulacion = sanitizeText(req.body?.motivoAnulacion, 300);

      if (!VALID_ESTADOS.includes(estado)) {
        return res.status(400).json({ error: 'Estado de requerimiento no válido.' });
      }

      const dbStore = getStore();
      const target = dbStore.getRequerimientoById(id);
      if (!target) {
        return res.status(404).json({ error: 'Requerimiento no encontrado.' });
      }

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

      const updated: Requerimiento = {
        ...target,
        estado,
        updatedAt: timestamp,
        fechaAnulacion: estado === 'ANULADO' ? timestamp : target.fechaAnulacion,
        usuarioAnulacion: estado === 'ANULADO' ? actor.nombre : target.usuarioAnulacion,
        motivoAnulacion: motivoAnulacion || target.motivoAnulacion,
        historialTrazabilidad: updatedHistory,
      };

      const revision = dbStore.updateRequerimiento(updated);
      broadcastRealtimeEvent({
        revision,
        kind: 'REQ_UPSERT',
        entityId: updated.id,
        requerimiento: updated,
      });

      res.json({
        success: true,
        requerimiento: updated,
        revision,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error actualizando estado.' });
    }
  });

  app.put(
    '/api/requerimientos/:id',
    requireAuth,
    requireRole('admin', 'receptor'),
    rateLimitMiddleware('write', 120, 60_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const updates = req.body || {};
        const dbStore = getStore();

        const current = dbStore.getRequerimientoById(id);
        if (!current) {
          return res.status(404).json({ error: 'Requerimiento no encontrado.' });
        }

        const next: Requerimiento = { ...current, updatedAt: new Date().toISOString() };

        if (updates.fecha && isValidDateString(updates.fecha)) next.fecha = updates.fecha;
        if (typeof updates.area === 'string' && updates.area.trim()) next.area = sanitizeText(updates.area, 80);
        if (typeof updates.fundo === 'string' && updates.fundo.trim()) next.fundo = sanitizeText(updates.fundo, 80);
        if (typeof updates.cultivo === 'string') next.cultivo = sanitizeText(updates.cultivo, 60);
        if (typeof updates.horaRecojo === 'string' && updates.horaRecojo.trim()) next.horaRecojo = sanitizeText(updates.horaRecojo, 40);
        if (typeof updates.horaSalida === 'string' && updates.horaSalida.trim()) next.horaSalida = sanitizeText(updates.horaSalida, 40);
        if (typeof updates.observaciones === 'string') next.observaciones = sanitizeText(updates.observaciones, 500);
        if (updates.estado && VALID_ESTADOS.includes(updates.estado)) next.estado = updates.estado;

        const revision = dbStore.updateRequerimiento(next);
        broadcastRealtimeEvent({
          revision,
          kind: 'REQ_UPSERT',
          entityId: next.id,
          requerimiento: next,
        });

        res.json({
          success: true,
          requerimiento: next,
          revision,
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
    rateLimitMiddleware('write', 60, 60_000),
    (req: AuthenticatedRequest, res) => {
      try {
        const { ids, estado } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
          return res.status(400).json({ error: 'Lista de IDs inválida.' });
        }
        if (!VALID_ESTADOS.includes(estado)) {
          return res.status(400).json({ error: 'Estado no válido.' });
        }

        const dbStore = getStore();
        const actor = req.authUser!;
        const timestamp = new Date().toISOString();
        let updatedCount = 0;
        let lastRevision = dbStore.getRevision();

        for (const idOrNum of ids) {
          const r = dbStore.getRequerimientoById(String(idOrNum));
          if (r) {
            updatedCount++;
            const updated: Requerimiento = {
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
            lastRevision = dbStore.updateRequerimiento(updated);
            broadcastRealtimeEvent({
              revision: lastRevision,
              kind: 'REQ_UPSERT',
              entityId: updated.id,
              requerimiento: updated,
            });
          }
        }

        res.json({ success: true, count: updatedCount, revision: lastRevision });
      } catch (err: any) {
        res.status(500).json({ error: 'Error en actualización masiva.' });
      }
    }
  );

  app.delete('/api/requerimientos/:id', requireAuth, rateLimitMiddleware('write', 90, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const dbStore = getStore();
      const actor = req.authUser!;

      const target = dbStore.getRequerimientoById(id);
      if (!target) {
        return res.status(404).json({ error: 'Requerimiento no encontrado.' });
      }

      if (actor.rol === 'usuario') {
        if (!userOwnsRequirement(actor, target) || target.estado !== 'PENDIENTE') {
          return res.status(403).json({ error: 'No tiene permisos para anular este requerimiento.' });
        }
      }

      const timestamp = new Date().toISOString();
      const updated: Requerimiento = {
        ...target,
        estado: 'ANULADO',
        updatedAt: timestamp,
        fechaAnulacion: timestamp,
        usuarioAnulacion: actor.nombre,
        motivoAnulacion: 'Anulado de la programación diaria',
        historialTrazabilidad: [
          ...(target.historialTrazabilidad || []),
          {
            fecha: timestamp,
            usuario: actor.nombre,
            accion: 'ANULADO / BORRADO',
            detalle: 'Requerimiento conservado en historial para trazabilidad.',
          },
        ].slice(-50),
      };

      const revision = dbStore.updateRequerimiento(updated);
      broadcastRealtimeEvent({
        revision,
        kind: 'REQ_UPSERT',
        entityId: updated.id,
        requerimiento: updated,
      });

      res.json({ success: true, deletedId: updated.id, anulado: true, revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error anulando requerimiento.' });
    }
  });

  app.get('/api/detalles', requireAuth, rateLimitMiddleware('read', 240, 60_000), (req: AuthenticatedRequest, res) => {
    const dbStore = getStore();
    const reqId = req.query.requerimientoId as string;
    const isUsuario = req.authRole === 'usuario';

    if (reqId) {
      const parent = dbStore.getRequerimientoById(reqId);
      if (!parent) return res.json([]);
      if (isUsuario && !userOwnsRequirement(req.authUser!, parent)) {
        return res.status(403).json({ error: 'No tiene permisos.' });
      }
      return res.json(dbStore.getDetallesForRequerimientos([parent.id]));
    }

    let reqs = dbStore.queryRequerimientos({ desde: getDateDaysAgo(60), limit: 20000 });
    if (isUsuario) {
      reqs = reqs.filter((r) => userOwnsRequirement(req.authUser!, r));
    }
    res.json(dbStore.getDetallesForRequerimientos(reqs.map((r) => r.id)));
  });

  // -------------------------------------------------------------
  // ADMIN-ONLY USER MANAGEMENT & RECOVERY TICKETS
  // -------------------------------------------------------------
  app.get('/api/users', requireAuth, requireRole('admin'), rateLimitMiddleware('read', 120, 60_000), (_req, res) => {
    const meta = getStore().getMeta();
    res.json(meta.users.map(sanitizeUser));
  });

  app.post('/api/users', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req, res) => {
    try {
      const dbStore = getStore();
      const meta = dbStore.getMeta();
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
      if (meta.users.some((u) => u.usuario.toLowerCase() === cleanUsername)) {
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

      const nextUsers = [...meta.users, newUser];
      const revision = dbStore.saveUsers(nextUsers, true);
      res.status(201).json({ success: true, user: sanitizeUser(newUser), revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error creando usuario.' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const dbStore = getStore();
      const meta = dbStore.getMeta();

      const idx = meta.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        if (!/^[a-zA-Z0-9_\-]{4,128}$/.test(id)) {
          return res.status(400).json({ error: 'Identificador de usuario inválido.' });
        }
        const cleanUsername = sanitizeText(updates.usuario, 32).toLowerCase();
        const nombre = sanitizeText(updates.nombre, 120);
        if (!nombre || nombre.length < 2 || !isValidUsername(cleanUsername)) {
          return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        if (meta.users.some((u) => u.usuario.toLowerCase() === cleanUsername)) {
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
        const revision = dbStore.saveUsers([...meta.users, restoredUser], true);
        return res.json({ success: true, user: sanitizeUser(restoredUser), revision });
      }

      const target = { ...meta.users[idx] };

      if (typeof updates.usuario === 'string' && updates.usuario.trim()) {
        const cleanUsername = sanitizeText(updates.usuario, 32).toLowerCase();
        if (!isValidUsername(cleanUsername)) {
          return res.status(400).json({ error: 'Nombre de usuario con formato inválido.' });
        }
        const collision = meta.users.find((u) => u.id !== id && u.usuario.toLowerCase() === cleanUsername);
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

      meta.users[idx] = target;
      const revision = dbStore.saveUsers(meta.users, true);
      res.json({ success: true, user: sanitizeUser(target), revision });
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

      const dbStore = getStore();
      const meta = dbStore.getMeta();
      const idx = meta.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      meta.users[idx].passwordHash = hashPasswordScrypt(nuevaContrasena);
      meta.users[idx].salt = 'scrypt';
      const revision = dbStore.saveUsers(meta.users, false);

      res.json({ success: true, revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error restableciendo contraseña.' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 20, 60_000), (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const dbStore = getStore();
      const meta = dbStore.getMeta();

      const target = meta.users.find((u) => u.id === id);
      if (!target) {
        return res.status(404).json({ error: 'El usuario no existe o ya fue eliminado.' });
      }

      if (target.id === req.authUser!.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador activa.' });
      }

      const activeAdmins = meta.users.filter((u) => u.rol === 'admin' && u.estado === 'ACTIVO');
      if (target.rol === 'admin' && activeAdmins.length <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar el único administrador activo del sistema.' });
      }

      const remaining = meta.users.filter((u) => u.id !== id);
      const revision = dbStore.saveUsers(remaining, true);
      res.json({ success: true, deletedId: id, revision });
    } catch (err: any) {
      res.status(500).json({ error: 'Error eliminando usuario.' });
    }
  });

  app.get('/api/recovery-requests', requireAuth, requireRole('admin'), (_req, res) => {
    const meta = getStore().getMeta();
    res.json(meta.recoveryRequests || []);
  });

  // Master catalogs synchronization (Admin only)
  app.post('/api/maestros', requireAuth, requireRole('admin'), rateLimitMiddleware('write', 40, 60_000), (req, res) => {
    try {
      const { zonas, paraderos, fundos, areas, comedores } = req.body || {};
      const dbStore = getStore();

      const revision = dbStore.saveMaestros({
        ...(Array.isArray(zonas) ? { zonas: zonas.slice(0, 200) } : {}),
        ...(Array.isArray(paraderos) ? { paraderos: paraderos.slice(0, 500) } : {}),
        ...(Array.isArray(fundos) ? { fundos: fundos.slice(0, 200) } : {}),
        ...(Array.isArray(areas) ? { areas: areas.slice(0, 200) } : {}),
        ...(Array.isArray(comedores) ? { comedores: comedores.slice(0, 200) } : {}),
      });
      const meta = dbStore.getMeta();

      broadcastRealtimeEvent({
        revision,
        kind: 'MAESTROS_UPDATE',
      });

      res.json({
        success: true,
        revision,
        zonasCount: meta.zonas?.length || 0,
        paraderosCount: meta.paraderos.length,
        fundosCount: meta.fundos.length,
        areasCount: meta.areas.length,
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
      const dbStore = getStore();
      const revision = dbStore.saveMaestros({ paraderos: paraderos.slice(0, 500) });
      broadcastRealtimeEvent({ revision, kind: 'MAESTROS_UPDATE' });
      res.json({ success: true, count: dbStore.getMeta().paraderos.length, revision });
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] CAMPOSOL Transporte API corriendo en http://localhost:${PORT} (SQLite WAL activo)`);
  });
}

startServer();
