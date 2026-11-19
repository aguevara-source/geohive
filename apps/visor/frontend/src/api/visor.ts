import { useApi } from "@geohive/auth";
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection, Geometry, Polygon } from "geojson";
import { API_URL } from "../config";
import type { CapaBD, ResultadoInterseccion } from "../types";

export interface Subcategoria { id: string; nombre: string; claves: string }
export interface Grupo { id: string; nombre: string; subcategorias: Subcategoria[] }
export interface FuenteLugares { tipo: "local" | "overpass"; fecha_datos: string | null; total: number | null }
export interface Catalogo { principales: string[]; grupos: Grupo[]; fuente: FuenteLugares }

type Lugares = FeatureCollection & { truncado?: boolean };

// ---------- Geomarketing ----------
export interface Rubro {
  id: string; nombre: string; grupo: string; icono: string; radio: number; minutos: number; estandar: number;
  competencia: string[]; imanes: string[];
}
export interface PropsHexagono {
  id: number; lon: number; lat: number; valida: boolean; recomendable: boolean; no_residencial: number; uso_principal: string | null;
  poblacion: number; demanda: number; competencia: number; imanes: number; competidor_cercano: number | null;
  i_demanda: number | null; i_brecha: number | null; i_imanes: number | null;
}
export interface PuntoGeo { nombre: string | null; subcategoria: string; lon: number; lat: number; competidor: boolean }
export interface AnalisisGeo {
  rubro: Omit<Rubro, "competencia" | "imanes">;
  resumen: {
    area_km2: number; poblacion: number; competidores: number; habitantes_por_establecimiento: number | null;
    establecimientos_sugeridos: number; brecha: number;
  };
  /** Zona analizada [oeste, sur, este, norte] */
  zona: [number, number, number, number];
  hexagonos: FeatureCollection<Polygon, PropsHexagono>;
  puntos: PuntoGeo[];
}

/** ¿Qué negocio falta aquí? */
export type EstadoCobertura = "falta" | "equilibrio" | "saturado" | "poca_poblacion";
export interface RubroZona {
  id: string; nombre: string; grupo: string; icono: string; competidores: number; esperados: number; brecha: number;
  cobertura: number | null; habitantes_por_establecimiento: number | null; estandar: number; imanes: number;
  /** Con qué se calculó lo esperado: misma cantidad por habitante que el entorno o misma proporción del comercio */
  referencia: "poblacion" | "mezcla";
  estado: EstadoCobertura;
}
export interface PerfilZona {
  area_km2: number; poblacion: number; negocios: number; negocios_por_mil: number | null; negocios_por_mil_entorno: number | null;
  rubros: RubroZona[]; perfil: { subcategoria: string; cantidad: number }[];
  zona: [number, number, number, number];
}

/** Ficha de un local candidato */
export interface EvaluacionPunto {
  rubro: { id: string; nombre: string; radio: number; estandar: number; minutos: number };
  punto: { lon: number; lat: number };
  uso_suelo: string | null;
  anillos: { minutos: number; radio: number; poblacion: number; competidores: number }[];
  poblacion_radio: number; competencia_radio: number; habitantes_por_competidor: number;
  veredicto: "favorable" | "moderado" | "dificil";
  competidor_cercano: number | null;
  competidores: { nombre: string | null; subcategoria: string; lon: number; lat: number; distancia: number }[];
  imanes: { subcategoria: string; cantidad: number }[];
}

// ---------- Buscador nacional de lugares ----------
export interface Localidad {
  id: number; nombre: string; tipo: string; contexto: string | null; lon: number; lat: number;
  tiene_limite: boolean;
  /** [oeste, sur, este, norte] de los lugares con polígono (límites, urbanizaciones, sitios…) */
  caja: [number, number, number, number] | null;
}

/** Sugerencia en vivo del geocodificador de Esri (no se guarda) */
export interface SugerenciaEsri { texto: string; clave: string }
export interface UbicacionEsri { nombre: string; tipo: string; lon: number; lat: number; caja: [number, number, number, number] | null }

/** Cliente tipado del backend del visor (apps/visor/backend). */
export function useVisorApi() {
  const api = useApi(API_URL);
  return {
    listarCapas: () => api<CapaBD[]>("/capas"),
    geojson: (id: number, bbox?: string) =>
      api<FeatureCollection>(`/capas/${id}/geojson${bbox ? `?bbox=${bbox}` : ""}`),
    catalogo: () => api<Catalogo>("/lugares/categorias"),
    lugares: (categoria: string, bbox: string, nombre = "") =>
      api<Lugares>(`/lugares?${new URLSearchParams({ categoria, bbox, nombre })}`),
    buscarPorNombre: (q: string, bbox: string) =>
      api<Lugares>(`/lugares/buscar?${new URLSearchParams({ q, bbox })}`),
    localidades: (q: string) => api<Localidad[]>(`/localidades?${new URLSearchParams({ q })}`),
    limiteLocalidad: (id: number) => api<Geometry>(`/localidades/${id}/limite`),
    sugerenciasEsri: (q: string) => api<SugerenciaEsri[]>(`/localidades/esri?${new URLSearchParams({ q })}`),
    ubicarEsri: (s: SugerenciaEsri) =>
      api<UbicacionEsri>(`/localidades/esri/ubicar?${new URLSearchParams({ texto: s.texto, clave: s.clave })}`),
    limites: (nivel: 4 | 6 | 8, caja?: string) =>
      api<Geometry>(`/localidades/limites/${nivel}${caja ? `?${new URLSearchParams({ caja })}` : ""}`),
    rubros: () => api<Rubro[]>("/geomarketing/rubros"),
    geomarketing: (rubro: string, bbox: string) =>
      api<AnalisisGeo>(`/geomarketing/analisis?${new URLSearchParams({ rubro, bbox })}`),
    perfilZona: (bbox: string) => api<PerfilZona>(`/geomarketing/zona?${new URLSearchParams({ bbox })}`),
    evaluarPunto: (rubro: string, lon: number, lat: number) =>
      api<EvaluacionPunto>(`/geomarketing/punto?${new URLSearchParams({ rubro, lon: lon.toFixed(6), lat: lat.toFixed(6) })}`),
    interseccion: (id: number, geometry: Geometry) =>
      api<ResultadoInterseccion>(`/capas/${id}/interseccion`, { method: "POST", json: { geometry } }),
  };
}

export function useCapasBD() {
  const api = useVisorApi();
  return useQuery({ queryKey: ["capas"], queryFn: api.listarCapas });
}

export function useCatalogo() {
  const api = useVisorApi();
  return useQuery({ queryKey: ["catalogo-lugares"], queryFn: api.catalogo, staleTime: Infinity });
}

export function useRubros() {
  const api = useVisorApi();
  return useQuery({ queryKey: ["rubros"], queryFn: api.rubros, staleTime: Infinity });
}
