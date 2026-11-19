"""Importa los lugares de interés de OpenStreetMap del Perú a la base local.

    docker compose exec visor-api python -m app.importar_osm            # descarga el extracto y lo importa
    docker compose exec visor-api python -m app.importar_osm --archivo /ruta/peru.osm.pbf

Fuente: extracto de Geofabrik (se actualiza a diario, ~260 MB). Conviene repetirlo cada semana.
Se carga en una tabla nueva y al final se intercambia, así el visor sigue respondiendo durante la importación.
"""
import argparse
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx
import osmium
from psycopg.types.json import Jsonb
from sqlalchemy import text

from .core.config import settings
from .db.migrate import aplicar_migraciones
from .db.session import engine
from .services.datos_lugares import marcar_duplicados, recrear_vista
from .services.lugares import CLAVES_OSM, SUBCATEGORIAS, posible_lugar, sin_tildes, subcategorias_de

# Etiquetas que, con nombre, hacen de un elemento sin categoría un lugar buscable por nombre
LUGAR_GENERICO = {"amenity", "shop", "tourism", "leisure", "office", "healthcare", "historic", "craft"}


def descargar(url: str, destino: str, intentos: int = 5) -> datetime | None:
    """Descarga con reintentos: si la conexión se corta, continúa desde el último byte recibido."""
    print(f"Descargando {url} …", flush=True)
    if os.path.exists(destino):
        os.remove(destino)
    modificado = None
    for intento in range(1, intentos + 1):
        hecho = os.path.getsize(destino) if os.path.exists(destino) else 0
        cabeceras = {"Range": f"bytes={hecho}-"} if hecho else {}
        try:
            with httpx.stream("GET", url, headers=cabeceras, follow_redirects=True,
                              timeout=httpx.Timeout(30, read=300)) as r:
                if r.status_code == 416:  # ya estaba completo
                    break
                r.raise_for_status()
                if hecho and r.status_code != 206:  # el servidor no admite continuar: desde cero
                    hecho = 0
                total = hecho + int(r.headers.get("content-length", 0))
                modificado = r.headers.get("last-modified") or modificado
                avance = hecho * 10 // total if total else 0
                with open(destino, "ab" if hecho else "wb") as f:
                    for bloque in r.iter_bytes(1 << 20):
                        f.write(bloque)
                        hecho += len(bloque)
                        if total and hecho * 10 // total > avance:
                            avance = hecho * 10 // total
                            print(f"  {avance * 10}% ({hecho / 1e6:.0f} MB)", flush=True)
            break
        except httpx.HTTPError as ex:
            if intento == intentos:
                raise
            print(f"  conexión interrumpida ({type(ex).__name__}); reintento {intento + 1} de {intentos} …", flush=True)
            time.sleep(5 * intento)
    return parsedate_to_datetime(modificado) if modificado else None


# Etiquetas muy abundantes (millones de edificaciones y vías): solo interesan algunos valores exactos,
# así que se filtran por pares clave=valor en C++ en una segunda pasada.
CLAVES_MASIVAS = {"building", "highway", "place", "natural", "man_made", "railway", "aeroway"}


def _pares_masivos() -> list[tuple[str, str]]:
    pares = set()
    for s in SUBCATEGORIAS.values():
        for f in s["filtros"]:
            for clave, regex in f.items():
                if clave in CLAVES_MASIVAS:
                    pares.update((clave, v) for v in re.fullmatch(r"\^\((.+)\)\$", regex).group(1).split("|"))
    return sorted(pares)


def _recorrer(ruta: str, filtro, vistos: set[str]):
    indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
    procesador = osmium.FileProcessor(ruta).with_locations(f"sparse_file_array,{indice}").with_filter(filtro)
    for obj in procesador:
        if obj.is_node():
            if not obj.location.valid():
                continue
            lon, lat, osm_id = obj.location.lon, obj.location.lat, f"node/{obj.id}"
        elif obj.is_way():
            puntos = [(n.lon, n.lat) for n in obj.nodes if n.location.valid()]
            if not puntos:
                continue
            lon, lat = sum(p[0] for p in puntos) / len(puntos), sum(p[1] for p in puntos) / len(puntos)
            osm_id = f"way/{obj.id}"
        else:
            continue
        if osm_id in vistos:
            continue
        fila = _fila(osm_id, {t.k: t.v for t in obj.tags}, lon, lat)
        if fila:
            vistos.add(osm_id)
            yield fila


