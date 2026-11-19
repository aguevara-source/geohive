CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;  -- levenshtein(): comparar nombres al detectar duplicados

-- Lugares de Overture Maps Places (complementan a OpenStreetMap; licencias abiertas por fuente).
-- Se importa con: python -m app.importar_overture --archivo peru_places.parquet
-- «duplicado»: el lugar ya existe en OpenStreetMap (mismo nombre y a menos de ~60 m): no se muestra.
CREATE TABLE geodata.lugares_overture (
  osm_id         text PRIMARY KEY,           -- overture/<id>
  nombre         text,
  nombre_norm    text,
  subcategoria   text NOT NULL,
  subcategorias  text[] NOT NULL,
  tags           jsonb NOT NULL,
  geom           geometry(Point, 4326) NOT NULL,
  direccion_ref  text,
  duplicado      boolean NOT NULL DEFAULT false
);
CREATE INDEX lugares_overture_geom ON geodata.lugares_overture USING gist (geom);
CREATE INDEX lugares_overture_subcategorias ON geodata.lugares_overture USING gin (subcategorias);

CREATE TABLE geodata.lugares_overture_meta (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version       text NOT NULL,
  importado_en  timestamptz NOT NULL DEFAULT now(),
  total         int NOT NULL,
  duplicados    int NOT NULL
);

-- Vista única que usan las consultas: OpenStreetMap + Overture (sin duplicados)
CREATE VIEW geodata.lugares AS
  SELECT osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom, direccion_ref, 'osm' AS fuente
  FROM geodata.lugares_osm
  UNION ALL
  SELECT osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom, direccion_ref, 'overture' AS fuente
  FROM geodata.lugares_overture WHERE NOT duplicado;
