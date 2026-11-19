"""Importa las localidades y sitios conocidos del Perú para el buscador nacional del visor.

    docker compose exec visor-api python -m app.importar_localidades --archivo /tmp/peru.osm.pbf

Toma del extracto de OpenStreetMap: límites de departamentos, provincias y distritos; ciudades, pueblos,
centros poblados, caseríos, urbanizaciones; y sitios conocidos (restos arqueológicos, museos, nevados, lagos,
aeropuertos…). Cada lugar guarda su contexto («Chiclayo, Lambayeque») según los límites que lo contienen.
"""
import argparse
import os
import re
import tempfile
import time

import osmium
from sqlalchemy import bindparam, text

from .db.migrate import aplicar_migraciones
from .db.session import engine
from .services.lugares import sin_tildes

# Nivel administrativo OSM en el Perú → (tipo, prioridad al ordenar resultados)
NIVELES = {"4": ("departamento", 1), "6": ("provincia", 3), "8": ("distrito", 4)}

# Valores de place=* → (tipo, prioridad)
LUGARES = {
    "city": ("ciudad", 2), "town": ("pueblo", 5), "village": ("centro poblado", 8), "hamlet": ("caserío", 9),
    "suburb": ("urbanización", 7), "borough": ("urbanización", 7), "quarter": ("barrio", 8),
    "neighbourhood": ("barrio", 9), "locality": ("paraje", 10), "island": ("isla", 6), "square": ("plaza", 7),
}

# Sitios conocidos: (clave, valor) → (tipo, prioridad)
SITIOS = {
    ("historic", "archaeological_site"): ("sitio arqueológico", 6), ("historic", "ruins"): ("sitio arqueológico", 7),
    ("historic", "monument"): ("monumento", 7), ("historic", "castle"): ("monumento", 7),
    ("tourism", "attraction"): ("atractivo turístico", 6), ("tourism", "museum"): ("museo", 7),
    ("tourism", "viewpoint"): ("mirador", 8), ("tourism", "zoo"): ("atractivo turístico", 7),
    ("tourism", "theme_park"): ("atractivo turístico", 7), ("natural", "peak"): ("cerro / nevado", 8),
    ("natural", "volcano"): ("volcán", 6), ("natural", "glacier"): ("nevado", 7), ("natural", "beach"): ("playa", 7),
    ("natural", "bay"): ("bahía", 7), ("water", "lake"): ("laguna / lago", 7), ("aeroway", "aerodrome"): ("aeropuerto", 6),
    ("leisure", "stadium"): ("estadio", 7), ("amenity", "university"): ("universidad", 7),
    ("leisure", "nature_reserve"): ("área natural", 6), ("boundary", "national_park"): ("área natural", 6),
    ("boundary", "protected_area"): ("área natural", 6),
}


# Zonas residenciales con nombre (landuse=residential): el tipo sale del nombre
TIPOS_RESIDENCIALES = [
    (re.compile(r"^(aa\.?\s?hh|a\.\s?h\.|asentamiento humano)\b"), ("asentamiento humano", 8)),
    (re.compile(r"^(urb\b|urbanizacion)"), ("urbanización", 7)),
    (re.compile(r"^(p\.?\s?j\.?\s|pueblo joven)"), ("pueblo joven", 8)),
    (re.compile(r"^(residencial|condominio|conjunto habitacional|conj\.? hab)"), ("residencial", 8)),
    (re.compile(r"^(cooperativa|coop\b)"), ("cooperativa de vivienda", 8)),
    (re.compile(r"^(asociacion|asoc\b|a\.?p\.?v\b)"), ("asociación de vivienda", 8)),
    (re.compile(r"^barrio\b"), ("barrio", 8)),
    (re.compile(r"^sector\b"), ("sector", 9)),
]
ZONA_RESIDENCIAL = ("zona residencial", 9)
# Tipos que pueden ser solo un punto y recibir el polígono con su mismo nombre que los contiene
TIPOS_CON_CONTORNO = ("urbanización", "barrio", "centro poblado", "caserío", "pueblo", "ciudad", "paraje", "plaza",
                      *(clase[0] for _, clase in TIPOS_RESIDENCIALES))


def _residencial(nombre: str, otro: tuple[str, int] = ZONA_RESIDENCIAL) -> tuple[str, int]:
    n = sin_tildes(nombre)
    return next((clase for patron, clase in TIPOS_RESIDENCIALES if patron.match(n)), otro)


def _clasificar(tags) -> tuple[str, int] | None:
    if tags.get("boundary") == "administrative" and tags.get("admin_level") in NIVELES:
        return NIVELES[tags["admin_level"]]
    if tags.get("place") in ("suburb", "borough", "quarter", "neighbourhood"):
        # «Urb. …», «AA.HH. …», «Asociación …»: el nombre dice mejor qué es
        return _residencial(tags["name"], LUGARES[tags["place"]])
    if tags.get("place") in LUGARES:
        return LUGARES[tags["place"]]
    for (k, v), clase in SITIOS.items():
        if tags.get(k) == v:
            return clase
    if tags.get("landuse") == "residential":
        return _residencial(tags["name"])
    return None


