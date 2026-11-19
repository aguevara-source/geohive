"""Consultas y procesamiento espacial en PostGIS."""
import json

from sqlalchemy import Connection, RowMapping, text

from ..db.session import ident


class CapaNoEncontrada(Exception):
    pass


class GeometriaInvalida(Exception):
    pass


def listar(db: Connection) -> list[RowMapping]:
    return list(db.execute(text("SELECT id, nombre, descripcion FROM capas WHERE activo ORDER BY nombre")).mappings())


def obtener(db: Connection, capa_id: int) -> RowMapping:
    capa = db.execute(text("SELECT * FROM capas WHERE id = :id AND activo"), {"id": capa_id}).mappings().first()
    if not capa:
        raise CapaNoEncontrada(capa_id)
    return capa


def _tabla(capa: RowMapping) -> tuple[str, str, str]:
    """(tabla calificada, columna geom entrecomillada, nombre de la columna geom)"""
    return f"{ident(capa['esquema'])}.{ident(capa['tabla'])}", ident(capa["columna_geom"]), capa["columna_geom"]


def _feature_collection(subconsulta: str, nombre_geom: str) -> str:
    # ST_AsGeoJSON(registro, columna) arma cada Feature con las demás columnas como properties
    return f"""
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(ST_AsGeoJSON(t.*, '{nombre_geom}')::json), '[]'::json)
        )::text
        FROM ({subconsulta}) t
    """


def geojson(db: Connection, capa: RowMapping, bbox: tuple[float, float, float, float] | None, limite: int) -> str:
    tabla, geom, nombre_geom = _tabla(capa)
    params: dict = {"limite": limite}
    filtro = ""
    if bbox:
        params.update(x1=bbox[0], y1=bbox[1], x2=bbox[2], y2=bbox[3])
        filtro = f"WHERE {geom} && ST_MakeEnvelope(:x1, :y1, :x2, :y2, 4326)"
    sql = _feature_collection(f"SELECT * FROM {tabla} {filtro} LIMIT :limite", nombre_geom)
    return db.execute(text(sql), params).scalar_one()


def interseccion(db: Connection, capa: RowMapping, geometria: dict) -> dict:
    """Elementos de la capa que intersectan la geometría dada, y el área de esta en hectáreas."""
    tabla, geom, nombre_geom = _tabla(capa)
    params = {"g": json.dumps(geometria)}
    zona = "ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)"
    try:
        with db.begin_nested():
            area_ha = db.execute(text(f"SELECT ST_Area({zona}::geography) / 10000"), params).scalar_one()
            fc = json.loads(db.execute(
                text(_feature_collection(f"SELECT * FROM {tabla} WHERE ST_Intersects({geom}, {zona})", nombre_geom)),
                params,
            ).scalar_one())
    except Exception as e:  # PostGIS rechaza el GeoJSON
        raise GeometriaInvalida(str(e)) from e
    return {"area_ha": round(area_ha, 4), "total": len(fc["features"]), "resultado": fc}
