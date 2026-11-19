import type L from "leaflet";
import { Database, Eye, EyeOff, File, Layers, MapPin, Trash2, ZoomIn } from "lucide-react";
import type { CapasMapa } from "../hooks";
import { ajustarVista, formatoNumero } from "../utils";
import { MarcaCapa } from "./Mapa";
import { Tarjeta, Vacio } from "./ui/Tarjeta";

export function PanelCapas({ map, capas }: { map: L.Map | null; capas: CapasMapa }) {
  return (
    <Tarjeta icono={Layers} titulo={`Capas en el mapa (${capas.lista.length})`}>
      {capas.lista.length === 0 && <Vacio>Agrega una capa de la base de datos o carga un archivo.</Vacio>}
      <ul className="space-y-2">
        {capas.lista.map(c => {
          const Origen = c.origen === "bd" ? Database : c.origen === "lugares" ? MapPin : File;
          const Ojo = c.visible ? Eye : EyeOff;
          return (
            <li key={c.id} className={`flex items-center gap-2.5 rounded-lg border border-line bg-ink/60 px-3 py-2 ${c.visible ? "" : "opacity-50"}`}>
              <MarcaCapa capa={c} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate" title={c.nombre}>{c.nombre}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Origen className="size-3" /> {formatoNumero(c.datos.features.length)} elementos
                </span>
              </span>
              <button onClick={() => capas.alternar(c.id)} title={c.visible ? "Ocultar" : "Mostrar"} className="text-gray-400 hover:text-gold"><Ojo className="size-4" /></button>
              <button onClick={() => ajustarVista(map, c.datos)} title="Acercar" className="text-gray-400 hover:text-gold"><ZoomIn className="size-4" /></button>
              <button onClick={() => capas.quitar(c.id)} title="Quitar" className="text-gray-400 hover:text-red-400"><Trash2 className="size-4" /></button>
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
