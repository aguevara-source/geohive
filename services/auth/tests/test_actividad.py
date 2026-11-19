from app.services.actividad import describir_agente, tipo_red

CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
EDGE_WINDOWS = CHROME_WINDOWS + " Edg/130.0"
SAFARI_IPHONE = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
                 "Version/17.5 Mobile/15E148 Safari/604.1")
CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"
TABLET_ANDROID = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


def test_describir_agente():
    assert describir_agente(CHROME_WINDOWS) == ("Chrome", "Windows", "computadora")
    assert describir_agente(EDGE_WINDOWS) == ("Edge", "Windows", "computadora")
    assert describir_agente(SAFARI_IPHONE) == ("Safari", "iOS", "celular")
    assert describir_agente(CHROME_ANDROID) == ("Chrome", "Android", "celular")
    assert describir_agente(TABLET_ANDROID) == ("Chrome", "Android", "tablet")
    assert describir_agente(None) == (None, None, None)


def test_tipo_red():
    assert tipo_red("127.0.0.1") == "local"
    assert tipo_red("192.168.1.20") == "privada"
    assert tipo_red("172.18.0.5") == "privada"
    assert tipo_red("190.12.34.56") == "publica"
    assert tipo_red("no-es-ip") is None
