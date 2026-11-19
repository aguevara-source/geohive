"""Buscador nacional: departamentos, provincias, distritos, ciudades, centros poblados y sitios conocidos del Perú."""
import json
import re

import httpx
from sqlalchemy import Connection, text

from .lugares import sin_tildes

_SQL_BUSCAR = """
SELECT l.id, l.nombre, l.tipo, l.contexto, ST_X(l.geom) AS lon, ST_Y(l.geom) AS lat,
       (l.limite_id IS NOT NULL OR l.contorno IS NOT NULL) AS tiene_limite,
       ST_XMin(b.caja) AS oeste, ST_YMin(b.caja) AS sur, ST_XMax(b.caja) AS este, ST_YMax(b.caja) AS norte
FROM geodata.localidades l
LEFT JOIN geodata.limites_admin la ON la.id = l.limite_id
LEFT JOIN LATERAL (SELECT Box2D(COALESCE(la.geom, l.contorno)) AS caja) b ON true
WHERE {condiciones}
ORDER BY (l.nombre_norm = :exacto) DESC, (l.nombre_norm LIKE :prefijo) DESC, l.prioridad,
         l.poblacion DESC NULLS LAST, length(l.nombre), l.id
LIMIT :limite
"""


def _like(texto: str) -> str:
    return re.sub(r"([\\%_])", r"\\\1", texto)


def _contexto(nombre: str, contexto: str | None) -> str | None:
    """«Chiclayo, Chiclayo, Lambayeque» para la ciudad de Chiclayo → «Lambayeque» (sin nombres repetidos)."""
    partes: list[str] = []
    for p in (contexto or "").split(", "):
        if p and p != nombre and p not in partes:
            partes.append(p)
    return ", ".join(partes) or None


def buscar(db: Connection, q: str, limite: int = 15) -> list[dict]:
    consulta = re.sub(r"[^\w\s]", " ", sin_tildes(q)).split()[:6]
    if not consulta or len("".join(consulta)) < 2:
        return []
    frase = " ".join(consulta)
    params = {"exacto": frase, "prefijo": f"{_like(frase)}%", "limite": limite}
    condiciones = []
    for i, palabra in enumerate(consulta):
        params[f"p{i}"] = f"%{_like(palabra)}%"
        condiciones.append(f"l.texto_norm LIKE :p{i}")
    filas = db.execute(text(_SQL_BUSCAR.format(condiciones=" AND ".join(condiciones))), params).mappings().all()
    return [{
        "id": f["id"], "nombre": f["nombre"], "tipo": f["tipo"], "contexto": _contexto(f["nombre"], f["contexto"]),
        "lon": round(f["lon"], 6), "lat": round(f["lat"], 6), "tiene_limite": f["tiene_limite"],
        "caja": [round(f[k], 6) for k in ("oeste", "sur", "este", "norte")] if f["tiene_limite"] else None,
    } for f in filas]


NIVELES_LIMITE = {4, 6, 8}  # departamentos, provincias, distritos

# Geocodificador mundial de Esri: complementa al buscador local con urbanizaciones, direcciones y negocios.
# Se consulta en vivo y no se guarda nada (sus condiciones no permiten almacenar resultados sin cuenta de pago).
ESRI_GEOCODER = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
_TIPOS_ESRI = {"Neighborhood": "urbanización", "District": "distrito", "City": "ciudad", "Subregion": "provincia",
               "Region": "departamento", "PointAddress": "dirección", "StreetAddress": "dirección",
               "StreetName": "calle", "StreetInt": "cruce de calles", "POI": "lugar"}


class EsriNoDisponible(Exception):
    pass


def _esri(ruta: str, params: dict) -> dict:
    try:
        r = httpx.get(f"{ESRI_GEOCODER}/{ruta}", params={"f": "json", "countryCode": "PER", **params}, timeout=6)
        r.raise_for_status()
        datos = r.json()
    except (httpx.HTTPError, ValueError) as e:
        raise EsriNoDisponible from e
    if "error" in datos:
        raise EsriNoDisponible
    return datos


def sugerencias_esri(q: str) -> list[dict]:
    """Sugerencias de Esri para el texto (urbanizaciones, direcciones, negocios…)."""
    datos = _esri("suggest", {"text": q[:80], "maxSuggestions": 6})
    return [{"texto": s["text"].removesuffix(", PER"), "clave": s["magicKey"]}
            for s in datos.get("suggestions", []) if not s.get("isCollection")]


def ubicar_esri(texto: str, clave: str) -> dict | None:
    """Ubicación y encuadre de una sugerencia de Esri (no da polígonos: solo punto y recuadro)."""
    datos = _esri("findAddressCandidates", {"singleLine": texto[:200], "magicKey": clave[:500], "maxLocations": 1,
                                            "outFields": "Addr_type,Type,PlaceName"})
    c = next(iter(datos.get("candidates", [])), None)
    if not c:
        return None
    a, e = c.get("attributes", {}), c.get("extent")
    tipo = _TIPOS_ESRI.get(a.get("Type")) or _TIPOS_ESRI.get(a.get("Addr_type")) or (a.get("Type") or "lugar").lower()
    return {"nombre": c["address"], "tipo": tipo, "lon": c["location"]["x"], "lat": c["location"]["y"],
            "caja": [e["xmin"], e["ymin"], e["xmax"], e["ymax"]] if e else None}


def lineas_limites(db: Connection, nivel: int, caja: tuple[float, float, float, float] | None) -> dict:
    """Bordes de un nivel administrativo (todo el país o recortados a una caja oeste, sur, este, norte)."""
    if caja:
        sql = """SELECT ST_AsGeoJSON(ST_Collect(ST_Intersection(geom, c.g)), 5) AS g
                 FROM geodata.limites_lineas, (SELECT ST_MakeEnvelope(:o, :s, :e, :n, 4326) AS g) c
                 WHERE nivel = :nivel AND geom && c.g"""
        params = {"nivel": nivel, "o": caja[0], "s": caja[1], "e": caja[2], "n": caja[3]}
    else:
        sql = "SELECT ST_AsGeoJSON(ST_Collect(geom), 5) AS g FROM geodata.limites_lineas WHERE nivel = :nivel"
        params = {"nivel": nivel}
    g = db.execute(text(sql), params).scalar()
    return json.loads(g) if g else {"type": "GeometryCollection", "geometries": []}


def limite(db: Connection, id_: int) -> dict | None:
    """Contorno simplificado del departamento, provincia, distrito, urbanización o sitio (para resaltarlo en el mapa)."""
    fila = db.execute(text("""
        SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(g, GREATEST(ST_XMax(g) - ST_XMin(g), ST_YMax(g) - ST_YMin(g)) / 1500), 6) AS g
        FROM (SELECT COALESCE(la.geom, l.contorno) AS g FROM geodata.localidades l
              LEFT JOIN geodata.limites_admin la ON la.id = l.limite_id WHERE l.id = :id) x
        WHERE g IS NOT NULL
    """), {"id": id_}).first()
    return json.loads(fila.g) if fila else None
