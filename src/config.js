// Toda la configuración sale de variables de entorno (12-Factor App, factor III).
// El mismo código corre en local, en CI y en Render: lo único que cambia es el entorno.

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const config = {
  env: NODE_ENV,
  isProduction,
  // Render (y casi todas las PaaS) asignan el puerto con la variable PORT.
  // Si la API escucha en un puerto fijo, el deploy falla porque la plataforma no la encuentra.
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || null,
  // La URL "interna" de Render no necesita SSL; la "externa" sí.
  databaseSsl: process.env.DATABASE_SSL === 'true',
  apiKey: process.env.API_KEY || null,
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  appVersion: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.npm_package_version || 'local',
};

// Fallar rápido: si falta algo crítico en producción, mejor que el deploy falle
// (y Render mantenga la versión anterior) a que la API arranque a medias.
if (isProduction) {
  const faltantes = [];
  if (!config.databaseUrl) faltantes.push('DATABASE_URL');
  if (!config.apiKey) faltantes.push('API_KEY');
  if (faltantes.length) {
    throw new Error(`Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
  }
}

module.exports = config;
