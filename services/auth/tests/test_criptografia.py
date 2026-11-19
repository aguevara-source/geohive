import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://x:x@localhost:1/x")
os.environ.setdefault("SECRET_KEY", "prueba")
os.environ.setdefault("PUBLIC_URL", "http://test")

import jwt  # noqa: E402

from app.core import criptografia as c  # noqa: E402


def test_codigo_tiene_4_digitos_y_2_letras():
    for _ in range(500):
        codigo = c.generar_codigo()
        assert c.FORMATO_CODIGO.match(codigo), codigo
        assert "I" not in codigo and "O" not in codigo


def test_codigos_no_se_repiten_facilmente():
    assert len({c.generar_codigo() for _ in range(1000)}) > 990


def test_normalizar_acepta_minusculas_espacios_y_guion():
    assert c.normalizar_codigo(" 4827-km ") == "4827KM"


def test_huella_depende_del_secreto():
    assert c.huella("a", "4827KM") != c.huella("b", "4827KM")
    assert c.coincide("a", "4827KM", c.huella("a", "4827KM"))
    assert not c.coincide("a", "4827KN", c.huella("a", "4827KM"))


def test_token_firmado_se_valida_con_la_llave_publica():
    llave = c.cargar_llave(c.nueva_llave_pem())
    usuario = {"id": "u1", "email": "ana@x.com", "nombre": "Ana", "roles": ["visor"]}
    token = c.firmar_token(kid="k1", llave=llave, emisor="http://test/auth", app="visor", usuario=usuario, minutos=5)

    publica = jwt.PyJWK(c.jwk_publica("k1", llave)).key
    claims = jwt.decode(token, publica, algorithms=["RS256"], audience="visor", issuer="http://test/auth")
    assert claims["roles"] == ["visor"] and claims["email"] == "ana@x.com"
    assert jwt.get_unverified_header(token)["kid"] == "k1"
