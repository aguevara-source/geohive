import { Layers, MapPin, SquareDashed, type LucideIcon } from "lucide-react";

export type EstadoApp = "disponible" | "beta" | "proximamente";

export interface AppGeoHive {
  /** Igual al rol de acceso, a la audiencia del token y a la carpeta apps/<id> */
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  icono: LucideIcon;
  /** Ruta pública en el gateway */
  ruta: string;
  estado: EstadoApp;
}

/** Catálogo único: lo usan el portal (tarjetas) y las apps (selector del encabezado). */
export const APPS: AppGeoHive[] = [
  {
    id: "visor",
    nombre: "Visor GeoHive",
    categoria: "Visores",
    descripcion: "Visor WebGIS con capas desde PostGIS, carga de GeoJSON, mapas base y análisis espacial de intersección.",
    icono: Layers,
    ruta: "/visor/",
    estado: "disponible",
  },
  {
    id: "geocodificador",
    nombre: "Geocodificador",
    categoria: "Geocodificación",
    descripcion: "Convierte direcciones en coordenadas y viceversa. Procesamiento masivo de archivos CSV en el servidor.",
    icono: MapPin,
    ruta: "/geocodificador/",
    estado: "beta",
  },
  {
    id: "catastro",
    nombre: "Visor Catastral",
    categoria: "Visores",
    descripcion: "Consulta predial y capas catastrales conectadas a servicios WMS/WFS.",
    icono: SquareDashed,
    ruta: "/catastro/",
    estado: "proximamente",
  },
];

export const buscarApp = (id: string) => APPS.find(a => a.id === id);
