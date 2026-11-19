# Geocodificador GeoHive

Geocodificación directa (dirección → coordenadas), inversa (coordenadas → dirección) y
**masiva** desde archivos CSV, procesada en el servidor en segundo plano.

- Ruta pública: `/geocodificador/` · API: `/api/geocodificador/` · Rol de acceso: `geocodificador`
- Base de datos propia: `geocodificador`

## Cómo funciona

- Las consultas se hacen a **Nominatim (OpenStreetMap)** desde el backend, con **caché en PostgreSQL**
  (tabla `geocache`) y un límite de 1 petición por segundo, como exige su política de uso.
- Un CSV subido se guarda en `lotes` / `lote_filas`; un **worker** dentro del backend lo procesa fila
  por fila. El usuario puede cerrar la página y volver luego; cada usuario solo ve sus propios lotes.
- El backend corre con **1 worker de uvicorn** para respetar el límite de peticiones. Para más volumen:
  servidor Nominatim propio (`NOMINATIM_URL`) y una cola de tareas (Redis + RQ/Celery).

## Estructura

```
frontend/src/
  main.tsx, App.tsx           Pestañas: Dirección, Coordenadas, Lote CSV
  api/geocodificador.ts       Cliente tipado + avance de lotes cada 3 s
  components/                 Mapa, ListaResultados, TabLotes
backend/app/
  core/                       Configuración y validación del token de acceso
  db/                         Conexión y migraciones
  services/nominatim.py       Cliente Nominatim con caché y límite de peticiones
  services/lotes.py           Lectura de CSV, exportación y worker en segundo plano
  api/routes/                 geocodificacion.py, lotes.py, sistema.py
backend/migrations/           001_inicial.sql
backend/tests/                Pruebas de seguridad y de lectura de CSV
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/buscar?q=...&pais=pe` | Dirección → coordenadas (hasta 5 resultados) |
| GET | `/inversa?lat=...&lng=...` | Coordenadas → dirección |
| POST | `/lotes` | Subir CSV (`archivo`, `pais`). Columna obligatoria: `direccion`. Máx. 5000 filas / 10 MB |
| GET | `/lotes` · `/lotes/{id}` | Mis lotes · avance |
| GET | `/lotes/{id}/csv` · `/lotes/{id}/geojson` | Resultados |

Documentación interactiva: `/api/geocodificador/docs`.

## Desarrollo

```bash
npm run dev:geocodificador              # http://localhost:5175/geocodificador/

docker build --build-arg DEV=true -t geocod-api-test apps/geocodificador/backend
docker run --rm -e WORKER_ACTIVO=false geocod-api-test python -m pytest -q
```