def _poblacion(tags) -> int | None:
    valor = (tags.get("population") or "").replace(",", "").replace(".", "").replace(" ", "")
    return int(valor) if valor.isdigit() and int(valor) < 50_000_000 else None


def elementos(ruta: str):
    """(osm_id, nombre, tipo, prioridad, poblacion, punto_wkt, poligono_wkb | None, nivel | None)."""
    indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
    filtro = osmium.filter.TagFilter(
        *[("boundary", "administrative"), ("landuse", "residential"), *(("place", v) for v in LUGARES), *SITIOS.keys()])
    procesador = (osmium.FileProcessor(ruta)
                  .with_locations(f"sparse_file_array,{indice}")
                  .with_areas(filtro)
                  .with_filter(filtro))
    wkb = osmium.geom.WKBFactory()
    for obj in procesador:
        if obj.is_way() or obj.is_relation():
            continue  # vías y relaciones llegan armadas como áreas
        tags = obj.tags
        nombre = tags.get("name")
        clase = nombre and _clasificar(tags)
        if not clase:
            continue
        nivel = tags.get("admin_level") if tags.get("boundary") == "administrative" and tags.get("admin_level") in NIVELES else None
        if obj.is_node():
            if not obj.location.valid() or nivel or tags.get("landuse") == "residential":
                continue
            yield (f"node/{obj.id}", nombre, *clase, _poblacion(tags),
                   f"SRID=4326;POINT({obj.location.lon:.7f} {obj.location.lat:.7f})", None, None)
            continue
        # Área (vía cerrada o multipolígono)
        osm_id = f"{'way' if obj.from_way() else 'relation'}/{obj.orig_id()}"
        try:
            poligono = wkb.create_multipolygon(obj)
        except RuntimeError:
            continue  # polígono roto en OSM
        yield (osm_id, nombre, *clase, _poblacion(tags), None, poligono, int(nivel) if nivel else None)


def importar(ruta: str) -> int:
    with engine.begin() as db:
        db.execute(text("""CREATE TEMP TABLE carga (osm_id text, nombre text, tipo text, prioridad smallint,
                           poblacion integer, punto text, wkb text, nivel smallint) ON COMMIT DROP"""))
        crudo = db.connection.dbapi_connection
        total = 0
        with crudo.cursor() as cur, cur.copy("COPY carga FROM STDIN") as copia:
            for fila in elementos(ruta):
                copia.write_row(fila)
                total += 1
                if total % 20_000 == 0:
                    print(f"  {total:,} elementos …", flush=True)
        print(f"  {total:,} elementos leídos. Armando límites y contexto …", flush=True)

        db.execute(text("TRUNCATE geodata.localidades, geodata.limites_admin RESTART IDENTITY"))
        db.execute(text("""
            ALTER TABLE carga ADD COLUMN geom geometry;
            UPDATE carga SET geom = ST_Multi(ST_CollectionExtract(ST_MakeValid(
                ST_SetSRID(ST_GeomFromWKB(decode(wkb, 'hex')), 4326)), 3)) WHERE wkb IS NOT NULL;
            DELETE FROM carga WHERE wkb IS NOT NULL AND ST_IsEmpty(geom);
            INSERT INTO geodata.limites_admin (osm_id, nombre, nivel, geom)
              SELECT osm_id, nombre, nivel, geom FROM carga WHERE nivel IS NOT NULL;
        """))
        db.execute(text("""
            INSERT INTO geodata.localidades (osm_id, nombre, nombre_norm, tipo, prioridad, poblacion, texto_norm, limite_id, contorno, geom)
            SELECT c.osm_id, c.nombre, '', c.tipo, c.prioridad, c.poblacion, '', la.id,
                   CASE WHEN c.nivel IS NULL THEN c.geom END,
                   CASE WHEN c.punto IS NOT NULL THEN ST_GeomFromEWKT(c.punto) ELSE ST_PointOnSurface(c.geom) END
            FROM carga c LEFT JOIN geodata.limites_admin la ON la.osm_id = c.osm_id AND c.nivel IS NOT NULL
        """))
        # Contexto: distrito, provincia y departamento que contienen cada lugar (polígonos troceados: más rápido)
        db.execute(text("""
            CREATE TEMP TABLE trozos ON COMMIT DROP AS
              SELECT id, nombre, nivel, ST_Subdivide(geom, 200) AS geom FROM geodata.limites_admin;
            CREATE INDEX ON trozos USING gist (geom);
            ANALYZE trozos;
            UPDATE geodata.localidades l SET contexto = x.contexto
            FROM (
              SELECT l2.id, string_agg(t.nombre, ', ' ORDER BY t.nivel DESC) AS contexto
              FROM geodata.localidades l2
              JOIN LATERAL (SELECT DISTINCT ON (tr.nivel) tr.nombre, tr.nivel FROM trozos tr
                            WHERE ST_Intersects(tr.geom, l2.geom) AND tr.id IS DISTINCT FROM l2.limite_id
                              AND tr.nivel < COALESCE((SELECT nivel FROM geodata.limites_admin WHERE id = l2.limite_id), 99)
                            ORDER BY tr.nivel) t ON true
              GROUP BY l2.id
            ) x WHERE x.id = l.id
        """))
        # Sin tildes ni mayúsculas para buscar; la limpieza se hace en Python (igual que el resto del visor)
        filas = db.execute(text("SELECT id, nombre, contexto FROM geodata.localidades")).all()
        db.execute(text("CREATE TEMP TABLE normas (id integer, nombre_norm text, texto_norm text) ON COMMIT DROP"))
        with crudo.cursor() as cur, cur.copy("COPY normas FROM STDIN") as copia:
            for id_, nombre, contexto in filas:
                n = sin_tildes(nombre)
                copia.write_row((id_, n, f"{n} {sin_tildes(contexto)}" if contexto else n))
        db.execute(text("""
            UPDATE geodata.localidades l SET nombre_norm = n.nombre_norm, texto_norm = n.texto_norm
            FROM normas n WHERE n.id = l.id;
            ANALYZE geodata.localidades; ANALYZE geodata.limites_admin;
        """))
        unidos = unir_contornos(db)
        print(f"  {unidos:,} urbanizaciones y localidades (puntos) recibieron el polígono con su nombre.", flush=True)
        db.execute(text("REFRESH MATERIALIZED VIEW geodata.limites_lineas"))
        return len(filas) - unidos


