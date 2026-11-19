"""Geomarketing para emprendedores: ¿dónde conviene abrir un negocio dentro de la zona consultada?

La zona se divide en hexágonos (~200 m de ancho). Para cada uno se calcula, en el radio que una persona
camina hasta el negocio:
  - demanda: habitantes alcanzables (población Kontur repartida por área),
  - competencia: negocios del mismo rubro (con pesos: un restaurante compite menos que otro chifa),
  - imanes: lugares que atraen clientes a ese rubro (colegios, paraderos, clínicas…).
Con eso se arman tres indicadores normalizados (0–1) que el visor combina con los pesos del usuario.
"""
import json
import math

from sqlalchemy import Connection, text

from .lugares import area_km2

VELOCIDAD_A_PIE = 80  # metros por minuto (≈ 4,8 km/h)
LADO_HEXAGONO = 115   # metros: hexágonos de ~200 m de ancho

GRUPOS_RUBROS = ("Comida y bebida", "Comercio", "Salud", "Belleza y deporte", "Servicios", "Educación y hospedaje")


def _rubro(nombre: str, grupo: str, icono: str, radio: int, estandar: int, competencia: dict, imanes: dict) -> dict:
    return {"nombre": nombre, "grupo": grupo, "icono": icono, "radio": radio, "estandar": estandar,
            "competencia": competencia, "imanes": imanes}


