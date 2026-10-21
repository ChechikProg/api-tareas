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
  console.log('[migrate] Tabla "tareas" lista.');

  // Datos de ejemplo: solo si la tabla está vacía, para que la API no arranque sin nada que mostrar.
  const { rows } = await client.query('SELECT COUNT(*)::int AS total FROM tareas');
  if (rows[0].total === 0) {
    await client.query(
      `INSERT INTO tareas (titulo, completada) VALUES
        ('Investigar plataformas de deploy', true),
        ('Preparar la API para producción', true),
        ('Hacer el deploy en Render', true),
        ('Armar la colección de Postman', true),
        ('Ensayar la exposición', false),
        ('Presentar el tema 6', false)`
    );
    console.log('[migrate] Base vacía: se cargaron 6 tareas de ejemplo.');
  }

  await client.end();
}

main().catch((err) => {
  console.error('[migrate] Error:', err.message);
  process.exit(1); // un exit code distinto de 0 hace fallar el deploy
});
