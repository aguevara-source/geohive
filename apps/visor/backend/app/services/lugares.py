"""Lugares de interés desde OpenStreetMap (Overpass API): categorías agrupadas y búsqueda por nombre."""
import math
import re
import threading
import time
import unicodedata

import httpx
from sqlalchemy import text

from ..core.config import settings
from ..db.session import engine

# ---------------------------------------------------------------------------
# Clasificación. Cada subcategoría tiene uno o más filtros; cada filtro es un dict
# etiqueta OSM → expresión regular (todas las condiciones del dict deben cumplirse).
# «claves» son palabras que la gente escribe en el buscador (sin tildes).
# ---------------------------------------------------------------------------


def x(*valores: str) -> str:
    """Valor exacto de una etiqueta: x("bank", "atm") → ^(bank|atm)$"""
    return f"^({'|'.join(valores)})$"


GRUPOS: list[dict] = [
    {"id": "comer", "nombre": "Comer y beber", "subcategorias": [
        {"id": "restaurantes", "nombre": "Restaurantes", "claves": "restaurante comida menu almuerzo", "filtros": [{"amenity": x("restaurant")}]},
        {"id": "comida_rapida", "nombre": "Comida rápida", "claves": "fast food hamburguesa pizza sanguche", "filtros": [{"amenity": x("fast_food")}]},
        {"id": "chifas", "nombre": "Chifas", "claves": "chifa china chino oriental", "filtros": [{"amenity": x("restaurant", "fast_food"), "cuisine": "chinese"}, {"amenity": x("restaurant", "fast_food"), "name": "chifa"}]},
        {"id": "pollerias", "nombre": "Pollerías", "claves": "polleria pollo a la brasa", "filtros": [{"amenity": x("restaurant", "fast_food"), "cuisine": "chicken"}, {"amenity": x("restaurant", "fast_food"), "name": "poller|pollo"}]},
        {"id": "cevicherias", "nombre": "Cevicherías", "claves": "cevicheria ceviche mariscos pescado", "filtros": [{"amenity": x("restaurant"), "cuisine": "seafood|ceviche|fish"}, {"amenity": x("restaurant"), "name": "cevich|marisc"}]},
        {"id": "cafeterias", "nombre": "Cafeterías", "claves": "cafe cafeteria desayuno", "filtros": [{"amenity": x("cafe")}]},
        {"id": "panaderias", "nombre": "Panaderías y pastelerías", "claves": "panaderia pan pasteleria torta", "filtros": [{"shop": x("bakery", "pastry", "confectionery")}]},
        {"id": "bares", "nombre": "Bares", "claves": "bar pub cerveza", "filtros": [{"amenity": x("bar", "pub", "biergarten")}]},
        {"id": "heladerias", "nombre": "Heladerías", "claves": "heladeria helado", "filtros": [{"amenity": x("ice_cream")}, {"shop": x("ice_cream")}]},
    ]},
    {"id": "compras", "nombre": "Compras", "subcategorias": [
        {"id": "bodegas", "nombre": "Bodega / minimarket", "claves": "bodega minimarket tienda abarrotes", "filtros": [{"shop": x("convenience", "general", "kiosk")}]},
        {"id": "supermercados", "nombre": "Supermercado", "claves": "supermercado plaza vea tottus metro wong", "filtros": [{"shop": x("supermarket")}]},
        {"id": "mercados", "nombre": "Mercado", "claves": "mercado feria", "filtros": [{"amenity": x("marketplace")}]},
        {"id": "centros_comerciales", "nombre": "Centro comercial", "claves": "centro comercial mall plaza tienda por departamento", "filtros": [{"shop": x("mall", "department_store")}]},
        {"id": "ropa", "nombre": "Ropa y calzado", "claves": "ropa zapatos zapateria calzado", "filtros": [{"shop": x("clothes", "shoes", "boutique", "fashion")}]},
        {"id": "tecnologia", "nombre": "Tecnología", "claves": "celular computadora electronica", "filtros": [{"shop": x("electronics", "mobile_phone", "computer")}]},
        {"id": "ferreterias", "nombre": "Ferretería y construcción", "claves": "ferreteria construccion materiales", "filtros": [{"shop": x("hardware", "doityourself", "trade")}]},
        {"id": "librerias", "nombre": "Librería y útiles", "claves": "libreria utiles libros", "filtros": [{"shop": x("books", "stationery")}]},
    ]},
    {"id": "salud", "nombre": "Salud", "subcategorias": [
        {"id": "farmacias", "nombre": "Farmacias y boticas", "claves": "farmacia botica medicinas inkafarma mifarma", "filtros": [{"amenity": x("pharmacy")}, {"shop": x("chemist")}]},
        {"id": "hospitales", "nombre": "Hospitales", "claves": "hospital emergencia essalud", "filtros": [{"amenity": x("hospital")}]},
        {"id": "clinicas", "nombre": "Clínicas y centros de salud", "claves": "clinica centro de salud posta policlinico", "filtros": [{"amenity": x("clinic")}]},
        {"id": "consultorios", "nombre": "Consultorios", "claves": "consultorio medico doctor", "filtros": [{"amenity": x("doctors")}]},
        {"id": "dentistas", "nombre": "Dentistas", "claves": "dentista odontologo dental", "filtros": [{"amenity": x("dentist")}]},
        {"id": "laboratorios", "nombre": "Laboratorios", "claves": "laboratorio analisis", "filtros": [{"healthcare": x("laboratory")}]},
        {"id": "veterinarias", "nombre": "Veterinarias", "claves": "veterinaria mascotas", "filtros": [{"amenity": x("veterinary")}]},
        {"id": "opticas", "nombre": "Ópticas", "claves": "optica lentes anteojos", "filtros": [{"shop": x("optician")}]},
    ]},
    {"id": "bienestar", "nombre": "Bienestar y deporte", "subcategorias": [
        {"id": "gimnasios", "nombre": "Gimnasios", "claves": "gimnasio gym", "filtros": [{"leisure": x("fitness_centre")}]},
        {"id": "deportes", "nombre": "Canchas y complejos deportivos", "claves": "cancha losa estadio futbol deporte", "filtros": [{"leisure": x("sports_centre", "stadium", "pitch")}]},
        {"id": "piscinas", "nombre": "Piscinas", "claves": "piscina natacion", "filtros": [{"leisure": x("swimming_pool"), "access": x("yes", "public", "customers")}]},
        {"id": "peluquerias", "nombre": "Peluquerías y belleza", "claves": "peluqueria salon belleza barberia", "filtros": [{"shop": x("hairdresser", "beauty")}]},
        {"id": "spa", "nombre": "Spa y masajes", "claves": "spa masajes sauna", "filtros": [{"leisure": x("sauna")}, {"shop": x("massage")}]},
    ]},
    {"id": "educacion", "nombre": "Educación", "subcategorias": [
        {"id": "inicial", "nombre": "Educación inicial", "claves": "nido jardin inicial cuna", "filtros": [{"amenity": x("kindergarten", "childcare")}]},
        {"id": "colegios", "nombre": "Colegios", "claves": "colegio escuela institucion educativa", "filtros": [{"amenity": x("school")}]},
        {"id": "universidades", "nombre": "Universidades e institutos", "claves": "universidad instituto facultad", "filtros": [{"amenity": x("university", "college")}]},
        {"id": "bibliotecas", "nombre": "Bibliotecas", "claves": "biblioteca", "filtros": [{"amenity": x("library")}]},
    ]},
    {"id": "entretenimiento", "nombre": "Entretenimiento", "subcategorias": [
        {"id": "cines", "nombre": "Cines", "claves": "cine pelicula", "filtros": [{"amenity": x("cinema")}]},
        {"id": "teatros", "nombre": "Teatros", "claves": "teatro", "filtros": [{"amenity": x("theatre", "arts_centre")}]},
        {"id": "discotecas", "nombre": "Discotecas", "claves": "discoteca fiesta", "filtros": [{"amenity": x("nightclub")}]},
        {"id": "juegos_infantiles", "nombre": "Juegos infantiles", "claves": "juegos infantiles parque infantil columpios", "filtros": [{"leisure": x("playground")}]},
        {"id": "diversion", "nombre": "Juegos y diversión", "claves": "juegos parque de diversiones", "filtros": [{"leisure": x("amusement_arcade", "water_park", "bowling_alley")}, {"tourism": x("theme_park", "zoo")}]},
    ]},
    {"id": "servicios", "nombre": "Servicios", "subcategorias": [
        {"id": "grifos", "nombre": "Grifos", "claves": "grifo gasolinera combustible estacion de servicio", "filtros": [{"amenity": x("fuel")}]},
        {"id": "talleres", "nombre": "Talleres mecánicos", "claves": "taller mecanico", "filtros": [{"shop": x("car_repair", "tyres")}]},
        {"id": "estacionamientos", "nombre": "Estacionamientos", "claves": "estacionamiento parqueo cochera", "filtros": [{"amenity": x("parking")}]},
        {"id": "lavanderias", "nombre": "Lavanderías", "claves": "lavanderia", "filtros": [{"shop": x("laundry", "dry_cleaning")}]},
        {"id": "correos", "nombre": "Correos y courier", "claves": "correo courier envios serpost", "filtros": [{"amenity": x("post_office")}]},
        {"id": "notarias", "nombre": "Notarías", "claves": "notaria notario", "filtros": [{"office": x("notary")}]},
        {"id": "imprentas", "nombre": "Copias e imprentas", "claves": "copias fotocopias imprenta", "filtros": [{"shop": x("copyshop")}, {"craft": x("printer")}]},
    ]},
    {"id": "hospedaje", "nombre": "Hospedaje", "subcategorias": [
        {"id": "hoteles", "nombre": "Hoteles", "claves": "hotel", "filtros": [{"tourism": x("hotel")}]},
        {"id": "hostales", "nombre": "Hostales y hospedajes", "claves": "hostal hospedaje albergue", "filtros": [{"tourism": x("hostel", "guest_house", "motel")}]},
        {"id": "departamentos", "nombre": "Departamentos turísticos", "claves": "departamento apart", "filtros": [{"tourism": x("apartment", "chalet")}]},
        {"id": "campamentos", "nombre": "Campamentos", "claves": "camping campamento", "filtros": [{"tourism": x("camp_site")}]},
    ]},
    {"id": "eventos", "nombre": "Espacios y eventos", "subcategorias": [
        {"id": "locales_eventos", "nombre": "Locales de eventos", "claves": "local eventos fiestas salon recepcion", "filtros": [{"amenity": x("events_venue", "conference_centre")}]},
        {"id": "centros_comunales", "nombre": "Centros comunales", "claves": "local comunal centro comunal", "filtros": [{"amenity": x("community_centre", "social_centre")}]},
        {"id": "templos", "nombre": "Iglesias y templos", "claves": "iglesia parroquia templo capilla", "filtros": [{"amenity": x("place_of_worship")}]},
    ]},
    {"id": "turismo", "nombre": "Turismo y naturaleza", "subcategorias": [
        {"id": "museos", "nombre": "Museos", "claves": "museo", "filtros": [{"tourism": x("museum", "gallery")}]},
        {"id": "atractivos", "nombre": "Atractivos turísticos", "claves": "atractivo turistico huaca monumento", "filtros": [{"tourism": x("attraction")}, {"historic": x("archaeological_site", "monument", "memorial", "ruins")}]},
        {"id": "miradores", "nombre": "Miradores", "claves": "mirador vista", "filtros": [{"tourism": x("viewpoint")}]},
        {"id": "parques", "nombre": "Parques", "claves": "parque plaza area verde", "filtros": [{"leisure": x("park", "garden")}]},
        {"id": "piletas", "nombre": "Piletas", "claves": "pileta fuente de agua", "filtros": [{"amenity": x("fountain")}]},
        {"id": "playas", "nombre": "Playas", "claves": "playa", "filtros": [{"natural": x("beach")}]},
    ]},
    {"id": "publicos", "nombre": "Servicios públicos", "subcategorias": [
        {"id": "municipalidades", "nombre": "Municipalidades", "claves": "municipalidad municipio alcaldia", "filtros": [{"amenity": x("townhall")}]},
        {"id": "comisarias", "nombre": "Comisarías", "claves": "comisaria policia serenazgo", "filtros": [{"amenity": x("police")}]},
        {"id": "bomberos", "nombre": "Bomberos", "claves": "bomberos compania", "filtros": [{"amenity": x("fire_station")}]},
        {"id": "juzgados", "nombre": "Juzgados", "claves": "juzgado poder judicial corte", "filtros": [{"amenity": x("courthouse")}]},
        {"id": "banos", "nombre": "Baños públicos", "claves": "bano banos servicios higienicos sshh", "filtros": [{"amenity": x("toilets")}]},
        {"id": "gobierno", "nombre": "Oficinas del Estado", "claves": "ministerio reniec sunat sunarp gobierno", "filtros": [{"office": x("government")}]},
    ]},
    {"id": "transporte", "nombre": "Transporte", "subcategorias": [
        {"id": "paraderos", "nombre": "Paraderos", "claves": "paradero bus combi", "filtros": [{"highway": x("bus_stop")}]},
        {"id": "estaciones", "nombre": "Estaciones (metro, metropolitano)", "claves": "estacion metro tren metropolitano", "filtros": [{"public_transport": x("station")}, {"railway": x("station")}]},
        {"id": "terminales", "nombre": "Terminales terrestres", "claves": "terminal terrestre buses interprovincial", "filtros": [{"amenity": x("bus_station")}]},
        {"id": "aeropuertos", "nombre": "Aeropuertos", "claves": "aeropuerto aerodromo", "filtros": [{"aeroway": x("aerodrome")}]},
        {"id": "taxis", "nombre": "Paraderos de taxi", "claves": "taxi", "filtros": [{"amenity": x("taxi")}]},
    ]},
    {"id": "dinero", "nombre": "Bancos y dinero", "subcategorias": [
        {"id": "bancos", "nombre": "Bancos", "claves": "banco bcp interbank bbva scotiabank banco de la nacion", "filtros": [{"amenity": x("bank")}]},
        {"id": "cajeros", "nombre": "Cajeros automáticos", "claves": "cajero atm", "filtros": [{"amenity": x("atm")}]},
        {"id": "agentes", "nombre": "Agentes bancarios", "claves": "agente bcp agente bancario", "filtros": [{"amenity": x("bank", "atm"), "name": "agente"}, {"shop": ".*", "name": "agente"}]},
        {"id": "cambio", "nombre": "Casas de cambio", "claves": "cambio dolares casa de cambio", "filtros": [{"amenity": x("bureau_de_change")}]},
    ]},
    {"id": "empresas", "nombre": "Empresas e industria", "subcategorias": [
        {"id": "oficinas", "nombre": "Oficinas y empresas", "claves": "oficina empresa", "filtros": [{"office": x("company", "it", "estate_agent", "insurance", "lawyer", "accountant")}]},
        {"id": "industrias", "nombre": "Industrias y fábricas", "claves": "fabrica industria planta", "filtros": [{"man_made": x("works")}, {"industrial": ".+"}]},
        {"id": "almacenes", "nombre": "Almacenes", "claves": "almacen deposito", "filtros": [{"building": x("warehouse"), "name": ".+"}]},
    ]},
    {"id": "vivienda", "nombre": "Vivienda", "subcategorias": [
        {"id": "edificios", "nombre": "Edificios y condominios", "claves": "edificio condominio residencial", "filtros": [{"building": x("apartments", "residential"), "name": ".+"}]},
        {"id": "urbanizaciones", "nombre": "Urbanizaciones y AA.HH.", "claves": "urbanizacion asentamiento humano barrio", "filtros": [{"place": x("neighbourhood", "suburb", "quarter")}]},
    ]},
]