def _fila(osm_id: str, tags: dict, lon: float, lat: float):
    """Fila para la tabla, o None si el elemento no es un lugar de interés."""
    nombre = tags.get("name") or tags.get("brand")
    if not posible_lugar(tags) and not (nombre and LUGAR_GENERICO & tags.keys()):
        return None  # descarte rápido
    subs = subcategorias_de(tags)
    if not subs:
        if not nombre or not LUGAR_GENERICO & tags.keys():
            return None
        subs = ["otro"]
    return (osm_id, nombre, sin_tildes(nombre) if nombre else None, subs[0], subs, Jsonb(tags),
            f"SRID=4326;POINT({lon:.7f} {lat:.7f})")


def _relaciones(ruta: str, vistos: set[str]):
    """Lugares dibujados como relación (multipolígonos: hospitales, universidades, parques grandes…).
    Se arma el polígono y se usa el promedio de los vértices de sus anillos exteriores."""
    indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
    procesador = (osmium.FileProcessor(ruta)
                  .with_locations(f"sparse_file_array,{indice}")
                  .with_areas(osmium.filter.KeyFilter(*(set(CLAVES_OSM) - CLAVES_MASIVAS)))
                  .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)))
    for area in procesador:
        if area.from_way():
            continue  # las vías cerradas ya se importaron en la pasada 1
        osm_id = f"relation/{area.orig_id()}"
        puntos = [(n.lon, n.lat) for anillo in area.outer_rings() for n in anillo if n.location.valid()]
        if osm_id in vistos or not puntos:
            continue
        fila = _fila(osm_id, {t.k: t.v for t in area.tags},
                     sum(p[0] for p in puntos) / len(puntos), sum(p[1] for p in puntos) / len(puntos))
        if fila:
            vistos.add(osm_id)
            yield fila


def filas(ruta: str):
    """Recorre el archivo (tres pasadas) y devuelve una fila por cada lugar de interés."""
    vistos: set[str] = set()
    print("  Pasada 1: amenity, shop, tourism, leisure, office…", flush=True)
    yield from _recorrer(ruta, osmium.filter.KeyFilter(*(set(CLAVES_OSM) - CLAVES_MASIVAS)), vistos)
    print(f"  {len(vistos):,} lugares. Pasada 2: paraderos, estaciones, edificios con nombre…", flush=True)
    yield from _recorrer(ruta, osmium.filter.TagFilter(*_pares_masivos()), vistos)
    print(f"  {len(vistos):,} lugares. Pasada 3: lugares dibujados como relación (multipolígonos)…", flush=True)
    yield from _relaciones(ruta, vistos)


CLASES_VIA = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
              "living_street", "service", "pedestrian", "road", "motorway_link", "trunk_link", "primary_link",
              "secondary_link", "tertiary_link"}
DISTANCIA_REFERENCIA = 0.0015  # grados (≈ 165 m): más lejos no se considera «cerca de»


def vias(ruta: str):
    """Calles con nombre (para la dirección referencial)."""
    indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
    procesador = (osmium.FileProcessor(ruta)
                  .with_locations(f"sparse_file_array,{indice}")
                  .with_filter(osmium.filter.EntityFilter(osmium.osm.WAY))
                  .with_filter(osmium.filter.KeyFilter("highway")))
    for via in procesador:
        nombre = via.tags.get("name")
        clase = via.tags.get("highway")
        if not nombre or clase not in CLASES_VIA:
            continue
        puntos = [f"{n.lon:.7f} {n.lat:.7f}" for n in via.nodes if n.location.valid()]
        if len(puntos) < 2:
            continue
        yield (f"way/{via.id}", nombre, clase, f"SRID=4326;LINESTRING({','.join(puntos)})")


def _copiar(sql: str, filas_iter) -> int:
    total = 0
    crudo = engine.raw_connection()
    try:
        with crudo.cursor() as cur, cur.copy(sql) as copia:
            for fila in filas_iter:
                copia.write_row(fila)
                total += 1
        crudo.commit()
    finally:
        crudo.close()
    return total


