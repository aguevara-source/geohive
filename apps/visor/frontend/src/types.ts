import type { FeatureCollection } from "geojson";

export interface CapaBD {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface CapaMapa {
  id: string;
  nombre: string;
  color: string;
  visible: boolean;
  origen: "bd" | "archivo" | "analisis" | "lugares";
  /** Categoría de lugares de interés que la originó (botones superiores) */
  categoria?: string;
  /** Zona consultada [oeste, sur, este, norte]: se dibuja punteada en el mapa */
  zona?: Zona;
  /** Cambia cada vez que se reemplazan los datos: obliga a redibujar la capa en el mapa */
  version?: number;
  datos: FeatureCollection;
}

export interface ResultadoInterseccion {
  area_ha: number;
  total: number;
  resultado: FeatureCollection;
}

export interface Analisis {
  capa: string;
  area_ha: number;
  total: number;
}

/** Elemento elegido en el mapa, la lista o la tabla */
export interface Seleccion {
  capaId: string;
  indice: number;
}

export type Zona = [number, number, number, number];

export type Vista = "capas" | "analisis" | "ubicacion" | "geomarketing" | "buscar";
export type PestanaInferior = "estadisticas" | "tabla" | "analisis";
