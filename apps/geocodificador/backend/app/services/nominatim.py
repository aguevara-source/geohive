"""Cliente de Nominatim con caché en PostgreSQL y límite de 1 petición por segundo."""
import json
import threading
import time

import httpx
from sqlalchemy import Connection, text

from ..core.config import settings


class ServicioNoDisponible(Exception):
    pass


class _Limitador:
    """Espacia las peticiones salientes (compartido por endpoints y worker del proceso)."""

    def __init__(self, intervalo: float):
        self._lock = threading.Lock()
        self._ultimo = 0.0
        self.intervalo = intervalo

    def esperar(self):
        with self._lock:
            espera = self._ultimo + self.intervalo - time.monotonic()
            if espera > 0:
                time.sleep(espera)
            self._ultimo = time.monotonic()


_limitador = _Limitador(settings.nominatim_intervalo_seg)
_http = httpx.Client(
    base_url=settings.nominatim_url,
    headers={"User-Agent": settings.nominatim_user_agent, "Accept-Language": "es"},
    timeout=15,
)


def _consultar(ruta: str, params: dict):
    _limitador.esperar()
    try:
        r = _http.get(ruta, params={"format": "jsonv2", "addressdetails": 1, **params})
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        raise ServicioNoDisponible(str(e)) from e


def _con_cache(db: Connection, tipo: str, consulta: str, pais: str, obtener):
    fila = db.execute(
        text("SELECT resultado FROM geocache WHERE tipo = :t AND consulta = :c AND pais = :p"),
        {"t": tipo, "c": consulta, "p": pais},
    ).scalar()
    if fila is not None:
        return fila
    resultado = obtener()
    db.execute(
        text("""INSERT INTO geocache (tipo, consulta, pais, resultado) VALUES (:t, :c, :p, CAST(:r AS jsonb))
                ON CONFLICT DO NOTHING"""),
        {"t": tipo, "c": consulta, "p": pais, "r": json.dumps(resultado)},
    )
    return resultado


def _resumen(item: dict) -> dict:
    return {"lat": float(item["lat"]), "lng": float(item["lon"]), "direccion": item.get("display_name", ""),
            "tipo": item.get("type"), "importancia": item.get("importance")}


def buscar(db: Connection, direccion: str, pais: str = "", limite: int = 5) -> list[dict]:
    consulta = " ".join(direccion.split()).lower()
    params = {"q": consulta, "limit": limite, **({"countrycodes": pais} if pais else {})}
    datos = _con_cache(db, "directa", f"{consulta}|{limite}", pais, lambda: _consultar("/search", params))
    return [_resumen(i) for i in datos]


def inversa(db: Connection, lat: float, lng: float) -> dict | None:
    consulta = f"{lat:.6f},{lng:.6f}"
    datos = _con_cache(db, "inversa", consulta, "", lambda: _consultar("/reverse", {"lat": lat, "lon": lng}))
    return None if "error" in datos else _resumen(datos)