def importar(ruta: str, fecha_datos: datetime | None) -> int:
    inicio = time.monotonic()
    with engine.begin() as db:
        for tabla in ("lugares_osm", "vias_osm"):
            db.execute(text(f"DROP TABLE IF EXISTS geodata.{tabla}_nueva"))
            db.execute(text(f"CREATE TABLE geodata.{tabla}_nueva (LIKE geodata.{tabla} INCLUDING DEFAULTS)"))

    print("Leyendo y clasificando lugares …", flush=True)
    total = _copiar("COPY geodata.lugares_osm_nueva (osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom) FROM STDIN",
                    filas(ruta))
    print(f"  {total:,} lugares cargados. Leyendo calles con nombre …", flush=True)
    total_vias = _copiar("COPY geodata.vias_osm_nueva (osm_id, nombre, clase, geom) FROM STDIN", vias(ruta))
    print(f"  {total_vias:,} calles. Calculando direcciones referenciales …", flush=True)

    with engine.begin() as db:
        db.execute(text("ALTER TABLE geodata.vias_osm_nueva ADD CONSTRAINT vias_osm_nueva_pkey PRIMARY KEY (osm_id)"))
        db.execute(text("CREATE INDEX vias_osm_nueva_geom ON geodata.vias_osm_nueva USING gist (geom)"))
        db.execute(text("ALTER TABLE geodata.lugares_osm_nueva ADD CONSTRAINT lugares_osm_nueva_pkey PRIMARY KEY (osm_id)"))
        db.execute(text("CREATE INDEX lugares_osm_nueva_geom ON geodata.lugares_osm_nueva USING gist (geom)"))
        db.execute(text("ANALYZE geodata.vias_osm_nueva"))
        # Para cada lugar sin calle registrada: la calle con nombre más cercana (búsqueda por índice espacial)
        referenciados = db.execute(text("""
            UPDATE geodata.lugares_osm_nueva l SET direccion_ref = (
              SELECT v.nombre FROM geodata.vias_osm_nueva v
              WHERE ST_DWithin(v.geom, l.geom, :dist)
              ORDER BY v.geom <-> l.geom LIMIT 1)
            WHERE NOT (l.tags ? 'addr:street')
        """), {"dist": DISTANCIA_REFERENCIA}).rowcount
        print(f"  {referenciados:,} lugares revisados para dirección referencial. Creando índices …", flush=True)
        db.execute(text("CREATE INDEX lugares_osm_nueva_subcategorias ON geodata.lugares_osm_nueva USING gin (subcategorias)"))
        db.execute(text("ANALYZE geodata.lugares_osm_nueva"))
        # Intercambio: en una sola transacción, el visor nunca ve las tablas a medias
        db.execute(text("DROP VIEW IF EXISTS geodata.lugares"))
        for tabla, indices in (("lugares_osm", ("pkey", "geom", "subcategorias")), ("vias_osm", ("pkey", "geom"))):
            db.execute(text(f"DROP TABLE geodata.{tabla}"))
            db.execute(text(f"ALTER TABLE geodata.{tabla}_nueva RENAME TO {tabla}"))
            for sufijo in indices:
                db.execute(text(f"ALTER INDEX geodata.{tabla}_nueva_{sufijo} RENAME TO {tabla}_{sufijo}"))
        recrear_vista(db)
        marcar_duplicados(db)  # OpenStreetMap cambió: se recalculan los duplicados de Overture
        db.execute(text("""
            INSERT INTO geodata.lugares_osm_meta (id, fuente, fecha_datos, importado_en, total, segundos)
            VALUES (1, :fuente, :fecha, now(), :total, :seg)
            ON CONFLICT (id) DO UPDATE SET fuente = EXCLUDED.fuente, fecha_datos = EXCLUDED.fecha_datos,
              importado_en = now(), total = EXCLUDED.total, segundos = EXCLUDED.segundos
        """), {"fuente": settings.osm_extracto_url, "fecha": fecha_datos, "total": total,
               "seg": round(time.monotonic() - inicio, 1)})
    return total


# Usos de suelo no residenciales (clave → valores): ahí no vive gente
NO_RESIDENCIAL = {
    "landuse": {"industrial", "railway", "military", "cemetery", "quarry", "landfill", "port", "depot",
                "garages", "brownfield", "construction", "recreation_ground", "airport"},
    "leisure": {"park", "golf_course", "stadium", "sports_centre", "pitch", "nature_reserve"},
    "amenity": {"grave_yard", "university", "college", "school", "hospital", "prison", "parking"},
    "aeroway": {"aerodrome"},
    "natural": {"water", "wetland", "beach"},
    "building": {"warehouse", "industrial", "hangar"},
    "man_made": {"works", "wastewater_plant"},
}


