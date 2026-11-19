import re
from collections.abc import Iterator

from sqlalchemy import Connection, create_engine

from ..core.config import settings

engine = create_engine(
    settings.url_bd,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    # Las tablas sin esquema explícito se crean y buscan en el esquema del servicio
    connect_args={"options": f"-csearch_path={settings.db_schema},public"},
)


def get_db() -> Iterator[Connection]:
    """Una transacción por petición: commit al terminar, rollback si hay error."""
    with engine.begin() as conn:
        yield conn


_IDENT = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def ident(nombre: str) -> str:
    """Valida y entrecomilla un identificador SQL (esquema, tabla, columna)."""
    if not _IDENT.match(nombre):
        raise ValueError(f"Identificador SQL no válido: {nombre!r}")
    return f'"{nombre}"'
