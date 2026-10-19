// Repositorio en memoria: se usa en desarrollo y en los tests cuando no hay DATABASE_URL.
// Los datos se pierden al reiniciar (igual que el disco efímero de Render).

function createMemoryRepo() {
  let tareas = [];
  let nextId = 1;

  return {
    nombre: 'memoria',
    async listar() {
      return [...tareas];
    },
    async obtener(id) {
      return tareas.find((t) => t.id === id) || null;
    },
    async crear({ titulo }) {
      const tarea = { id: nextId++, titulo, completada: false, creada_en: new Date().toISOString() };
      tareas.push(tarea);
      return tarea;
    },
    async actualizar(id, cambios) {
      const tarea = tareas.find((t) => t.id === id);
      if (!tarea) return null;
      Object.assign(tarea, cambios);
      return tarea;
    },
    async borrar(id) {
      const antes = tareas.length;
      tareas = tareas.filter((t) => t.id !== id);
      return tareas.length < antes;
    },
    async ping() {
      return true;
    },
    async cerrar() {},
  };
}

module.exports = { createMemoryRepo };
