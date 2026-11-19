from urllib.parse import quote

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Base de datos: DATABASE_URL completa, o por partes (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE).
    # Cada servicio guarda sus tablas en su propio esquema dentro de la misma base.
    database_url: str = ""
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_user: str = "postgres"
    pg_password: str = ""
    pg_database: str = "geohive"
    db_schema: str = "geocodificador"

    # Servicio de autenticación: el emisor es PUBLIC_URL/auth; las llaves se leen por la red interna
    auth_issuer: str
    auth_jwks_url: str
    client_id: str = "geocodificador"
    rol_requerido: str = "geocodificador"

    # Prefijo con el que el gateway publica esta API
    root_path: str = "/api/geocodificador"

    # Nominatim (OpenStreetMap). Política de uso: máx. 1 petición/segundo y User-Agent identificable.
    # Para alto volumen se recomienda un servidor Nominatim propio (cambiar la URL).
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "GeoHive/1.0"
    nominatim_intervalo_seg: float = 1.1

    lote_max_filas: int = 5000
    worker_activo: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def url_bd(self) -> str:
        if self.database_url:
            return self.database_url
        return (f"postgresql+psycopg://{quote(self.pg_user, safe='')}:{quote(self.pg_password, safe='')}"
                f"@{self.pg_host}:{self.pg_port}/{self.pg_database}")


settings = Settings()
