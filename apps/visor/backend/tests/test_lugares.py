import re

import pytest

from app.services import lugares


def test_ids_de_subcategorias_y_grupos_no_se_repiten():
    ids_sub = [s["id"] for g in lugares.GRUPOS for s in g["subcategorias"]]
    ids_grupo = [g["id"] for g in lugares.GRUPOS]
    assert len(ids_sub) == len(set(ids_sub))
    assert not set(ids_sub) & set(ids_grupo)
    assert all(p in lugares.SUBCATEGORIAS or p in lugares.GRUPOS_POR_ID for p in lugares.PRINCIPALES)


def test_consulta_overpass_por_subcategoria():
    q = lugares._consulta(lugares.SUBCATEGORIAS["cafeterias"]["filtros"], -12.1, -77.1, -12.0, -77.0)
    assert 'nwr["amenity"~"^(cafe)$"](-12.1,-77.1,-12.0,-77.0);' in q
    assert q.startswith("[out:json]") and "out center tags" in q


def test_patron_nombre_ignora_tildes_y_mayusculas():
    patron = lugares.patron_nombre("Banco de la NACIÓN")
    assert re.search(patron, "banco de la nación")
    assert re.search(patron, "banco de la nacion")


def test_patron_nombre_neutraliza_signos():
    patron = lugares.patron_nombre('a"];out;("')
    sin_clases = re.sub(r"\[[^\]]*\]", "", patron)  # quita las clases de vocales [aáàä]
    assert not set('"];(') & set(sin_clases)


def test_clasifica_elementos_de_un_grupo():
    assert lugares.clasificar({"amenity": "restaurant", "cuisine": "chinese"}, ["restaurantes", "chifas"]) == "chifas"
    assert lugares.clasificar({"amenity": "restaurant"}, ["restaurantes", "chifas"]) == "restaurantes"
    assert lugares.clasificar({"amenity": "restaurant", "name": "Chifa Wa Lok"}, ["chifas", "restaurantes"]) == "chifas"
    assert lugares.clasificar({"amenity": "atm"}, ["bancos", "cajeros"]) == "cajeros"
    assert lugares.clasificar({"shop": "bakery"}, ["bancos"]) is None


def test_convierte_nodo_y_via_con_centro():
    nodo = {"type": "node", "id": 1, "lat": -12.05, "lon": -77.03,
            "tags": {"name": "Café Central", "amenity": "cafe", "addr:street": "Jr. Ucayali", "addr:housenumber": "123"}}
    via = {"type": "way", "id": 2, "center": {"lat": -12.1, "lon": -77.0}, "tags": {"leisure": "park"}}
    f1, f2 = lugares._a_feature(nodo, ["cafeterias"]), lugares._a_feature(via, ["parques"])
    assert f1["geometry"]["coordinates"] == [-77.03, -12.05]
    assert f1["properties"]["direccion"] == "Jr. Ucayali 123" and f1["properties"]["subcategoria"] == "cafeterias"
    assert f2["properties"]["nombre"] == "Sin nombre" and f2["properties"]["osm"] == "way/2"


def test_rechaza_zonas_grandes_y_categorias_desconocidas():
    with pytest.raises(lugares.ZonaMuyGrande):
        lugares.buscar("cafeterias", -18, -81, 0, -68)
    with pytest.raises(lugares.CategoriaInvalida):
        lugares.buscar("casinos", -12.1, -77.1, -12.0, -77.0)
    with pytest.raises(lugares.CategoriaInvalida):
        lugares.buscar_por_nombre("a", -12.1, -77.1, -12.0, -77.0)


def test_selector_usa_existencia_y_deja_el_nombre_al_final():
    sel = lugares._selector({"name": "agente", "amenity": ".+"})
    assert sel == '["amenity"]["name"~"agente",i]'


def test_subcategorias_de_devuelve_todas_de_la_mas_especifica_a_la_general():
    subs = lugares.subcategorias_de({"amenity": "restaurant", "cuisine": "chinese", "name": "Chifa Lung Fung"})
    assert subs[0] == "chifas" and "restaurantes" in subs
    assert lugares.subcategorias_de({"amenity": "atm"}) == ["cajeros"]
    assert lugares.subcategorias_de({"highway": "residential"}) == []


def test_claves_osm_incluye_las_etiquetas_de_la_clasificacion():
    assert {"amenity", "shop", "tourism", "highway"} <= set(lugares.CLAVES_OSM)
    assert "name" not in lugares.CLAVES_OSM


def test_descarte_rapido_no_pierde_lugares():
    assert lugares.posible_lugar({"amenity": "restaurant"})
    assert lugares.posible_lugar({"building": "apartments", "name": "Torre Sol"})
    assert not lugares.posible_lugar({"building": "yes"})
    assert not lugares.posible_lugar({"highway": "residential", "name": "Jr. Lima"})


def test_nuevas_subcategorias():
    assert lugares.subcategorias_de({"amenity": "toilets"}) == ["banos"]
    assert lugares.subcategorias_de({"leisure": "playground"}) == ["juegos_infantiles"]
    assert lugares.subcategorias_de({"amenity": "fountain"}) == ["piletas"]


def test_direccion_referencial_solo_si_no_hay_calle():
    p = lugares.propiedades({"name": "Bodega Lucha"}, "bodegas", "node/1", "Jirón Ucayali")
    assert p["direccion_referencial"] == "Cerca de Jirón Ucayali" and "direccion" not in p
    p = lugares.propiedades({"name": "X", "addr:street": "Av. Abancay", "addr:housenumber": "10"}, "bodegas", "node/2", "Jr. Lampa")
    assert p["direccion"] == "Av. Abancay 10" and "direccion_referencial" not in p


def test_area_maxima_40_km2():
    assert 39 < lugares.area_km2((-12.1, -77.1, -12.043, -77.042)) < 41
    assert lugares.area_km2((-12.07, -77.06, -12.04, -77.01)) < lugares.AREA_MAXIMA_KM2  # ~18 km²


def test_overture_mapea_a_subcategorias_existentes():
    from app.services import overture
    for subs in overture.MAPEO.values():
        assert all(s in lugares.SUBCATEGORIAS for s in subs), subs
    for _, subs in overture.SUFIJOS:
        assert all(s in lugares.SUBCATEGORIAS for s in subs)
    assert overture.subcategorias_overture("chinese_restaurant", None) == ["chifas", "restaurantes"]
    assert overture.subcategorias_overture("thai_restaurant", None) == ["restaurantes"]
    assert overture.subcategorias_overture("unknown_thing", ["barber"]) == ["peluquerias"]
    assert overture.subcategorias_overture(None, None) == []


def test_fuente_en_propiedades():
    assert lugares.propiedades({"name": "X"}, "bodegas", "overture/abc")["fuente"] == "Overture Maps"
    assert lugares.propiedades({"name": "X", "addr:full": "Av. Perú 123"}, "bodegas", "overture/abc")["direccion"] == "Av. Perú 123"
    assert lugares.propiedades({"name": "X"}, "bodegas", "node/1")["fuente"] == "OpenStreetMap"
