from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Connection

from ...core.security import Usuario, usuario_actual
from ...db.session import get_db
from ...schemas.capas import CapaOut, InterseccionIn, InterseccionOut
from ...services import capas as servicio

# Toda ruta exige sesión válida y rol, antes de tocar la base de datos
router = APIRouter(prefix="/capas", tags=["Capas"], dependencies=[Depends(usuario_actual)])


def _capa(db: Connection, capa_id: int):
    try:
        return servicio.obtener(db, capa_id)
    except servicio.CapaNoEncontrada:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capa no encontrada")


@router.get("", response_model=list[CapaOut])
def listar_capas(db: Connection = Depends(get_db), _: Usuario = Depends(usuario_actual)):
    return servicio.listar(db)


@router.get("/{capa_id}/geojson")
def capa_geojson(
    capa_id: int,
    bbox: str | None = Query(None, description="minLng,minLat,maxLng,maxLat"),
    limite: int = Query(5000, ge=1, le=50000),
    db: Connection = Depends(get_db),
    _: Usuario = Depends(usuario_actual),
):
    caja = None
    if bbox:
        try:
            x1, y1, x2, y2 = map(float, bbox.split(","))
            caja = (x1, y1, x2, y2)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox debe ser minLng,minLat,maxLng,maxLat")
    return Response(servicio.geojson(db, _capa(db, capa_id), caja, limite), media_type="application/geo+json")


@router.post("/{capa_id}/interseccion", response_model=InterseccionOut)
def interseccion(capa_id: int, datos: InterseccionIn, db: Connection = Depends(get_db),
                 _: Usuario = Depends(usuario_actual)):
    try:
        return servicio.interseccion(db, _capa(db, capa_id), datos.geometry)
    except servicio.GeometriaInvalida:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Geometría GeoJSON no válida")