# Botones visibles en la barra (el resto se elige desde «Más»)
PRINCIPALES = ["restaurantes", "cafeterias", "grifos", "bancos", "cajeros", "farmacias", "supermercados", "hoteles", "salud"]

SUBCATEGORIAS = {s["id"]: {**s, "grupo": g["id"]} for g in GRUPOS for s in g["subcategorias"]}
GRUPOS_POR_ID = {g["id"]: g for g in GRUPOS}
SIN_MAYUSCULAS = {"name", "cuisine"}  # etiquetas que se comparan sin distinguir mayúsculas

LIMITE = 400            # elementos por consulta a Overpass
LIMITE_LOCAL = 1000     # elementos por consulta a la base local (responde en milisegundos)
AREA_MAXIMA = 0.25      # grados² (≈ 55 × 55 km) para Overpass: evita consultas de países enteros
AREA_MAXIMA_KM2 = 40     # área máxima de consulta en la base local
CACHE_SEGUNDOS = 3600   # los lugares cambian poco


class CategoriaInvalida(Exception):
    pass


class ZonaMuyGrande(Exception):
    pass


class ServicioNoDisponible(Exception):
    pass


_http = httpx.Client(headers={"User-Agent": settings.overpass_user_agent}, timeout=settings.overpass_timeout_seg + 5)
_cache: dict[tuple, tuple[float, dict]] = {}
_lock = threading.Lock()


