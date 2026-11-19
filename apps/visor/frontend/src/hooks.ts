import type { FeatureCollection } from "geojson";
import type { LatLng } from "leaflet";
import { useCallback, useState } from "react";
import { COLORES, COLOR_SIN_SLOT } from "./config";
import type { Analisis, CapaMapa, Zona } from "./types";

/** Capas cargadas en el mapa (desde la BD o desde archivos). */
export function useCapasMapa() {
  const [lista, setLista] = useState<CapaMapa[]>([]);

  const agregar = useCallback((nombre: string, datos: FeatureCollection, origen: CapaMapa["origen"], categoria?: string, zona?: Zona) => {
    const id = crypto.randomUUID();
    setLista(prev => {
      // El color sigue a la capa: se toma el primer color libre y no cambia aunque se quiten otras
      const usados = new Set(prev.map(c => c.color));
      const color = COLORES.find(c => !usados.has(c)) ?? COLOR_SIN_SLOT;
      return [...prev, { id, nombre, datos, origen, categoria, zona, visible: true, color }];
    });
    return id;
  }, []);

  const actualizarDatos = useCallback((id: string, datos: FeatureCollection, zona?: Zona) => {
    setLista(prev => prev.map(c => (c.id === id ? { ...c, datos, zona, version: (c.version ?? 0) + 1 } : c)));
  }, []);

  const alternar = useCallback((id: string) => {
    setLista(prev => prev.map(c => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }, []);

  const quitar = useCallback((id: string) => {
    setLista(prev => prev.filter(c => c.id !== id));
  }, []);

  return { lista, agregar, actualizarDatos, alternar, quitar };
}

export type CapasMapa = ReturnType<typeof useCapasMapa>;

/** Estado de la herramienta de dibujo y del último análisis de intersección. */
export function useDibujo() {
  const [activo, setActivo] = useState(false);
  const [vertices, setVertices] = useState<LatLng[]>([]);
  const [resultado, setResultadoEstado] = useState<FeatureCollection | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [version, setVersion] = useState(0); // identifica cada resultado nuevo

  return {
    activo,
    vertices,
    resultado,
    analisis,
    version,
    setResultado: (r: FeatureCollection, a: Analisis) => {
      setResultadoEstado(r);
      setAnalisis(a);
      setVersion(v => v + 1);
    },
    iniciar: () => { setVertices([]); setResultadoEstado(null); setAnalisis(null); setActivo(true); },
    terminar: () => setActivo(false),
    agregar: (p: LatLng) => setVertices(v => [...v, p]),
    limpiar: () => { setActivo(false); setVertices([]); setResultadoEstado(null); setAnalisis(null); },
  };
}

export type Dibujo = ReturnType<typeof useDibujo>;
