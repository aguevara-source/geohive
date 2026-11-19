# Servicio de autenticación GeoHive

Inicio de sesión **sin contraseña**: el usuario escribe su correo, recibe un código de
**4 dígitos y 2 letras** (ej. `4827KM`) y con él ingresa. Emite tokens firmados para que cada
aplicación los valide.

- Ruta pública: `/auth/` · Página de login: `/login/` (en el portal) · BD propia: `auth`

## Flujo

1. `POST /auth/codigo {email}`: si el correo está registrado y activo, genera el código, guarda
   **solo su huella** (HMAC-SHA256) y lo envía por SMTP. La respuesta es la misma exista o no el correo.
2. `POST /auth/verificar {email, codigo}`: valida el código y abre una sesión con una cookie
   `httpOnly` que solo viaja a `/auth`.
3. `POST /auth/token {app}`: con la sesión, entrega un token RS256 de 5 minutos, válido **solo** para esa
   app (`aud`), si el usuario tiene ese rol.
4. Los backends de las apps verifican el token con las llaves públicas de `GET /auth/jwks.json`.

## Reglas de seguridad

| Regla | Valor (configurable por variable de entorno) |
|-------|------|
| Vigencia del código | 10 min (`CODIGO_MINUTOS`) |
| Intentos por código | 5; luego queda bloqueado (`CODIGO_INTENTOS`) |
| Códigos por correo | 5 por hora (`CODIGOS_POR_HORA`) |
| Un código nuevo | invalida los anteriores; cada código se usa una sola vez |
| Sesión | 8 h (`SESION_HORAS`); se revoca al salir o al desactivar el usuario |
| Token de acceso | 5 min (`TOKEN_MINUTOS`), firmado con RSA 2048 |
| Gateway | máx. 10 solicitudes/verificaciones por minuto por IP |

Todos los eventos (código enviado, código incorrecto, login, límites) quedan en la tabla `auditoria`.

## Usuarios

Solo pueden ingresar correos registrados. Roles = ids de las apps (`visor`, `geocodificador`) y
`geohive-admin` para administrar.

```bash
docker compose exec auth-api python -m app.cli crear ana@empresa.com "Ana Torres" --roles visor,geocodificador,geohive-admin
docker compose exec auth-api python -m app.cli listar
docker compose exec auth-api python -m app.cli desactivar ana@empresa.com
```

Un usuario con rol `geohive-admin` puede usar también la API `/auth/admin/usuarios` (GET, POST, PUT).

## Actividad: desde dónde ingresan y qué módulos usan

| Tabla | Qué guarda | Cuándo se llena |
|-------|------------|-----------------|
| `ingresos` | un registro por inicio de sesión: IP, tipo de red (local / privada / pública), navegador, sistema, dispositivo y, si la persona acepta, latitud, longitud y precisión (m) | al verificar el código; la ubicación, al abrir la primera app (el navegador pide permiso una vez por sesión) |
| `uso_modulos` | app, módulo y segundos de uso (solo con la pestaña visible) | cada vez que se abre una app o se cambia de módulo (`useModulo` de `@geohive/auth`) |

Vistas: `uso_modulos_resumen` (ranking histórico) e `ingresos_mapa` (puntos con geometría, para QGIS; se crea
si la BD tiene PostGIS). Si la persona no da permiso, `permiso` queda en `denegado` o `no_disponible` y no hay
coordenadas. La ubicación es un dato personal (Ley 29733): conviene informarlo en la política de privacidad.

```sql
SELECT * FROM auth.uso_modulos_resumen;                       -- módulos más usados
SELECT email, creado_en, ip, dispositivo, latitud, longitud   -- últimos ingresos
FROM auth.ingresos JOIN auth.usuarios u ON u.id = usuario_id ORDER BY creado_en DESC LIMIT 50;
```

API para administradores: `GET /auth/admin/uso?dias=30` y `GET /auth/admin/ingresos?dias=30&limite=200`.
Módulos registrados: visor → `mapa` (panel cerrado), `capas`, `analisis`, `ubicacion`, `buscar`, `geomarketing`;
geocodificador → `directa`, `inversa`, `lote`.

## Correo (SMTP)

Se configura en `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SEGURIDAD`, `SMTP_USUARIO`, `SMTP_PASSWORD`,
`CORREO_REMITENTE`). En local, **Mailpit** captura todos los correos en http://localhost:8025.
En producción sirve el correo de tu hosting (cPanel), Google Workspace, Amazon SES, Brevo, etc.
Configura SPF y DKIM del dominio para que el correo no llegue a spam.

## Estructura

```
app/
  main.py                 Migraciones y llave de firma al iniciar
  cli.py                  Gestión de usuarios por consola
  core/criptografia.py    Código, huellas HMAC, llaves RSA, firma de tokens
  core/llaves.py          Llave activa (se crea sola) y JWKS
  services/codigos.py     Solicitar y verificar códigos
  services/sesiones.py    Sesiones del navegador
  services/correo.py      Envío por SMTP (texto + HTML)
  services/usuarios.py    Usuarios y roles
  api/routes/             login.py, admin.py, sistema.py
migrations/001_inicial.sql
tests/
```

```bash
docker build --build-arg DEV=true -t auth-test services/auth
docker run --rm auth-test python -m pytest -q
```
