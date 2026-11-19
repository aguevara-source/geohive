"""Alta, cambios y consulta de usuarios y sus roles (acceso a aplicaciones)."""
from sqlalchemy import Connection, text


def listar(db: Connection):
    return db.execute(text("""
        SELECT u.id, u.email, u.nombre, u.activo, u.creado_en, u.ultimo_acceso,
               COALESCE(array_agg(r.rol ORDER BY r.rol) FILTER (WHERE r.rol IS NOT NULL), '{}') AS roles
        FROM usuarios u LEFT JOIN usuario_roles r ON r.usuario_id = u.id
        GROUP BY u.id ORDER BY u.email
    """)).mappings().all()


def guardar_roles(db: Connection, usuario_id: str, roles: list[str]):
    db.execute(text("DELETE FROM usuario_roles WHERE usuario_id = :u"), {"u": usuario_id})
    for rol in sorted(set(roles)):
        db.execute(text("INSERT INTO usuario_roles (usuario_id, rol) VALUES (:u, :r)"), {"u": usuario_id, "r": rol})


def crear_o_actualizar(db: Connection, email: str, nombre: str, roles: list[str]) -> str:
    usuario_id = db.execute(
        text("""INSERT INTO usuarios (email, nombre) VALUES (:e, :n)
                ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true
                RETURNING id"""),
        {"e": email.strip().lower(), "n": nombre.strip()},
    ).scalar_one()
    guardar_roles(db, usuario_id, roles)
    return str(usuario_id)


def actualizar(db: Connection, usuario_id: str, roles: list[str], activo: bool) -> bool:
    res = db.execute(text("UPDATE usuarios SET activo = :a WHERE id = CAST(:id AS uuid)"), {"a": activo, "id": usuario_id})
    if res.rowcount == 0:
        return False
    guardar_roles(db, usuario_id, roles)
    if not activo:  # cierra sus sesiones abiertas
        db.execute(text("UPDATE sesiones SET revocada = true WHERE usuario_id = CAST(:id AS uuid)"), {"id": usuario_id})
    return True
