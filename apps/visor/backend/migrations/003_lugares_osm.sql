-- Lugares de interés de OpenStreetMap importados localmente (python -m app.importar_osm).
-- Evita depender del servicio público Overpass, que es lento y limita las consultas.
CREATE TABLE geodata.lugares_osm (
  osm_id         text PRIMARY KEY,           -- node/123, way/456
  nombre         text,
  nombre_norm    text,                       -- minúsculas y sin tildes, para buscar por nombre
  subcategoria   text NOT NULL,              -- la más específica (define el ícono)
  subcategorias  text[] NOT NULL,            -- todas las que aplican (un chifa también es restaurante)
  tags           jsonb NOT NULL,
  geom           geometry(Point, 4326) NOT NULL
);
CREATE INDEX lugares_osm_geom ON geodata.lugares_osm USING gist (geom);
CREATE INDEX lugares_osm_subcategorias ON geodata.lugares_osm USING gin (subcategorias);

-- Datos de la última importación
CREATE TABLE geodata.lugares_osm_meta (
  id             int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fuente         text NOT NULL,
  fecha_datos    timestamptz,                -- fecha del extracto de OpenStreetMap
  importado_en   timestamptz NOT NULL DEFAULT now(),
  total          int NOT NULL,
  segundos       numeric
);
