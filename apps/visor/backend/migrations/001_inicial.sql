-- Catálogo de capas publicadas en el visor.
-- Solo las tablas registradas aquí son consultables desde la API.
-- La columna geométrica debe estar en EPSG:4326.
CREATE SCHEMA IF NOT EXISTS geodata;

CREATE TABLE capas (
  id            serial PRIMARY KEY,
  nombre        varchar(120) NOT NULL,
  descripcion   text,
  esquema       varchar(63)  NOT NULL DEFAULT 'geodata',
  tabla         varchar(63)  NOT NULL,
  columna_geom  varchar(63)  NOT NULL DEFAULT 'geom',
  activo        boolean      NOT NULL DEFAULT true,
  UNIQUE (esquema, tabla)
);
