// Migración mínima: crea la tabla si no existe. Se ejecuta antes de levantar el servidor
// (ver "start" en package.json). Es idempotente: correrla varias veces no rompe nada.

const { Client } = require('pg');
const config = require('./config');

const SQL = `
CREATE TABLE IF NOT EXISTS tareas (
  id         SERIAL PRIMARY KEY,
  titulo     VARCHAR(200) NOT NULL,
  completada BOOLEAN      NOT NULL DEFAULT false,
  creada_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);`;

async function main() {
  if (!config.databaseUrl) {
    console.log('[migrate] Sin DATABASE_URL: se usa almacenamiento en memoria, no hay nada que migrar.');
    return;
  }
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  await client.query(SQL);
  await client.end();
  console.log('[migrate] Tabla "tareas" lista.');
}

main().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1); // un exit code distinto de 0 hace fallar el deploy
});
