/** Geomarketing: puntaje configurable, clases del mapa y recomendación de los mejores lugares. */
import type { AnalisisGeo, PropsHexagono, PuntoGeo } from "./api/visor";

export interface Pesos { demanda: number; brecha: number; imanes: number }
export const PESOS_INICIALES: Pesos = { demanda: 40, brecha: 35, imanes: 25 };

/** Rampa secuencial de un solo tono (azul), de baja a muy alta oportunidad. */
export const CLASES = [
  { nombre: "Muy baja", color: "#b7d3f6" },
  { nombre: "Baja", color: "#6da7ec" },
  { nombre: "Media", color: "#2a78d6" },
  { nombre: "Alta", color: "#1c5cab" },
  { nombre: "Muy alta", color: "#0d366b" },
];

/** Hexágonos mayormente no residenciales (industria, almacenes, parques…): se pintan en gris. */
export const COLOR_NO_RESIDENCIAL = "#6b7280";
export const UMBRAL_NO_RESIDENCIAL = 0.8;

/** Nombre del uso de suelo (etiqueta OpenStreetMap) que ocupa la mayor parte de un hexágono. */
const USOS: Record<string, string> = {
  "landuse=industrial": "zona industrial", "building=industrial": "naves industriales", "building=warehouse": "almacenes",
  "building=hangar": "hangares", "man_made=works": "fábrica", "man_made=wastewater_plant": "planta de tratamiento",
  "landuse=railway": "vía férrea", "landuse=military": "zona militar", "landuse=cemetery": "cementerio",
  "amenity=grave_yard": "cementerio", "landuse=quarry": "cantera", "landuse=landfill": "relleno sanitario",
  "landuse=port": "puerto", "landuse=depot": "depósito", "landuse=garages": "cocheras", "landuse=brownfield": "terreno baldío",
  "landuse=construction": "obra en construcción", "landuse=recreation_ground": "área recreativa", "landuse=airport": "aeropuerto",
  "aeroway=aerodrome": "aeropuerto", "leisure=park": "parque", "leisure=golf_course": "campo de golf", "leisure=stadium": "estadio",
  "leisure=sports_centre": "centro deportivo", "leisure=pitch": "canchas deportivas", "leisure=nature_reserve": "reserva natural",
  "amenity=university": "universidad", "amenity=college": "instituto", "amenity=school": "colegio", "amenity=hospital": "hospital",
  "amenity=prison": "penal", "amenity=parking": "estacionamiento", "natural=water": "agua (río, laguna)",
  "natural=wetland": "humedal", "natural=beach": "playa",
};
export const nombreUso = (tipo: string | null) => (tipo && USOS[tipo]) || "usos no residenciales";

export function puntaje(p: PropsHexagono, w: Pesos): number | null {
  if (!p.valida || p.i_demanda === null) return null;
  const total = w.demanda + w.brecha + w.imanes || 1;
  return (w.demanda * p.i_demanda + w.brecha * (p.i_brecha ?? 0) + w.imanes * (p.i_imanes ?? 0)) / total;
}

/** Rampa cálida para lo que juega en contra (competencia): no se confunde con la de oportunidad. */
const RAMPA_CALIDA = ["#fde7c8", "#f9b779", "#ee7d3b", "#c4511c", "#87300c"];
const RAMPA_AZUL = CLASES.map(c => c.color);

/** Qué se pinta en los hexágonos. «valor» devuelve null para los que no se evalúan. */
export interface VariableMapa {
  id: string; nombre: string; bajo: string; alto: string; colores: string[];
  valor: (p: PropsHexagono, puntaje: number, radio: number) => number;
}
export const VARIABLES: VariableMapa[] = [
  { id: "oportunidad", nombre: "Oportunidad", bajo: "Muy baja", alto: "Muy alta", colores: RAMPA_AZUL, valor: (_p, s) => s },
  { id: "poblacion", nombre: "Habitantes", bajo: "Pocos", alto: "Muchos", colores: RAMPA_AZUL, valor: p => p.poblacion },
  { id: "demanda", nombre: "Población a pie", bajo: "Poca", alto: "Mucha", colores: RAMPA_AZUL, valor: p => p.demanda },
  { id: "competencia", nombre: "Competencia", bajo: "Poca", alto: "Mucha", colores: RAMPA_CALIDA, valor: p => p.competencia },
  { id: "imanes", nombre: "Atractores de clientes", bajo: "Pocos", alto: "Muchos", colores: RAMPA_AZUL, valor: p => p.imanes },
  // Sin competidor cerca cuenta como «muy lejos»
  { id: "distancia", nombre: "Distancia al competidor", bajo: "Cerca", alto: "Lejos", colores: RAMPA_AZUL,
    valor: (p, _s, radio) => p.competidor_cercano ?? radio * 3 },
];

