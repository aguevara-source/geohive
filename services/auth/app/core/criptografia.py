"""Funciones puras de seguridad: códigos, huellas y tokens firmados."""
import hashlib
import hmac
import re
import secrets
import time
import uuid

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

DIGITOS = "0123456789"
LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # sin I ni O, que se confunden con 1 y 0
FORMATO_CODIGO = re.compile(r"^\d{4}[A-Z]{2}$")


def generar_codigo() -> str:
    """4 dígitos + 2 letras, ej. 4827KM (≈5,7 millones de combinaciones)."""
    return "".join(secrets.choice(DIGITOS) for _ in range(4)) + "".join(secrets.choice(LETRAS) for _ in range(2))


def normalizar_codigo(codigo: str) -> str:
    return re.sub(r"[\s\-]", "", codigo).upper()


def huella(secreto: str, valor: str) -> str:
    return hmac.new(secreto.encode(), valor.encode(), hashlib.sha256).hexdigest()


def coincide(secreto: str, valor: str, huella_guardada: str) -> bool:
    return hmac.compare_digest(huella(secreto, valor), huella_guardada)


def token_sesion() -> str:
    return secrets.token_urlsafe(32)


# ---------- Llaves RSA y tokens de acceso ----------

def nueva_llave_pem() -> str:
    llave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return llave.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()


def cargar_llave(pem: str) -> rsa.RSAPrivateKey:
    return serialization.load_pem_private_key(pem.encode(), password=None)  # type: ignore[return-value]


def jwk_publica(kid: str, llave: rsa.RSAPrivateKey) -> dict:
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(llave.public_key(), as_dict=True)
    return {**jwk, "kid": kid, "use": "sig", "alg": "RS256"}


def firmar_token(*, kid: str, llave: rsa.RSAPrivateKey, emisor: str, app: str, usuario: dict, minutos: int) -> str:
    ahora = int(time.time())
    claims = {
        "iss": emisor,
        "aud": app,
        "sub": str(usuario["id"]),
        "email": usuario["email"],
        "name": usuario["nombre"],
        "preferred_username": usuario["email"],
        "roles": list(usuario["roles"]),
        "iat": ahora,
        "exp": ahora + minutos * 60,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(claims, llave, algorithm="RS256", headers={"kid": kid})
