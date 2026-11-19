from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.routes import admin, contacto, login, sistema
from .core.config import settings
from .core.llaves import llave_activa
from .db.migrate import aplicar_migraciones
from .db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    aplicar_migraciones(engine)
    llave_activa()  # crea la llave de firma en el primer arranque
    yield


app = FastAPI(
    title="GeoHive — Autenticación",
    description="Inicio de sesión con código enviado por correo y emisión de tokens para las aplicaciones.",
    version="1.0.0",
    root_path=settings.root_path,
    lifespan=lifespan,
)

app.include_router(sistema.router)
app.include_router(login.router)
app.include_router(admin.router)
app.include_router(contacto.router)
