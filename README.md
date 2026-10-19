# api-tareas — Deploy de una API Node.js en Render

API REST de ejemplo (CRUD de tareas) hecha con **Express 5 + PostgreSQL**, preparada para producción y desplegada en **Render**. Es la demo técnica del TP *Tema 6 – Estrategias y plataformas para Deploy de Node.js*.

## Qué la hace "lista para producción"

| Requisito de producción | Cómo lo resuelve | Archivo |
|---|---|---|
| Puerto asignado por la plataforma | Lee `process.env.PORT` y escucha en `0.0.0.0` | `src/config.js`, `src/server.js` |
| Configuración fuera del código | Todo por variables de entorno; `.env` ignorado por git | `src/config.js`, `.env.example` |
| Fallar rápido si falta config | En `production` exige `DATABASE_URL` y `API_KEY` | `src/config.js` |
| Base de datos persistente | PostgreSQL gestionado; el disco de la app es efímero | `src/repos/pgRepo.js` |
| Esquema creado automáticamente | Migración idempotente antes de arrancar | `src/migrate.js` |
| Health check | `GET /health` verifica la conexión a la base | `src/app.js` |
| Zero-downtime deploy | Render no manda tráfico hasta que `/health` responde 200 | `render.yaml` |
| Apagado limpio | Maneja `SIGTERM`, cierra conexiones y el pool | `src/server.js` |
| Logs útiles y sin secretos | JSON con pino por stdout, headers sensibles excluidos | `src/app.js`, `src/server.js` |
| HTTPS | Lo termina Render (certificado automático); `trust proxy` activo | `src/app.js` |
| Headers de seguridad | `helmet`, sin `X-Powered-By` | `src/app.js` |
| Deploy solo si los tests pasan | GitHub Actions + `autoDeployTrigger: checksPass` | `.github/workflows/ci.yml`, `render.yaml` |
| Infraestructura como código | Blueprint que crea la API y la base juntas | `render.yaml` |
| Portabilidad | `Dockerfile` para Fly.io, Railway o un VPS | `Dockerfile` |

## Endpoints

| Método | Ruta | Requiere `x-api-key` | Descripción |
|---|---|---|---|
| GET | `/health` | no | Estado de la API y de la base |
| GET | `/api/tareas` | no | Lista todas las tareas |
| GET | `/api/tareas/:id` | no | Una tarea |
| POST | `/api/tareas` | sí | Crea `{ "titulo": "..." }` |
| PATCH | `/api/tareas/:id` | sí | Modifica `titulo` y/o `completada` |
| DELETE | `/api/tareas/:id` | sí | Borra |

## Correr en local

```bash
npm install
cp .env.example .env          # opcional
npm run dev                   # sin DATABASE_URL usa memoria
npm test                      # 10 tests con node:test + supertest
```

Con Postgres local:

```bash
DATABASE_URL=postgresql://usuario:pass@localhost:5432/tareas npm start
```

Con Docker:

```bash
docker build -t api-tareas .
docker run -p 3000:3000 -e API_KEY=demo api-tareas
```

## Deploy en Render (paso a paso)

**Opción A — Blueprint (recomendada, todo en un clic)**

1. Subir este proyecto a un repositorio de GitHub (público o privado).
2. Crear cuenta en <https://render.com> e iniciar sesión con GitHub.
3. Dashboard → **New** → **Blueprint** → elegir el repositorio.
4. Render lee `render.yaml` y muestra lo que va a crear: el web service `api-tareas` y la base `tareas-db`. Confirmar con **Apply**.
5. Esperar el primer deploy (2-4 minutos). En **Logs** se ve: `npm ci` → `[migrate] Tabla "tareas" lista.` → `API escuchando`.
6. Copiar la URL pública (`https://api-tareas-xxxx.onrender.com`) y probar `/health`.
7. Ver el valor de `API_KEY` en la pestaña **Environment** del servicio (lo generó Render).

**Opción B — Manual desde el panel**

1. **New → Postgres**: nombre `tareas-db`, plan Free, región Virginia. Copiar la *Internal Database URL*.
2. **New → Web Service**: conectar el repo. Runtime Node, Build `npm ci`, Start `npm start`, plan Free, misma región.
3. En **Environment** agregar: `NODE_ENV=production`, `DATABASE_URL=<internal URL>`, `API_KEY=<un secreto>`.
4. En **Settings → Health Check Path** poner `/health`.
5. **Create Web Service**.

## Probar el deploy

```bash
URL=https://api-tareas-xxxx.onrender.com
KEY=<API_KEY de Render>

curl $URL/health
curl -X POST $URL/api/tareas -H "content-type: application/json" -H "x-api-key: $KEY" -d '{"titulo":"Primera tarea en producción"}'
curl $URL/api/tareas
curl -X POST $URL/api/tareas -H "content-type: application/json" -d '{"titulo":"sin key"}'   # → 401
```

## Demostrar el deploy continuo en la exposición

1. Cambiar algo visible (por ejemplo el mensaje de `GET /`) y hacer `git push`.
2. Mostrar GitHub Actions corriendo los tests (en verde).
3. Mostrar a Render detectar el commit y desplegar; el `version` de `/health` pasa a ser el hash del commit nuevo.
4. **Rollback**: en Render → Events → elegir el deploy anterior → *Rollback*.
5. Mostrar un deploy que falla: romper un test, hacer push y ver que Render **no** publica esa versión.

## Limitaciones del plan Free (importante para la defensa)

- El servicio se duerme tras 15 minutos sin tráfico y tarda alrededor de un minuto en despertar. **Abrir `/health` unos minutos antes de exponer.**
- La base Free vence a los 30 días de creada (14 días de gracia y después se borra). Crear la base cerca de la fecha de la presentación.
- Sin backups, sin disco persistente ni escalado a más de una instancia.

Para un producto real: web service Starter y base paga (aprox. USD 13/mes en total a octubre de 2026).
