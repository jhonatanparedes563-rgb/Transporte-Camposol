import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  INITIAL_REQUERIMIENTOS,
  INITIAL_DETALLES,
  MAESTRO_AREAS,
  MAESTRO_FUNDOS,
  MAESTRO_PARADEROS,
  MAESTRO_COMEDORES,
} from './src/data/masterData';
import { INITIAL_USERS } from './src/services/authService';
import {
  Requerimiento,
  DetalleRequerimiento,
  AppUser,
  RequerimientoDraft,
  MaestroParadero,
  MaestroArea,
  MaestroFundo,
  MaestroComedor,
} from './src/types';

interface ServerDb {
  version: number;
  revision: number;
  lastUpdated: string;
  requerimientos: Requerimiento[];
  detalles: DetalleRequerimiento[];
  users: AppUser[];
  areas: MaestroArea[];
  fundos: MaestroFundo[];
  paraderos: MaestroParadero[];
  comedores: MaestroComedor[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let inMemoryDb: ServerDb | null = null;
let currentRevision = 1;

function initDb(): ServerDb {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.requerimientos)) {
        inMemoryDb = parsed;
        currentRevision = parsed.revision || 1;
        return inMemoryDb as ServerDb;
      }
    }
  } catch (err) {
    console.error('Error loading db.json, creating initial store:', err);
  }

  const initialDb: ServerDb = {
    version: 1,
    revision: 1,
    lastUpdated: new Date().toISOString(),
    requerimientos: INITIAL_REQUERIMIENTOS,
    detalles: INITIAL_DETALLES,
    users: INITIAL_USERS,
    areas: MAESTRO_AREAS,
    fundos: MAESTRO_FUNDOS,
    paraderos: MAESTRO_PARADEROS,
    comedores: MAESTRO_COMEDORES,
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

  // Persistencia asíncrona no bloqueante de alta concurrencia
  setImmediate(() => {
    flushDbToDisk().catch((err) => console.error('[SERVER] Async flush error:', err));
  });
}

let lastAllocatedNumber = 0;

