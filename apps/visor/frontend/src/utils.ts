import L from "leaflet";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ESCAPES[c]);

export const formatoNumero = (n: number, decimales = 0) =>
  n.toLocaleString("es-PE", { maximumFractionDigits: decimales, minimumFractionDigits: 0 });

export function ajustarVista(map: L.Map | null, datos: GeoJsonObject | GeoJsonObject[]) {
  if (!map) return;
  const grupo = L.featureGroup((Array.isArray(datos) ? datos : [datos]).map(d => L.geoJSON(d)));
  const b = grupo.getBounds();
  if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
}

/** Acepta FeatureCollection, Feature o geometría suelta y devuelve un FeatureCollection. */
export function aFeatureCollection(json: unknown): FeatureCollection {
  const o = json as { type?: string };
  if (o?.type === "FeatureCollection") return json as FeatureCollection;
  if (o?.type === "Feature") return { type: "FeatureCollection", features: [json as Feature] };
  if (o?.type && "coordinates" in (o as object)) {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: json as never }] };
  }
  throw new Error("No es un GeoJSON válido");
}

const CAMPOS_NOMBRE = ["nombre", "name", "NOMBRE", "NAME", "titulo", "title", "descripcion", "direccion"];

/** Elementos sin nombre propio (ej. «Sin nombre» de OpenStreetMap) no se listan. */
export function tieneNombre(f: Feature): boolean {
  const p = f.properties ?? {};
  return CAMPOS_NOMBRE.some(c => typeof p[c] === "string" && p[c].trim() !== "" && p[c] !== "Sin nombre");
}

export function etiquetaElemento(f: Feature, indice: number): string {
  const p = f.properties ?? {};
  for (const campo of CAMPOS_NOMBRE) {
    if (typeof p[campo] === "string" && p[campo]) return p[campo];
  }
  return `Elemento ${indice + 1}`;
}

export function tipoGeometria(f: Feature): string {
  switch (f.geometry?.type) {
    case "Point": case "MultiPoint": return "Punto";
    case "LineString": case "MultiLineString": return "Línea";
    case "Polygon": case "MultiPolygon": return "Polígono";
    default: return "Otro";
  }
}

export function centro(f: Feature): L.LatLng | null {
  const b = L.geoJSON(f).getBounds();
  return b.isValid() ? b.getCenter() : null;
}

/** Atributos con valores de texto repetidos: sirven para agrupar en un gráfico. */
export function atributosCategoricos(fc: FeatureCollection): string[] {
  const valores = new Map<string, Set<string>>();
  for (const f of fc.features.slice(0, 2000)) {
    for (const [k, v] of Object.entries(f.properties ?? {})) {
      if (typeof v !== "string" || !v || CAMPOS_OCULTOS.has(k)) continue;
      if (!valores.has(k)) valores.set(k, new Set());
      valores.get(k)!.add(v);
    }
  }
  const n = fc.features.length;
  return [...valores.entries()]
    .filter(([, set]) => set.size >= 1 && set.size <= 50 && (set.size < n || n <= 1))
    .map(([k]) => k);
}

/** Cuenta valores; los que no entran en el top se agrupan en «Otros». */
export function distribucion(valores: string[], maximo = 8): { etiqueta: string; valor: number }[] {
  const conteo = new Map<string, number>();
  for (const v of valores) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  const orden = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  const top = orden.slice(0, maximo).map(([etiqueta, valor]) => ({ etiqueta, valor }));
  const resto = orden.slice(maximo).reduce((s, [, v]) => s + v, 0);
  return resto ? [...top, { etiqueta: "Otros", valor: resto }] : top;
}

export function columnas(fc: FeatureCollection, maximo = 12): string[] {
  const set = new Set<string>();
  for (const f of fc.features.slice(0, 200)) Object.keys(f.properties ?? {}).forEach(k => !CAMPOS_OCULTOS.has(k) && set.add(k));
  return [...set].slice(0, maximo);
}

/** Minúsculas y sin tildes: «Nación» y «nacion» coinciden. */
export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** ¿El nombre del elemento contiene el texto del filtro (ya normalizado)? */
export function coincideNombre(f: Feature, filtroNormalizado: string, indice = 0): boolean {
  if (!filtroNormalizado) return true;
  const p = f.properties ?? {};
  const textos = [etiquetaElemento(f, indice), p.marca, p.brand, p.categoria].filter(Boolean).map(String);
  return textos.some(t => normalizar(t).includes(filtroNormalizado));
}

/** Área aproximada (km²) de una zona [oeste, sur, este, norte] en grados. */
export function areaZonaKm2([w, s, e, n]: [number, number, number, number]): number {
  const latMedia = ((s + n) / 2) * (Math.PI / 180);
  return Math.abs((e - w) * 111.32 * Math.cos(latMedia) * (n - s) * 110.57);
}

/** «35,2 ha» si es menor a 1 km²; si no, «12,4 km²». */
export function formatoArea(km2: number): string {
  return km2 < 1 ? `${formatoNumero(km2 * 100, 1)} ha` : `${formatoNumero(km2, km2 < 100 ? 2 : 0)} km²`;
}

/** Dirección para mostrar bajo el nombre (OpenStreetMap: calle + número; capas propias: campo direccion). */
export function direccionDe(f: Feature): string | null {
  const p = f.properties ?? {};
  const directa = p.direccion ?? p.DIRECCION ?? p.address;
  if (typeof directa === "string" && directa.trim()) return directa.trim();
  const calle = [p["addr:street"], p["addr:housenumber"]].filter(Boolean).join(" ");
  if (calle) return calle;
  // Sin dirección registrada: la calle con nombre más cercana («Cerca de Jr. Ucayali»)
  return typeof p.direccion_referencial === "string" ? p.direccion_referencial : null;
}

/** Campos internos que no se muestran al usuario. */
export const CAMPOS_OCULTOS = new Set(["osm", "subcategoria"]);

const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: "Nombre", categoria: "Categoría", tipo: "Tipo", direccion: "Dirección",
  direccion_referencial: "Dirección referencial", telefono: "Teléfono", horario: "Horario",
  web: "Web", marca: "Marca", cocina: "Cocina", id: "Id", fuente: "Fuente",
};

/** Nombre legible de un campo: «direccion_referencial» → «Dirección referencial». */
export const etiquetaCampo = (campo: string) =>
  ETIQUETAS_CAMPO[campo] ?? campo.charAt(0).toUpperCase() + campo.slice(1).replace(/_/g, " ");
