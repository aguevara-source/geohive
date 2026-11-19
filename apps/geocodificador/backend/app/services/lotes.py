"""Geocodificación masiva: el CSV se guarda en la BD y un worker lo procesa en segundo plano."""
import csv
import io
import json
import logging
import threading
import time
from collections.abc import Iterator

from sqlalchemy import Connection, Engine, text

from ..core.config import settings
from ..core.security import Usuario
from . import nominatim

log = logging.getLogger("lotes")
COLUMNA = "direccion"


class CSVInvalido(Exception):
    pass


def leer_csv(contenido: bytes) -> tuple[list[str], list[dict]]:
    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = contenido.decode("latin-1")
    primera = texto.split("\n", 1)[0]
    lector = csv.DictReader(io.StringIO(texto), delimiter=";" if primera.count(";") > primera.count(",") else ",")
    columnas = [c.strip() for c in (lector.fieldnames or [])]
    lector.fieldnames = columnas
    if COLUMNA not in [c.lower() for c in columnas]:
        raise CSVInvalido(f'El CSV debe tener una columna "{COLUMNA}"')
    col = next(c for c in columnas if c.lower() == COLUMNA)
    filas = [f for f in lector if (f.get(col) or "").strip()]
    if not filas:
        raise CSVInvalido("El CSV no tiene filas con dirección")
    if len(filas) > settings.lote_max_filas:
        raise CSVInvalido(f"Máximo {settings.lote_max_filas} filas por archivo")
    return columnas, [{**f, COLUMNA: f[col]} for f in filas]


def crear(db: Connection, usuario: Usuario, nombre_archivo: str, pais: str, contenido: bytes) -> str:
    columnas, filas = leer_csv(contenido)
    lote_id = db.execute(
        text("""INSERT INTO lotes (usuario_id, usuario, nombre_archivo, pais, columnas, total)
                VALUES (:u, :un, :n, :p, CAST(:c AS jsonb), :t) RETURNING id"""),
        {"u": usuario.id, "un": usuario.usuario, "n": nombre_archivo[:255], "p": pais,
         "c": json.dumps(columnas), "t": len(filas)},
    ).scalar_one()
    db.execute(
        text("""INSERT INTO lote_filas (lote_id, n, datos, direccion)
                VALUES (:l, :n, CAST(:d AS jsonb), :dir)"""),
        [{"l": lote_id, "n": i, "d": json.dumps(f, ensure_ascii=False), "dir": f[COLUMNA].strip()}
         for i, f in enumerate(filas, start=1)],
    )
    return str(lote_id)


_CAMPOS_LOTE = "id, nombre_archivo, pais, total, procesados, encontrados, estado, creado_en, terminado_en"


def listar(db: Connection, usuario: Usuario):
    return db.execute(
        text(f"SELECT {_CAMPOS_LOTE} FROM lotes WHERE usuario_id = :u ORDER BY creado_en DESC LIMIT 50"),
        {"u": usuario.id},
    ).mappings().all()


def obtener(db: Connection, usuario: Usuario, lote_id: str):
    """Solo el dueño del lote puede verlo."""
    return db.execute(
        text(f"SELECT {_CAMPOS_LOTE}, columnas FROM lotes WHERE id = CAST(:id AS uuid) AND usuario_id = :u"),
        {"id": lote_id, "u": usuario.id},
    ).mappings().first()


def filas(db: Connection, lote_id: str):
    return db.execute(
        text("SELECT * FROM lote_filas WHERE lote_id = CAST(:id AS uuid) ORDER BY n"), {"id": lote_id}
    ).mappings()


def exportar_csv(db: Connection, lote) -> Iterator[str]:
    columnas = [c for c in lote["columnas"]] + ["lat", "lng", "direccion_encontrada", "estado_geocodificacion"]
    buffer = io.StringIO()
    escritor = csv.writer(buffer)
    buffer.write("﻿")
    escritor.writerow(columnas)
    for f in filas(db, str(lote["id"])):
        escritor.writerow([f["datos"].get(c, "") for c in lote["columnas"]]
                          + [f["lat"] or "", f["lng"] or "", f["direccion_encontrada"] or "", f["estado"]])
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate()
    yield buffer.getvalue()


def exportar_geojson(db: Connection, lote) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [f["lng"], f["lat"]]},
             "properties": {"n": f["n"], "direccion": f["direccion"], "encontrada": f["direccion_encontrada"]}}
            for f in filas(db, str(lote["id"])) if f["estado"] == "ok"
        ],
    }


# ---------------- Worker en segundo plano ----------------

def _procesar_siguiente(engine: Engine) -> bool:
    """Geocodifica una fila pendiente. Devuelve False si no había trabajo."""
    with engine.begin() as db:
        fila = db.execute(text("""
            SELECT f.lote_id, f.n, f.direccion, l.pais
            FROM lote_filas f JOIN lotes l ON l.id = f.lote_id
            WHERE f.estado = 'pendiente'
            ORDER BY l.creado_en, f.n
            LIMIT 1 FOR UPDATE OF f SKIP LOCKED
        """)).mappings().first()
        if not fila:
            return False

        try:
            resultados = nominatim.buscar(db, fila["direccion"], fila["pais"], limite=1)
            r = resultados[0] if resultados else None
            estado = "ok" if r else "sin_resultado"
        except nominatim.ServicioNoDisponible:
            r, estado = None, "error"

        db.execute(
            text("""UPDATE lote_filas SET estado = :e, lat = :lat, lng = :lng, direccion_encontrada = :d
                    WHERE lote_id = :l AND n = :n"""),
            {"e": estado, "lat": r and r["lat"], "lng": r and r["lng"], "d": r and r["direccion"],
             "l": fila["lote_id"], "n": fila["n"]},
        )
        db.execute(
            text("""UPDATE lotes SET
                      procesados = procesados + 1,
                      encontrados = encontrados + :ok,
                      estado = CASE WHEN procesados + 1 >= total THEN 'completado' ELSE 'procesando' END,
                      terminado_en = CASE WHEN procesados + 1 >= total THEN now() END
                    WHERE id = :l"""),
            {"ok": 1 if estado == "ok" else 0, "l": fila["lote_id"]},
        )
    return True


def iniciar_worker(engine: Engine) -> threading.Event:
    detener = threading.Event()

    def bucle():
        while not detener.is_set():
            try:
                if not _procesar_siguiente(engine):
                    detener.wait(2)
            except Exception:
                log.exception("Error en el worker de lotes")
                time.sleep(5)

    threading.Thread(target=bucle, name="worker-lotes", daemon=True).start()
    return detener
