"""Importa la población estimada del Perú (Kontur Population, hexágonos H3 de ~400 m) a la base.

    docker compose exec visor-api python -m app.importar_poblacion --archivo /tmp/kontur_population_PE_20231101.gpkg

Fuente: https://data.humdata.org/dataset/kontur-population-peru (licencia CC BY 4.0).
"""
import argparse
import re
import sqlite3
import time
from datetime import date

import h3
from pyproj import Transformer
from sqlalchemy import text

from .db.migrate import aplicar_migraciones
from .db.session import engine

A_METROS = Transformer.from_crs(4326, 3857, always_xy=True)


def poligono(celda: str) -> str:
    """Contorno del hexágono H3 en EPSG:3857 (WKT con SRID)."""
    puntos = [A_METROS.transform(lng, lat) for lat, lng in h3.cell_to_boundary(celda)]
    puntos.append(puntos[0])
    return "SRID=3857;POLYGON((" + ",".join(f"{x:.2f} {y:.2f}" for x, y in puntos) + "))"


def main():
    parser = argparse.ArgumentParser(prog="app.importar_poblacion", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archivo", required=True, help="GeoPackage de Kontur Population del Perú")
    args = parser.parse_args()

    aplicar_migraciones(engine)
    inicio = time.monotonic()
    origen = sqlite3.connect(args.archivo)
    tabla = origen.execute("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'").fetchone()[0]
    filas = origen.execute(f'SELECT h3, population FROM "{tabla}" WHERE population > 0')

    with engine.begin() as db:
        db.execute(text("TRUNCATE geodata.poblacion_h3"))
    crudo = engine.raw_connection()
    total, habitantes = 0, 0.0
    try:
        with crudo.cursor() as cur, cur.copy("COPY geodata.poblacion_h3 (h3, poblacion, geom) FROM STDIN") as copia:
            for celda, poblacion in filas:
                copia.write_row((celda, poblacion, poligono(celda)))
                total += 1
                habitantes += poblacion
        crudo.commit()
    finally:
        crudo.close()

    fecha = re.search(r"(\d{4})(\d{2})(\d{2})", args.archivo)
    with engine.begin() as db:
        db.execute(text("ANALYZE geodata.poblacion_h3"))
        db.execute(text("""
            INSERT INTO geodata.poblacion_meta (id, fuente, fecha_datos, importado_en, hexagonos, poblacion)
            VALUES (1, 'Kontur Population (CC BY 4.0)', :fecha, now(), :hex, :pob)
            ON CONFLICT (id) DO UPDATE SET fuente = EXCLUDED.fuente, fecha_datos = EXCLUDED.fecha_datos,
              importado_en = now(), hexagonos = EXCLUDED.hexagonos, poblacion = EXCLUDED.poblacion
        """), {"fecha": date(*map(int, fecha.groups())) if fecha else None, "hex": total, "pob": int(habitantes)})
    print(f"Listo: {total:,} hexágonos, {habitantes:,.0f} habitantes, en {time.monotonic() - inicio:.0f} s.")


if __name__ == "__main__":
    main()
