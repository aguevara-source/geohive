import type { Resultado } from "../api/geocodificador";

export function ListaResultados({ resultados, seleccionado, onSeleccionar }: {
  resultados: Resultado[];
  seleccionado: number | null;
  onSeleccionar: (i: number) => void;
}) {
  return (
    <ul className="space-y-2 text-sm">
      {resultados.map((r, i) => (
        <li key={i}>
          <button onClick={() => onSeleccionar(i)}
            className={`w-full text-left rounded-lg p-3 transition ${i === seleccionado ? "bg-gold/15 border border-gold/40" : "bg-white/5 hover:bg-white/10"}`}>
            <div className="text-gray-200">{r.direccion}</div>
            <div className="text-[11px] text-gold font-mono mt-1">{r.lat.toFixed(6)}, {r.lng.toFixed(6)}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