def catalogo() -> dict:
    return {
        "principales": PRINCIPALES,
        "fuente": estado_fuente(),
        "grupos": [{"id": g["id"], "nombre": g["nombre"],
                    "subcategorias": [{"id": s["id"], "nombre": s["nombre"], "claves": s["claves"]} for s in g["subcategorias"]]}
                   for g in GRUPOS],
    }


# ---------- Búsqueda por nombre (insensible a tildes y mayúsculas) ----------

_VARIANTES = {"a": "aáàä", "e": "eéèë", "i": "iíìï", "o": "oóòö", "u": "uúùü", "n": "nñ"}


def sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")


def patron_nombre(texto: str) -> str:
    """«banco de la nacion» → regex que acepta «Banco de la Nación» (Overpass, sin mayúsculas)."""
    limpio = re.sub(r"\s+", " ", sin_tildes(texto)).strip()[:60]
    partes = []
    for c in limpio:
        if c in _VARIANTES:
            partes.append(f"[{_VARIANTES[c]}]")
        elif c.isalnum() or c == " ":
            partes.append(c)
        else:
            partes.append(".")  # signos: cualquier carácter (evita inyectar sintaxis)
    return "".join(partes)


# ---------- Clasificación (precompilada: se usa en cada elemento al importar) ----------

