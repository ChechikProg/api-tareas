const { Pool } = require('pg');

// Repositorio PostgreSQL. Todas las consultas son parametrizadas ($1, $2...)
// para evitar inyección SQL.

function createPgRepo({ connectionString, ssl }) {
  const pool = new Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: 5, // las bases free/chicas aceptan pocas conexiones
  });

  return {
    nombre: 'postgres',
    pool,
    async listar() {
      const { rows } = await pool.query('SELECT * FROM tareas ORDER BY id');
      return rows;
    },
    async obtener(id) {
      const { rows } = await pool.query('SELECT * FROM tareas WHERE id = $1', [id]);
      return rows[0] || null;
    },
    async crear({ titulo }) {
      const { rows } = await pool.query(
        'INSERT INTO tareas (titulo) VALUES ($1) RETURNING *',
        [titulo]
      );
      return rows[0];
    },
    async actualizar(id, { titulo, completada }) {
      const { rows } = await pool.query(
        `UPDATE tareas
            SET titulo = COALESCE($2, titulo),
                completada = COALESCE($3, completada)
          WHERE id = $1
        RETURNING *`,
        [id, titulo ?? null, completada ?? null]
      );
      return rows[0] || null;
    },
    async borrar(id) {
      const { rowCount } = await pool.query('DELETE FROM tareas WHERE id = $1', [id]);
      return rowCount > 0;
    },
    async ping() {
      await pool.query('SELECT 1');
      return true;
    },
    async cerrar() {
      await pool.end();
    },
  };
}

module.exports = { createPgRepo };
