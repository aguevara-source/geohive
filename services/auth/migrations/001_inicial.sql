-- Usuarios y roles (el rol = id de la aplicación a la que tiene acceso)
CREATE TABLE usuarios (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  email          varchar(254) NOT NULL UNIQUE,   -- siempre en minúsculas
  nombre         varchar(120) NOT NULL,
  activo         boolean      NOT NULL DEFAULT true,
  creado_en      timestamptz  NOT NULL DEFAULT now(),
  ultimo_acceso  timestamptz
);

CREATE TABLE usuario_roles (
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol         varchar(50) NOT NULL,
  PRIMARY KEY (usuario_id, rol)
);

-- Códigos enviados por correo (se guarda solo su huella HMAC, nunca el código)
CREATE TABLE codigos (
  id           bigserial    PRIMARY KEY,
  usuario_id   uuid         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash  char(64)     NOT NULL,
  creado_en    timestamptz  NOT NULL DEFAULT now(),
  expira_en    timestamptz  NOT NULL,
  intentos     int          NOT NULL DEFAULT 0,
  usado        boolean      NOT NULL DEFAULT false,
  ip           varchar(45)
);
CREATE INDEX ON codigos (usuario_id, creado_en DESC);

-- Sesiones abiertas (la cookie guarda un token aleatorio; aquí solo su huella)
CREATE TABLE sesiones (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  char(64)     NOT NULL UNIQUE,
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  expira_en   timestamptz  NOT NULL,
  ultimo_uso  timestamptz  NOT NULL DEFAULT now(),
  revocada    boolean      NOT NULL DEFAULT false,
  ip          varchar(45),
  agente      varchar(300)
);

-- Llave RSA con la que se firman los tokens de acceso (se genera sola al iniciar)
CREATE TABLE llaves (
  kid          varchar(40) PRIMARY KEY,
  privada_pem  text        NOT NULL,
  activa       boolean     NOT NULL DEFAULT true,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auditoria (
  id          bigserial    PRIMARY KEY,
  usuario_id  uuid,
  email       varchar(254),
  evento      varchar(40)  NOT NULL,
  ip          varchar(45),
  creado_en   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ON auditoria (creado_en);
