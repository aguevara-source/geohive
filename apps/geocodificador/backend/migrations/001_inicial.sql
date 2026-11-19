-- Caché de respuestas de Nominatim (evita repetir consultas)
CREATE TABLE geocache (
  tipo        varchar(10)  NOT NULL,          -- 'directa' | 'inversa'
  consulta    text         NOT NULL,
  pais        varchar(10)  NOT NULL DEFAULT '',
  resultado   jsonb        NOT NULL,
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, consulta, pais)
);

-- Procesos de geocodificación masiva
CREATE TABLE lotes (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      varchar(64)  NOT NULL,      -- "sub" del token de acceso (id del usuario)
  usuario         varchar(100) NOT NULL,
  nombre_archivo  varchar(255) NOT NULL,
  pais            varchar(10)  NOT NULL DEFAULT '',
  columnas        jsonb        NOT NULL,      -- columnas originales del CSV, en orden
  total           int          NOT NULL,
  procesados      int          NOT NULL DEFAULT 0,
  encontrados     int          NOT NULL DEFAULT 0,
  estado          varchar(20)  NOT NULL DEFAULT 'pendiente',  -- pendiente | procesando | completado
  creado_en       timestamptz  NOT NULL DEFAULT now(),
  terminado_en    timestamptz
);
CREATE INDEX ON lotes (usuario_id, creado_en DESC);

CREATE TABLE lote_filas (
  lote_id               uuid         NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  n                     int          NOT NULL,
  datos                 jsonb        NOT NULL,  -- fila original
  direccion             text         NOT NULL,
  estado                varchar(20)  NOT NULL DEFAULT 'pendiente',  -- pendiente | ok | sin_resultado | error
  lat                   double precision,
  lng                   double precision,
  direccion_encontrada  text,
  PRIMARY KEY (lote_id, n)
);
CREATE INDEX ON lote_filas (estado) WHERE estado = 'pendiente';