def _compilar(filtro: dict) -> list[tuple[str, re.Pattern, bool]]:
    return [(clave, re.compile(sin_tildes(regex) if clave in SIN_MAYUSCULAS else regex), clave in SIN_MAYUSCULAS)
            for clave, regex in filtro.items()]


_COMPILADOS = {sid: [_compilar(f) for f in s["filtros"]] for sid, s in SUBCATEGORIAS.items()}
# Orden: primero las más específicas (más condiciones): un restaurante chino es «Chifas»
_POR_ESPECIFICIDAD = sorted(SUBCATEGORIAS, key=lambda s: -max(len(f) for f in SUBCATEGORIAS[s]["filtros"]))
# Etiquetas que pueden convertir un elemento en lugar de interés
CLAVES_OSM = sorted({clave for s in SUBCATEGORIAS.values() for f in s["filtros"] for clave in f} - {"name", "cuisine", "access"})


# Descarte rápido al importar: por cada etiqueta, la unión de todos los valores que usa alguna categoría.
# Si ninguna etiqueta del elemento coincide (ej. building=yes, highway=residential), no puede ser un lugar.
_UNION_POR_CLAVE = {
    clave: re.compile("|".join(f"(?:{f[clave]})" for s in SUBCATEGORIAS.values() for f in s["filtros"] if clave in f))
    for clave in CLAVES_OSM
}


