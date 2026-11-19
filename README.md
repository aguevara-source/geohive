# geohive
Plataforma de Advanced • Geoanalytics • Intelligence • Systems — **AG-Y GEOHIVE**

Monorepo con un **portal** público (solo presentación) y **aplicaciones independientes**
(visores, geocodificadores…), cada una con su propio frontend, backend y base de datos.
El acceso se protege con un **código enviado por correo** (4 dígitos y 2 letras), válido
para todas las aplicaciones a las que el usuario tiene permiso.

Diagramas: [docs/arquitectura.html](docs/arquitectura.html)

## Arquitectura

```
                         ┌──────────────── Gateway Nginx (un solo dominio, HTTPS) ────────────────┐
Navegador ──────────────►│  /  ·  /login/        → portal               (React, estático)          │
                         │  /auth/               → auth-api             (FastAPI) ──► BD "auth" ──► SMTP
                         │  /visor/              → visor-web            (React)                     │
                         │  /api/visor/          → visor-api            (FastAPI) ──► BD "visor" (PostGIS)
                         │  /geocodificador/     → geocodificador-web   (React)                     │
                         │  /api/geocodificador/ → geocodificador-api   (FastAPI) ──► BD "geocodificador"
                         └────────────────────────────────────────────────────────────────────────┘
```

**Flujo de acceso**
1. El usuario entra al portal (público) y elige una aplicación → `/visor/`.
2. La app no encuentra sesión y lo envía a `/login/`.
3. Escribe su correo; recibe un código como `4827KM` (vence en 10 minutos).
4. Escribe el código; se abre la sesión y vuelve a la app.
5. La app pide a `/auth/token` un token de 5 minutos **válido solo para ella** (requiere el rol).
6. El backend de la app valida firma, vencimiento, emisor, audiencia y rol en cada petición.
7. Al abrir otra app no vuelve a pedir el código mientras la sesión siga abierta (8 h).

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript + Vite · Tailwind CSS v4 · lucide-react |
| Mapas | Leaflet + react-leaflet |
| Datos en pantalla | TanStack Query |
| Autenticación | Servicio propio `services/auth` (FastAPI) · código por correo · JWT RS256 |
| Backend | FastAPI (Python 3.12) + SQLAlchemy |
| Base de datos | PostgreSQL + PostGIS (una base, **un esquema por servicio**) |
| Infraestructura | Nginx (gateway) + Docker Compose |

## Estructura

```
geohive/
├── portal/                  # Página pública + pantalla /login/ (React)
├── services/
│   └── auth/                # Código por correo, sesiones, tokens, usuarios y roles
├── apps/
│   ├── visor/               # frontend/ (React) + backend/ (FastAPI) + README
│   └── geocodificador/      # misma estructura + worker de procesamiento masivo
├── packages/
│   ├── auth/                # @geohive/auth: AuthProvider, useAuth, useApi, RequireRole
│   └── ui/                  # @geohive/ui: tema, logo, catálogo de apps, AppHeader
├── infra/
│   ├── gateway/             # Nginx: rutas, cabeceras de seguridad, CSP, límites
├── docs/arquitectura.html
├── docker-compose.yml
└── .env.example
```

## Seguridad
- Sin contraseñas: código de un solo uso, vence en 10 min, máx. 5 intentos y 5 códigos por hora.
- Solo se guarda la huella HMAC de códigos y sesiones; la cookie de sesión es `httpOnly` y solo viaja a `/auth`.
- La respuesta al pedir un código es igual exista o no el correo (no revela usuarios registrados).
- Tokens por app (audiencia): el token del geocodificador **no sirve** en el visor.
- Roles validados en frontend **y** backend; la autenticación se exige antes de tocar la base de datos.
- Cada servicio guarda sus tablas en su propio esquema de la base (`auth`, `visor`, `geocodificador`, `geodata`).
- Gateway con CSP, `X-Frame-Options`, `nosniff` y límite de peticiones. Auditoría de accesos.

Detalles: [services/auth/README.md](services/auth/README.md).

## Base de datos

Todo se guarda en **una base PostgreSQL con PostGIS** (configurada en `.env` con `PG_HOST`, `PG_PORT`,
`PG_USER`, `PG_PASSWORD`, `PG_DATABASE`). Cada servicio crea y actualiza sus tablas al arrancar:

