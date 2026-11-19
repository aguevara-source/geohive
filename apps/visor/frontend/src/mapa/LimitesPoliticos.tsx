import { useQueries, useQuery } from "@tanstack/react-query";
import type { PathOptions } from "leaflet";
import { useState } from "react";
import { GeoJSON, Pane, useMap, useMapEvents } from "react-leaflet";
import { useVisorApi } from "../api/visor";

/** Zoom desde el que aparece cada nivel (el país completo se ve con zoom ≈ 5,5) */
const ZOOM_PROVINCIAS = 7;
const ZOOM_DISTRITOS = 9;
/** Los distritos se piden por cuadrantes de 1° (se guardan en caché al moverse) */
const CUADRANTE = 1;
const MAX_CUADRANTES = 16;

/** Mapas base oscuros o de satélite: líneas claras para que se noten */
const BASE_OSCURA = /satélite|híbrido|oscuro|medianoche/i;

function estilos(oscuro: boolean, zoom: number): Record<"dep" | "prov" | "dist", PathOptions> {
  // Morado: el color clásico de los límites políticos, no se confunde con calles ni ríos
  const tinta = oscuro ? "#f5d0fe" : "#7e22ce";
  return {
    dep: { color: tinta, weight: zoom < ZOOM_PROVINCIAS ? 1.4 : 2.4, opacity: oscuro ? 0.75 : 0.55 },
    prov: { color: tinta, weight: zoom < ZOOM_DISTRITOS ? 1.1 : 1.6, opacity: oscuro ? 0.65 : 0.5, dashArray: "10 4" },
    dist: { color: tinta, weight: 1.2, opacity: oscuro ? 0.6 : 0.5, dashArray: "3 4" },
  };
}

/**
 * Límites políticos pintados por escala, como referencia tenue:
 * país → departamentos; al acercarse se suman provincias y luego distritos.
 */
export function LimitesPoliticos() {
  const map = useMap();
  const api = useVisorApi();
  const [zoom, setZoom] = useState(map.getZoom());
  const [caja, setCaja] = useState(map.getBounds());
  const [oscuro, setOscuro] = useState(false);
  useMapEvents({
    moveend: () => { setZoom(map.getZoom()); setCaja(map.getBounds()); },
    baselayerchange: e => setOscuro(BASE_OSCURA.test(e.name)),
  });

  const deps = useQuery({ queryKey: ["limites", 4], queryFn: () => api.limites(4), staleTime: Infinity });
  const provs = useQuery({ queryKey: ["limites", 6], queryFn: () => api.limites(6), staleTime: Infinity, enabled: zoom >= ZOOM_PROVINCIAS });

  const cuadrantes: [number, number][] = [];
  if (zoom >= ZOOM_DISTRITOS) {
    for (let x = Math.floor(caja.getWest()); x < caja.getEast(); x += CUADRANTE)
      for (let y = Math.floor(caja.getSouth()); y < caja.getNorth(); y += CUADRANTE) cuadrantes.push([x, y]);
  }
  const dists = useQueries({
    queries: cuadrantes.slice(0, MAX_CUADRANTES).map(([x, y]) => ({
      queryKey: ["limites", 8, x, y],
      queryFn: () => api.limites(8, `${x},${y},${x + CUADRANTE},${y + CUADRANTE}`),
      staleTime: Infinity,
    })),
  });

  const e = estilos(oscuro, zoom);
  const clave = `${oscuro}-${zoom >= ZOOM_PROVINCIAS}-${zoom >= ZOOM_DISTRITOS}`;
  return (
    // Debajo de las capas y de los puntos: solo referencia, sin capturar clics
    <Pane name="limites-politicos" style={{ zIndex: 350, pointerEvents: "none" }}>
      {dists.map((d, i) => d.data && (
        <GeoJSON key={`dist-${cuadrantes[i].join()}-${clave}`} data={d.data} style={e.dist} interactive={false} />
      ))}
      {zoom >= ZOOM_PROVINCIAS && provs.data && <GeoJSON key={`prov-${clave}`} data={provs.data} style={e.prov} interactive={false} />}
      {deps.data && <GeoJSON key={`dep-${clave}`} data={deps.data} style={e.dep} interactive={false} />}
    </Pane>
  );
}
