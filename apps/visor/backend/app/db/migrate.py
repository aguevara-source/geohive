"""Migraciones SQL versionadas: aplica en orden los archivos migrations/NNN_*.sql pendientes."""
import logging
from pathlib import Path

from sqlalchemy import Engine, text

from ..core.config import settings
from .session import ident

CARPETA = Path(__file__).resolve().parents[2] / "migrations"
log = logging.getLogger("migraciones")


def aplicar_migraciones(engine: Engine) -> None:
    with engine.begin() as conn:
        # Evita que dos procesos (workers) migren a la vez
        conn.execute(text("SELECT pg_advisory_xact_lock(hashtext(:esquema))"), {"esquema": settings.db_schema})
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {ident(settings.db_schema)}"))
        conn.execute(text("""CREATE TABLE IF NOT EXISTS schema_migrations (
            version text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())"""))
        hechas = set(conn.execute(text("SELECT version FROM schema_migrations")).scalars())

        for archivo in sorted(CARPETA.glob("*.sql")):
            if archivo.name in hechas:
                continue
            log.warning("Aplicando migración %s", archivo.name)
            conn.connection.dbapi_connection.cursor().execute(archivo.read_text(encoding="utf-8"))
            conn.execute(text("INSERT INTO schema_migrations (version) VALUES (:v)"), {"v": archivo.name})
