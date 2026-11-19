-- Desde dónde ingresa cada persona: una fila por inicio de sesión.
-- La IP y el navegador se guardan siempre; las coordenadas solo si la persona acepta compartir
-- su ubicación en el navegador (el aviso aparece al abrir la primera app después del login).
CREATE TABLE ingresos (
  id            bigserial    PRIMARY KEY,
  usuario_id    uuid         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sesion_id     uuid         UNIQUE REFERENCES sesiones(id) ON DELETE SET NULL,
  creado_en     timestamptz  NOT NULL DEFAULT now(),
  ip            varchar(45),
  red           varchar(10),           -- local | privada | publica
  navegador     varchar(40),
  sistema       varchar(40),
  dispositivo   varchar(20),           -- computadora | celular | tablet
  agente        varchar(300),
  -- Ubicación del navegador (WGS84)
  permiso       varchar(15),           -- concedido | denegado | no_disponible; NULL = aún no respondió
  latitud       double precision CHECK (latitud BETWEEN -90 AND 90),
  longitud      double precision CHECK (longitud BETWEEN -180 AND 180),
  precision_m   real,
  ubicado_en    timestamptz
);
CREATE INDEX ON ingresos (usuario_id, creado_en DESC);
CREATE INDEX ON ingresos (creado_en);

-- Qué módulos usan: una fila cada vez que alguien abre una app o un módulo dentro de ella.
-- «segundos»: tiempo con la pestaña visible; se guarda al cambiar de módulo, ocultar o cerrar la pestaña.
CREATE TABLE uso_modulos (
  id          bigserial    PRIMARY KEY,
  usuario_id  uuid         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sesion_id   uuid         REFERENCES sesiones(id) ON DELETE SET NULL,
  app         varchar(50)  NOT NULL,   -- visor | geocodificador | ...
  modulo      varchar(60)  NOT NULL,   -- inicio | capas | geomarketing | lotes | ...
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  segundos    int          CHECK (segundos >= 0)
);
CREATE INDEX ON uso_modulos (creado_en);
CREATE INDEX ON uso_modulos (app, modulo);

-- Ranking de módulos (todo el historial; para un periodo usar GET /auth/admin/uso?dias=N)
CREATE VIEW uso_modulos_resumen AS
SELECT app, modulo,
       count(*)                                    AS veces,
       count(DISTINCT usuario_id)                  AS usuarios,
       round(sum(segundos) / 60.0, 1)              AS minutos,
       round(avg(segundos) / 60.0, 1)              AS minutos_promedio,
       max(creado_en)                              AS ultimo_uso
FROM uso_modulos
GROUP BY app, modulo
ORDER BY veces DESC;

-- Con PostGIS, una vista con geometría para ver los ingresos en QGIS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    EXECUTE $v$
      CREATE VIEW ingresos_mapa AS
      SELECT i.id, u.email, u.nombre, i.creado_en, i.ip, i.navegador, i.sistema, i.dispositivo, i.precision_m,
             ST_SetSRID(ST_MakePoint(i.longitud, i.latitud), 4326)::geometry(Point, 4326) AS geom
      FROM ingresos i JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.latitud IS NOT NULL
    $v$;
  END IF;
END $$;
