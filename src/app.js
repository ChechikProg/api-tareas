const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

// La app se construye en una función (sin escuchar en ningún puerto) para poder
// testearla con supertest y elegir el repositorio desde afuera.

function createApp({ repo, logger, apiKey = null, version = 'local' }) {
  const app = express();

  // Render pone un proxy/balanceador delante de la app que termina HTTPS.
  // Con esto Express confía en X-Forwarded-For / X-Forwarded-Proto (IP real, req.secure).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  if (logger) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/health' },
        // Logs compactos y SIN secretos: nunca registrar headers como x-api-key o Authorization.
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      })
    );
  }

  // ---------- Health check ----------
  // Render lo consulta durante cada deploy: si no responde 2xx, no manda tráfico
  // a la versión nueva y mantiene la anterior (zero-downtime deploy).
  app.get('/health', async (req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok', storage: repo.nombre, version, uptime: Math.round(process.uptime()) });
    } catch (err) {
      req.log?.error({ err }, 'health check falló');
      res.status(503).json({ status: 'error', detalle: 'base de datos no disponible' });
    }
  });

  app.get('/', (req, res) => {
    res.json({ api: 'api-tareas', docs: 'Ver README.md', endpoints: ['/health', '/api/tareas'] });
  });

  // ---------- Protección simple de escrituras ----------
  // (La autenticación real es el tema del grupo 8; acá alcanza con mostrar
  // que el secreto vive en una variable de entorno y no en el código.)
  function requireApiKey(req, res, next) {
    if (!apiKey) return next();
    if (req.get('x-api-key') === apiKey) return next();
    return res.status(401).json({ error: 'API key inválida o ausente (header x-api-key)' });
  }

  function parseId(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: 'id inválido' });
      return null;
    }
    return id;
  }

  // ---------- CRUD de tareas ----------
  app.get('/api/tareas', async (req, res) => {
    res.json(await repo.listar());
  });

  app.get('/api/tareas/:id', async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const tarea = await repo.obtener(id);
    if (!tarea) return res.status(404).json({ error: 'tarea no encontrada' });
    res.json(tarea);
  });

  app.post('/api/tareas', requireApiKey, async (req, res) => {
    const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
    if (!titulo || titulo.length > 200) {
      return res.status(400).json({ error: 'titulo es obligatorio (1 a 200 caracteres)' });
    }
    res.status(201).json(await repo.crear({ titulo }));
  });

  app.patch('/api/tareas/:id', requireApiKey, async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const cambios = {};
    if (req.body?.titulo !== undefined) {
      if (typeof req.body.titulo !== 'string' || !req.body.titulo.trim()) {
        return res.status(400).json({ error: 'titulo inválido' });
      }
      cambios.titulo = req.body.titulo.trim();
    }
    if (req.body?.completada !== undefined) {
      if (typeof req.body.completada !== 'boolean') {
        return res.status(400).json({ error: 'completada debe ser true o false' });
      }
      cambios.completada = req.body.completada;
    }
    const tarea = await repo.actualizar(id, cambios);
    if (!tarea) return res.status(404).json({ error: 'tarea no encontrada' });
    res.json(tarea);
  });

  app.delete('/api/tareas/:id', requireApiKey, async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    const ok = await repo.borrar(id);
    if (!ok) return res.status(404).json({ error: 'tarea no encontrada' });
    res.status(204).end();
  });

  // ---------- 404 y manejo de errores ----------
  app.use((req, res) => res.status(404).json({ error: 'ruta no encontrada' }));

  // Express 5 pasa automáticamente acá los errores de handlers async.
  // En producción nunca devolvemos el stack trace al cliente: queda solo en los logs.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    req.log?.error({ err }, 'error no controlado');
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: status === 500 ? 'error interno' : err.message });
  });

  return app;
}

module.exports = { createApp };
