from typing import Any

from pydantic import BaseModel


class CapaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None


class InterseccionIn(BaseModel):
    geometry: dict[str, Any]


class InterseccionOut(BaseModel):
    area_ha: float
    total: int
    resultado: dict[str, Any]