# Por rubro: radio a pie (m), estándar referencial (habitantes por establecimiento, ajustable: sirve para medir
# la brecha), competencia (subcategoría → peso: 1 = mismo rubro) e imanes (lugares que atraen a sus clientes).
RUBROS: dict[str, dict] = {
    # Comida y bebida
    "restaurante": _rubro("Restaurante / menú", "Comida y bebida", "restaurantes", 600, 800,
                          {"restaurantes": 1, "cevicherias": 0.3, "chifas": 0.3, "pollerias": 0.3, "comida_rapida": 0.3},
                          {"oficinas": 1, "gobierno": 0.6, "industrias": 0.5, "mercados": 0.6, "universidades": 0.8, "paraderos": 0.5, "colegios": 0.3}),
    "chifa": _rubro("Chifa", "Comida y bebida", "chifas", 800, 3000,
                    {"chifas": 1, "restaurantes": 0.25, "pollerias": 0.25, "comida_rapida": 0.25},
                    {"universidades": 1, "oficinas": 0.6, "centros_comerciales": 1, "mercados": 0.6, "colegios": 0.4, "paraderos": 0.4}),
    "polleria": _rubro("Pollería", "Comida y bebida", "pollerias", 800, 2500,
                       {"pollerias": 1, "restaurantes": 0.25, "chifas": 0.2, "comida_rapida": 0.3},
                       {"universidades": 0.8, "centros_comerciales": 1, "mercados": 0.6, "colegios": 0.5, "paraderos": 0.5, "parques": 0.3}),
    "cevicheria": _rubro("Cevichería", "Comida y bebida", "cevicherias", 1000, 4000,
                         {"cevicherias": 1, "restaurantes": 0.25},
                         {"mercados": 0.8, "oficinas": 0.6, "playas": 1, "parques": 0.3, "paraderos": 0.3}),
    "comida_rapida": _rubro("Comida rápida / sánguches", "Comida y bebida", "comida_rapida", 600, 2500,
                            {"comida_rapida": 1, "pollerias": 0.3, "restaurantes": 0.2},
                            {"universidades": 1, "colegios": 0.8, "centros_comerciales": 1, "cines": 0.5, "discotecas": 0.4, "paraderos": 0.5, "parques": 0.3}),
    "cafeteria": _rubro("Cafetería", "Comida y bebida", "cafeterias", 500, 3000,
                        {"cafeterias": 1, "panaderias": 0.3, "heladerias": 0.2},
                        {"universidades": 1, "oficinas": 1, "bancos": 0.5, "centros_comerciales": 0.8, "museos": 0.4, "hoteles": 0.4, "parques": 0.3}),
    "panaderia": _rubro("Panadería", "Comida y bebida", "panaderias", 400, 1500,
                        {"panaderias": 1, "supermercados": 0.3, "bodegas": 0.1},
                        {"paraderos": 0.6, "colegios": 0.6, "mercados": 0.5, "templos": 0.3, "parques": 0.2}),
    "heladeria": _rubro("Heladería / juguería", "Comida y bebida", "heladerias", 600, 5000,
                        {"heladerias": 1, "cafeterias": 0.2},
                        {"parques": 1, "playas": 1, "piletas": 0.5, "juegos_infantiles": 0.6, "colegios": 0.6, "centros_comerciales": 0.8}),
    "bar": _rubro("Bar / cervecería", "Comida y bebida", "bares", 800, 5000,
                  {"bares": 1, "discotecas": 0.5},
                  {"universidades": 0.8, "oficinas": 0.6, "discotecas": 0.4, "centros_comerciales": 0.4, "deportes": 0.4, "hoteles": 0.3}),
    # Comercio
    "bodega": _rubro("Bodega / minimarket", "Comercio", "bodegas", 300, 250,
                     {"bodegas": 1, "supermercados": 0.5},
                     {"paraderos": 1, "colegios": 1, "inicial": 0.6, "mercados": 0.4, "templos": 0.3}),
    "ferreteria": _rubro("Ferretería", "Comercio", "ferreterias", 1000, 3000,
                         {"ferreterias": 1},
                         {"mercados": 0.5, "talleres": 0.5, "industrias": 0.4, "almacenes": 0.3, "paraderos": 0.3}),
    "libreria": _rubro("Librería / útiles", "Comercio", "librerias", 500, 3000,
                       {"librerias": 1, "imprentas": 0.4},
                       {"colegios": 1, "inicial": 0.6, "universidades": 1, "gobierno": 0.3}),
    "tecnologia": _rubro("Celulares y tecnología", "Comercio", "tecnologia", 800, 5000,
                         {"tecnologia": 1},
                         {"centros_comerciales": 1, "mercados": 0.8, "universidades": 0.6, "paraderos": 0.5, "bancos": 0.3}),
    "ropa": _rubro("Ropa y calzado", "Comercio", "ropa", 800, 3000,
                   {"ropa": 1},
                   {"centros_comerciales": 1, "mercados": 1, "paraderos": 0.5, "bancos": 0.3, "universidades": 0.3}),
    # Salud
    "botica": _rubro("Botica / farmacia", "Salud", "farmacias", 500, 2000,
                     {"farmacias": 1},
                     {"clinicas": 1, "hospitales": 1.5, "consultorios": 0.8, "laboratorios": 0.5, "mercados": 0.6, "paraderos": 0.4}),
    "consultorio": _rubro("Consultorio médico", "Salud", "consultorios", 1000, 2000,
                          {"consultorios": 1, "clinicas": 0.5},
                          {"farmacias": 0.6, "laboratorios": 0.8, "hospitales": 0.6, "paraderos": 0.4}),
    "dentista": _rubro("Consultorio dental", "Salud", "dentistas", 1000, 3000,
                       {"dentistas": 1, "clinicas": 0.2},
                       {"oficinas": 0.6, "centros_comerciales": 0.6, "colegios": 0.4, "bancos": 0.3, "paraderos": 0.4}),
    "optica": _rubro("Óptica", "Salud", "opticas", 1000, 8000,
                     {"opticas": 1},
                     {"centros_comerciales": 1, "hospitales": 0.6, "clinicas": 0.6, "colegios": 0.4, "universidades": 0.4}),
    "veterinaria": _rubro("Veterinaria / pet shop", "Salud", "veterinarias", 1000, 5000,
                          {"veterinarias": 1},
                          {"parques": 1, "edificios": 0.5, "mercados": 0.4, "paraderos": 0.2}),
    # Belleza y deporte
    "peluqueria": _rubro("Peluquería / barbería", "Belleza y deporte", "peluquerias", 500, 1200,
                         {"peluquerias": 1, "spa": 0.3},
                         {"mercados": 0.8, "paraderos": 0.6, "centros_comerciales": 0.8, "gimnasios": 0.3, "universidades": 0.4}),
    "spa": _rubro("Spa / centro de uñas", "Belleza y deporte", "spa", 1000, 6000,
                  {"spa": 1, "peluquerias": 0.3},
                  {"oficinas": 0.6, "gimnasios": 0.6, "centros_comerciales": 0.8, "hoteles": 0.6}),
    "gimnasio": _rubro("Gimnasio", "Belleza y deporte", "gimnasios", 1200, 6000,
                       {"gimnasios": 1, "deportes": 0.2},
                       {"universidades": 1, "oficinas": 0.7, "centros_comerciales": 0.8, "parques": 0.3, "paraderos": 0.3}),
    # Servicios
    "lavanderia": _rubro("Lavandería", "Servicios", "lavanderias", 600, 4000,
                         {"lavanderias": 1},
                         {"edificios": 1, "universidades": 0.8, "hostales": 0.6, "hoteles": 0.4, "oficinas": 0.3}),
    "imprenta": _rubro("Copias e impresiones", "Servicios", "imprentas", 400, 4000,
                       {"imprentas": 1, "librerias": 0.4},
                       {"universidades": 1, "colegios": 0.8, "gobierno": 1, "municipalidades": 0.8, "juzgados": 0.8, "notarias": 0.6}),
    "taller": _rubro("Taller mecánico", "Servicios", "talleres", 1500, 4000,
                     {"talleres": 1},
                     {"grifos": 1, "estacionamientos": 0.5, "terminales": 0.5, "industrias": 0.4, "almacenes": 0.3}),
    # Educación y hospedaje
    "nido": _rubro("Nido / cuna", "Educación y hospedaje", "inicial", 800, 1500,
                   {"inicial": 1, "colegios": 0.2},
                   {"parques": 0.6, "juegos_infantiles": 0.6, "templos": 0.3, "mercados": 0.3}),
    "hostal": _rubro("Hostal / hospedaje", "Educación y hospedaje", "hostales", 1000, 8000,
                     {"hostales": 1, "hoteles": 0.5, "departamentos": 0.3},
                     {"terminales": 1, "atractivos": 0.8, "museos": 0.5, "hospitales": 0.6, "universidades": 0.4, "playas": 0.6}),
}

