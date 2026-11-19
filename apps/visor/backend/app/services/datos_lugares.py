"""Vista única de lugares (OpenStreetMap + Overture) y detección de duplicados entre fuentes."""
from sqlalchemy import Connection, text

VISTA_LUGARES = """
CREATE OR REPLACE VIEW geodata.lugares AS
  SELECT osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom, direccion_ref, 'osm' AS fuente
  FROM geodata.lugares_osm
  UNION ALL
  SELECT osm_id, nombre, nombre_norm, subcategoria, subcategorias, tags, geom, direccion_ref, 'overture' AS fuente
  FROM geodata.lugares_overture WHERE NOT duplicado
"""

# Un lugar de Overture es duplicado si en OpenStreetMap hay uno a menos de ~60 m con nombre igual o muy parecido
# (o, si alguno no tiene nombre, de la misma subcategoría a menos de ~15 m).
_MARCAR_DUPLICADOS = """
UPDATE geodata.lugares_overture o SET duplicado = EXISTS (
  SELECT 1 FROM geodata.lugares_osm l
  WHERE ST_DWithin(l.geom, o.geom, 0.00055)
    AND ((o.nombre_norm IS NOT NULL AND l.nombre_norm IS NOT NULL AND (
            l.nombre_norm = o.nombre_norm
            OR (length(o.nombre_norm) >= 4 AND length(l.nombre_norm) >= 4
                AND (strpos(l.nombre_norm, o.nombre_norm) > 0 OR strpos(o.nombre_norm, l.nombre_norm) > 0))
            OR levenshtein(left(l.nombre_norm, 100), left(o.nombre_norm, 100)) <= greatest(2, length(o.nombre_norm) / 5)))
      OR (l.subcategorias && o.subcategorias AND ST_DWithin(l.geom, o.geom, 0.00015)
          AND (o.nombre_norm IS NULL OR l.nombre_norm IS NULL)))
)
"""


def recrear_vista(db: Connection) -> None:
    db.execute(text(VISTA_LUGARES))


def marcar_duplicados(db: Connection) -> int:
    """Recalcula los duplicados de Overture frente a OpenStreetMap. Devuelve cuántos hay."""
    db.execute(text(_MARCAR_DUPLICADOS))
    return db.execute(text("SELECT count(*) FROM geodata.lugares_overture WHERE duplicado")).scalar_one()
