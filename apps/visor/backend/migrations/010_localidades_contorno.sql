-- Contorno de los lugares dibujados como polígono en OpenStreetMap: urbanizaciones, asentamientos humanos,
-- zonas residenciales, barrios, sitios arqueológicos, áreas naturales, aeropuertos…
-- (los departamentos, provincias y distritos usan geodata.limites_admin)
ALTER TABLE geodata.localidades ADD COLUMN contorno geometry(MultiPolygon, 4326);
CREATE INDEX localidades_geom ON geodata.localidades USING gist (geom);
