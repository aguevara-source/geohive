from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class Resultado(BaseModel):
    lat: float
    lng: float
    direccion: str
    tipo: str | None = None
    importancia: float | None = None


class LoteOut(BaseModel):
    id: UUID
    nombre_archivo: str
    pais: str
    total: int
    procesados: int
    encontrados: int
    estado: str
    creado_en: datetime
    terminado_en: datetime | None
