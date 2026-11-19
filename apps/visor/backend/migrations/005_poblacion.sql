-- Población estimada en hexágonos H3 de ~400 m (Kontur Population, CC BY 4.0).
-- Se importa con: python -m app.importar_poblacion --archivo kontur_population_PE_*.gpkg
-- Geometría en EPSG:3857 (metros): los cálculos de geomarketing reparten la población por área.
CREATE TABLE geodata.poblacion_h3 (
  h3         text PRIMARY KEY,
  poblacion  real NOT NULL,
  geom       geometry(Polygon, 3857) NOT NULL
);
CREATE INDEX poblacion_h3_geom ON geodata.poblacion_h3 USING gist (geom);

CREATE TABLE geodata.poblacion_meta (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fuente        text NOT NULL,
  fecha_datos   date,
  importado_en  timestamptz NOT NULL DEFAULT now(),
  hexagonos     int NOT NULL,
  poblacion     bigint NOT NULL
);
