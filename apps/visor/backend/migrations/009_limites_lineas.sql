-- Líneas de los límites políticos para pintarlos por escala (departamentos, provincias, distritos).
-- Cada borde compartido se une en una sola línea (no se dibuja dos veces) y se simplifica según el nivel.
-- Se actualiza al final de: python -m app.importar_localidades
CREATE MATERIALIZED VIEW geodata.limites_lineas AS
SELECT row_number() OVER () AS id, nivel, geom
FROM (
  SELECT nivel, (ST_Dump(ST_SimplifyPreserveTopology(ST_LineMerge(ST_Union(ST_Boundary(geom))),
           CASE nivel WHEN 4 THEN 0.003 WHEN 6 THEN 0.0015 ELSE 0.0004 END))).geom AS geom
  FROM geodata.limites_admin
  GROUP BY nivel
) x;
CREATE INDEX limites_lineas_geom ON geodata.limites_lineas USING gist (geom);
CREATE INDEX limites_lineas_nivel ON geodata.limites_lineas (nivel);