# «¿Qué falta aquí?» compara la zona con su entorno: la zona más este margen (grados, ≈ 5,5 km) por lado
MARGEN_ENTORNO = 0.05

# Anillos de la evaluación de un punto: minutos a pie
ANILLOS_MINUTOS = (5, 10, 15)

AREA_MAXIMA_KM2 = 40
UMBRAL_NO_RESIDENCIAL = 0.8  # hexágonos con ≥ 80 % de superficie no residencial (y casi sin gente) no se evalúan
POBLACION_MINIMA = 50        # habitantes propios mínimos para recomendar un hexágono


class RubroInvalido(Exception):
    pass


class ZonaMuyGrande(Exception):
    pass


def catalogo() -> list[dict]:
    return [{"id": k, "nombre": r["nombre"], "grupo": r["grupo"], "icono": r["icono"], "radio": r["radio"],
             "minutos": round(r["radio"] / VELOCIDAD_A_PIE), "estandar": r["estandar"],
             "competencia": list(r["competencia"]), "imanes": list(r["imanes"])}
            for k, r in RUBROS.items()]


def percentiles(valores: list[float]) -> list[float]:
    """Rango percentil (0–1) de cada valor; empates comparten rango. Todo cero → todo cero."""
    if not valores or max(valores) == min(valores):
        return [0.0 for _ in valores]
    orden = sorted(valores)
    n = len(orden) - 1
    posicion: dict[float, float] = {}
    i = 0
    while i < len(orden):
        j = i
        while j + 1 < len(orden) and orden[j + 1] == orden[i]:
            j += 1
        posicion[orden[i]] = ((i + j) / 2) / n
        i = j + 1
    return [round(posicion[v], 4) for v in valores]


