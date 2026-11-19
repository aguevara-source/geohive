import { useApi } from "@geohive/auth";
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection, Point } from "geojson";
import { API_URL } from "../config";

export interface Resultado {
  lat: number;
  lng: number;
  direccion: string;
  tipo?: string | null;
}

export interface Lote {
  id: string;
  nombre_archivo: string;
  pais: string;
  total: number;
  procesados: number;
  encontrados: number;
  estado: "pendiente" | "procesando" | "completado";
  creado_en: string;
  terminado_en: string | null;
}

/** Cliente tipado del backend del geocodificador (apps/geocodificador/backend). */
export function useGeocodificadorApi() {
  const api = useApi(API_URL);
  return {
    buscar: (q: string, pais: string) => api<Resultado[]>(`/buscar?${new URLSearchParams({ q, pais })}`),
    inversa: (lat: number, lng: number) => api<Resultado | null>(`/inversa?lat=${lat}&lng=${lng}`),
    listarLotes: () => api<Lote[]>("/lotes"),
    crearLote: (archivo: File, pais: string) => {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("pais", pais);
      return api<{ id: string }>("/lotes", { method: "POST", body: form });
    },
    geojsonLote: (id: string) => api<FeatureCollection<Point>>(`/lotes/${id}/geojson`),
    csvLote: (id: string) => api<Blob>(`/lotes/${id}/csv`),
  };
}

export function useLotes() {
  const api = useGeocodificadorApi();
  return useQuery({
    queryKey: ["lotes"],
    queryFn: api.listarLotes,
    // Mientras haya lotes en proceso, se consulta el avance cada 3 segundos
    refetchInterval: q => (q.state.data?.some(l => l.estado !== "completado") ? 3000 : false),
  });
}
