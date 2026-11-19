import { ChevronDown, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/**
 * Tarjeta plegable de los paneles laterales.
 * Con «llenar», la tarjeta reparte la altura del panel con sus hermanas según su «peso»
 * y desplaza su contenido por dentro: así varias tarjetas nunca se montan entre sí.
 */
export function Tarjeta({ icono: Icono, titulo, extra, children, abiertaInicial = true, llenar = false, peso = 1, className = "" }: {
  icono: LucideIcon;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
  abiertaInicial?: boolean;
  llenar?: boolean;
  peso?: number;
  className?: string;
}) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  const id = useId();

  return (
    <section
      className={`rounded-xl border border-line bg-panel ${llenar ? "flex flex-col min-h-0 basis-0" : ""} ${className}`}
      style={llenar ? { flexGrow: abierta ? peso : 0, flexBasis: abierta ? 0 : "auto" } : undefined}
    >
      <div className="flex items-center shrink-0">
        <button
          onClick={() => setAbierta(a => !a)}
          aria-expanded={abierta}
          aria-controls={id}
          className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-3 font-titulo text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-200 hover:text-cian transition-colors"
        >
          <Icono className="size-4 text-cian shrink-0" />
          <span className="flex-1 text-left truncate">{titulo}</span>
          <ChevronDown className={`size-4 text-gray-400 transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
        {extra && <div className="pr-3">{extra}</div>}
      </div>
      {abierta && (
        <div id={id} className={`border-t border-line px-4 py-3 ${llenar ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>
          {children}
        </div>
      )}
    </section>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-xs text-gray-500 leading-relaxed">{children}</p>;
}