_SQL = """
WITH zona AS (SELECT ST_Transform(ST_MakeEnvelope(:w, :s, :e, :n, 4326), 3857) AS g),
celdas AS (
  SELECT row_number() OVER () AS id, h.geom, ST_Centroid(h.geom) AS c
  FROM zona, ST_HexagonGrid(:lado, zona.g) h
  WHERE ST_Intersects(h.geom, zona.g)
),
-- Población Kontur: se reparte solo sobre la parte habitable de cada hexágono de 400 m (dasimétrico).
-- Cada hexágono usa únicamente los polígonos no residenciales que lo tocan (uniones pequeñas y rápidas).
kontur AS MATERIALIZED (
  SELECT p.poblacion, x.hab, ST_Area(x.hab) AS area_hab
  FROM geodata.poblacion_h3 p, zona,
       LATERAL (SELECT ST_Union(u.geom) AS g FROM geodata.usos_suelo u WHERE u.geom && p.geom) nr,
       LATERAL (SELECT CASE WHEN nr.g IS NULL THEN p.geom
                            ELSE COALESCE(NULLIF(ST_Difference(p.geom, nr.g), 'POLYGON EMPTY'::geometry), p.geom) END AS hab) x
  WHERE p.geom && ST_Expand(zona.g, :margen_m)
),
pob AS MATERIALIZED (
  SELECT c.id, c.geom, c.c,
         COALESCE((SELECT sum(k.poblacion * ST_Area(ST_Intersection(c.geom, k.hab)) / NULLIF(k.area_hab, 0))
                   FROM kontur k WHERE k.hab && c.geom), 0) AS pob,
         COALESCE((SELECT ST_Area(ST_Intersection(c.geom, ST_Union(u.geom)))
                   FROM geodata.usos_suelo u WHERE u.geom && c.geom), 0) / ST_Area(c.geom) AS no_residencial,
         (SELECT u.tipo FROM geodata.usos_suelo u WHERE u.geom && c.geom
          ORDER BY ST_Area(ST_Intersection(u.geom, c.geom)) DESC LIMIT 1) AS uso_principal
  FROM celdas c
),
pesos(sub, comp, iman) AS (SELECT * FROM jsonb_to_recordset(CAST(:pesos AS jsonb)) AS x(sub text, comp real, iman real)),
puntos AS (
  SELECT l.osm_id, ST_Transform(l.geom, 3857) AS g, max(p.comp) AS comp, max(p.iman) AS iman
  FROM geodata.lugares l
  JOIN pesos p ON p.sub = ANY(l.subcategorias)
  WHERE l.geom && ST_Expand(ST_MakeEnvelope(:w, :s, :e, :n, 4326), :margen_grados)
  GROUP BY l.osm_id, l.geom
)
SELECT p.id, ST_AsGeoJSON(ST_Transform(p.geom, 4326), 6)::json AS geometria,
       ST_X(ST_Transform(p.c, 4326)) AS lon, ST_Y(ST_Transform(p.c, 4326)) AS lat,
       p.pob AS pob_local, p.no_residencial, p.uso_principal,
       (SELECT COALESCE(sum(q.pob), 0) FROM pob q WHERE ST_DWithin(q.c, p.c, :radio)) AS demanda,
       (SELECT COALESCE(sum(t.comp), 0) FROM puntos t WHERE t.comp > 0 AND ST_DWithin(t.g, p.c, :radio)) AS competencia,
       (SELECT COALESCE(sum(t.iman), 0) FROM puntos t WHERE t.iman > 0 AND ST_DWithin(t.g, p.c, :radio)) AS imanes,
       (SELECT min(ST_Distance(t.g, p.c)) FROM puntos t WHERE t.comp >= 1) AS competidor_cercano
FROM pob p
"""