# «Urb. Santa Victoria», «AA.HH. Los Olivos» → «santa victoria», «los olivos» (para comparar nombres)
_NUCLEO = (r"^(urb\.?|urbanizacion|aa\.?\s?hh\.?|asentamiento humano|pueblo joven|p\.?\s?j\.?|"
           r"asociacion( de vivienda)?|asoc\.?|a\.?p\.?v\.?|cooperativa( de vivienda)?|coop\.?|"
           r"residencial|barrio|sector|conjunto habitacional|centro poblado|c\.?\s?p\.?)\s+")


def unir_contornos(db) -> int:
    """Un barrio o urbanización que en OSM es solo un punto toma el polígono que lo contiene si tiene el mismo
    nombre (similitud ≥ 0,6); ese polígono deja de aparecer por separado. Devuelve los polígonos absorbidos."""
    db.execute(text(f"""
        CREATE TEMP TABLE absorbidos ON COMMIT DROP AS
        SELECT DISTINCT ON (p.id) p.id AS punto, z.id AS poligono
        FROM geodata.localidades p
        JOIN geodata.localidades z ON z.contorno IS NOT NULL AND z.id <> p.id
             AND z.contorno && ST_Expand(p.geom, 0.002) AND ST_DWithin(z.contorno, p.geom, 0.002)
        WHERE p.contorno IS NULL AND p.limite_id IS NULL AND p.tipo IN :tipos
          AND similarity(regexp_replace(p.nombre_norm, :nucleo, ''), regexp_replace(z.nombre_norm, :nucleo, '')) >= 0.6
        ORDER BY p.id, similarity(regexp_replace(p.nombre_norm, :nucleo, ''), regexp_replace(z.nombre_norm, :nucleo, '')) DESC,
                 ST_Area(z.contorno)
    """).bindparams(bindparam("tipos", expanding=True)), {"tipos": list(TIPOS_CON_CONTORNO), "nucleo": _NUCLEO})
    db.execute(text("""
        UPDATE geodata.localidades p SET contorno = z.contorno,
          -- el nombre del polígono («Urbanización Marcavalle») también sirve para encontrarlo
          texto_norm = CASE WHEN z.nombre_norm <> p.nombre_norm THEN p.texto_norm || ' ' || z.nombre_norm ELSE p.texto_norm END,
          tipo = CASE WHEN p.tipo IN ('barrio', 'urbanización') AND z.tipo NOT IN ('barrio', 'zona residencial') THEN z.tipo ELSE p.tipo END
        FROM absorbidos a JOIN geodata.localidades z ON z.id = a.poligono WHERE p.id = a.punto
    """))
    return db.execute(text("""
        DELETE FROM geodata.localidades WHERE id IN (SELECT poligono FROM absorbidos)
    """)).rowcount


def main():
    parser = argparse.ArgumentParser(prog="app.importar_localidades", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archivo", required=True, help="Extracto .osm.pbf del Perú (Geofabrik)")
    args = parser.parse_args()
    aplicar_migraciones(engine)
    inicio = time.monotonic()
    try:
        total = importar(args.archivo)
    finally:
        indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
        if os.path.exists(indice):
            os.remove(indice)  # índice de coordenadas: ~2 GB
    print(f"Listo: {total:,} localidades y sitios en {time.monotonic() - inicio:.0f} s.", flush=True)


if __name__ == "__main__":
    main()
