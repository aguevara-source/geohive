from fastapi import APIRouter
from sqlalchemy import text

from ...core import llaves
from ...db.session import engine

router = APIRouter(tags=["Sistema"])


@router.get("/health")
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}


@router.get("/jwks.json")
def jwks():
    """Llaves públicas con las que los backends de las apps verifican los tokens."""
    return llaves.jwks()
