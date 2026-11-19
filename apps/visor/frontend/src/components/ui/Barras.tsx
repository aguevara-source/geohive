import { useRef, useState } from "react";
import { ORO_DATOS } from "../../config";
import { formatoNumero } from "../../utils";

export interface DatoBarra {
  etiqueta: string;
  valor: number;
  /** Color de identidad (ej. el de la capa en el mapa). Si falta, se usa el dorado de datos. */
  color?: string;
}

/**
 * Barras horizontales: cada barra lleva su etiqueta y su valor escritos (la identidad nunca
 * depende solo del color). Al pasar el cursor se muestra el valor y su porcentaje del total.
 */
export function Barras({ datos, unidad = "" }: { datos: DatoBarra[]; unidad?: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; d: DatoBarra } | null>(null);
  const maximo = Math.max(...datos.map(d => d.valor), 1);
  const total = datos.reduce((s, d) => s + d.valor, 0);

  function mover(e: React.MouseEvent, d: DatoBarra) {
    const r = contenedor.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, d });
  }

  return (
    <div ref={contenedor} className="relative" onMouseLeave={() => setTip(null)}>
      <ul className="flex flex-col gap-[2px]" role="list">
        {datos.map(d => (
          <li
            key={d.etiqueta}
            onMouseMove={e => mover(e, d)}
            className={`grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2 h-7 px-1.5 rounded-md transition-colors ${tip?.d === d ? "bg-white/[0.06]" : ""}`}
          >
            <span className="truncate text-[11px] text-gray-300" title={d.etiqueta}>{d.etiqueta}</span>
            <span className="h-3 flex items-center">
              <span
                className="h-3 rounded-r-[4px] min-w-[3px] block"
                style={{ width: `${(d.valor / maximo) * 100}%`, background: d.color ?? ORO_DATOS }}
              />
            </span>
            <span className="text-[11px] tabular-nums text-gray-400 text-right min-w-[2.5rem]">{formatoNumero(d.valor)}</span>
          </li>
        ))}
      </ul>

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 rounded-lg border border-line bg-ink/95 px-3 py-2 text-xs shadow-xl whitespace-nowrap"
          style={{ left: Math.min(tip.x + 14, (contenedor.current?.clientWidth ?? 300) - 150), top: tip.y + 14 }}
        >
          <div className="flex items-center gap-1.5 text-gray-300">
            <span className="size-2.5 rounded-sm" style={{ background: tip.d.color ?? ORO_DATOS }} />
            {tip.d.etiqueta}
          </div>
          <div className="mt-0.5 text-white font-semibold tabular-nums">
            {formatoNumero(tip.d.valor)} {unidad}
            <span className="text-gray-400 font-normal"> · {formatoNumero((tip.d.valor / (total || 1)) * 100, 1)} %</span>
          </div>
        </div>
      )}
    </div>
  );
}
