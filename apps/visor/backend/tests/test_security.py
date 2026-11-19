from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.main import app

cliente = TestClient(app)


def get_me(token: str | None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return cliente.get("/me", headers=headers)


def test_sin_token_401():
    assert get_me(None).status_code == 401


def test_token_valido(token):
    r = get_me(token())
    assert r.status_code == 200
    assert r.json()["usuario"] == "jperez"


def test_sin_rol_403(token):
    assert get_me(token(roles=("geocodificador",))).status_code == 403


def test_audiencia_de_otra_app_401(token):
    assert get_me(token(aud="geocodificador")).status_code == 401


def test_emisor_incorrecto_401(token):
    assert get_me(token(iss="http://otro/auth")).status_code == 401


def test_token_expirado_401(token):
    assert get_me(token(exp=-10)).status_code == 401


def test_firma_falsa_401(token):
    otra = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert get_me(token(llave=otra)).status_code == 401
