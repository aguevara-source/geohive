from app.services import geomarketing as g
from app.services import lugares


def test_percentiles_con_empates_y_constantes():
    assert g.percentiles([10, 20, 20, 40]) == [0.0, 0.5, 0.5, 1.0]
    assert g.percentiles([5, 5, 5]) == [0.0, 0.0, 0.0]
    assert g.percentiles([]) == []


def test_rubros_usan_subcategorias_existentes():
    for rubro in g.RUBROS.values():
        for sub in list(rubro["competencia"]) + list(rubro["imanes"]):
            assert sub in lugares.SUBCATEGORIAS, sub
        assert rubro["radio"] > 0 and rubro["estandar"] > 0


def test_catalogo_incluye_minutos_a_pie():
    bodega = next(r for r in g.catalogo() if r["id"] == "bodega")
    assert bodega["minutos"] == round(300 / g.VELOCIDAD_A_PIE)


def test_cada_rubro_tiene_grupo_y_un_competidor_directo():
    for rid, rubro in g.RUBROS.items():
        assert rubro["grupo"] in g.GRUPOS_RUBROS, rid
        assert sum(1 for p in rubro["competencia"].values() if p >= 1) == 1, rid


def test_estado_cobertura():
    assert g.estado_cobertura(None) == "poca_poblacion"
    assert g.estado_cobertura(0.3) == "falta"
    assert g.estado_cobertura(1.0) == "equilibrio"
    assert g.estado_cobertura(2.0) == "saturado"


def test_esperados_usa_la_referencia_mas_exigente():
    # Zona residencial: pocos negocios, mucha gente → manda la población
    assert g.esperados_rubro(100, 10_000, 100_000, 200, 5_000) == (10.0, "poblacion")
    # Zona comercial: muchos negocios para su gente → manda la mezcla del comercio
    assert g.esperados_rubro(100, 10_000, 100_000, 2_000, 5_000) == (40.0, "mezcla")
    assert g.esperados_rubro(0, 0, 0, 0, 0) == (0, "poblacion")


def test_veredicto():
    assert g.veredicto(4000, 2000) == "favorable"
    assert g.veredicto(1600, 2000) == "moderado"
    assert g.veredicto(500, 2000) == "dificil"