| Esquema | Servicio | Tablas |
|---------|----------|--------|
| `auth` | auth-api | usuarios, usuario_roles, codigos, sesiones, llaves, auditoria |
| `visor` | visor-api | capas (catálogo de capas publicadas) |
| `geodata` | visor-api | puntos_interes, lugares_osm (OpenStreetMap del Perú), lugares_osm_meta |
| `geocodificador` | geocodificador-api | geocache, lotes, lote_filas |

Si la base corre en el mismo equipo que Docker, usa `PG_HOST=host.docker.internal`.

## Puesta en marcha

```bash
cp .env.example .env              # cambiar TODAS las claves
docker compose up -d --build

# registrar usuarios y sus apps
docker compose exec auth-api python -m app.cli crear ana@empresa.com "Ana Torres" --roles visor,geocodificador,geohive-admin
docker compose exec auth-api python -m app.cli crear jperez@empresa.com "Juan Pérez" --roles geocodificador
```

| URL | |
|-----|---|
| http://localhost:8088 | Portal |
| http://localhost:8088/login/ | Inicio de sesión |
| http://localhost:8088/visor/ · /geocodificador/ | Aplicaciones (piden código) |
| http://localhost:8025 | Buzón de pruebas (Mailpit): aquí llegan los códigos en local |
| http://localhost:8088/api/visor/docs · /auth/docs | Documentación de las APIs |

## Desarrollo de una app (recarga en caliente)

Con la plataforma levantada en Docker:

```bash
npm install
npm run dev:visor            # http://localhost:5174/visor/
npm run dev:geocodificador   # http://localhost:5175/geocodificador/
npm run dev:portal           # http://localhost:5173/
```

## Agregar una nueva aplicación (ej. `catastro`)

1. Copia `apps/visor/` a `apps/catastro/` y reemplaza `visor` por `catastro` en
   `frontend/package.json`, `frontend/vite.config.ts` (base y puerto), `frontend/src/config.ts`,
   `frontend/Dockerfile`, `frontend/nginx.conf` y `backend/app/core/config.py`.
2. **Base de datos**: agrega `crear_bd catastro catastro "$CATASTRO_DB_PASSWORD"` en
   `infra/postgres/init.sh` (o créala a mano si la BD ya existe).
3. **Servicios**: agrega `catastro-web` y `catastro-api` en `docker-compose.yml` y sus dos `location`
   en `infra/gateway/nginx.conf`.
4. **Catálogo**: cambia su `estado` a `"disponible"` en `packages/ui/src/catalog.ts`.
5. **Permisos**: asigna el rol `catastro` a los usuarios (`app.cli crear ... --roles ...,catastro`).

No hay que registrar nada en el servicio de autenticación: el rol es el id de la app.

## Despliegue

**Hosting compartido (cPanel):** el portal sí puede subirse como archivos estáticos (`portal/dist`),
pero las APIs en Python, PostgreSQL/PostGIS y los procesos en segundo plano **no** funcionan en un
hosting compartido. Lo que sí puedes aprovechar del hosting es su **correo SMTP** para enviar los códigos.

**Recomendado: un VPS pequeño con Docker** (2 GB de RAM bastan; DigitalOcean, Hetzner, Contabo,
AWS Lightsail):

1. Clonar el repositorio y crear `.env` con claves fuertes, `PUBLIC_URL=https://tu-dominio.com`,
   `COOKIE_SECURE=true` y los datos SMTP reales.
2. HTTPS: Cloudflare delante (modo *Full*) o certbot en el servidor.
3. `docker compose up -d --build` y registrar los usuarios. Quitar el servicio `mailpit`.
4. Respaldos diarios: `docker compose exec -T db pg_dumpall -U postgres | gzip > respaldo_$(date +%F).sql.gz`

## Próximos pasos recomendados
- Pantalla de administración de usuarios en el frontend (la API `/auth/admin/usuarios` ya existe).
- CI (GitHub Actions) que ejecute `npm run build` y `pytest` de cada servicio en cada push.
- Teselas vectoriales (Martin / pg_tileserv) o GeoServer para capas muy grandes en el visor.
