from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.routes import capas, geomarketing, localidades, lugares, sistema
from .core.config import settings
from .db.migrate import aplicar_migraciones
from .db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    aplicar_migraciones(engine)
    yield


app = FastAPI(
    title="Visor GeoHive — API",
    version="1.0.0",
    root_path=settings.root_path,
    lifespan=lifespan,
)

app.include_router(sistema.router)
app.include_router(capas.router)
app.include_router(lugares.router)
app.include_router(geomarketing.router)
app.include_router(localidades.router)