def posible_lugar(tags: dict) -> bool:
    for clave, valor in tags.items():
        patron = _UNION_POR_CLAVE.get(clave)
        if patron is not None and patron.search(valor):
            return True
    return False


def _cumple(compilado: list[tuple[str, re.Pattern, bool]], tags: dict) -> bool:
    for clave, patron, sin_may in compilado:
        valor = tags.get(clave)
        if valor is None or not patron.search(sin_tildes(valor) if sin_may else valor):
            return False
    return True


def subcategorias_de(tags: dict) -> list[str]:
    """Todas las subcategorías a las que pertenece un elemento, de la más específica a la más general."""
    return [s for s in _POR_ESPECIFICIDAD if any(_cumple(c, tags) for c in _COMPILADOS[s])]


def clasificar(tags: dict, candidatas: list[str]) -> str | None:
    """Subcategoría (entre las candidatas) a la que pertenece un elemento, para su ícono en el mapa."""
    candidatas_set = set(candidatas)
    for s in _POR_ESPECIFICIDAD:
        if s in candidatas_set and any(_cumple(c, tags) for c in _COMPILADOS[s]):
            return s
    return None


def propiedades(tags: dict, sub: str | None, osm_id: str, calle_cercana: str | None = None) -> dict:
    """Atributos que se muestran en el visor a partir de las etiquetas de OpenStreetMap."""
    props = {
        "nombre": tags.get("name") or tags.get("brand") or "Sin nombre",
        "categoria": SUBCATEGORIAS[sub]["nombre"] if sub in SUBCATEGORIAS else "Otro",
        "subcategoria": sub or "otro",
    }
    tipo = (tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("leisure")
            or tags.get("office") or tags.get("healthcare"))
    if tipo:
        props["tipo"] = tipo
    direccion = " ".join(filter(None, [tags.get("addr:street"), tags.get("addr:housenumber")])) or tags.get("addr:full")
    if direccion:
        props["direccion"] = direccion
    elif calle_cercana:
        props["direccion_referencial"] = f"Cerca de {calle_cercana}"
    for clave, campo in [("phone", "telefono"), ("contact:phone", "telefono"), ("opening_hours", "horario"),
                         ("website", "web"), ("contact:website", "web"), ("brand", "marca"), ("cuisine", "cocina")]:
        if tags.get(clave) and campo not in props:
            props[campo] = tags[clave]
    props["osm"] = osm_id
    props["fuente"] = "Overture Maps" if osm_id.startswith("overture/") else "OpenStreetMap"
    return props


