from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Connection

from ...core.security import usuario_actual
from ...db.session import get_db
from ...services import geomarketing as servicio

# Toda ruta exige sesión válida y rol
router = APIRouter(prefix="/geomarketing", tags=["Geomarketing"], dependencies=[Depends(usuario_actual)])


@router.get("/rubros")
def rubros():
    """Rubros disponibles con su radio a pie, competencia, imanes y estándar referencial."""
    return servicio.catalogo()


def _caja(bbox: str) -> tuple[float, float, float, float]:
    try:
        w, s, e, n = map(float, bbox.split(","))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox debe ser minLng,minLat,maxLng,maxLat")
    return w, s, e, n


ZONA_GRANDE = f"Acércate un poco más a una zona (máximo {servicio.AREA_MAXIMA_KM2} km²)."


@router.get("/analisis")
def analisis(rubro: str = Query(pattern=r"^[a-z_]{3,30}$"),
             bbox: str = Query(description="minLng,minLat,maxLng,maxLat de la zona"),
             db: Connection = Depends(get_db)):
    """Oportunidad por hexágono para abrir un negocio del rubro dentro de la zona."""
    w, s, e, n = _caja(bbox)
    try:
        return servicio.analizar(db, rubro, s, w, n, e)
    except servicio.RubroInvalido:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rubro no válido")
    except servicio.ZonaMuyGrande:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, ZONA_GRANDE)


@router.get("/zona")
def perfil_zona(bbox: str = Query(description="minLng,minLat,maxLng,maxLat de la zona"), db: Connection = Depends(get_db)):
    """¿Qué negocio falta aquí? Ranking de rubros por brecha y perfil comercial de la zona."""
    w, s, e, n = _caja(bbox)
    try:
        return servicio.perfil_zona(db, s, w, n, e)
    except servicio.ZonaMuyGrande:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, ZONA_GRANDE)


@router.get("/punto")
def evaluar_punto(rubro: str = Query(pattern=r"^[a-z_]{3,30}$"),
                  lon: float = Query(ge=-82, le=-68), lat: float = Query(ge=-19, le=0.5),
                  db: Connection = Depends(get_db)):
    """Ficha de un local candidato: población a 5, 10 y 15 min a pie, competencia e imanes alrededor."""
    try:
        return servicio.evaluar_punto(db, rubro, lon, lat)
    except servicio.RubroInvalido:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rubro no válido")
