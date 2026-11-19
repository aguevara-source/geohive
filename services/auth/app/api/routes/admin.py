from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...db.session import engine
from ...services import actividad, usuarios
from ..deps import requiere_admin

router = APIRouter(prefix="/admin", tags=["Administración"], dependencies=[Depends(requiere_admin)])

ROL = Field(pattern=r"^[a-z][a-z0-9-]{1,49}$")


class UsuarioIn(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    nombre: str = Field(min_length=1, max_length=120)
    roles: list[str] = []


class CambiosIn(BaseModel):
    roles: list[str]
    activo: bool = True


@router.get("/usuarios")
def listar():
    with engine.begin() as db:
        return usuarios.listar(db)


@router.post("/usuarios", status_code=status.HTTP_201_CREATED)
def crear(datos: UsuarioIn):
    with engine.begin() as db:
        return {"id": usuarios.crear_o_actualizar(db, datos.email, datos.nombre, datos.roles)}


@router.put("/usuarios/{usuario_id}")
def actualizar(usuario_id: str, datos: CambiosIn):
    try:
        with engine.begin() as db:
            encontrado = usuarios.actualizar(db, usuario_id, datos.roles, datos.activo)
    except Exception:
        encontrado = False
    if not encontrado:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return {"ok": True}


@router.get("/uso")
def uso_modulos(dias: int = Query(30, ge=1, le=3650)):
    """Ranking de los módulos más usados en los últimos N días."""
    with engine.begin() as db:
        return actividad.resumen_uso(db, dias)


@router.get("/ingresos")
def ingresos(dias: int = Query(30, ge=1, le=3650), limite: int = Query(200, ge=1, le=5000)):
    """Últimos ingresos: quién, cuándo, desde qué IP/dispositivo y, si la compartió, su ubicación."""
    with engine.begin() as db:
        return actividad.ultimos_ingresos(db, dias, limite)