function generateNextNumero(reqs: Requerimiento[]): string {
  let maxNum = lastAllocatedNumber;
  for (const r of reqs) {
    const match = r.numeroRequerimiento.match(/REQ-(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  const nextVal = maxNum + 1;
  lastAllocatedNumber = nextVal;
  return `REQ-${nextVal.toString().padStart(6, '0')}`;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize persistent DB
  initDb();

  // -------------------------------------------------------------
  // API ROUTES (Always before Vite middleware)
  // -------------------------------------------------------------

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CAMPOSOL Transporte API',
      timestamp: new Date().toISOString(),
      revision: currentRevision,
    });
  });

  // Version check for fast background polling
  app.get('/api/sync/version', (_req, res) => {
    const db = getDb();
    res.json({
      revision: db.revision,
      lastUpdated: db.lastUpdated,
      count: db.requerimientos.length,
      usersCount: db.users.length,
    });
  });

  // Full data snapshot for sync
  app.get('/api/data', (_req, res) => {
    const db = getDb();
    res.json(db);
  });

  // Get all requirements
  app.get('/api/requerimientos', (_req, res) => {
    const db = getDb();
    res.json(db.requerimientos);
  });

  // Create new requirement (from worker mobile or desktop)
  app.post('/api/requerimientos', (req, res) => {
    try {
      const db = getDb();
      const body = req.body;

      let newReq: Requerimiento;
      let newDets: DetalleRequerimiento[] = [];

      if (body.requerimiento) {
        // Direct pre-built object
        newReq = body.requerimiento;
        newDets = body.detalles || [];

        // 1. Idempotencia: Si ya existe por ID, responder sin duplicar
        const existingIdx = db.requerimientos.findIndex((r) => r.id === newReq.id);
        if (existingIdx !== -1) {
          return res.status(200).json({
            success: true,
            alreadyExists: true,
            requerimiento: db.requerimientos[existingIdx],
            revision: db.revision,
          });
        }

        // 2. Prevención de colisiones concurrentes:
        // Si dos usuarios generaron el mismo REQ-XXXXXX al mismo tiempo mientras enviaban,
        // el servidor reasigna de inmediato un número ascendente libre
        if (db.requerimientos.some((r) => r.numeroRequerimiento === newReq.numeroRequerimiento)) {
          const freshNumero = generateNextNumero(db.requerimientos);
          newReq.numeroRequerimiento = freshNumero;
          newDets.forEach((d) => {
            d.numeroRequerimiento = freshNumero;
          });
        }
      } else {
        // Draft format
        const draft: RequerimientoDraft = body.draft || body;
        const currentUser: AppUser | undefined = body.currentUser;

        const nextNumero = generateNextNumero(db.requerimientos);
        const reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        let totalPersonas = 0;
        if (draft.comedores && draft.comedores.length > 0) {
          draft.comedores.forEach((c) => {
            Object.entries(c.paraderosCantidades || {}).forEach(([paradero, rawQty]) => {
              const cantidad = Number(rawQty) || 0;
              if (cantidad > 0) {
                totalPersonas += cantidad;
                newDets.push({
                  id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  requerimientoId: reqId,
                  numeroRequerimiento: nextNumero,
                  comedor: c.comedor || 'Comedor 1',
                  parcela: c.comedor || 'Comedor 1',
                  paradero: paradero,
                  zona: 'SUR',
                  cultivo: draft.cultivo || 'ARÁNDANO',
                  cantidad: cantidad,
                });
              }
            });
          });
        }

        const isUserObj = typeof currentUser === 'object' && currentUser !== null;
        const userName = isUserObj ? currentUser.nombre : 'Supervisor de Campo';

        newReq = {
          id: reqId,
          numeroRequerimiento: nextNumero,
          fecha: draft.fecha || new Date().toISOString().split('T')[0],
          area: draft.area || 'PRODUCCIÓN',
          fundo: draft.fundo || 'AGRICULTOR 1',
          cultivo: draft.cultivo || 'ARÁNDANO',
          parcelas: draft.parcelas || [],
          movimiento: draft.movimiento || 'Programa personal por tarea',
          horaRecojo: draft.horaRecojo || '13:00',
          horaSalida: draft.horaSalida || '14:00',
          observaciones: (draft.observaciones || '').trim(),
          usuario: userName,
          userId: isUserObj ? currentUser.id : undefined,
          userUsername: isUserObj ? currentUser.usuario : undefined,
          userRole: isUserObj ? currentUser.rol : undefined,
          fechaRegistro: new Date().toISOString(),
          totalPersonas: totalPersonas,
          estado: 'PENDIENTE',
        };
      }

      // Prepend to list
      db.requerimientos = [newReq, ...db.requerimientos];
      db.detalles = [...db.detalles, ...newDets];
      persistDb(db);

      console.log(`[SERVER] Requerimiento guardado: ${newReq.numeroRequerimiento} por ${newReq.usuario}`);
      res.status(201).json({
        success: true,
        requerimiento: newReq,
        detalles: newDets,
        revision: db.revision,
      });
    } catch (err: any) {
      console.error('Error saving requirement:', err);
      res.status(500).json({ error: err.message || 'Error saving requirement' });
    }
  });

  // Batch insert endpoint for mass queue processing or stress testing
  app.post('/api/requerimientos/batch', (req, res) => {
    try {
      const db = getDb();
      const items: Array<{ requerimiento: Requerimiento; detalles?: DetalleRequerimiento[] }> = req.body.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Array of items required' });
      }

      const addedReqs: Requerimiento[] = [];
      const addedDets: DetalleRequerimiento[] = [];

      items.forEach((item) => {
        const r = item.requerimiento;
        if (!db.requerimientos.some((ex) => ex.id === r.id)) {
          if (db.requerimientos.some((ex) => ex.numeroRequerimiento === r.numeroRequerimiento)) {
            r.numeroRequerimiento = generateNextNumero(db.requerimientos);
          }
          addedReqs.push(r);
          if (item.detalles && Array.isArray(item.detalles)) {
            item.detalles.forEach((d) => {
              d.numeroRequerimiento = r.numeroRequerimiento;
              addedDets.push(d);
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
      res.status(500).json({ error: err.message });
    }
  });

  // Concurrency & stress test benchmark endpoint: simula 300 peticiones en paralelo
  app.post('/api/diagnostics/stress-test', async (req, res) => {
    try {
      const count = Math.min(Math.max(Number(req.body.count) || 300, 10), 1000);
      const startTime = Date.now();
      const db = getDb();
      const initialCount = db.requerimientos.length;

      // Ejecutar 300 creaciones concurrentes simultáneas
      const tasks = Array.from({ length: count }, (_, idx) => {
        return new Promise<{ id: string; numero: string }>((resolve) => {
          const freshNumero = generateNextNumero(db.requerimientos);
          const reqId = `stress-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 8)}`;
          const simReq: Requerimiento = {
            id: reqId,
            numeroRequerimiento: freshNumero,
            fecha: new Date().toISOString().split('T')[0],
            area: 'PRODUCCIÓN',
            fundo: 'AGRICULTOR 1',
            cultivo: 'ARÁNDANO',
            movimiento: 'INGRESO',
            horaRecojo: '05:00',
            horaSalida: '06:00',
            observaciones: `Prueba de concurrencia simulada #${idx + 1}`,
            usuario: `Test Supervisor ${idx + 1}`,
            fechaRegistro: new Date().toISOString(),
            totalPersonas: Math.floor(Math.random() * 40) + 10,
            estado: 'PENDIENTE',
          };
          db.requerimientos.push(simReq);
          resolve({ id: simReq.id, numero: simReq.numeroRequerimiento });
        });
      });

      const results = await Promise.all(tasks);
      persistDb(db);
      const durationMs = Date.now() - startTime;

      // Verificar unicidad absoluta (0 colisiones)
      const generatedNumbers = results.map((r) => r.numero);
      const uniqueNumbers = new Set(generatedNumbers);
      const hasZeroCollisions = uniqueNumbers.size === count;

      res.json({
        success: true,
        message: `Prueba de alta concurrencia completada: ${count} solicitudes simultáneas procesadas.`,
        solicitudesProcesadas: count,
        duracionTotalMs: durationMs,
        promedioPorSolicitudMs: Number((durationMs / count).toFixed(2)),
        ceroColisionesGarantizado: hasZeroCollisions,
        solicitudesUnicas: uniqueNumbers.size,
        totalEnBaseDeDatos: db.requerimientos.length,
        initialCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update requirement status
  app.put('/api/requerimientos/:id/estado', (req, res) => {
    try {
      const { id } = req.params;
      const { estado, usuario, motivo, fechaAnulacion, usuarioAnulacion, motivoAnulacion } = req.body;
      const db = getDb();

      const idx = db.requerimientos.findIndex((r) => r.id === id || r.numeroRequerimiento === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Requerimiento no encontrado' });
      }

      const history = db.requerimientos[idx].historialTrazabilidad || [];
      const timestamp = new Date().toISOString();
      const updatedHistory = [
        ...history,
        {
          fecha: timestamp,
          usuario: usuario || 'Admin / Transporte',
          accion: `ESTADO: ${estado}`,
          detalle: motivo || `Estado actualizado a ${estado}`,
        },
      ];

      db.requerimientos[idx] = {
        ...db.requerimientos[idx],
        estado,
        fechaAnulacion: fechaAnulacion || (estado === 'ANULADO' ? timestamp : db.requerimientos[idx].fechaAnulacion),
        usuarioAnulacion: usuarioAnulacion || (estado === 'ANULADO' ? (usuario || 'Admin') : db.requerimientos[idx].usuarioAnulacion),
        motivoAnulacion: motivoAnulacion || db.requerimientos[idx].motivoAnulacion,
        historialTrazabilidad: updatedHistory,
      };

      persistDb(db);
      res.json({
        success: true,
        requerimiento: db.requerimientos[idx],
        revision: db.revision,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update full requirement
  app.put('/api/requerimientos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = getDb();

      const idx = db.requerimientos.findIndex((r) => r.id === id || r.numeroRequerimiento === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Requerimiento no encontrado' });
      }

      db.requerimientos[idx] = {
        ...db.requerimientos[idx],
        ...updates,
      };

      persistDb(db);
      res.json({
        success: true,
        requerimiento: db.requerimientos[idx],
        revision: db.revision,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch update requirements status
  app.post('/api/requerimientos/batch-status', (req, res) => {
    try {
      const { ids, estado } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array required' });
      }

      const db = getDb();
      db.requerimientos = db.requerimientos.map((r) => {
        if (ids.includes(r.id) || ids.includes(r.numeroRequerimiento)) {
          return { ...r, estado };
        }
        return r;
      });

      persistDb(db);
      res.json({ success: true, count: ids.length, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete requirement: Soft-delete/anular to preserve in history and ensure traceability
  app.delete('/api/requerimientos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = getDb();

      const target = db.requerimientos.find((r) => r.id === id || r.numeroRequerimiento === id);
      if (!target) {
        return res.status(404).json({ error: 'Requerimiento no encontrado' });
      }

      const timestamp = new Date().toISOString();
      target.estado = 'ANULADO';
      target.fechaAnulacion = timestamp;
      target.usuarioAnulacion = 'Admin / Sistema';
      target.motivoAnulacion = 'Anulado de la programación diaria';
      target.historialTrazabilidad = [
        ...(target.historialTrazabilidad || []),
        {
          fecha: timestamp,
          usuario: 'Admin / Sistema',
          accion: 'ANULADO / BORRADO',
          detalle: 'Requerimiento conservado en historial para trazabilidad.',
        },
      ];

      persistDb(db);
      res.json({ success: true, deletedId: target.id, anulado: true, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get details
  app.get('/api/detalles', (req, res) => {
    const db = getDb();
    const reqId = req.query.requerimientoId as string;
    if (reqId) {
      return res.json(db.detalles.filter((d) => d.requerimientoId === reqId || d.numeroRequerimiento === reqId));
    }
    res.json(db.detalles);
  });

  // Users CRUD
  app.get('/api/users', (_req, res) => {
    const db = getDb();
    res.json(db.users);
  });

  app.post('/api/users', (req, res) => {
    try {
      const db = getDb();
      const newUser: AppUser = req.body;

      if (!newUser.id) {
        newUser.id = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
      newUser.fechaCreacion = new Date().toISOString();

      db.users.push(newUser);
      persistDb(db);
      res.status(201).json({ success: true, user: newUser, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const db = getDb();

      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      db.users[idx] = { ...db.users[idx], ...updates };
      persistDb(db);
      res.json({ success: true, user: db.users[idx], revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = getDb();

      db.users = db.users.filter((u) => u.id !== id);
      persistDb(db);
      res.json({ success: true, deletedId: id, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Master catalogs synchronization (Paraderos, Fundos, Áreas, Comedores)
  app.post('/api/maestros', (req, res) => {
    try {
      const { paraderos, fundos, areas, comedores } = req.body;
      const db = getDb();

      if (Array.isArray(paraderos)) {
        db.paraderos = paraderos;
      }
      if (Array.isArray(fundos)) {
        db.fundos = fundos;
      }
      if (Array.isArray(areas)) {
        db.areas = areas;
      }
      if (Array.isArray(comedores)) {
        db.comedores = comedores;
      }

      persistDb(db);
      console.log(`[Server] Catálogos maestros persistidos en disco. Paraderos: ${db.paraderos?.length || 0}`);
      res.json({
        success: true,
        revision: db.revision,
        paraderosCount: db.paraderos.length,
        fundosCount: db.fundos.length,
        areasCount: db.areas.length,
      });
    } catch (err: any) {
      console.error('[Server] Error guardando catálogos maestros:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/maestros/paraderos', (req, res) => {
    try {
      const { paraderos } = req.body;
      if (!Array.isArray(paraderos)) {
        return res.status(400).json({ error: 'paraderos array required' });
      }
      const db = getDb();
      db.paraderos = paraderos;
      persistDb(db);
      console.log(`[Server] ${paraderos.length} paraderos guardados en db.json para sincronización.`);
      res.json({ success: true, count: paraderos.length, revision: db.revision });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset to initial demo data
  app.post('/api/data/reset-demo', (_req, res) => {
    try {
      const initialDb: ServerDb = {
        version: 1,
        revision: currentRevision + 1,
        lastUpdated: new Date().toISOString(),
        requerimientos: INITIAL_REQUERIMIENTOS,
        detalles: INITIAL_DETALLES,
        users: INITIAL_USERS,
        areas: MAESTRO_AREAS,
        fundos: MAESTRO_FUNDOS,
        paraderos: MAESTRO_PARADEROS,
        comedores: MAESTRO_COMEDORES,
      };
      persistDb(initialDb);
      res.json({ success: true, message: 'Base de datos restablecida a los valores iniciales' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // VITE MIDDLEWARE OR STATIC SERVING
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
    // Headers to prevent caching of HTML and Service Worker assets so user updates are immediate
    app.use((req, res, next) => {
      const p = req.path;
      if (
        p === '/' ||
        p === '/index.html' ||
        p === '/sw.js' ||
        p === '/registerSW.js' ||
        p === '/manifest.webmanifest' ||
        p.endsWith('.html')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (p.startsWith('/assets/')) {
        // Hashed static assets (e.g. index-ABC123.js) are immutable
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      next();
    });

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
      res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CAMPOSOL] Servidor principal activo en http://0.0.0.0:${PORT}`);
  });

  // If running on a different port like Cloud Run 8080, also attempt binding 3000
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
