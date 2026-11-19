from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.routes import geocodificacion, lotes, sistema
from .core.config import settings
from .db.migrate import aplicar_migraciones
from .db.session import engine
from .services.lotes import iniciar_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    aplicar_migraciones(engine)
    detener = iniciar_worker(engine) if settings.worker_activo else None
    yield
    if detener:
        detener.set()


app = FastAPI(
    title="Geocodificador GeoHive — API",
    version="1.0.0",
    root_path=settings.root_path,
    lifespan=lifespan,
)

app.include_router(sistema.router)
app.include_router(geocodificacion.router)
app.include_router(lotes.router)
