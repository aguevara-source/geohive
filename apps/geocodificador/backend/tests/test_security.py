from fastapi.testclient import TestClient

from app.main import app

cliente = TestClient(app)


def test_sin_token_401():
    assert cliente.get("/lotes").status_code == 401


def test_token_valido(token):
    r = cliente.get("/me", headers={"Authorization": f"Bearer {token()}"})
    assert r.status_code == 200


def test_rol_de_otra_app_403(token):
    r = cliente.get("/me", headers={"Authorization": f"Bearer {token(roles=('visor',))}"})
    assert r.status_code == 403


def test_token_del_visor_rechazado(token):
    r = cliente.get("/me", headers={"Authorization": f"Bearer {token(aud='visor')}"})
    assert r.status_code == 401
