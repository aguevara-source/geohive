"""Solicitud y verificación de códigos de acceso enviados por correo."""
from dataclasses import dataclass

from sqlalchemy import Connection, text

from ..core import criptografia
from ..core.config import settings
from .auditoria import registrar


class DemasiadasSolicitudes(Exception):
    pass


@dataclass
class CodigoGenerado:
    usuario_id: str
    nombre: str
    codigo: str


@dataclass
class Verificacion:
    ok: bool
    usuario_id: str | None = None
    vencido: bool = False
    intentos_restantes: int = 0


def solicitar(db: Connection, email: str, ip: str | None) -> CodigoGenerado | None:
    """Genera un código si el correo pertenece a un usuario activo. Invalida los anteriores."""
    usuario = db.execute(
        text("SELECT id, nombre FROM usuarios WHERE email = :e AND activo"), {"e": email}
    ).mappings().first()
    if not usuario:
        registrar(db, "codigo_correo_desconocido", email=email, ip=ip)
        return None

    recientes = db.execute(
        text("SELECT count(*) FROM codigos WHERE usuario_id = :u AND creado_en > now() - interval '1 hour'"),
        {"u": usuario["id"]},
    ).scalar_one()
    if recientes >= settings.codigos_por_hora:
        registrar(db, "codigo_limite_excedido", usuario_id=usuario["id"], email=email, ip=ip)
        raise DemasiadasSolicitudes

    codigo = criptografia.generar_codigo()
    db.execute(text("UPDATE codigos SET usado = true WHERE usuario_id = :u AND NOT usado"), {"u": usuario["id"]})
    db.execute(
        text("""INSERT INTO codigos (usuario_id, codigo_hash, expira_en, ip)
                VALUES (:u, :h, now() + make_interval(mins => :m), :ip)"""),
        {"u": usuario["id"], "h": criptografia.huella(settings.secret_key, codigo), "m": settings.codigo_minutos, "ip": ip},
    )
    registrar(db, "codigo_enviado", usuario_id=usuario["id"], email=email, ip=ip)
    return CodigoGenerado(str(usuario["id"]), usuario["nombre"], codigo)


def verificar(db: Connection, email: str, codigo: str, ip: str | None) -> Verificacion:
    fila = db.execute(text("""
        SELECT c.id, c.codigo_hash, c.intentos, c.expira_en < now() AS vencido, u.id AS usuario_id
        FROM codigos c JOIN usuarios u ON u.id = c.usuario_id
        WHERE u.email = :e AND u.activo AND NOT c.usado
        ORDER BY c.creado_en DESC LIMIT 1
        FOR UPDATE OF c
    """), {"e": email}).mappings().first()

    if not fila or fila["vencido"]:
        registrar(db, "codigo_vencido", email=email, ip=ip)
        return Verificacion(ok=False, vencido=True)

    normalizado = criptografia.normalizar_codigo(codigo)
    valido = bool(criptografia.FORMATO_CODIGO.match(normalizado)) and criptografia.coincide(
        settings.secret_key, normalizado, fila["codigo_hash"]
    )

    if not valido:
        intentos = fila["intentos"] + 1
        bloqueado = intentos >= settings.codigo_intentos
        db.execute(text("UPDATE codigos SET intentos = :i, usado = :b WHERE id = :id"),
                   {"i": intentos, "b": bloqueado, "id": fila["id"]})
        registrar(db, "codigo_incorrecto", usuario_id=fila["usuario_id"], email=email, ip=ip)
        return Verificacion(ok=False, intentos_restantes=max(settings.codigo_intentos - intentos, 0))

    db.execute(text("UPDATE codigos SET usado = true WHERE id = :id"), {"id": fila["id"]})
    db.execute(text("UPDATE usuarios SET ultimo_acceso = now() WHERE id = :u"), {"u": fila["usuario_id"]})
    registrar(db, "login", usuario_id=fila["usuario_id"], email=email, ip=ip)
    return Verificacion(ok=True, usuario_id=str(fila["usuario_id"]))
