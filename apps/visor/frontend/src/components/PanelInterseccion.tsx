import { useMutation } from "@tanstack/react-query";
import type L from "leaflet";
import { Eraser, Pencil, Play, Shapes } from "lucide-react";
import { useState } from "react";
import { useCapasBD, useVisorApi } from "../api/visor";
import type { Dibujo } from "../hooks";
import { ajustarVista, formatoNumero } from "../utils";
import { Tarjeta } from "./ui/Tarjeta";

/** Dibuja un polígono y procesa en PostGIS los elementos de una capa que lo intersectan. */
export function PanelInterseccion({ map, dibujo, onResultado }: {
  map: L.Map | null;
  dibujo: Dibujo;
  onResultado: (areaHa: number) => void;
}) {
  const { data: capas } = useCapasBD();
  const api = useVisorApi();
  const [capaId, setCapaId] = useState<number | "">("");
  const capa = capas?.find(c => c.id === capaId) ?? capas?.[0];

  const analisis = useMutation({
    mutationFn: () => {
      const anillo = dibujo.vertices.map(p => [p.lng, p.lat]);
      return api.interseccion(capa!.id, { type: "Polygon", coordinates: [[...anillo, anillo[0]]] });
    },
    onSuccess: res => {
      dibujo.setResultado(res.resultado, { capa: capa!.nombre, area_ha: res.area_ha, total: res.total });
      if (res.total) ajustarVista(map, res.resultado);
      onResultado(res.area_ha);
    },
  });

  return (
    <Tarjeta icono={Shapes} titulo="Análisis de intersección">
      <ol className="text-[11px] text-gray-400 space-y-1 mb-3 list-decimal list-inside">
        <li>Elige la capa a analizar.</li>
        <li>Pulsa el lápiz y marca los vértices en el mapa (mínimo 3).</li>
        <li>Procesa: PostGIS devuelve los elementos que cruzan el polígono.</li>
      </ol>
      <label htmlFor="capa-analisis" className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Capa</label>
      <select id="capa-analisis" className="input-field !py-2 !text-xs mt-1 mb-3" value={capa?.id ?? ""}
        onChange={e => setCapaId(Number(e.target.value))}>
        {capas?.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => { analisis.reset(); dibujo.iniciar(); }} title="Dibujar polígono"
          className={`btn-ghost rounded-lg py-2 flex justify-center ${dibujo.activo ? "!border-gold text-gold" : ""}`}>
          <Pencil className="size-4" />
        </button>
        <button onClick={() => { dibujo.terminar(); analisis.mutate(); }} title="Procesar"
          disabled={dibujo.vertices.length < 3 || !capa || analisis.isPending}
          className="btn-gold rounded-lg py-2 flex justify-center">
          <Play className="size-4" />
        </button>
        <button onClick={() => { analisis.reset(); dibujo.limpiar(); }} title="Limpiar" className="btn-ghost rounded-lg py-2 flex justify-center">
          <Eraser className="size-4" />
        </button>
      </div>

      <div className="text-xs text-gray-400 mt-3 min-h-5" aria-live="polite">
        {dibujo.activo && `Marcando vértices: ${dibujo.vertices.length}.`}
        {analisis.isPending && "Procesando en el servidor…"}
        {analisis.error && <span className="text-red-400">{analisis.error.message}</span>}
        {dibujo.analisis && !dibujo.activo && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-ink/60 p-2.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Área</div>
              <div className="text-lg font-bold text-white tabular-nums">{formatoNumero(dibujo.analisis.area_ha, 1)} <span className="text-xs text-gray-400">ha</span></div>
            </div>
            <div className="rounded-lg border border-line bg-ink/60 p-2.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Elementos</div>
              <div className="text-lg font-bold text-white tabular-nums">{formatoNumero(dibujo.analisis.total)}</div>
            </div>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}
