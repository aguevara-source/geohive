/**
 * Estilos vectoriales propios de GeoHive sobre teselas libres de OpenFreeMap
 * (esquema OpenMapTiles, datos de OpenStreetMap). No requieren API key.
 * Incluyen vías con nombre y borde, límites distritales, edificaciones y numeración de casas.
 */
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

interface Paleta {
  fondo: string; agua: string; aguaBorde: string; verde: string; residencial: string;
  edificio: string; edificioBorde: string;
  viaPrincipal: string; viaPrincipalBorde: string; viaPrimaria: string; viaPrimariaBorde: string;
  viaSecundaria: string; viaSecundariaBorde: string; viaLocal: string; viaLocalBorde: string; viaServicio: string;
  ferrovia: string; limite: string; texto: string; textoVia: string; halo: string; numeros: string;
}

export type NombreEstilo = "claro" | "medianoche";

const PALETAS: Record<NombreEstilo, Paleta> = {
  claro: {
    fondo: "#f4f1e4", agua: "#aad3df", aguaBorde: "#8fc3d4", verde: "#d2e7b5", residencial: "#efebdc",
    edificio: "#e8e3d4", edificioBorde: "#cbc3ad",
    viaPrincipal: "#f7a440", viaPrincipalBorde: "#d4822a", viaPrimaria: "#fcd36b", viaPrimariaBorde: "#dcae44",
    viaSecundaria: "#fff1b0", viaSecundariaBorde: "#d8ca8c", viaLocal: "#ffffff", viaLocalBorde: "#d7cfbb", viaServicio: "#ffffff",
    ferrovia: "#b5ae9f", limite: "#e0564f", texto: "#2f3440", textoVia: "#4b5160", halo: "#ffffff", numeros: "#7a7f8a",
  },
  medianoche: {
    fondo: "#0d1931", agua: "#050c1e", aguaBorde: "#14294d", verde: "#0f2433", residencial: "#101d38",
    edificio: "#16284c", edificioBorde: "#1f3762",
    viaPrincipal: "#d4af37", viaPrincipalBorde: "#7d6420", viaPrimaria: "#c19a45", viaPrimariaBorde: "#6a5427",
    viaSecundaria: "#5675a8", viaSecundariaBorde: "#0a1428", viaLocal: "#2a416e", viaLocalBorde: "#0a1428", viaServicio: "#20345b",
    ferrovia: "#3b4f7a", limite: "#7d8fc0", texto: "#c8d3ea", textoVia: "#93a8cf", halo: "#0d1931", numeros: "#6b82b0",
  },
};

const NOMBRE: ExpressionSpecification = ["coalesce", ["get", "name:es"], ["get", "name"]];
const REGULAR = ["Noto Sans Regular"];
const NEGRITA = ["Noto Sans Bold"];

const ancho = (z10: number, z18: number): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 10, z10, 18, z18];