_SQL_PUNTOS = """
SELECT l.nombre, l.subcategoria, ST_X(l.geom) AS lon, ST_Y(l.geom) AS lat,
       EXISTS (SELECT 1 FROM jsonb_to_recordset(CAST(:pesos AS jsonb)) AS x(sub text, comp real, iman real)
               WHERE x.sub = ANY(l.subcategorias) AND x.comp >= 1) AS competidor
FROM geodata.lugares l
WHERE l.geom && ST_Expand(ST_MakeEnvelope(:w, :s, :e, :n, 4326), :margen_grados)
  AND l.subcategorias && CAST(:subs AS text[])
"""


def analizar(db: Connection, rubro_id: str, s: float, w: float, n: float, e: float) -> dict:
    rubro = RUBROS.get(rubro_id)
    if not rubro:
        raise RubroInvalido(rubro_id)
    if area_km2((s, w, n, e)) > AREA_MAXIMA_KM2 * 1.02:
        raise ZonaMuyGrande

    subs = sorted(set(rubro["competencia"]) | set(rubro["imanes"]))
    pesos = [{"sub": x, "comp": rubro["competencia"].get(x, 0), "iman": rubro["imanes"].get(x, 0)} for x in subs]
    params = {"w": w, "s": s, "e": e, "n": n, "lado": LADO_HEXAGONO, "radio": rubro["radio"],
              "margen_m": rubro["radio"] + 500, "margen_grados": rubro["radio"] / 100_000,
              "pesos": json.dumps(pesos), "subs": subs}

    filas = db.execute(text(_SQL), params).mappings().all()
    puntos = db.execute(text(_SQL_PUNTOS), params).mappings().all()

    # Celdas que no se colorean: sin gente ni imanes (mar, cerros) o casi del todo no residenciales y sin vecinos
    # (fábricas, parques); si igual viven ahí ≥ 50 personas, se evalúa (el polígono de OSM puede estar dibujado de más)
    validas = [f for f in filas if (f["pob_local"] >= 5 or f["imanes"] > 0) and (f["no_residencial"] < UMBRAL_NO_RESIDENCIAL or f["pob_local"] >= POBLACION_MINIMA)]
    # Para recomendar, el hexágono debe tener población propia: al menos ¼ de la mediana de la zona
    con_gente = sorted(f["pob_local"] for f in validas if f["pob_local"] >= 5)
    minimo = max(POBLACION_MINIMA, 0.25 * con_gente[len(con_gente) // 2]) if con_gente else POBLACION_MINIMA
    demanda = percentiles([f["demanda"] for f in validas])
    brecha = percentiles([f["demanda"] / (f["competencia"] + 1) for f in validas])
    imanes = percentiles([f["imanes"] for f in validas])
    indicadores = {f["id"]: (d, b, i) for f, d, b, i in zip(validas, demanda, brecha, imanes)}

    hexagonos = []
    for f in filas:
        d, b, i = indicadores.get(f["id"], (None, None, None))
        hexagonos.append({
            "type": "Feature", "geometry": f["geometria"],
            "properties": {
                "id": f["id"], "lon": round(f["lon"], 6), "lat": round(f["lat"], 6),
                "valida": f["id"] in indicadores,
                "recomendable": f["id"] in indicadores and f["pob_local"] >= minimo,
                "no_residencial": round(f["no_residencial"], 2), "uso_principal": f["uso_principal"],
                "poblacion": round(f["pob_local"]), "demanda": round(f["demanda"]),
                "competencia": round(f["competencia"], 2), "imanes": round(f["imanes"], 2),
                "competidor_cercano": round(f["competidor_cercano"]) if f["competidor_cercano"] is not None else None,
                "i_demanda": d, "i_brecha": b, "i_imanes": i,
            },
        })

    # Resumen de la zona (solo lo que cae dentro del rectángulo)
    poblacion_zona = sum(f["pob_local"] for f in filas)
    competidores = [p for p in puntos if p["competidor"] and w <= p["lon"] <= e and s <= p["lat"] <= n]
    sugeridos = poblacion_zona / rubro["estandar"]
    return {
        "rubro": {"id": rubro_id, **{k: rubro[k] for k in ("nombre", "icono", "radio", "estandar")},
                  "minutos": round(rubro["radio"] / VELOCIDAD_A_PIE)},
        "resumen": {
            "area_km2": round(area_km2((s, w, n, e)), 2),
            "poblacion": round(poblacion_zona),
            "competidores": len(competidores),
            "habitantes_por_establecimiento": round(poblacion_zona / len(competidores)) if competidores else None,
            "establecimientos_sugeridos": round(sugeridos),
            "brecha": round(sugeridos - len(competidores)),
        },
        "zona": [w, s, e, n],
        "hexagonos": {"type": "FeatureCollection", "features": hexagonos},
        "puntos": [{"nombre": p["nombre"], "subcategoria": p["subcategoria"], "lon": p["lon"], "lat": p["lat"],
                    "competidor": p["competidor"]} for p in puntos],
    }


# ---------- ¿Qué negocio falta aquí? ----------

_SQL_PERFIL = """
WITH zona AS (SELECT ST_MakeEnvelope(:w, :s, :e, :n, 4326) AS g)
SELECT x.sub, count(*) AS cantidad
FROM geodata.lugares l, zona, unnest(l.subcategorias) AS x(sub)
WHERE l.geom && zona.g AND x.sub <> 'otro'
GROUP BY x.sub
"""

_SQL_POBLACION_ZONA = """
WITH zona AS (SELECT ST_Transform(ST_MakeEnvelope(:w, :s, :e, :n, 4326), 3857) AS g)
SELECT COALESCE(sum(p.poblacion * ST_Area(ST_Intersection(p.geom, zona.g)) / ST_Area(p.geom)), 0)
FROM geodata.poblacion_h3 p, zona WHERE p.geom && zona.g
"""


def estado_cobertura(cobertura: float | None) -> str:
    """Negocios registrados / esperados según el entorno."""
    if cobertura is None:
        return "poca_poblacion"
    if cobertura < 0.6:
        return "falta"
    return "equilibrio" if cobertura <= 1.3 else "saturado"


def esperados_rubro(competidores_entorno: int, poblacion: float, poblacion_entorno: float,
                    total: int, total_entorno: int) -> tuple[float, str]:
    """Negocios del rubro que tendría la zona según su entorno, con la más exigente de dos referencias:
      - «poblacion»: la misma cantidad por habitante (sirve en barrios residenciales),
      - «mezcla»: la misma proporción dentro del comercio de la zona (sirve en zonas comerciales, donde
        todo sobra por habitante pero igual puede faltar un rubro entre tantos negocios).
    """
    por_poblacion = poblacion * competidores_entorno / poblacion_entorno if poblacion_entorno else 0
    por_mezcla = total * competidores_entorno / total_entorno if total_entorno else 0
    return (por_mezcla, "mezcla") if por_mezcla > por_poblacion else (por_poblacion, "poblacion")


def perfil_zona(db: Connection, s: float, w: float, n: float, e: float) -> dict:
    """Ranking de rubros: negocios por habitante de la zona comparados con los de su entorno, y perfil comercial.

    Se compara con el entorno (la zona más ~5 km alrededor) y no con un estándar fijo: así se toma la costumbre
    de la ciudad y el subregistro de OpenStreetMap (pocas bodegas registradas, por ejemplo) se cancela.
    """
    if area_km2((s, w, n, e)) > AREA_MAXIMA_KM2 * 1.02:
        raise ZonaMuyGrande
    params = {"w": w, "s": s, "e": e, "n": n}
    m = MARGEN_ENTORNO
    entorno = {"w": w - m, "s": s - m, "e": e + m, "n": n + m}
    conteo = {f["sub"]: f["cantidad"] for f in db.execute(text(_SQL_PERFIL), params).mappings()}
    conteo_ent = {f["sub"]: f["cantidad"] for f in db.execute(text(_SQL_PERFIL), entorno).mappings()}
    poblacion = float(db.execute(text(_SQL_POBLACION_ZONA), params).scalar() or 0)
    poblacion_ent = float(db.execute(text(_SQL_POBLACION_ZONA), entorno).scalar() or 0)

    total = sum(conteo.values())
    total_ent = sum(conteo_ent.values())
    rubros = []
    for rid, r in RUBROS.items():
        directo = next(sub for sub, peso in r["competencia"].items() if peso >= 1)
        competidores = conteo.get(directo, 0)
        imanes = sum(conteo.get(sub, 0) * peso for sub, peso in r["imanes"].items())
        esperados, referencia = esperados_rubro(competidores_entorno=conteo_ent.get(directo, 0), poblacion=poblacion,
                                                poblacion_entorno=poblacion_ent, total=total, total_entorno=total_ent)
        # Con menos de uno esperado la zona es chica para el rubro (o el entorno no tiene): no se compara
        cobertura = competidores / esperados if esperados >= 1 else None
        rubros.append({
            "id": rid, "nombre": r["nombre"], "grupo": r["grupo"], "icono": r["icono"],
            "competidores": competidores, "esperados": round(esperados, 1), "referencia": referencia,
            "brecha": round(esperados - competidores),
            "cobertura": round(cobertura, 2) if cobertura is not None else None,
            "habitantes_por_establecimiento": round(poblacion / competidores) if competidores else None,
            "estandar": r["estandar"], "imanes": round(imanes, 1), "estado": estado_cobertura(cobertura),
        })
    # Primero lo que más falta (menor cobertura); a igual cobertura, más imanes
    rubros.sort(key=lambda x: (x["cobertura"] is None, x["cobertura"] or 0, -x["imanes"]))

    return {
        "area_km2": round(area_km2((s, w, n, e)), 2), "poblacion": round(poblacion),
        "negocios": total, "negocios_por_mil": round(total / poblacion * 1000, 1) if poblacion else None,
        "negocios_por_mil_entorno": round(total_ent / poblacion_ent * 1000, 1) if poblacion_ent else None,
        "rubros": rubros,
        "perfil": [{"subcategoria": k, "cantidad": v} for k, v in sorted(conteo.items(), key=lambda x: -x[1])[:15]],
        "zona": [w, s, e, n],
    }


# ---------- Evaluar un punto ----------

_SQL_ANILLOS = """
WITH pt AS (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857) AS g),
kontur AS MATERIALIZED (
  SELECT p.poblacion, x.hab, ST_Area(x.hab) AS area_hab
  FROM geodata.poblacion_h3 p, pt,
       LATERAL (SELECT ST_Union(u.geom) AS g FROM geodata.usos_suelo u WHERE u.geom && p.geom) nr,
       LATERAL (SELECT CASE WHEN nr.g IS NULL THEN p.geom
                            ELSE COALESCE(NULLIF(ST_Difference(p.geom, nr.g), 'POLYGON EMPTY'::geometry), p.geom) END AS hab) x
  WHERE p.geom && ST_Expand(pt.g, :rmax * :k + 500)
)
SELECT r.radio,
       COALESCE((SELECT sum(k.poblacion * ST_Area(ST_Intersection(ST_Buffer(pt.g, r.radio * :k, 32), k.hab)) / NULLIF(k.area_hab, 0))
                 FROM kontur k WHERE ST_DWithin(k.hab, pt.g, r.radio * :k)), 0) AS poblacion
FROM pt, unnest(CAST(:radios AS int[])) AS r(radio)
"""

_SQL_CERCANOS = """
WITH pt AS (SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) AS g)
SELECT l.nombre, l.subcategoria, l.subcategorias, ST_X(l.geom) AS lon, ST_Y(l.geom) AS lat,
       ST_Distance(l.geom::geography, pt.g::geography) AS distancia
FROM geodata.lugares l, pt
WHERE l.geom && ST_Expand(pt.g, :rmax / 100000.0) AND l.subcategorias && CAST(:subs AS text[])
  AND ST_DWithin(l.geom::geography, pt.g::geography, :rmax)
"""

_SQL_USO_PUNTO = """
SELECT u.tipo FROM geodata.usos_suelo u
WHERE ST_Intersects(u.geom, ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 3857))
ORDER BY ST_Area(u.geom) LIMIT 1
"""


def veredicto(habitantes_por_competidor: float, estandar: float) -> str:
    """Qué tan holgado está el mercado del rubro alrededor del punto."""
    razon = habitantes_por_competidor / estandar
    if razon >= 1.5:
        return "favorable"
    return "moderado" if razon >= 0.7 else "dificil"


def evaluar_punto(db: Connection, rubro_id: str, lon: float, lat: float) -> dict:
    """Ficha de un local candidato: población por minutos a pie, competencia e imanes alrededor."""
    rubro = RUBROS.get(rubro_id)
    if not rubro:
        raise RubroInvalido(rubro_id)
    radios = sorted({m * VELOCIDAD_A_PIE for m in ANILLOS_MINUTOS} | {rubro["radio"]})
    rmax = radios[-1]
    # En Web Mercator las distancias se estiran por 1/cos(latitud)
    params = {"lon": lon, "lat": lat, "radios": radios, "rmax": rmax, "k": 1 / math.cos(math.radians(lat)),
              "subs": sorted(set(rubro["competencia"]) | set(rubro["imanes"]))}
    poblacion = {f["radio"]: float(f["poblacion"]) for f in db.execute(text(_SQL_ANILLOS), params).mappings()}
    cercanos = db.execute(text(_SQL_CERCANOS), params).mappings().all()
    uso = db.execute(text(_SQL_USO_PUNTO), params).scalar()

    def peso_comp(subs: list[str]) -> float:
        return max((rubro["competencia"].get(x, 0) for x in subs), default=0)

    competidores = sorted((c for c in cercanos if peso_comp(c["subcategorias"]) >= 1), key=lambda c: c["distancia"])
    en_radio = [c for c in cercanos if c["distancia"] <= rubro["radio"]]
    competencia = sum(peso_comp(c["subcategorias"]) for c in en_radio)
    imanes: dict[str, int] = {}
    for c in en_radio:
        if peso_comp(c["subcategorias"]) >= 1:
            continue
        for x in c["subcategorias"]:
            if x in rubro["imanes"]:
                imanes[x] = imanes.get(x, 0) + 1
    pob_radio = poblacion.get(rubro["radio"], 0)
    hab_por_comp = pob_radio / (competencia + 1)

    return {
        "rubro": {"id": rubro_id, "nombre": rubro["nombre"], "radio": rubro["radio"], "estandar": rubro["estandar"],
                  "minutos": round(rubro["radio"] / VELOCIDAD_A_PIE)},
        "punto": {"lon": lon, "lat": lat},
        "uso_suelo": uso,
        "anillos": [{"minutos": m, "radio": m * VELOCIDAD_A_PIE, "poblacion": round(poblacion.get(m * VELOCIDAD_A_PIE, 0)),
                     "competidores": sum(1 for c in competidores if c["distancia"] <= m * VELOCIDAD_A_PIE)}
                    for m in ANILLOS_MINUTOS],
        "poblacion_radio": round(pob_radio),
        "competencia_radio": round(competencia, 2),
        "habitantes_por_competidor": round(hab_por_comp),
        "veredicto": veredicto(hab_por_comp, rubro["estandar"]),
        "competidor_cercano": round(competidores[0]["distancia"]) if competidores else None,
        "competidores": [{"nombre": c["nombre"], "subcategoria": c["subcategoria"], "lon": c["lon"], "lat": c["lat"],
                          "distancia": round(c["distancia"])} for c in competidores[:8]],
        "imanes": [{"subcategoria": k, "cantidad": v} for k, v in sorted(imanes.items(), key=lambda x: -x[1])],
    }
