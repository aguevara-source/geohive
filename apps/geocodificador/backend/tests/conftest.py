import os
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://x:x@localhost:1/x")
os.environ.setdefault("AUTH_ISSUER", "http://test/auth")
os.environ.setdefault("AUTH_JWKS_URL", "http://test/jwks.json")

from app.core import security  # noqa: E402
from app.core.config import settings  # noqa: E402

LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _JWKSFalso:
    def get_signing_key_from_jwt(self, _token):
        return type("K", (), {"key": LLAVE.public_key()})()


@pytest.fixture(autouse=True)
def jwks_falso(monkeypatch):
    monkeypatch.setattr(security, "jwks_client", lambda: _JWKSFalso())


@pytest.fixture
def token():
    def crear(roles=("geocodificador",), aud=None, iss=None, exp=300, llave=LLAVE):
        ahora = int(time.time())
        claims = {
            "sub": "u-1", "preferred_username": "jperez", "name": "Juan Pérez",
            "iat": ahora, "exp": ahora + exp,
            "aud": aud or settings.client_id, "iss": iss or settings.auth_issuer,
            "roles": list(roles),
        }
        return jwt.encode(claims, llave, algorithm="RS256")
    return crear
