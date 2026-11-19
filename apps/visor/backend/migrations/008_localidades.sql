-- Buscador nacional de lugares: departamentos, provincias, distritos, ciudades, pueblos, centros poblados,
-- urbanizaciones y sitios conocidos del Perú (OpenStreetMap).
-- Se importa con: python -m app.importar_localidades --archivo peru.osm.pbf
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Límites administrativos (nivel OSM: 4 departamento, 6 provincia, 8 distrito): dan el contexto «Chiclayo, Lambayeque»
CREATE TABLE geodata.limites_admin (
  id      serial PRIMARY KEY,
  osm_id  text NOT NULL,
  nombre  text NOT NULL,
  nivel   smallint NOT NULL,
  geom    geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX limites_admin_geom ON geodata.limites_admin USING gist (geom);

CREATE TABLE geodata.localidades (
  id           serial PRIMARY KEY,
  osm_id       text NOT NULL,
  nombre       text NOT NULL,
  nombre_norm  text NOT NULL,
  tipo         text NOT NULL,      -- departamento, provincia, distrito, ciudad, pueblo, …
  prioridad    smallint NOT NULL,  -- menor = más importante al ordenar resultados
  poblacion    integer,
  contexto     text,               -- distrito, provincia y departamento que lo contienen
  texto_norm   text NOT NULL,      -- nombre + contexto sin tildes (búsqueda «chiclayo lambayeque»)
  limite_id    integer REFERENCES geodata.limites_admin (id) ON DELETE SET NULL,
  geom         geometry(Point, 4326) NOT NULL
);
CREATE INDEX localidades_texto_trgm ON geodata.localidades USING gin (texto_norm gin_trgm_ops);