export interface ResultadoHex { puntaje: number; clase: number; valor: number }

/** Puntaje (0–100) de cada hexágono y su clase (0–4, por quintiles dentro de la zona) en la variable elegida. */
export function calcular(analisis: AnalisisGeo, w: Pesos, variable: VariableMapa = VARIABLES[0]): Map<number, ResultadoHex> {
  const filas = analisis.hexagonos.features
    .map(f => ({ p: f.properties, s: puntaje(f.properties, w) }))
    .filter((x): x is { p: PropsHexagono; s: number } => x.s !== null)
    .map(x => ({ id: x.p.id, s: x.s, v: variable.valor(x.p, x.s, analisis.rubro.radio) }));
  const orden = filas.map(x => x.v).sort((a, b) => a - b);
  const corte = (q: number) => orden[Math.min(orden.length - 1, Math.floor(q * orden.length))] ?? 0;
  const cortes = [corte(0.2), corte(0.4), corte(0.6), corte(0.8)];
  // «>» y no «≥»: si muchos valen 0 (sin competencia), todos quedan en la clase más baja
  const clase = (v: number) => (v === orden[orden.length - 1] && v > orden[0] ? 4 : cortes.filter(c => v > c).length);
  return new Map(filas.map(x => [x.id, { puntaje: Math.round(x.s * 100), clase: clase(x.v), valor: x.v }]));
}

/** Tabla de hexágonos evaluados en CSV (se abre en Excel con «;» y coma decimal). */
export function tablaCSV(analisis: AnalisisGeo, resultado: Map<number, ResultadoHex>): string {
  const num = (n: number | null, d = 0) => (n === null ? "" : n.toFixed(d).replace(".", ","));
  const filas = analisis.hexagonos.features
    .map(f => f.properties)
    .filter(p => resultado.has(p.id))
    .sort((a, b) => resultado.get(b.id)!.puntaje - resultado.get(a.id)!.puntaje)
    .map(p => [p.id, num(p.lat, 6), num(p.lon, 6), resultado.get(p.id)!.puntaje, p.poblacion, p.demanda,
               num(p.competencia, 2), num(p.imanes, 2), p.competidor_cercano ?? "", p.recomendable ? "sí" : "no"].join(";"));
  const cabecera = ["hexagono", "latitud", "longitud", "oportunidad", "habitantes", `poblacion_${analisis.rubro.minutos}min`,
                    "competencia", "atractores", "competidor_cercano_m", "recomendable"].join(";");
  return BOM + [cabecera, ...filas].join(FIN_LINEA);
}
const BOM = "﻿"; // así Excel reconoce las tildes
const FIN_LINEA = "\r\n";

export function descargar(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function distanciaM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

export interface Recomendado {
  puesto: number;
  hex: PropsHexagono;
  puntaje: number;
  competidoresCerca: number;
  imanesCerca: { subcategoria: string; cantidad: number }[];
}

/** Los «n» mejores hexágonos, separados entre sí al menos el radio a pie del rubro. */
export function recomendar(analisis: AnalisisGeo, resultado: Map<number, { puntaje: number }>, n = 3): Recomendado[] {
  const candidatos = analisis.hexagonos.features
    .map(f => f.properties)
    .filter(p => resultado.has(p.id) && p.recomendable)
    .sort((a, b) => resultado.get(b.id)!.puntaje - resultado.get(a.id)!.puntaje || b.demanda - a.demanda);
  const elegidos: PropsHexagono[] = [];
  for (const p of candidatos) {
    if (elegidos.every(e => distanciaM(e, p) >= analisis.rubro.radio)) elegidos.push(p);
    if (elegidos.length === n) break;
  }
  return elegidos.map((hex, i) => {
    const cerca = analisis.puntos.filter(pt => distanciaM(hex, pt) <= analisis.rubro.radio);
    return {
      puesto: i + 1, hex, puntaje: resultado.get(hex.id)!.puntaje,
      competidoresCerca: cerca.filter(pt => pt.competidor).length,
      imanesCerca: agrupar(cerca.filter(pt => !pt.competidor)),
    };
  });
}

function agrupar(puntos: PuntoGeo[]) {
  const conteo = new Map<string, number>();
  puntos.forEach(p => conteo.set(p.subcategoria, (conteo.get(p.subcategoria) ?? 0) + 1));
  return [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([subcategoria, cantidad]) => ({ subcategoria, cantidad }));
}
