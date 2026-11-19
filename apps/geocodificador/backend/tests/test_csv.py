import pytest

from app.services.lotes import CSVInvalido, leer_csv


def test_csv_con_comas():
    columnas, filas = leer_csv("id,direccion\n1,Av. Arequipa 1200\n2,Jr. de la Unión 300\n".encode())
    assert columnas == ["id", "direccion"]
    assert [f["direccion"] for f in filas] == ["Av. Arequipa 1200", "Jr. de la Unión 300"]


def test_csv_punto_y_coma_bom_y_mayusculas():
    _, filas = leer_csv("﻿Codigo;Direccion\nA;Calle 1, Lima\n".encode())
    assert filas[0]["direccion"] == "Calle 1, Lima"


def test_csv_ignora_filas_vacias():
    _, filas = leer_csv(b"direccion\nCalle 1\n\n   \n")
    assert len(filas) == 1


def test_csv_sin_columna_direccion():
    with pytest.raises(CSVInvalido):
        leer_csv(b"nombre\nJuan\n")


def test_csv_latin1():
    _, filas = leer_csv("direccion\nAv. Perú 123\n".encode("latin-1"))
    assert filas[0]["direccion"] == "Av. Perú 123"