def _feature(lon: float, lat: float, props: dict) -> dict:
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}


# ---------- Fuente local (PostGIS) ----------

def area_km2(caja: tuple[float, float, float, float]) -> float:
    """Área aproximada en km² de una caja (sur, oeste, norte, este) en grados."""
    s, w, n, e = caja
    return abs((e - w) * 111.32 * math.cos(math.radians((s + n) / 2)) * (n - s) * 110.57)

_estado_local: dict = {"hay_datos": None, "revisado": 0.0, "meta": None}


def estado_fuente() -> dict:
    """¿Hay lugares importados en la base local? (se revisa como máximo una vez por minuto)"""
    if time.monotonic() - _estado_local["revisado"] > 60:
        try:
            with engine.connect() as db:
                meta = db.execute(text(
                    "SELECT fuente, fecha_datos, importado_en, total FROM geodata.lugares_osm_meta WHERE id = 1"
                )).mappings().first()
            _estado_local.update(hay_datos=bool(meta and meta["total"]), meta=dict(meta) if meta else None)
        except Exception:
            _estado_local.update(hay_datos=False, meta=None)
        _estado_local["revisado"] = time.monotonic()
    usar_local = settings.lugares_fuente == "local" or (settings.lugares_fuente == "auto" and _estado_local["hay_datos"])
    meta = _estado_local["meta"] or {}
    return {
        "tipo": "local" if usar_local else "overpass",
        "fecha_datos": meta.get("fecha_datos"),
        "total": meta.get("total"),
    }


def _buscar_local(subs: list[str] | None, texto: str, caja: tuple[float, float, float, float]) -> dict:
    s, w, n, e = caja
    if area_km2(caja) > AREA_MAXIMA_KM2 * 1.02:  # 2 % de tolerancia por redondeo
        raise ZonaMuyGrande
    condiciones = ["geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)"]
    params: dict = {"w": w, "s": s, "e": e, "n": n, "limite": LIMITE_LOCAL + 1}
    if subs:
        condiciones.append("subcategorias && CAST(:subs AS text[])")
        params["subs"] = subs
    if texto:
        condiciones.append("nombre_norm LIKE :texto")
        params["texto"] = f"%{sin_tildes(texto).strip()}%"
    with engine.connect() as db:
        filas = db.execute(text(f"""
            SELECT osm_id, tags, subcategoria, subcategorias, direccion_ref, ST_X(geom) AS lon, ST_Y(geom) AS lat
            FROM geodata.lugares WHERE {" AND ".join(condiciones)}
            ORDER BY nombre IS NULL, nombre LIMIT :limite
        """), params).mappings().all()
    features = []
    for f in filas[:LIMITE_LOCAL]:
        # El ícono: la subcategoría más específica dentro de lo pedido (en «Restaurantes», un chifa sale como chifa)
        sub = next((x for x in f["subcategorias"] if not subs or x in subs), f["subcategoria"])
        features.append(_feature(f["lon"], f["lat"], propiedades(f["tags"], sub, f["osm_id"], f["direccion_ref"])))
    return {"type": "FeatureCollection", "features": features, "truncado": len(filas) > LIMITE_LOCAL, "fuente": "local"}


# ---------- Fuente remota (Overpass, respaldo) ----------

def _selector(filtro: dict) -> str:
    """Filtro Overpass. «Tiene la etiqueta» (rápido, usa índice) va primero; el nombre (regex) al final."""
    orden = sorted(filtro.items(), key=lambda kv: (kv[1] not in (".+", ".*"), kv[0] in SIN_MAYUSCULAS))
    sel = ""
    for clave, regex in orden:
        if regex in (".+", ".*"):
            sel += f'["{clave}"]'
            continue
        valor = regex.replace("\\", "\\\\").replace('"', '\\"')
        sel += f'["{clave}"~"{valor}"{",i" if clave in SIN_MAYUSCULAS else ""}]'
    return sel


