from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Connection

from ...core.security import Usuario, usuario_actual
from ...db.session import get_db
from ...schemas.geocodificacion import Resultado
from ...services import nominatim

# Toda ruta exige sesión válida y rol, antes de tocar la base de datos
router = APIRouter(tags=["Geocodificación"], dependencies=[Depends(usuario_actual)])

PAIS = Query("", pattern=r"^([a-z]{2}(,[a-z]{2})*)?$", description="Códigos ISO, ej. pe")


@router.get("/buscar", response_model=list[Resultado])
def buscar(q: str = Query(min_length=3, max_length=300), pais: str = PAIS,
           db: Connection = Depends(get_db), _: Usuario = Depends(usuario_actual)):
    """Geocodificación directa: dirección → coordenadas."""
    try:
        return nominatim.buscar(db, q, pais)
    except nominatim.ServicioNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "El servicio de geocodificación no respondió")


@router.get("/inversa", response_model=Resultado | None)
def inversa(lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180),
            db: Connection = Depends(get_db), _: Usuario = Depends(usuario_actual)):
    """Geocodificación inversa: coordenadas → dirección."""
    try:
        return nominatim.inversa(db, lat, lng)
    except nominatim.ServicioNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "El servicio de geocodificación no respondió")
