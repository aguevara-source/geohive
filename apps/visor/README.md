# Visor GeoHive

Visor WebGIS: capas publicadas en PostGIS, carga de archivos GeoJSON, mapas base y
análisis espacial de intersección procesado en el servidor.

- Ruta pública: `/visor/` · API: `/api/visor/` · Rol de acceso: `visor`
- Base de datos propia: `visor` (PostGIS)

## Estructura

```
frontend/                     React + TypeScript + Vite
  src/
    main.tsx                  AuthProvider + RequireRole("visor") + React Query
    App.tsx                   Layout: encabezado común, panel lateral y mapa
    config.ts                 Id de la app, URL de la API, mapas base
    api/visor.ts              Cliente tipado del backend
    hooks.ts                  Estado de capas del mapa y de la herramienta de dibujo
    components/               Mapa y paneles (capas BD, intersección, archivos, ubicación)
backend/                      FastAPI
  app/
    main.py                   Aplicación + migraciones al iniciar
    core/config.py            Variables de entorno
    core/security.py          Validación del token de acceso (firma, audiencia, rol)
    db/session.py, migrate.py Conexión y migraciones SQL versionadas
    services/capas.py         Consultas y procesamiento PostGIS
    api/routes/               Endpoints
    schemas/                  Modelos de entrada/salida
  migrations/                 001_inicial.sql, 002_datos_demo.sql, ...
  tests/                      Pruebas (pytest)
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/capas` | Capas publicadas |
| GET | `/capas/{id}/geojson?bbox=minLng,minLat,maxLng,maxLat&limite=5000` | Elementos de la capa |
| POST | `/capas/{id}/interseccion` | `{"geometry": <GeoJSON>}` → elementos que intersectan y área (ha) |
| GET | `/me` · `/health` | Usuario actual · estado |

Documentación interactiva: `/api/visor/docs`.

## Lugares de interés (botones de categorías y «Más»)

Los lugares (restaurantes, bancos, farmacias…) salen de **OpenStreetMap**. Hay dos fuentes:

| Fuente | Velocidad | Cuándo se usa |
|--------|-----------|---------------|
| **Base local** (`geodata.lugares_osm`) | milisegundos, sin límites | cuando ya se importó (recomendado) |
| Overpass API (servicio público) | 15–60 s, a veces no responde | respaldo si la base local está vacía |

Importar o actualizar la base local (descarga el extracto del Perú de Geofabrik, ~260 MB):

```bash
docker compose exec visor-api python -m app.importar_osm
```

Se carga en una tabla nueva y se intercambia al final, así el visor sigue funcionando durante la importación.
Actualización semanal sugerida (cron en el servidor, lunes 4 a. m.):

```
0 4 * * 1  cd /opt/geohive && docker compose exec -T visor-api python -m app.importar_osm >> /var/log/geohive-osm.log 2>&1
```

Variable `LUGARES_FUENTE`: `auto` (por defecto), `local` u `overpass`.

## Overture Maps Places (complemento de OpenStreetMap)

Más negocios pequeños (peluquerías, gimnasios, consultorios…) que OpenStreetMap. Se guardan en
`geodata.lugares_overture`; los que ya existen en OpenStreetMap (mismo nombre a < 60 m) se marcan como duplicados.
Las consultas usan la vista `geodata.lugares` (OSM + Overture sin duplicados). Cada lugar indica su «Fuente».

