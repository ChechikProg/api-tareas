const pino = require('pino');
const config = require('./config');
const { createApp } = require('./app');
const { createMemoryRepo } = require('./repos/memoryRepo');
const { createPgRepo } = require('./repos/pgRepo');

// Logs en JSON por stdout: Render (y cualquier PaaS) los captura y los muestra en el panel.
// redact: segunda red de seguridad por si algún log incluye headers sensibles.
const logger = pino({
  level: config.logLevel,
  redact: ['req.headers["x-api-key"]', 'req.headers.authorization', 'req.headers.cookie'],
});

const repo = config.databaseUrl
  ? createPgRepo({ connectionString: config.databaseUrl, ssl: config.databaseSsl })
  : createMemoryRepo();

const app = createApp({ repo, logger, apiKey: config.apiKey, version: config.appVersion });

// Escuchar en 0.0.0.0 (todas las interfaces) y en el PORT que da la plataforma.
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port, env: config.env, storage: repo.nombre, version: config.appVersion }, 'API escuchando');
});

// Graceful shutdown: en cada deploy Render manda SIGTERM a la instancia vieja.
// Dejamos de aceptar conexiones nuevas, terminamos las que están en curso y cerramos la base.
function apagar(signal) {
  logger.info({ signal }, 'Apagando...');
  server.close(async () => {
    await repo.cerrar();
    logger.info('Apagado limpio');
    process.exit(0);
  });
  // Si algo se cuelga, forzamos la salida antes de que la plataforma mate el proceso.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
