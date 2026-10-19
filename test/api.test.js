// Tests con el runner nativo de Node (node:test) + supertest.
// Usan el repositorio en memoria, así corren en CI sin base de datos.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createMemoryRepo } = require('../src/repos/memoryRepo');

const API_KEY = 'clave-de-test';
let app;

beforeEach(() => {
  app = createApp({ repo: createMemoryRepo(), apiKey: API_KEY });
});

describe('health check', () => {
  test('GET /health responde 200 con status ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('GET /health responde 503 si la base no está disponible', async () => {
    const repoRoto = { ...createMemoryRepo(), ping: async () => { throw new Error('sin conexión'); } };
    const res = await request(createApp({ repo: repoRoto })).get('/health');
    assert.equal(res.status, 503);
  });
});

describe('tareas', () => {
  test('crear y listar', async () => {
    const creada = await request(app)
      .post('/api/tareas')
      .set('x-api-key', API_KEY)
      .send({ titulo: 'Hacer el deploy' });
    assert.equal(creada.status, 201);
    assert.equal(creada.body.titulo, 'Hacer el deploy');

    const lista = await request(app).get('/api/tareas');
    assert.equal(lista.status, 200);
    assert.equal(lista.body.length, 1);
  });

  test('POST sin API key devuelve 401', async () => {
    const res = await request(app).post('/api/tareas').send({ titulo: 'x' });
    assert.equal(res.status, 401);
  });

  test('POST con título vacío devuelve 400', async () => {
    const res = await request(app).post('/api/tareas').set('x-api-key', API_KEY).send({ titulo: '  ' });
    assert.equal(res.status, 400);
  });

  test('PATCH marca como completada', async () => {
    const { body } = await request(app).post('/api/tareas').set('x-api-key', API_KEY).send({ titulo: 'a' });
    const res = await request(app)
      .patch(`/api/tareas/${body.id}`)
      .set('x-api-key', API_KEY)
      .send({ completada: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.completada, true);
  });

  test('DELETE y luego GET devuelve 404', async () => {
    const { body } = await request(app).post('/api/tareas').set('x-api-key', API_KEY).send({ titulo: 'a' });
    const del = await request(app).delete(`/api/tareas/${body.id}`).set('x-api-key', API_KEY);
    assert.equal(del.status, 204);
    const get = await request(app).get(`/api/tareas/${body.id}`);
    assert.equal(get.status, 404);
  });

  test('id inválido devuelve 400', async () => {
    const res = await request(app).get('/api/tareas/abc');
    assert.equal(res.status, 400);
  });
});

test('ruta inexistente devuelve 404 en JSON', async () => {
  const res = await request(app).get('/no-existe');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('no expone el header X-Powered-By', async () => {
  const res = await request(app).get('/');
  assert.equal(res.headers['x-powered-by'], undefined);
});
