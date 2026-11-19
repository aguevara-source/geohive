from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import Connection

from ...core.security import Usuario, usuario_actual
from ...db.session import get_db
from ...schemas.geocodificacion import LoteOut
from ...services import lotes as servicio

# Toda ruta exige sesión válida y rol, antes de tocar la base de datos
router = APIRouter(prefix="/lotes", tags=["Lotes CSV"], dependencies=[Depends(usuario_actual)])

MAX_BYTES = 10 * 1024 * 1024


def _lote(db: Connection, usuario: Usuario, lote_id: str):
    try:
        lote = servicio.obtener(db, usuario, lote_id)
    except Exception:
        lote = None
    if not lote:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lote no encontrado")
    return lote


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_lote(archivo: UploadFile = File(...), pais: str = Form("", pattern=r"^([a-z]{2})?$"),
                     db: Connection = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    contenido = await archivo.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Archivo mayor a 10 MB")
    try:
        lote_id = servicio.crear(db, usuario, archivo.filename or "archivo.csv", pais, contenido)
    except servicio.CSVInvalido as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return {"id": lote_id}


@router.get("", response_model=list[LoteOut])
def listar_lotes(db: Connection = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    return servicio.listar(db, usuario)


@router.get("/{lote_id}", response_model=LoteOut)
def ver_lote(lote_id: str, db: Connection = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    return _lote(db, usuario, lote_id)


@router.get("/{lote_id}/geojson")
def lote_geojson(lote_id: str, db: Connection = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    return servicio.exportar_geojson(db, _lote(db, usuario, lote_id))


@router.get("/{lote_id}/csv")
def lote_csv(lote_id: str, db: Connection = Depends(get_db), usuario: Usuario = Depends(usuario_actual)):
    lote = _lote(db, usuario, lote_id)
    contenido = "".join(servicio.exportar_csv(db, lote))
    nombre = f"geocodificado_{lote['nombre_archivo'].rsplit('.', 1)[0]}.csv".encode("ascii", "ignore").decode()
    return StreamingResponse(
        iter([contenido]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
