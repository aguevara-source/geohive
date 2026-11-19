import { BarChart3, Info, Layers, MapPinned, Navigation, Shapes, Target, type LucideIcon } from "lucide-react";
import type { Vista } from "../types";

const VISTAS: { id: Vista; titulo: string; icono: LucideIcon }[] = [
  { id: "buscar", titulo: "Buscar lugares del Perú", icono: MapPinned },
  { id: "capas", titulo: "Capas", icono: Layers },
  { id: "analisis", titulo: "Análisis espacial", icono: Shapes },
  { id: "ubicacion", titulo: "Ubicación", icono: Navigation },
  { id: "geomarketing", titulo: "Geomarketing: ¿dónde pongo mi negocio?", icono: Target },
];

/** Barra de iconos: cambia el contenido del panel izquierdo. */
export function Riel({ vista, panelAbierto, onVista, onEstadisticas }: {
  vista: Vista;
  panelAbierto: boolean;
  onVista: (v: Vista) => void;
  onEstadisticas: () => void;
}) {
  const boton = "size-11 grid place-items-center rounded-xl transition-colors";
  return (
    <nav aria-label="Secciones del visor" className="w-16 shrink-0 flex flex-col items-center gap-2 py-3 border-r border-line bg-ink">
      {VISTAS.map(({ id, titulo, icono: Icono }) => {
        const activo = vista === id && panelAbierto;
        return (
          <button key={id} onClick={() => onVista(id)} title={titulo} aria-label={titulo} aria-pressed={activo}
            className={`${boton} ${activo ? "bg-cian/15 text-cian ring-1 ring-cian/40" : "text-gray-400 hover:text-cian hover:bg-white/5"}`}>
            <Icono className="size-5" />
          </button>
        );
      })}
      <button onClick={onEstadisticas} title="Estadísticas" aria-label="Estadísticas"
        className={`${boton} text-gray-400 hover:text-cian hover:bg-white/5`}>
        <BarChart3 className="size-5" />
      </button>
      <a href="/api/visor/docs" target="_blank" rel="noreferrer" title="Documentación de la API" aria-label="Documentación de la API"
        className={`${boton} mt-auto text-gray-500 hover:text-cian`}>
        <Info className="size-5" />
      </a>
    </nav>
  );
}