1. Exportar el Perú desde el bucket público (requiere `pip install duckdb`; cambiar la versión por la última de
   https://stac.overturemaps.org):

```sql
INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';
COPY (
  SELECT id, names.primary AS nombre, taxonomy.primary AS categoria, taxonomy.alternates AS alternativas,
         confidence, ST_X(geometry) AS lon, ST_Y(geometry) AS lat, addresses[1].freeform AS direccion,
         phones[1] AS telefono, websites[1] AS web, brand.names.primary AS marca
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-10-21.0/theme=places/type=place/*', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN -81.4 AND -68.6 AND bbox.ymin BETWEEN -18.4 AND 0.1
    AND (addresses[1].country = 'PE' OR addresses[1].country IS NULL)
    AND operating_status IS DISTINCT FROM 'permanently_closed' AND confidence >= 0.5
) TO 'peru_places.parquet' (FORMAT parquet);
```

2. Importar: `docker compose exec visor-api python -m app.importar_overture --archivo /tmp/peru_places.parquet --version 2026-10-21.0`

Traducción de categorías Overture → subcategorías GeoHive: `app/services/overture.py`.

## Buscador de lugares del Perú

Ícono 📍 de la barra izquierda. Busca en todo el país departamentos, provincias, distritos, ciudades, centros
poblados, caseríos, urbanizaciones y sitios conocidos (restos arqueológicos, museos, nevados, lagos, aeropuertos…)
y lleva el mapa al lugar. Los departamentos, provincias y distritos se encuadran y se dibuja su límite.
Admite varias palabras («miraflores arequipa») y no distingue tildes.

Tablas `geodata.localidades` y `geodata.limites_admin`, desde el extracto de OpenStreetMap (~70 000 lugares, 1–2 min):

```bash
docker compose cp peru-latest.osm.pbf visor-api:/tmp/peru.osm.pbf
docker compose exec visor-api python -m app.importar_localidades --archivo /tmp/peru.osm.pbf
```

Tipos de lugares incluidos: `app/importar_localidades.py` (`NIVELES`, `LUGARES`, `SITIOS`).

**Polígonos de urbanizaciones y barrios.** Los lugares dibujados como área en OpenStreetMap (urbanizaciones,
asentamientos humanos, zonas residenciales con nombre, sitios arqueológicos, áreas naturales…) guardan su contorno
(`localidades.contorno`) y el buscador los encuadra y resalta igual que a un distrito. Si una urbanización es solo un
punto, toma el polígono con su mismo nombre que la contiene (similitud ≥ 0,6); el nombre del polígono queda como alias.
Cobertura: OpenStreetMap tiene polígono solo para una parte de las urbanizaciones; el resto se muestra como punto.

**Más resultados · Esri.** Desde 3 letras, el buscador también consulta en vivo el geocodificador mundial de Esri
(`/localidades/esri`, a través del backend): urbanizaciones que no están en OpenStreetMap, direcciones con número y
negocios. Solo da ubicación (punto y recuadro), no polígonos. Los resultados **no se guardan** en la base: las
condiciones de Esri no permiten almacenarlos sin una cuenta de pago (`forStorage`).

**Límites políticos por escala** (capa «Límites políticos» del control de mapas, activa por defecto): a escala
nacional se ven los departamentos; desde zoom 7 se suman las provincias y desde zoom 9 los distritos (pedidos por
cuadrantes de 1°). Líneas moradas tenues, claras sobre satélite. Salen de la vista `geodata.limites_lineas`
(bordes unidos y simplificados por nivel), que se actualiza al reimportar las localidades.

## Geomarketing: «¿Dónde pongo mi negocio?»

Ícono 🎯 de la barra izquierda. Sobre la zona consultada (máx. 40 km²) divide el área en hexágonos de ~200 m
y calcula, en el radio que un cliente camina hasta el negocio:

| Indicador | Cálculo |
|-----------|---------|
| Población cercana | habitantes alcanzables (población Kontur repartida por área) |
| Poca competencia | habitantes por cada negocio del mismo rubro (con pesos: un restaurante compite menos con un chifa que otro chifa) |
| Lugares que atraen clientes | «imanes» del rubro: colegios, paraderos, clínicas, universidades… |

Cada indicador se normaliza (rango percentil dentro de la zona) y se combina con los pesos que el usuario elige.
Se recomiendan los 3, 5 o 10 mejores lugares, separados al menos un radio entre sí, con una explicación en lenguaje
simple. Los hexágonos se pueden pintar por oportunidad, habitantes, población a pie, competencia, atractores o
distancia al competidor, y la tabla se exporta en CSV (para Excel).
Hay 27 rubros en 6 grupos (comida, comercio, salud, belleza y deporte, servicios, educación y hospedaje); sus radios,
competencia, imanes y estándares referenciales están en `app/services/geomarketing.py` (`RUBROS`).

El panel tiene tres modos:

| Modo | Qué responde | API |
|------|--------------|-----|
| Dónde abrir | los mejores hexágonos de la zona para un rubro | `GET /geomarketing/analisis` |
| Qué falta | qué rubros faltan o sobran en la zona comparada con su entorno (~5 km alrededor) | `GET /geomarketing/zona` |
| Evaluar local | ficha de un punto: habitantes y competidores a 5, 10 y 15 min a pie, imanes, veredicto; compara hasta 3 locales | `GET /geomarketing/punto` |

«Qué falta» calcula, para cada rubro, cuántos negocios tendría la zona según su entorno con la referencia más
exigente: la misma cantidad por habitante (barrios residenciales) o la misma proporción entre todos sus negocios
(zonas comerciales, donde todo sobra por habitante). Al comparar con el entorno, el subregistro de OpenStreetMap
(pocas bodegas registradas, por ejemplo) se cancela.

Población (Kontur Population, hexágonos H3 de ~400 m, CC BY 4.0,
https://data.humdata.org/dataset/kontur-population-peru):

```bash
docker compose cp kontur_population_PE_20231101.gpkg visor-api:/tmp/
docker compose exec visor-api python -m app.importar_poblacion --archivo /tmp/kontur_population_PE_20231101.gpkg
```

Limitación: OpenStreetMap no registra todos los negocios (sobre todo bodegas y peluquerías), por lo que la brecha
frente al estándar es referencial; la comparación entre lugares de la misma zona es lo más confiable.

## Publicar una capa

Carga la tabla en la BD `visor` (QGIS, `ogr2ogr` o SQL), con geometría en **EPSG:4326**, y regístrala:

```sql
INSERT INTO capas (nombre, descripcion, esquema, tabla, columna_geom)
VALUES ('Distritos de Lima', 'Límites distritales', 'geodata', 'distritos', 'geom');
```

Conexión desde QGIS/pgAdmin en el servidor: `localhost:${DB_PORT}`, BD `visor`, usuario `visor`
(desde fuera, mediante túnel SSH).

## Desarrollo

```bash
# frontend (con la plataforma levantada en Docker)
npm run dev:visor                       # http://localhost:5174/visor/

# pruebas del backend
docker build --build-arg DEV=true -t visor-api-test apps/visor/backend
docker run --rm visor-api-test python -m pytest -q
```

Para cambiar el esquema de la BD, agrega un archivo `migrations/003_descripcion.sql`; se aplica
automáticamente la próxima vez que inicie el backend.