def _consulta(filtros: list[dict], s: float, w: float, n: float, e: float) -> str:
    caja = f"({s},{w},{n},{e})"
    cuerpo = "".join(f"nwr{_selector(f)}{caja};" for f in filtros)
    return f"[out:json][timeout:{settings.overpass_timeout_seg}];({cuerpo});out center tags {LIMITE};"


def _a_feature(el: dict, candidatas: list[str]) -> dict | None:
    lat = el.get("lat", el.get("center", {}).get("lat"))
    lon = el.get("lon", el.get("center", {}).get("lon"))
    if lat is None or lon is None:
        return None
    tags = el.get("tags", {})
    return _feature(lon, lat, propiedades(tags, clasificar(tags, candidatas), f"{el['type']}/{el['id']}"))


def _consultar(consulta: str) -> list[dict]:
    """Prueba los servidores Overpass en orden hasta que uno responda."""
    ultimo_error: Exception | None = None
    for url in settings.overpass_urls:
        try:
            r = _http.post(url, data={"data": consulta})
            r.raise_for_status()
            return r.json().get("elements", [])
        except (httpx.HTTPError, ValueError) as ex:
            ultimo_error = ex
    raise ServicioNoDisponible(str(ultimo_error))


def _ejecutar(clave: tuple, filtros: list[dict], candidatas: list[str], caja: tuple[float, float, float, float]) -> dict:
    s, w, n, e = caja
    if (n - s) * (e - w) > AREA_MAXIMA:
        raise ZonaMuyGrande
    clave = (*clave, round(s, 3), round(w, 3), round(n, 3), round(e, 3))
    with _lock:
        guardado = _cache.get(clave)
        if guardado and time.monotonic() - guardado[0] < CACHE_SEGUNDOS:
            return guardado[1]

    elementos = _consultar(_consulta(filtros, s, w, n, e))
    features = [f for f in (_a_feature(el, candidatas) for el in elementos) if f]
    resultado = {"type": "FeatureCollection", "features": features, "truncado": len(elementos) >= LIMITE, "fuente": "overpass"}
    with _lock:
        if len(_cache) > 500:
            _cache.clear()
        _cache[clave] = (time.monotonic(), resultado)
    return resultado


# ---------- API del servicio ----------

def _subcategorias_pedidas(categoria: str) -> list[str]:
    if categoria in SUBCATEGORIAS:
        return [categoria]
    if categoria in GRUPOS_POR_ID:
        return [x["id"] for x in GRUPOS_POR_ID[categoria]["subcategorias"]]
    raise CategoriaInvalida(categoria)


def buscar(categoria: str, s: float, w: float, n: float, e: float, nombre: str = "") -> dict:
    """Lugares de una subcategoría o de un grupo completo («Todo Compras»), opcionalmente por nombre."""
    subs = _subcategorias_pedidas(categoria)
    if estado_fuente()["tipo"] == "local":
        return _buscar_local(subs, nombre, (s, w, n, e))
    patron = patron_nombre(nombre) if nombre.strip() else ""
    filtros = [{**f, "name": patron} if patron else f for sub in subs for f in SUBCATEGORIAS[sub]["filtros"]]
    return _ejecutar(("cat", categoria, patron), filtros, subs, (s, w, n, e))


# Etiquetas que identifican un lugar de interés (para buscar por nombre sin categoría)
_ETIQUETAS_LUGAR = ["amenity", "shop", "tourism", "leisure", "office", "healthcare", "historic", "public_transport"]


def buscar_por_nombre(texto: str, s: float, w: float, n: float, e: float) -> dict:
    """Lugares cuyo nombre contiene el texto (ej. «banco de la nación»), de cualquier categoría."""
    if len(sin_tildes(texto).strip()) < 3:
        raise CategoriaInvalida(texto)
    if estado_fuente()["tipo"] == "local":
        return _buscar_local(None, texto, (s, w, n, e))
    patron = patron_nombre(texto)
    filtros = [{"name": patron, etiqueta: ".+"} for etiqueta in _ETIQUETAS_LUGAR]
    return _ejecutar(("nombre", patron), filtros, list(SUBCATEGORIAS), (s, w, n, e))
