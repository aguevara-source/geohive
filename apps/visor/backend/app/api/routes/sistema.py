from fastapi import APIRouter, Depends
from sqlalchemy import text

from ...core.security import Usuario, usuario_actual
from ...db.session import engine

router = APIRouter(tags=["Sistema"])


@router.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/me")
def me(usuario: Usuario = Depends(usuario_actual)):
    return usuario
