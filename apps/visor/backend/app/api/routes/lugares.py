from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.security import usuario_actual
from ...services import lugares as servicio

# Toda ruta exige sesión válida y rol, antes de consultar servicios externos
router = APIRouter(prefix="/lugares", tags=["Lugares de interés"], dependencies=[Depends(usuario_actual)])

BBOX = Query(description="minLng,minLat,maxLng,maxLat de la vista actual")


def _caja(bbox: str) -> tuple[float, float, float, float]:
    try:
        w, s, e, n = map(float, bbox.split(","))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "bbox debe ser minLng,minLat,maxLng,maxLat")
    return s, w, n, e


def _ejecutar(funcion, *args):
    try:
        return funcion(*args)
    except servicio.CategoriaInvalida:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Categoría o texto de búsqueda no válido")
    except servicio.ZonaMuyGrande:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Acércate un poco más a una zona (máximo {servicio.AREA_MAXIMA_KM2} km²).")
    except servicio.ServicioNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "OpenStreetMap no respondió. Intenta nuevamente en unos segundos.")


@router.get("/categorias")
def categorias():
    """Grupos de categorías con sus subcategorías y palabras clave (para el menú «Más»)."""
    return servicio.catalogo()


@router.get("")
def buscar_lugares(
    categoria: str = Query(pattern=r"^[a-z_]{3,40}$", description="Subcategoría (ej. chifas) o grupo (ej. compras)"),
    bbox: str = BBOX,
    nombre: str = Query("", max_length=60, description="Opcional: solo los que contienen este nombre"),
):
    """Lugares de una categoría dentro de la vista del mapa (OpenStreetMap)."""
    s, w, n, e = _caja(bbox)
    return _ejecutar(servicio.buscar, categoria, s, w, n, e, nombre)


@router.get("/buscar")
def buscar_por_nombre(q: str = Query(min_length=3, max_length=60), bbox: str = BBOX):
    """Lugares de cualquier categoría cuyo nombre contiene el texto (ej. «banco de la nación»)."""
    s, w, n, e = _caja(bbox)
    return _ejecutar(servicio.buscar_por_nombre, q, s, w, n, e)