def importar_usos_suelo(ruta: str) -> int:
    """Polígonos de usos de suelo no residenciales (para repartir la población solo donde se vive)."""
    indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
    procesador = (osmium.FileProcessor(ruta)
                  .with_locations(f"sparse_file_array,{indice}")
                  .with_areas(osmium.filter.KeyFilter(*NO_RESIDENCIAL))
                  .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)))
    wkb = osmium.geom.WKBFactory()

    def poligonos():
        for area in procesador:
            tipo = next((f"{k}={area.tags[k]}" for k, valores in NO_RESIDENCIAL.items()
                         if area.tags.get(k) in valores), None)
            if not tipo:
                continue
            try:
                geom = wkb.create_multipolygon(area)
            except RuntimeError:
                continue  # polígono roto en OSM
            yield (f"{'way' if area.from_way() else 'relation'}/{area.orig_id()}", tipo, geom)

    with engine.begin() as db:
        db.execute(text("CREATE TEMP TABLE usos_carga (osm_id text, tipo text, wkb text) ON COMMIT DROP"))
        crudo = db.connection.dbapi_connection
        total = 0
        with crudo.cursor() as cur, cur.copy("COPY usos_carga (osm_id, tipo, wkb) FROM STDIN") as copia:
            for fila in poligonos():
                copia.write_row(fila)
                total += 1
        db.execute(text("TRUNCATE geodata.usos_suelo"))
        db.execute(text("""
            INSERT INTO geodata.usos_suelo (osm_id, tipo, geom)
            SELECT osm_id, tipo, ST_Multi(ST_CollectionExtract(ST_MakeValid(
                     ST_Transform(ST_SetSRID(ST_GeomFromWKB(decode(wkb, 'hex')), 4326), 3857)), 3))
            FROM usos_carga
        """))
        db.execute(text("DELETE FROM geodata.usos_suelo WHERE ST_IsEmpty(geom)"))
        db.execute(text("ANALYZE geodata.usos_suelo"))
    return total


def fecha_del_extracto(ruta: str) -> datetime:
    """Fecha de los datos según la cabecera del archivo OSM (si no la trae, la del archivo)."""
    try:
        lector = osmium.io.Reader(ruta, osmium.osm.osm_entity_bits.NOTHING)
        marca = lector.header().get("osmosis_replication_timestamp")
        lector.close()
        if marca:
            return datetime.fromisoformat(marca.replace("Z", "+00:00"))
    except Exception:
        pass
    return datetime.fromtimestamp(os.path.getmtime(ruta), timezone.utc)


def main():
    parser = argparse.ArgumentParser(prog="app.importar_osm", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archivo", help="Usar un .osm.pbf ya descargado en vez de descargarlo")
    parser.add_argument("--solo-usos-suelo", action="store_true", help="Importar solo los usos de suelo no residenciales")
    args = parser.parse_args()

    aplicar_migraciones(engine)
    inicio = time.monotonic()
    if args.archivo:
        ruta, fecha = args.archivo, fecha_del_extracto(args.archivo)
    else:
        ruta = os.path.join(tempfile.gettempdir(), "geohive-osm.pbf")
        fecha = descargar(settings.osm_extracto_url, ruta)
    try:
        if args.solo_usos_suelo:
            n = importar_usos_suelo(ruta)
            print(f"Listo: {n:,} polígonos de uso de suelo no residencial en {time.monotonic() - inicio:.0f} s.", flush=True)
            return
        total = importar(ruta, fecha)
        print("Importando usos de suelo no residenciales …", flush=True)
        importar_usos_suelo(ruta)
    finally:
        # Limpieza: el índice de coordenadas pesa ~2 GB y Docker lo cuenta como memoria del contenedor
        indice = os.path.join(tempfile.gettempdir(), "geohive-nodos.idx")
        for temporal in ([ruta] if not args.archivo else []) + [indice]:
            if os.path.exists(temporal):
                os.remove(temporal)
    print(f"Listo: {total:,} lugares importados en {time.monotonic() - inicio:.0f} s.", flush=True)


if __name__ == "__main__":
    main()
