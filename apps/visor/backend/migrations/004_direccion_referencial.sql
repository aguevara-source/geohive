-- Dirección referencial: para lugares sin calle registrada, la calle con nombre más cercana.
ALTER TABLE geodata.lugares_osm ADD COLUMN direccion_ref text;

-- Calles con nombre de OpenStreetMap (se usan para calcular la dirección referencial)
CREATE TABLE geodata.vias_osm (
  osm_id  text PRIMARY KEY,
  nombre  text NOT NULL,
  clase   text,
  geom    geometry(LineString, 4326) NOT NULL
);
CREATE INDEX vias_osm_geom ON geodata.vias_osm USING gist (geom);
