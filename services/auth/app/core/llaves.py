"""Llave de firma de los tokens: se crea al primer arranque y se guarda en la BD."""
import secrets
from functools import lru_cache

from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import text

from ..db.session import engine
from . import criptografia


@lru_cache
def llave_activa() -> tuple[str, rsa.RSAPrivateKey]:
    with engine.begin() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('llaves'))"))
        fila = db.execute(
            text("SELECT kid, privada_pem FROM llaves WHERE activa ORDER BY creado_en DESC LIMIT 1")
        ).first()
        if fila is None:
            kid, pem = secrets.token_hex(8), criptografia.nueva_llave_pem()
            db.execute(text("INSERT INTO llaves (kid, privada_pem) VALUES (:k, :p)"), {"k": kid, "p": pem})
        else:
            kid, pem = fila
    return kid, criptografia.cargar_llave(pem)


def jwks() -> dict:
    kid, llave = llave_activa()
    return {"keys": [criptografia.jwk_publica(kid, llave)]}
