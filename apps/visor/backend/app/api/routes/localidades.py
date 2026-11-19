from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Connection

from ...core.security import usuario_actual
from ...db.session import get_db
from ...services import localidades as servicio

# Toda ruta exige sesión válida y rol
router = APIRouter(prefix="/localidades", tags=["Buscador de lugares del Perú"], dependencies=[Depends(usuario_actual)])


@router.get("")
def buscar(q: str = Query(min_length=2, max_length=80, description="Ej. «chiclayo», «miraflores lima», «kuelap»"),
           db: Connection = Depends(get_db)):
    """Departamentos, provincias, distritos, ciudades, centros poblados y sitios conocidos de todo el Perú."""
    return servicio.buscar(db, q)


@router.get("/esri")
def sugerencias_esri(q: str = Query(min_length=3, max_length=80)):
    """Sugerencias en vivo del geocodificador de Esri (urbanizaciones, direcciones, negocios). No se guardan."""
    try:
        return servicio.sugerencias_esri(q)
    except servicio.EsriNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "El buscador de Esri no respondió")


@router.get("/esri/ubicar")
def ubicar_esri(texto: str = Query(min_length=3, max_length=200), clave: str = Query(min_length=10, max_length=500)):
    """Ubicación de una sugerencia de Esri."""
    try:
        resultado = servicio.ubicar_esri(texto, clave)
    except servicio.EsriNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "El buscador de Esri no respondió")
    if not resultado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Esri no encontró ese lugar")
    return resultado


@router.get("/limites/{nivel}")
def lineas_limites(nivel: int, response: Response,
                   caja: str | None = Query(None, pattern=r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$",
                                            description="oeste,sur,este,norte (obligatoria para distritos)"),
                   db: Connection = Depends(get_db)):
    """Bordes de departamentos (4), provincias (6) o distritos (8) para pintarlos por escala."""
    if nivel not in servicio.NIVELES_LIMITE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nivel: 4 departamentos, 6 provincias u 8 distritos")
    c = tuple(map(float, caja.split(","))) if caja else None
    if nivel == 8 and (not c or (c[2] - c[0]) * (c[3] - c[1]) > 4.01):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Los distritos se piden por cuadrantes de hasta 2° × 2°")
    response.headers["Cache-Control"] = "private, max-age=86400"  # cambian solo al reimportar
    return servicio.lineas_limites(db, nivel, c)


@router.get("/{id_}/limite")
def limite(id_: int, db: Connection = Depends(get_db)):
    """Contorno del lugar elegido (departamento, provincia, distrito, urbanización, sitio…)."""
    geometria = servicio.limite(db, id_)
    if geometria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese lugar no tiene límite")
    return geometria
