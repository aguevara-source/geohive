import type L from "leaflet";
import { Database, Loader2, PlusCircle } from "lucide-react";
import { useState } from "react";
import { useCapasBD, useVisorApi } from "../api/visor";
import type { CapasMapa } from "../hooks";
import type { CapaBD } from "../types";
import { ajustarVista } from "../utils";
import { Tarjeta, Vacio } from "./ui/Tarjeta";

export function PanelCapasBD({ map, capas }: { map: L.Map | null; capas: CapasMapa }) {
  const { data, isLoading, error } = useCapasBD();
  const api = useVisorApi();
  const [soloVista, setSoloVista] = useState(true);
  const [cargando, setCargando] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");

  async function cargar(capa: CapaBD) {
    if (!map) return;
    const b = map.getBounds();
    const bbox = soloVista ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => v.toFixed(6)).join(",") : undefined;
    setCargando(capa.id);
    setAviso("");
    try {
      const datos = await api.geojson(capa.id, bbox);
      if (!datos.features.length) {
        setAviso(`«${capa.nombre}» no tiene elementos en esta zona. Desmarca «solo la vista actual» o aleja el mapa.`);
        return;
      }
      capas.agregar(capa.nombre, datos, "bd");
      ajustarVista(map, datos);
    } catch (e) {
      setAviso((e as Error).message);
    } finally {
      setCargando(null);
    }
  }

  return (
    <Tarjeta icono={Database} titulo="Capas disponibles">
      {isLoading && <Vacio>Cargando catálogo…</Vacio>}
      {error && <p className="text-xs text-red-400">{(error as Error).message}</p>}
      {data?.length === 0 && <Vacio>No hay capas publicadas.</Vacio>}
      <ul className="space-y-2">
        {data?.map(c => (
          <li key={c.id}>
            <button onClick={() => cargar(c)} disabled={cargando !== null}
              className="w-full flex items-center gap-3 rounded-lg border border-line bg-ink/60 px-3 py-2.5 text-left hover:border-gold/60 transition-colors">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate">{c.nombre}</span>
                {c.descripcion && <span className="block text-[11px] text-gray-400 truncate">{c.descripcion}</span>}
              </span>
              {cargando === c.id ? <Loader2 className="size-4 text-gold animate-spin" /> : <PlusCircle className="size-4 text-gold" />}
            </button>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 text-[11px] text-gray-400 mt-3">
        <input type="checkbox" checked={soloVista} onChange={e => setSoloVista(e.target.checked)} className="accent-yellow-500" />
        Cargar solo la vista actual
      </label>
      {aviso && <p className="text-[11px] text-gold-light mt-2">{aviso}</p>}
    </Tarjeta>
  );
}
