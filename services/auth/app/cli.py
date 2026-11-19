"""Gestión de usuarios desde la consola del servidor.

    docker compose exec auth-api python -m app.cli crear ana@empresa.com "Ana Torres" --roles visor,geocodificador,geohive-admin
    docker compose exec auth-api python -m app.cli listar
    docker compose exec auth-api python -m app.cli desactivar jperez@empresa.com
"""
import argparse

from sqlalchemy import text

from .db.migrate import aplicar_migraciones
from .db.session import engine
from .services import usuarios


def _roles(valor: str | None) -> list[str]:
    return [r.strip() for r in (valor or "").split(",") if r.strip()]


def crear(args):
    with engine.begin() as db:
        usuarios.crear_o_actualizar(db, args.email, args.nombre, _roles(args.roles))
    print(f"Usuario {args.email.lower()} guardado. Roles: {args.roles or 'ninguno'}")


def listar(_args):
    with engine.begin() as db:
        for u in usuarios.listar(db):
            estado = "activo" if u["activo"] else "INACTIVO"
            print(f"{u['email']:<35} {u['nombre']:<25} {estado:<9} {', '.join(u['roles'])}")


def desactivar(args):
    with engine.begin() as db:
        fila = db.execute(text("SELECT id FROM usuarios WHERE email = :e"), {"e": args.email.lower()}).first()
        if not fila:
            raise SystemExit("Usuario no encontrado")
        roles = db.execute(text("SELECT rol FROM usuario_roles WHERE usuario_id = :u"), {"u": fila.id}).scalars().all()
        usuarios.actualizar(db, str(fila.id), list(roles), activo=False)
    print(f"Usuario {args.email} desactivado y sus sesiones cerradas.")


def main():
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(required=True)

    p = sub.add_parser("crear", help="Crea o actualiza un usuario")
    p.add_argument("email")
    p.add_argument("nombre")
    p.add_argument("--roles", help="Apps separadas por coma: visor,geocodificador,geohive-admin")
    p.set_defaults(func=crear)

    sub.add_parser("listar", help="Lista los usuarios").set_defaults(func=listar)

    p = sub.add_parser("desactivar", help="Desactiva un usuario y cierra sus sesiones")
    p.add_argument("email")
    p.set_defaults(func=desactivar)

    args = parser.parse_args()
    aplicar_migraciones(engine)
    args.func(args)


if __name__ == "__main__":
    main()