function via(id: string, clases: string[], color: string, z10: number, z18: number, minzoom = 5): LayerSpecification {
  return {
    id, type: "line", source: "osm", "source-layer": "transportation", minzoom,
    filter: ["all", ["in", ["get", "class"], ["literal", clases]], ["!=", ["get", "brunnel"], "tunnel"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": ancho(z10, z18) },
  };
}

/** Borde de una vía: la misma geometría, un poco más ancha y debajo del relleno. */
const borde = (id: string, clases: string[], color: string, z10: number, z18: number, minzoom = 5) =>
  via(`${id}-borde`, clases, color, z10 + 0.8, z18 + 3, minzoom);

export function crearEstilo(nombre: NombreEstilo): StyleSpecification {
  const p = PALETAS[nombre];
  return {
    version: 8,
    name: `GeoHive ${nombre}`,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: '&copy; <a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": p.fondo } },
      { id: "residencial", type: "fill", source: "osm", "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
        paint: { "fill-color": p.residencial } },
      { id: "verde", type: "fill", source: "osm", "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland", "wetland"]]],
        paint: { "fill-color": p.verde, "fill-opacity": 0.85 } },
      { id: "parques", type: "fill", source: "osm", "source-layer": "park", paint: { "fill-color": p.verde } },
      { id: "agua", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": p.agua } },
      { id: "agua-borde", type: "line", source: "osm", "source-layer": "water", minzoom: 10,
        paint: { "line-color": p.aguaBorde, "line-width": 1 } },
      { id: "rios", type: "line", source: "osm", "source-layer": "waterway",
        paint: { "line-color": p.aguaBorde, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 3] } },
      { id: "edificios", type: "fill", source: "osm", "source-layer": "building", minzoom: 14,
        paint: { "fill-color": p.edificio, "fill-outline-color": p.edificioBorde } },

      // Vías: primero todos los bordes, luego los rellenos (así los cruces se ven limpios)
      borde("locales", ["minor"], p.viaLocalBorde, 0.4, 14, 13),
      borde("terciarias", ["tertiary"], p.viaLocalBorde, 0.6, 15, 11),
      borde("secundarias", ["secondary"], p.viaSecundariaBorde, 0.8, 16, 10),
      borde("primarias", ["primary"], p.viaPrimariaBorde, 1.1, 19, 8),
      borde("troncales", ["motorway", "trunk"], p.viaPrincipalBorde, 1.4, 22, 6),
      via("servicio", ["service", "track"], p.viaServicio, 0.3, 5, 14),
      via("locales", ["minor"], p.viaLocal, 0.4, 14, 12),
      via("terciarias", ["tertiary"], p.viaLocal, 0.6, 15, 10),
      via("secundarias", ["secondary"], p.viaSecundaria, 0.8, 16, 9),
      via("primarias", ["primary"], p.viaPrimaria, 1.1, 19, 7),
      via("troncales", ["motorway", "trunk"], p.viaPrincipal, 1.4, 22, 5),
      { id: "ferrovias", type: "line", source: "osm", "source-layer": "transportation", minzoom: 11,
        filter: ["in", ["get", "class"], ["literal", ["rail", "transit"]]],
        paint: { "line-color": p.ferrovia, "line-width": 1.2, "line-dasharray": [4, 3] } },

      // Límites: regiones y provincias siempre; distritos (nivel 8) al acercarse
      { id: "limites", type: "line", source: "osm", "source-layer": "boundary",
        filter: ["all", ["<=", ["get", "admin_level"], 8], ["!=", ["get", "maritime"], 1]],
        minzoom: 4,
        paint: {
          "line-color": p.limite,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 12, 1.2, 16, 2],
          "line-dasharray": [3, 2],
          // «zoom» solo puede ir en el nivel superior: el case va dentro de cada parada
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, ["case", ["==", ["get", "admin_level"], 8], 0, 0.9], 11, 0.9],
        } },

      { id: "nombres-agua", type: "symbol", source: "osm", "source-layer": "water_name",
        layout: { "text-field": NOMBRE, "text-font": REGULAR, "text-size": 12, "text-letter-spacing": 0.15 },
        paint: { "text-color": p.aguaBorde, "text-halo-color": p.halo, "text-halo-width": 1 } },
      { id: "nombres-vias", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 13,
        layout: { "symbol-placement": "line", "text-field": NOMBRE, "text-font": REGULAR,
          "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 18, 13], "text-max-angle": 30 },
        paint: { "text-color": p.textoVia, "text-halo-color": p.halo, "text-halo-width": 1.6 } },
      { id: "numeracion", type: "symbol", source: "osm", "source-layer": "housenumber", minzoom: 17,
        layout: { "text-field": ["get", "housenumber"], "text-font": REGULAR, "text-size": 10 },
        paint: { "text-color": p.numeros, "text-halo-color": p.halo, "text-halo-width": 1 } },
      { id: "barrios", type: "symbol", source: "osm", "source-layer": "place", minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["suburb", "neighbourhood", "quarter"]]],
        layout: { "text-field": NOMBRE, "text-font": NEGRITA, "text-size": 13 },
        paint: { "text-color": p.textoVia, "text-halo-color": p.halo, "text-halo-width": 1.5 } },
      { id: "ciudades", type: "symbol", source: "osm", "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
        layout: { "text-field": NOMBRE, "text-font": NEGRITA,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 12, 16] },
        paint: { "text-color": p.texto, "text-halo-color": p.halo, "text-halo-width": 1.5 } },
      { id: "paises", type: "symbol", source: "osm", "source-layer": "place", maxzoom: 7,
        filter: ["==", ["get", "class"], "country"],
        layout: { "text-field": NOMBRE, "text-font": NEGRITA, "text-size": 14, "text-transform": "uppercase", "text-letter-spacing": 0.3 },
        paint: { "text-color": p.texto, "text-halo-color": p.halo, "text-halo-width": 1.5 } },
    ],
  };
}
