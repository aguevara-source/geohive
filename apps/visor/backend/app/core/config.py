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
    db_schema: str = "visor"

    # Servicio de autenticación: el emisor es PUBLIC_URL/auth; las llaves se leen por la red interna
    auth_issuer: str
    auth_jwks_url: str
    client_id: str = "visor"
    rol_requerido: str = "visor"

    # Lugares de interés. «auto»: la base local si ya se importó (python -m app.importar_osm); si no, Overpass.
    lugares_fuente: str = "auto"  # auto | local | overpass
    osm_extracto_url: str = "https://download.geofabrik.de/south-america/peru-latest.osm.pbf"

    # Overpass API (respaldo, sin API key)
    # Servidores en orden de preferencia: si uno falla o tarda demasiado se usa el siguiente.
    # Para producción conviene un Overpass propio o importar OSM a PostGIS (respuesta inmediata).
    overpass_urls: list[str] = [
        "https://overpass-api.de/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]
    overpass_timeout_seg: int = 60
    overpass_user_agent: str = "GeoHive-Visor/1.0"

    # Prefijo con el que el gateway publica esta API
    root_path: str = "/api/visor"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def url_bd(self) -> str:
        if self.database_url:
            return self.database_url
        return (f"postgresql+psycopg://{quote(self.pg_user, safe='')}:{quote(self.pg_password, safe='')}"
                f"@{self.pg_host}:{self.pg_port}/{self.pg_database}")


settings = Settings()
