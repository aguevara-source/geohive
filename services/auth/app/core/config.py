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
    db_schema: str = "auth"
    # Clave para las huellas (HMAC) de códigos y sesiones. Larga y aleatoria.
    secret_key: str
    # URL pública de la plataforma, sin "/" final. El emisor de los tokens es PUBLIC_URL/auth
    public_url: str

    # Código por correo: 4 dígitos + 2 letras
    codigo_minutos: int = 10
    codigo_intentos: int = 5
    codigos_por_hora: int = 5

    # Sesión (cookie) y token de acceso a las apps
    sesion_horas: int = 8
    token_minutos: int = 5
    cookie_name: str = "gh_sesion"
    cookie_secure: bool = True

    # Correo saliente (SMTP)
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_usuario: str = ""
    smtp_password: str = ""
    smtp_seguridad: str = "starttls"  # starttls | ssl | ninguna
    correo_remitente: str = "AG-Y GEOHIVE <no-responder@agygeohive.com>"

    # Correo que recibe los mensajes del formulario de contacto del portal
    contacto_destino: str = ""

    rol_admin: str = "geohive-admin"
    root_path: str = "/auth"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def emisor(self) -> str:
        return f"{self.public_url.rstrip('/')}/auth"

    @property
    def url_bd(self) -> str:
        if self.database_url:
            return self.database_url
        return (f"postgresql+psycopg://{quote(self.pg_user, safe='')}:{quote(self.pg_password, safe='')}"
                f"@{self.pg_host}:{self.pg_port}/{self.pg_database}")


settings = Settings()
