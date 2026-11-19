"""Sesiones del navegador: la cookie guarda un token aleatorio y la BD solo su huella."""
from dataclasses import dataclass

from sqlalchemy import Connection, text

from ..core import criptografia
from ..core.config import settings


@dataclass(frozen=True)
class UsuarioSesion:
    sesion_id: str
    id: str
    email: str
    nombre: str
    roles: tuple[str, ...]

    def a_dict(self) -> dict:
        return {"id": self.id, "email": self.email, "nombre": self.nombre, "roles": list(self.roles)}


def crear(db: Connection, usuario_id: str, ip: str | None, agente: str | None) -> tuple[str, str]:
    """Abre la sesión y devuelve (token para la cookie, id de la sesión)."""
    token = criptografia.token_sesion()
    sesion_id = db.execute(
        text("""INSERT INTO sesiones (usuario_id, token_hash, expira_en, ip, agente)
                VALUES (:u, :h, now() + make_interval(hours => :horas), :ip, :ag) RETURNING id"""),
        {"u": usuario_id, "h": criptografia.huella(settings.secret_key, token), "horas": settings.sesion_horas,
         "ip": ip, "ag": (agente or "")[:300]},
    ).scalar_one()
    return token, str(sesion_id)


def buscar(db: Connection, token: str) -> UsuarioSesion | None:
    fila = db.execute(text("""
        SELECT s.id AS sesion_id, u.id, u.email, u.nombre,
               COALESCE(array_agg(r.rol ORDER BY r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
        FROM sesiones s
        JOIN usuarios u ON u.id = s.usuario_id
        LEFT JOIN usuario_roles r ON r.usuario_id = u.id
        WHERE s.token_hash = :h AND NOT s.revocada AND s.expira_en > now() AND u.activo
        GROUP BY s.id, u.id
    """), {"h": criptografia.huella(settings.secret_key, token)}).mappings().first()
    if not fila:
        return None
    db.execute(text("UPDATE sesiones SET ultimo_uso = now() WHERE id = :id"), {"id": fila["sesion_id"]})
    return UsuarioSesion(str(fila["sesion_id"]), str(fila["id"]), fila["email"], fila["nombre"], tuple(fila["roles"]))


def revocar(db: Connection, sesion_id: str):
    db.execute(text("UPDATE sesiones SET revocada = true WHERE id = :id"), {"id": sesion_id})
