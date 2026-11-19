-- Usos de suelo donde no vive gente (industrial, almacenes, vías férreas, cementerios, parques, agua…).
-- El geomarketing reparte la población solo sobre el área habitable (método dasimétrico).
-- Se importa con: python -m app.importar_osm --solo-usos-suelo --archivo peru.osm.pbf
CREATE TABLE geodata.usos_suelo (
  id      serial PRIMARY KEY,
  osm_id  text NOT NULL,
  tipo    text NOT NULL,
  geom    geometry(MultiPolygon, 3857) NOT NULL
);
CREATE INDEX usos_suelo_geom ON geodata.usos_suelo USING gist (geom);
