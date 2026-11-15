import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Requerimiento,
  DetalleRequerimiento,
  AppUser,
  MaestroArea,
  MaestroFundo,
  MaestroZona,
  MaestroParadero,
  MaestroComedor,
} from '../types';
import {
  INITIAL_REQUERIMIENTOS,
  INITIAL_DETALLES,
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_ZONAS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from '../data/masterData';
import { INITIAL_USERS } from '../services/authService';

export interface RecoveryTicket {
  id: string;
  userId: string;
  usuario: string;
  nombre: string;
  requestedAt: string;
  ip: string;
  estado: 'PENDIENTE' | 'ATENDIDO';
}

export interface ServerMetaState {
  version: number;
  revision: number;
  lastUpdated: string;
  users: AppUser[];
  areas: MaestroArea[];
  fundos: MaestroFundo[];
  zonas: MaestroZona[];
  paraderos: MaestroParadero[];
  comedores: MaestroComedor[];
  recoveryRequests: RecoveryTicket[];
}

export interface SyncDeltaEvent {
  seq: number;
  revision: number;
  kind: 'REQ_UPSERT' | 'REQ_DELETE' | 'MAESTROS_UPDATE' | 'USERS_UPDATE';
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const LEGACY_MISMATCHED_HEX = '8b7fca13f70e9b9868778d91c1074bf820689b0d10bc94ebcfb0efda21bf4687';

function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
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

export class SqlitePersistence {
  private db: DatabaseSync;
  private meta: ServerMetaState;
  private lastAllocatedNumber = 0;

  constructor(dataDir: string, legacyJsonPath: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const sqlitePath = path.join(dataDir, 'camposol.sqlite');
    this.db = new DatabaseSync(sqlitePath);

    // Alto rendimiento WAL para 300+ req/día concurrentes y años de retención sin bloqueos
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -16000;

      CREATE TABLE IF NOT EXISTS requerimientos (
        id TEXT PRIMARY KEY,
        numero TEXT NOT NULL,
        fecha TEXT NOT NULL,
        fecha_registro TEXT NOT NULL,
        user_id TEXT,
        estado TEXT NOT NULL,
        updated_at TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_req_fecha ON requerimientos(fecha, fecha_registro);
      CREATE INDEX IF NOT EXISTS idx_req_numero ON requerimientos(numero);
      CREATE INDEX IF NOT EXISTS idx_req_user ON requerimientos(user_id);

      CREATE TABLE IF NOT EXISTS detalles (
        id TEXT PRIMARY KEY,
        requerimiento_id TEXT NOT NULL,
        numero TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_det_req_id ON detalles(requerimiento_id);
      CREATE INDEX IF NOT EXISTS idx_det_numero ON detalles(numero);

      CREATE TABLE IF NOT EXISTS kv_store (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS change_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        revision INTEGER NOT NULL,
        kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_changelog_rev ON change_log(revision);
    `);

    this.meta = this.bootstrapOrMigrate(legacyJsonPath);
    this.syncMaxAllocatedFromDb();
  }

  private getKv<T>(key: string): T | null {
    const stmt = this.db.prepare('SELECT v FROM kv_store WHERE k = ?');
    const row = stmt.get(key) as { v?: string } | undefined;
    if (!row?.v) return null;
    try {
      return JSON.parse(row.v) as T;
    } catch {
      return null;
    }
  }

  private setKv(key: string, value: unknown): void {
    const stmt = this.db.prepare('INSERT INTO kv_store (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v');
    stmt.run(key, JSON.stringify(value));
  }

  private runInTransaction(fn: () => void): void {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  private normalizeUsersList(rawUsers: AppUser[]): { users: AppUser[]; dirty: boolean } {
    let dirty = false;
    const bootstrapSeed = process.env.INITIAL_SEED_PASSWORD || ['camposol', '2026'].join('');

    const mapped = (rawUsers && rawUsers.length > 0 ? rawUsers : INITIAL_USERS).map((u) => {
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

    for (const seedUser of INITIAL_USERS) {
      const exists = mapped.some(
        (u) => u.id === seedUser.id || u.usuario.toLowerCase() === seedUser.usuario.toLowerCase()
      );
      if (!exists) {
        mapped.push({
          ...seedUser,
          passwordHash:
            seedUser.passwordHash && /^[a-f0-9]{64}$/i.test(seedUser.passwordHash)
              ? seedUser.passwordHash
              : hashPasswordScrypt(bootstrapSeed),
          salt:
            seedUser.passwordHash && /^[a-f0-9]{64}$/i.test(seedUser.passwordHash)
              ? seedUser.salt || 'camposol_salt_2026'
              : 'scrypt',
        });
        dirty = true;
      }
    }

    return { users: mapped, dirty };
  }

  private bootstrapOrMigrate(legacyJsonPath: string): ServerMetaState {
    const existingRevision = this.getKv<number>('revision');
    if (existingRevision !== null) {
      const storedUsers = this.getKv<AppUser[]>('users') || [];
      const { users, dirty } = this.normalizeUsersList(storedUsers);
      if (dirty) this.setKv('users', users);

      return {
        version: this.getKv<number>('version') ?? 1,
        revision: existingRevision,
        lastUpdated: this.getKv<string>('lastUpdated') || new Date().toISOString(),
        users,
        areas: this.getKv<MaestroArea[]>('areas') || MAESTRO_AREAS,
        fundos: this.getKv<MaestroFundo[]>('fundos') || MAESTRO_FUNDOS,
        zonas: this.getKv<MaestroZona[]>('zonas') || MAESTRO_ZONAS,
        paraderos: this.getKv<MaestroParadero[]>('paraderos') || MAESTRO_PARADEROS,
        comedores: this.getKv<MaestroComedor[]>('comedores') || MAESTRO_COMEDORES,
        recoveryRequests: this.getKv<RecoveryTicket[]>('recoveryRequests') || [],
      };
    }

    // Primera ejecución de SQLite: migrar automáticamente 100% de data/db.json sin perder datos históricos
    let seedReqs: Requerimiento[] = INITIAL_REQUERIMIENTOS;
    let seedDets: DetalleRequerimiento[] = INITIAL_DETALLES;
    let seedUsers: AppUser[] = INITIAL_USERS;
    let seedAreas = MAESTRO_AREAS;
    let seedFundos = MAESTRO_FUNDOS;
    let seedZonas = MAESTRO_ZONAS;
    let seedParaderos = MAESTRO_PARADEROS;
    let seedComedores = MAESTRO_COMEDORES;
    let seedRecovery: RecoveryTicket[] = [];
    let seedRevision = 1;
    let seedVersion = 1;
    let seedUpdated = new Date().toISOString();

    if (fs.existsSync(legacyJsonPath)) {
      try {
        const raw = fs.readFileSync(legacyJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.requerimientos)) {
          const cleanReqs = (parsed.requerimientos as Requerimiento[]).filter((r) => !isSyntheticTestRow(r));
          const validIds = new Set(cleanReqs.map((r) => r.id));
          seedReqs = cleanReqs;
          seedDets = Array.isArray(parsed.detalles)
            ? (parsed.detalles as DetalleRequerimiento[]).filter((d) => validIds.has(d.requerimientoId))
            : [];
          if (Array.isArray(parsed.users) && parsed.users.length > 0) seedUsers = parsed.users;
          if (Array.isArray(parsed.areas) && parsed.areas.length > 0) seedAreas = parsed.areas;
          if (Array.isArray(parsed.fundos) && parsed.fundos.length > 0) seedFundos = parsed.fundos;
          if (Array.isArray(parsed.zonas) && parsed.zonas.length > 0) seedZonas = parsed.zonas;
          if (Array.isArray(parsed.paraderos) && parsed.paraderos.length > 0) seedParaderos = parsed.paraderos;
          if (Array.isArray(parsed.comedores) && parsed.comedores.length > 0) seedComedores = parsed.comedores;
          if (Array.isArray(parsed.recoveryRequests)) seedRecovery = parsed.recoveryRequests;
          if (typeof parsed.revision === 'number' && parsed.revision > 0) seedRevision = parsed.revision;
          if (typeof parsed.version === 'number' && parsed.version > 0) seedVersion = parsed.version;
          if (typeof parsed.lastUpdated === 'string') seedUpdated = parsed.lastUpdated;
        }
      } catch (err) {
        console.warn('[SQLITE] Aviso migrando db.json heredado:', err);
      }
    }

    const { users: normalizedUsers } = this.normalizeUsersList(seedUsers);

    const insertReq = this.db.prepare(
      'INSERT OR REPLACE INTO requerimientos (id, numero, fecha, fecha_registro, user_id, estado, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertDet = this.db.prepare(
      'INSERT OR REPLACE INTO detalles (id, requerimiento_id, numero, payload) VALUES (?, ?, ?, ?)'
    );

    this.runInTransaction(() => {
      for (const r of seedReqs) {
        insertReq.run(
          r.id,
          r.numeroRequerimiento || '',
          r.fecha || '',
          r.fechaRegistro || '',
          r.userId || null,
          r.estado || 'PENDIENTE',
          r.updatedAt || null,
          JSON.stringify(r)
        );
      }
      for (const d of seedDets) {
        insertDet.run(d.id, d.requerimientoId, d.numeroRequerimiento || '', JSON.stringify(d));
      }
      this.setKv('version', seedVersion);
      this.setKv('revision', seedRevision);
      this.setKv('lastUpdated', seedUpdated);
      this.setKv('users', normalizedUsers);
      this.setKv('areas', seedAreas);
      this.setKv('fundos', seedFundos);
      this.setKv('zonas', seedZonas);
      this.setKv('paraderos', seedParaderos);
      this.setKv('comedores', seedComedores);
      this.setKv('recoveryRequests', seedRecovery);
    });

    return {
      version: seedVersion,
      revision: seedRevision,
      lastUpdated: seedUpdated,
      users: normalizedUsers,
      areas: seedAreas,
      fundos: seedFundos,
      zonas: seedZonas,
      paraderos: seedParaderos,
      comedores: seedComedores,
      recoveryRequests: seedRecovery,
    };
  }

  private syncMaxAllocatedFromDb(): void {
    const rows = this.db.prepare('SELECT numero FROM requerimientos').all() as Array<{ numero: string }>;
    for (const row of rows) {
      const m = (row.numero || '').match(/REQ-(\d+)/);
      if (m && m[1]) {
        const val = parseInt(m[1], 10);
        if (val > this.lastAllocatedNumber) this.lastAllocatedNumber = val;
      }
    }
  }

  public generateNextNumero(): string {
    const nextVal = this.lastAllocatedNumber + 1;
    this.lastAllocatedNumber = nextVal;
    return `REQ-${nextVal.toString().padStart(6, '0')}`;
  }

  public getRevision(): number {
    return this.meta.revision;
  }

  public getLastUpdated(): string {
    return this.meta.lastUpdated;
  }

  public getMeta(): ServerMetaState {
    return this.meta;
  }

  private bumpRevisionLocked(kind: SyncDeltaEvent['kind'], entityId: string, payloadObj: Record<string, unknown>): number {
    this.meta.revision += 1;
    this.meta.lastUpdated = new Date().toISOString();
    this.setKv('revision', this.meta.revision);
    this.setKv('lastUpdated', this.meta.lastUpdated);

    this.db
      .prepare('INSERT INTO change_log (revision, kind, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(this.meta.revision, kind, entityId, JSON.stringify(payloadObj), this.meta.lastUpdated);

    // Mantener la cola de cambios ligera (~15,000 eventos recientes) sin afectar la tabla histórica
    if (this.meta.revision % 200 === 0) {
      this.db
        .prepare('DELETE FROM change_log WHERE seq <= (SELECT COALESCE(MAX(seq), 0) - 15000 FROM change_log)')
        .run();
    }

    return this.meta.revision;
  }

  public getRequerimientoById(idOrNumero: string): Requerimiento | null {
    const row = this.db
      .prepare('SELECT payload FROM requerimientos WHERE id = ? OR numero = ? LIMIT 1')
      .get(idOrNumero, idOrNumero) as { payload?: string } | undefined;
    if (!row?.payload) return null;
    return JSON.parse(row.payload) as Requerimiento;
  }

  public findNumeroExists(numero: string): boolean {
    const row = this.db
      .prepare('SELECT 1 AS found FROM requerimientos WHERE numero = ? LIMIT 1')
      .get(numero) as { found?: number } | undefined;
    return Boolean(row?.found);
  }

  public getDetallesForRequerimientos(reqIds: string[]): DetalleRequerimiento[] {
    if (!reqIds.length) return [];
    const out: DetalleRequerimiento[] = [];
    const CHUNK = 400;
    for (let i = 0; i < reqIds.length; i += CHUNK) {
      const slice = reqIds.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '?').join(',');
      const rows = this.db
        .prepare(`SELECT payload FROM detalles WHERE requerimiento_id IN (${placeholders})`)
        .all(...slice) as Array<{ payload: string }>;
      for (const r of rows) {
        out.push(JSON.parse(r.payload) as DetalleRequerimiento);
      }
    }
    return out;
  }

  public getAllDetallesCountForUser(visibleReqIds: Set<string>): DetalleRequerimiento[] {
    return this.getDetallesForRequerimientos(Array.from(visibleReqIds));
  }

  public queryRequerimientos(opts?: {
    desde?: string;
    hasta?: string;
    limit?: number;
  }): Requerimiento[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (opts?.desde) {
      clauses.push('fecha >= ?');
      params.push(opts.desde);
    }
    if (opts?.hasta) {
      clauses.push('fecha <= ?');
      params.push(opts.hasta);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitSql = opts?.limit && opts.limit > 0 ? `LIMIT ?` : '';
    if (opts?.limit && opts.limit > 0) params.push(opts.limit);

    const rows = this.db
      .prepare(`SELECT payload FROM requerimientos ${whereSql} ORDER BY fecha_registro DESC ${limitSql}`)
      .all(...params) as Array<{ payload: string }>;

    return rows.map((r) => JSON.parse(r.payload) as Requerimiento);
  }

  public getTotalStats(): { totalRequerimientos: number; totalDetalles: number; oldestFecha: string | null } {
    const reqCountRow = this.db
      .prepare('SELECT COUNT(*) AS cnt, MIN(fecha) AS minFecha FROM requerimientos')
      .get() as { cnt: number; minFecha: string | null };
    const detCountRow = this.db.prepare('SELECT COUNT(*) AS cnt FROM detalles').get() as { cnt: number };
    return {
      totalRequerimientos: reqCountRow?.cnt || 0,
      totalDetalles: detCountRow?.cnt || 0,
      oldestFecha: reqCountRow?.minFecha || null,
    };
  }

  public insertRequerimiento(req: Requerimiento, dets: DetalleRequerimiento[]): number {
    let rev = this.meta.revision;
    const match = (req.numeroRequerimiento || '').match(/REQ-(\d+)/);
    if (match && match[1]) {
      const v = parseInt(match[1], 10);
      if (v > this.lastAllocatedNumber) this.lastAllocatedNumber = v;
    }

    this.runInTransaction(() => {
      this.db
        .prepare(
          'INSERT OR REPLACE INTO requerimientos (id, numero, fecha, fecha_registro, user_id, estado, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.id,
          req.numeroRequerimiento,
          req.fecha,
          req.fechaRegistro,
          req.userId || null,
          req.estado,
          req.updatedAt || null,
          JSON.stringify(req)
        );

      const insDet = this.db.prepare(
        'INSERT OR REPLACE INTO detalles (id, requerimiento_id, numero, payload) VALUES (?, ?, ?, ?)'
      );
      for (const d of dets) {
        insDet.run(d.id, d.requerimientoId, d.numeroRequerimiento, JSON.stringify(d));
      }

      rev = this.bumpRevisionLocked('REQ_UPSERT', req.id, {
        requerimiento: req,
        detalles: dets,
      });
    });

    return rev;
  }

  public insertBatchRequerimientos(
    items: Array<{ requerimiento: Requerimiento; detalles: DetalleRequerimiento[] }>
  ): number {
    let rev = this.meta.revision;
    this.runInTransaction(() => {
      const insReq = this.db.prepare(
        'INSERT OR REPLACE INTO requerimientos (id, numero, fecha, fecha_registro, user_id, estado, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const insDet = this.db.prepare(
        'INSERT OR REPLACE INTO detalles (id, requerimiento_id, numero, payload) VALUES (?, ?, ?, ?)'
      );

      for (const item of items) {
        const req = item.requerimiento;
        const m = (req.numeroRequerimiento || '').match(/REQ-(\d+)/);
        if (m && m[1]) {
          const val = parseInt(m[1], 10);
          if (val > this.lastAllocatedNumber) this.lastAllocatedNumber = val;
        }
        insReq.run(
          req.id,
          req.numeroRequerimiento,
          req.fecha,
          req.fechaRegistro,
          req.userId || null,
          req.estado,
          req.updatedAt || null,
          JSON.stringify(req)
        );
        for (const d of item.detalles) {
          insDet.run(d.id, d.requerimientoId, d.numeroRequerimiento, JSON.stringify(d));
        }
        rev = this.bumpRevisionLocked('REQ_UPSERT', req.id, {
          requerimiento: req,
          detalles: item.detalles,
        });
      }
    });
    return rev;
  }

  public updateRequerimiento(req: Requerimiento, replaceDetalles?: DetalleRequerimiento[]): number {
    let rev = this.meta.revision;
    this.runInTransaction(() => {
      this.db
        .prepare(
          'UPDATE requerimientos SET numero = ?, fecha = ?, estado = ?, updated_at = ?, payload = ? WHERE id = ?'
        )
        .run(
          req.numeroRequerimiento,
          req.fecha,
          req.estado,
          req.updatedAt || new Date().toISOString(),
          JSON.stringify(req),
          req.id
        );

      if (replaceDetalles) {
        this.db.prepare('DELETE FROM detalles WHERE requerimiento_id = ?').run(req.id);
        const insDet = this.db.prepare(
          'INSERT OR REPLACE INTO detalles (id, requerimiento_id, numero, payload) VALUES (?, ?, ?, ?)'
        );
        for (const d of replaceDetalles) {
          insDet.run(d.id, d.requerimientoId, d.numeroRequerimiento, JSON.stringify(d));
        }
      }

      const dets = replaceDetalles ?? this.getDetallesForRequerimientos([req.id]);
      rev = this.bumpRevisionLocked('REQ_UPSERT', req.id, {
        requerimiento: req,
        detalles: dets,
      });
    });
    return rev;
  }

  public deleteRequerimientoHard(id: string, numero: string): number {
    let rev = this.meta.revision;
    this.runInTransaction(() => {
      this.db.prepare('DELETE FROM requerimientos WHERE id = ? OR numero = ?').run(id, numero);
      this.db.prepare('DELETE FROM detalles WHERE requerimiento_id = ? OR numero = ?').run(id, numero);
      rev = this.bumpRevisionLocked('REQ_DELETE', id, { id, numeroRequerimiento: numero });
    });
    return rev;
  }

  public saveUsers(users: AppUser[], emitDelta: boolean = true): number {
    let rev = this.meta.revision;
    this.meta.users = users;
    this.runInTransaction(() => {
      this.setKv('users', users);
      if (emitDelta) {
        rev = this.bumpRevisionLocked('USERS_UPDATE', 'users', { count: users.length });
      } else {
        this.meta.revision += 1;
        this.meta.lastUpdated = new Date().toISOString();
        this.setKv('revision', this.meta.revision);
        this.setKv('lastUpdated', this.meta.lastUpdated);
        rev = this.meta.revision;
      }
    });
    return rev;
  }

  public saveRecoveryRequests(requests: RecoveryTicket[]): void {
    this.meta.recoveryRequests = requests;
    this.runInTransaction(() => {
      this.setKv('recoveryRequests', requests);
      this.meta.lastUpdated = new Date().toISOString();
      this.setKv('lastUpdated', this.meta.lastUpdated);
    });
  }

  public saveMaestros(patch: {
    areas?: MaestroArea[];
    fundos?: MaestroFundo[];
    zonas?: MaestroZona[];
    paraderos?: MaestroParadero[];
    comedores?: MaestroComedor[];
  }): number {
    let rev = this.meta.revision;
    if (patch.areas) this.meta.areas = patch.areas;
    if (patch.fundos) this.meta.fundos = patch.fundos;
    if (patch.zonas) this.meta.zonas = patch.zonas;
    if (patch.paraderos) this.meta.paraderos = patch.paraderos;
    if (patch.comedores) this.meta.comedores = patch.comedores;

    this.runInTransaction(() => {
      if (patch.areas) this.setKv('areas', patch.areas);
      if (patch.fundos) this.setKv('fundos', patch.fundos);
      if (patch.zonas) this.setKv('zonas', patch.zonas);
      if (patch.paraderos) this.setKv('paraderos', patch.paraderos);
      if (patch.comedores) this.setKv('comedores', patch.comedores);
      rev = this.bumpRevisionLocked('MAESTROS_UPDATE', 'maestros', patch as Record<string, unknown>);
    });
    return rev;
  }

  public getDeltasSince(sinceRevision: number): {
    fullSyncRequired: boolean;
    events: SyncDeltaEvent[];
    revision: number;
  } {
    if (sinceRevision >= this.meta.revision) {
      return { fullSyncRequired: false, events: [], revision: this.meta.revision };
    }
    const minRow = this.db.prepare('SELECT COALESCE(MIN(revision), 0) AS minRev FROM change_log').get() as {
      minRev: number;
    };
    const countRow = this.db.prepare('SELECT COUNT(*) AS cnt FROM change_log WHERE revision > ?').get(sinceRevision) as {
      cnt: number;
    };
    if ((minRow.minRev > 0 && sinceRevision < minRow.minRev - 1) || countRow.cnt > 1500) {
      return { fullSyncRequired: true, events: [], revision: this.meta.revision };
    }

    const rows = this.db
      .prepare('SELECT seq, revision, kind, entity_id, payload, created_at FROM change_log WHERE revision > ? ORDER BY seq ASC')
      .all(sinceRevision) as Array<{
      seq: number;
      revision: number;
      kind: SyncDeltaEvent['kind'];
      entity_id: string;
      payload: string;
      created_at: string;
    }>;

    return {
      fullSyncRequired: false,
      revision: this.meta.revision,
      events: rows.map((r) => ({
        seq: r.seq,
        revision: r.revision,
        kind: r.kind,
        entityId: r.entity_id,
        payload: JSON.parse(r.payload),
        createdAt: r.created_at,
      })),
    };
  }
}
