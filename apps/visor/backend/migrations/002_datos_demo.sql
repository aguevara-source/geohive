-- Capa de ejemplo. Eliminar este archivo antes del primer despliegue si no se desea.
CREATE TABLE geodata.puntos_interes (
  id      serial PRIMARY KEY,
  nombre  varchar(150) NOT NULL,
  tipo    varchar(50),
  geom    geometry(Point, 4326) NOT NULL
);
CREATE INDEX ON geodata.puntos_interes USING gist (geom);

INSERT INTO geodata.puntos_interes (nombre, tipo, geom) VALUES
  ('Plaza Mayor de Lima',  'Plaza',  ST_SetSRID(ST_MakePoint(-77.0300, -12.0453), 4326)),
  ('Parque Kennedy',       'Parque', ST_SetSRID(ST_MakePoint(-77.0302, -12.1211), 4326)),
  ('Huaca Pucllana',       'Museo',  ST_SetSRID(ST_MakePoint(-77.0337, -12.1106), 4326)),
  ('Parque de la Reserva', 'Parque', ST_SetSRID(ST_MakePoint(-77.0339, -12.0703), 4326)),
  ('Plaza San Martín',     'Plaza',  ST_SetSRID(ST_MakePoint(-77.0346, -12.0517), 4326));

INSERT INTO capas (nombre, descripcion, tabla) VALUES
  ('Puntos de interés (demo)', 'Capa de ejemplo en Lima', 'puntos_interes');
