"""Actividad de los usuarios: desde dónde ingresan (tabla ingresos) y qué módulos usan (uso_modulos)."""
import ipaddress
import re

from sqlalchemy import Connection, text

# Orden importante: Edge y Opera también dicen «Chrome», y Chrome también dice «Safari»
_NAVEGADORES = (("Edg/", "Edge"), ("OPR/", "Opera"), ("SamsungBrowser", "Samsung Internet"), ("Firefox/", "Firefox"),
                ("Chrome/", "Chrome"), ("CriOS", "Chrome"), ("Safari/", "Safari"))
_SISTEMAS = (("Windows", "Windows"), ("Android", "Android"), ("iPhone", "iOS"), ("iPad", "iPadOS"),
             ("Mac OS X", "macOS"), ("CrOS", "ChromeOS"), ("Linux", "Linux"))


def describir_agente(agente: str | None) -> tuple[str | None, str | None, str | None]:
    """(navegador, sistema, dispositivo) a partir del User-Agent."""
    if not agente:
        return None, None, None
    navegador = next((n for clave, n in _NAVEGADORES if clave in agente), "Otro")
    sistema = next((s for clave, s in _SISTEMAS if clave in agente), "Otro")
    if "iPad" in agente or ("Android" in agente and "Mobile" not in agente) or "Tablet" in agente:
        dispositivo = "tablet"
    elif re.search(r"Mobile|iPhone|Android", agente):
        dispositivo = "celular"
    else:
        dispositivo = "computadora"
    return navegador, sistema, dispositivo


def tipo_red(ip: str | None) -> str | None:
    """local (la misma máquina), privada (red interna / VPN) o publica (internet)."""
    try:
        direccion = ipaddress.ip_address(ip or "")
    except ValueError:
        return None
    if direccion.is_loopback:
        return "local"
    return "privada" if direccion.is_private else "publica"


def registrar_ingreso(db: Connection, usuario_id: str, sesion_id: str, ip: str | None, agente: str | None):
    navegador, sistema, dispositivo = describir_agente(agente)
    db.execute(text("""
        INSERT INTO ingresos (usuario_id, sesion_id, ip, red, navegador, sistema, dispositivo, agente)
        VALUES (:u, :s, :ip, :red, :nav, :so, :disp, :ag)
    """), {"u": usuario_id, "s": sesion_id, "ip": ip, "red": tipo_red(ip), "nav": navegador, "so": sistema,
           "disp": dispositivo, "ag": (agente or "")[:300]})


def ubicacion_pendiente(db: Connection, sesion_id: str) -> bool:
    return bool(db.execute(text("SELECT permiso IS NULL FROM ingresos WHERE sesion_id = :s"), {"s": sesion_id}).scalar())


def guardar_ubicacion(db: Connection, sesion_id: str, permiso: str, latitud=None, longitud=None, precision_m=None):
    """Solo la primera respuesta de la sesión cuenta (no se sobrescribe desde otras pestañas)."""
    db.execute(text("""
        UPDATE ingresos SET permiso = :p, latitud = :lat, longitud = :lon, precision_m = :pre,
               ubicado_en = CASE WHEN :lat IS NULL THEN NULL ELSE now() END
        WHERE sesion_id = :s AND permiso IS NULL
    """), {"s": sesion_id, "p": permiso, "lat": latitud, "lon": longitud, "pre": precision_m})


def abrir_modulo(db: Connection, usuario_id: str, sesion_id: str, app: str, modulo: str) -> int:
    return db.execute(text("""
        INSERT INTO uso_modulos (usuario_id, sesion_id, app, modulo) VALUES (:u, :s, :a, :m) RETURNING id
    """), {"u": usuario_id, "s": sesion_id, "a": app, "m": modulo}).scalar_one()


def cerrar_modulo(db: Connection, usuario_id: str, uso_id: int, segundos: int):
    """Se puede enviar varias veces (al ocultar la pestaña y al salir): queda el mayor tiempo."""
    db.execute(text("""
        UPDATE uso_modulos SET segundos = GREATEST(coalesce(segundos, 0), :seg) WHERE id = :id AND usuario_id = :u
    """), {"id": uso_id, "u": usuario_id, "seg": segundos})


# ---------- Reportes (administración) ----------

def resumen_uso(db: Connection, dias: int) -> list[dict]:
    filas = db.execute(text("""
        SELECT app, modulo, count(*) AS veces, count(DISTINCT usuario_id) AS usuarios,
               round(coalesce(sum(segundos), 0) / 60.0, 1)::float AS minutos, max(creado_en) AS ultimo_uso
        FROM uso_modulos WHERE creado_en > now() - make_interval(days => :d)
        GROUP BY app, modulo ORDER BY veces DESC, minutos DESC
    """), {"d": dias}).mappings().all()
    return [dict(f) for f in filas]


def ultimos_ingresos(db: Connection, dias: int, limite: int) -> list[dict]:
    filas = db.execute(text("""
        SELECT i.id, u.email, u.nombre, i.creado_en, i.ip, i.red, i.navegador, i.sistema, i.dispositivo,
               i.permiso, i.latitud, i.longitud, i.precision_m
        FROM ingresos i JOIN usuarios u ON u.id = i.usuario_id
        WHERE i.creado_en > now() - make_interval(days => :d)
        ORDER BY i.creado_en DESC LIMIT :l
    """), {"d": dias, "l": limite}).mappings().all()
    return [dict(f) for f in filas]
