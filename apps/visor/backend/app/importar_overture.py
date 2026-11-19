"""Importa los lugares de Overture Maps Places del Perú (complemento de OpenStreetMap).

    docker compose exec visor-api python -m app.importar_overture --archivo /tmp/peru_places.parquet

El archivo se genera con DuckDB desde el bucket público de Overture (ver apps/visor/README.md).
Los lugares que ya existen en OpenStreetMap se marcan como duplicados y no se muestran.
"""
import argparse
import re
import time

import duckdb
from psycopg.types.json import Jsonb
from sqlalchemy import text

from .db.migrate import aplicar_migraciones
from .db.session import engine
from .importar_osm import DISTANCIA_REFERENCIA
from .services.datos_lugares import marcar_duplicados, recrear_vista
from .services.lugares import sin_tildes
from .services.overture import subcategorias_overture


NOMBRE_INVALIDO = re.compile(r"[\d\s\-+().#/]+")


def limpio(valor: str | None) -> str | None:
    return valor.replace(chr(0), "").strip() or None if valor else None


def filas(archivo: str):
    c = duckdb.connect()
    consulta = c.execute(f"""
        SELECT id, nombre, categoria, alternativas, lon, lat, direccion, telefono, web, marca
        FROM read_parquet('{archivo}') WHERE lon IS NOT NULL AND lat IS NOT NULL
    """)
    while lote := consulta.fetchmany(20_000):
        for id_, nombre, categoria, alternativas, lon, lat, direccion, telefono, web, marca in lote:
            # Algunos textos de Overture traen caracteres nulos: PostgreSQL no los acepta
            nombre, direccion, telefono, web, marca = (limpio(v) for v in (nombre, direccion, telefono, web, marca))
            if nombre and NOMBRE_INVALIDO.fullmatch(nombre):
                nombre = None  # «10030484987532»: un código o teléfono, no un nombre
            subs = subcategorias_overture(categoria, alternativas)
            if not subs:
                if not nombre:
                    continue
                subs = ["otro"]
            tags = {k: v for k, v in {"name": nombre, "addr:full": direccion, "phone": telefono, "website": web,
                                      "brand": marca, "overture:categoria": categoria}.items() if v}
            yield (f"overture/{id_}", nombre, sin_tildes(nombre) if nombre else None, subs[0], subs, Jsonb(tags),
                   f"SRID=4326;POINT({lon:.7f} {lat:.7f})")


def main():
    parser = argparse.ArgumentParser(prog="app.importar_overture", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archivo", required=True, help="GeoParquet de lugares de Overture del Perú")
    parser.add_argument("--version", default="", help="Versión de Overture (ej. 2026-10-21.0)")
    args = parser.parse_args()

    aplicar_migraciones(engine)
    inicio = time.monotonic()
    with engine.begin() as db:
        db.execute(text("DROP TABLE IF EXISTS geodata.lugares_overture_nueva"))
        db.execute(text("CREATE TABLE geodata.lugares_overture_nueva (LIKE geodata.lugares_overture INCLUDING DEFAULTS)"))

    total = 0
    crudo = engine.raw_connection()
    try:
        with crudo.cursor() as cur, cur.copy(
            "COPY geodata.lugares_overture_nueva (osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom) FROM STDIN"
        ) as copia:
            for fila in filas(args.archivo):
                copia.write_row(fila)
                total += 1
        crudo.commit()
    finally:
        crudo.close()
    print(f"  {total:,} lugares leídos. Creando índices y direcciones referenciales …", flush=True)

    with engine.begin() as db:
        db.execute(text("ALTER TABLE geodata.lugares_overture_nueva ADD CONSTRAINT lugares_overture_nueva_pkey PRIMARY KEY (osm_id)"))
        db.execute(text("CREATE INDEX lugares_overture_nueva_geom ON geodata.lugares_overture_nueva USING gist (geom)"))
        db.execute(text("ANALYZE geodata.lugares_overture_nueva"))
        db.execute(text("""
            UPDATE geodata.lugares_overture_nueva l SET direccion_ref = (
              SELECT v.nombre FROM geodata.vias_osm v
              WHERE ST_DWithin(v.geom, l.geom, :dist) ORDER BY v.geom <-> l.geom LIMIT 1)
            WHERE NOT (l.tags ? 'addr:full')
        """), {"dist": DISTANCIA_REFERENCIA})
        db.execute(text("CREATE INDEX lugares_overture_nueva_subcategorias ON geodata.lugares_overture_nueva USING gin (subcategorias)"))
        # Intercambio en una sola transacción
        db.execute(text("DROP VIEW IF EXISTS geodata.lugares"))
        db.execute(text("DROP TABLE geodata.lugares_overture"))
        db.execute(text("ALTER TABLE geodata.lugares_overture_nueva RENAME TO lugares_overture"))
        for sufijo in ("pkey", "geom", "subcategorias"):
            db.execute(text(f"ALTER INDEX geodata.lugares_overture_nueva_{sufijo} RENAME TO lugares_overture_{sufijo}"))
        print("  Detectando duplicados con OpenStreetMap …", flush=True)
        duplicados = marcar_duplicados(db)
        recrear_vista(db)
        version = args.version or (re.search(r"\d{4}-\d{2}-\d{2}\.\d", args.archivo) or [""])[0]
        db.execute(text("""
            INSERT INTO geodata.lugares_overture_meta (id, version, importado_en, total, duplicados)
            VALUES (1, :v, now(), :t, :d)
            ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, importado_en = now(),
              total = EXCLUDED.total, duplicados = EXCLUDED.duplicados
        """), {"v": version or "desconocida", "t": total, "d": duplicados})
    print(f"Listo: {total:,} lugares de Overture ({duplicados:,} ya estaban en OpenStreetMap) "
          f"en {time.monotonic() - inicio:.0f} s.", flush=True)


if __name__ == "__main__":
    main()
