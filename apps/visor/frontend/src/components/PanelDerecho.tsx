import type { Feature } from "geojson";
import { ChevronLeft, ChevronRight, FileText, ListTree, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { iconoCategoria } from "../categorias";
import type { CapaMapa, Seleccion } from "../types";
import { CAMPOS_OCULTOS, centro, coincideNombre, direccionDe, etiquetaCampo, etiquetaElemento, formatoNumero, normalizar, tieneNombre } from "../utils";
import { Tarjeta, Vacio } from "./ui/Tarjeta";

const MAX_LISTA = 300;

/**
 * Lista de elementos con una pestaña por categoría (capa visible). Muestra solo los nombres;
 * los elementos sin nombre no se listan. El buscador filtra dentro de la pestaña activa.
 */
export function ListaElementos({ capas, seleccion, onElegir, filtros, onFiltro }: {
  capas: CapaMapa[];
  seleccion: Seleccion | null;
  onElegir: (s: Seleccion) => void;
  /** Texto de búsqueda de cada pestaña (id de capa → texto tal como se escribió) */
  filtros: Record<string, string>;
  onFiltro: (capaId: string, texto: string) => void;
}) {

  const visiblesCapas = capas.filter(c => c.visible);
  const [pestana, setPestana] = useState<string | null>(null);

  // Elementos con nombre de cada capa, y los que coinciden con el buscador
  const porCapa = useMemo(() => new Map(visiblesCapas.map(c => {
    const conNombre = c.datos.features.map((f, indice) => ({ f, indice })).filter(({ f }) => tieneNombre(f));
    const filtroCapa = normalizar((filtros[c.id] ?? "").trim());
    return [c.id, { conNombre, coinciden: conNombre.filter(({ f, indice }) => coincideNombre(f, filtroCapa, indice)) }];
  })), [visiblesCapas, filtros]);

  // Al elegir un elemento en el mapa, se abre la pestaña de su categoría
  useEffect(() => {
    if (seleccion && visiblesCapas.some(c => c.id === seleccion.capaId)) setPestana(seleccion.capaId);
  }, [seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  const capa = visiblesCapas.find(c => c.id === pestana) ?? visiblesCapas[0];
  const filtro = capa ? filtros[capa.id] ?? "" : "";
  const escribir = (texto: string) => capa && onFiltro(capa.id, texto);

  // Al cambiar de pestaña (con clic o al elegir un elemento en el mapa) se borra la búsqueda
  // de las demás categorías: vuelven a verse completas en la lista y en el mapa.
  useEffect(() => {
    Object.entries(filtros).forEach(([id, texto]) => {
      if (id !== capa?.id && texto) onFiltro(id, "");
    });
  }, [capa?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const datos = capa ? porCapa.get(capa.id) : undefined;
  const filas = datos?.coinciden ?? [];
  const esSel = (indice: number) => seleccion?.capaId === capa?.id && seleccion?.indice === indice;
  // El seleccionado siempre aparece en la lista, aunque esté fuera de los primeros resultados
  const mostrar = filas.slice(0, MAX_LISTA);
  const sel = filas.find(x => esSel(x.indice));
  if (sel && !mostrar.includes(sel)) mostrar.unshift(sel);
  const sinNombre = capa ? capa.datos.features.length - (datos?.conNombre.length ?? 0) : 0;

  const activoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activoRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [seleccion, capa?.id]);

  // Pestañas: una sola fila horizontal; la activa siempre a la vista
  const filaPestanas = useRef<HTMLDivElement>(null);
  const pestanaActiva = useRef<HTMLButtonElement>(null);
  const [desplazable, setDesplazable] = useState({ izquierda: false, derecha: false });
  const medir = () => {
    const el = filaPestanas.current;
    if (el) setDesplazable({ izquierda: el.scrollLeft > 4, derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  const mover = (sentido: number) => filaPestanas.current?.scrollBy({ left: sentido * 180, behavior: "smooth" });
  useEffect(() => {
    pestanaActiva.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    medir();
  }, [capa?.id, visiblesCapas.length]);
  const borde = (visible: boolean) => (visible ? "transparent 0, #000 36px" : "#000 0");
  const mascara = `linear-gradient(to right, ${borde(desplazable.izquierda)}, ${desplazable.derecha ? "#000 calc(100% - 36px), transparent 100%" : "#000 100%"})`;

  return (
    <Tarjeta icono={ListTree} titulo="Elementos" llenar peso={3}>
      {visiblesCapas.length === 0 ? <Vacio>Los elementos de las capas visibles aparecerán aquí.</Vacio> : (
        <div className="sticky -top-3 z-10 -mx-4 -mt-3 mb-2 bg-panel border-b border-line">
          {/* Pestañas: una por categoría */}
          <div className="relative px-4 pt-3 pb-2">
            {desplazable.izquierda && (
              <button onClick={() => mover(-1)} aria-label="Pestañas anteriores"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 size-7 grid place-items-center rounded-full bg-panel border border-line text-gray-300 shadow hover:text-cian">
                <ChevronLeft className="size-4" />
              </button>
            )}
            {desplazable.derecha && (
              <button onClick={() => mover(1)} aria-label="Más pestañas"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 size-7 grid place-items-center rounded-full bg-panel border border-line text-gray-300 shadow hover:text-cian">
                <ChevronRight className="size-4" />
              </button>
            )}
          <div ref={filaPestanas} role="tablist" aria-label="Categorías" onScroll={medir}
            onWheel={e => { if (e.deltaY && filaPestanas.current) filaPestanas.current.scrollLeft += e.deltaY; }}
            style={{ maskImage: mascara, WebkitMaskImage: mascara }}
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visiblesCapas.map(c => {
              const Icono = c.origen === "lugares" ? iconoCategoria(c.categoria) : null;
              const activa = c.id === capa?.id;
              const n = porCapa.get(c.id)?.coinciden.length ?? 0;
              return (
                <button key={c.id} role="tab" aria-selected={activa} onClick={() => setPestana(c.id)} title={c.nombre}
                  ref={activa ? pestanaActiva : undefined}
                  className={`shrink-0 flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-full border font-titulo text-xs transition-colors ${activa ? "bg-cian border-cian text-ink font-semibold" : "border-line bg-ink/60 text-gray-300 hover:border-white/25"}`}>
                  {Icono ? <Icono className="size-3.5" /> : <span className="size-2.5 rounded-full" style={{ background: c.color }} />}
                  <span className="whitespace-nowrap">{c.nombre}</span>
                  {activa && filtro.trim() && <Search className="size-3" aria-label="con búsqueda" />}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${activa ? "bg-ink/15" : "bg-white/10 text-gray-400"}`}>{formatoNumero(n)}</span>
                </button>
              );
            })}
          </div>
          </div>

          {/* Buscador (dentro de la pestaña) */}
          <div className="px-4 pb-2">
            <label className="relative block">
              <span className="sr-only">Buscar por nombre</span>
              <Search className="size-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={filtro} onChange={e => escribir(e.target.value)} onKeyDown={e => e.key === "Escape" && escribir("")}
                placeholder={capa ? `Buscar en ${capa.nombre.toLowerCase()}…` : "Buscar por nombre…"}
                className={`input-field !py-2 !pl-9 !pr-8 !text-[13px] font-titulo ${filtro ? "!border-cian" : ""}`} />
              {filtro && (
                <button onClick={() => escribir("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" aria-label="Borrar búsqueda">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <p className="mt-1.5 text-[11px] text-gray-500" aria-live="polite">
              {filtro ? <><b className="text-cian tabular-nums">{formatoNumero(filas.length)}</b> de {formatoNumero(datos?.conNombre.length ?? 0)} con ese nombre</>
                : <>{formatoNumero(datos?.conNombre.length ?? 0)} con nombre</>}
              {sinNombre > 0 && <> · {formatoNumero(sinNombre)} sin nombre no se listan</>}
            </p>
          </div>
        </div>
      )}

      {capa && filas.length === 0 && <Vacio>{filtro ? "Ningún elemento de esta categoría coincide con esa búsqueda." : "Ningún elemento de esta categoría tiene nombre."}</Vacio>}
      <ul role="tabpanel" className="space-y-1">
        {capa && mostrar.map(({ f, indice }) => {
          const activo = esSel(indice);
          return (
            <li key={`${capa.id}-${indice}`}>
              <button ref={activo ? activoRef : undefined} onClick={() => onElegir({ capaId: capa.id, indice })} aria-current={activo}
                className={`relative w-full overflow-hidden rounded-lg border pl-4 pr-3 py-1.5 text-left transition-colors ${activo ? "border-cian/60 bg-cian/10" : "border-transparent bg-ink/50 hover:border-white/15 hover:bg-ink/80"}`}>
                <span className={`absolute left-0 inset-y-0 ${activo ? "w-1.5" : "w-1"}`} style={{ background: activo ? "var(--color-cian)" : capa.color }} />
                <span className={`block font-titulo text-[13px] font-medium leading-snug truncate ${activo ? "text-white" : "text-gray-100"}`}>
                  {etiquetaElemento(f, indice)}
                </span>
                <span className={`block text-[11px] leading-snug truncate ${direccionDe(f) ? "text-gray-400" : "text-gray-600 italic"}`}>
                  {direccionDe(f) ?? "Dirección no registrada"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {filas.length > MAX_LISTA && (
        <p className="text-[11px] text-gray-500 mt-2">Se muestran {MAX_LISTA} de {formatoNumero(filas.length)}. Usa el buscador o la tabla de atributos.</p>
      )}
    </Tarjeta>
  );
}

export function Detalles({ capa, elemento, indice, onCerrar }: {
  capa: CapaMapa | null;
  elemento: Feature | null;
  indice: number;
  onCerrar: () => void;
}) {
  if (!capa || !elemento) {
    return (
      <Tarjeta icono={FileText} titulo="Detalles">
        <p className="text-sm text-gray-400 text-center py-3 leading-relaxed">
          Selecciona un elemento en el mapa, la lista o la tabla para ver sus detalles.
        </p>
      </Tarjeta>
    );
  }
  const c = centro(elemento);
  const props = Object.entries(elemento.properties ?? {}).filter(([k]) => !CAMPOS_OCULTOS.has(k));
  return (
    <Tarjeta icono={FileText} titulo="Detalles" llenar peso={2}
      extra={<button onClick={onCerrar} className="size-7 grid place-items-center rounded-md text-gray-400 hover:text-white hover:bg-white/5" title="Quitar selección" aria-label="Quitar selección"><X className="size-4" /></button>}>
      <div className="flex items-start gap-3 mb-3">
        <span className="size-3.5 mt-1 rounded-full shrink-0 ring-2 ring-panel" style={{ background: capa.color }} />
        <h3 className="min-w-0 font-titulo text-base font-bold leading-snug break-words">{etiquetaElemento(elemento, indice)}</h3>
      </div>
      {props.length === 0 && !c ? <Vacio>Este elemento no tiene atributos.</Vacio> : (
        <dl className="divide-y divide-line rounded-lg border border-line overflow-hidden text-xs">
          {props.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 px-3 py-2 bg-ink/40">
              <dt className="text-gray-400 truncate" title={k}>{etiquetaCampo(k)}</dt>
              <dd className="text-gray-100 break-words">{v === null || v === undefined ? "—" : String(v)}</dd>
            </div>
          ))}
          {c && (
            <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 px-3 py-2 bg-ink/40">
              <dt className="text-gray-400">Ubicación</dt>
              <dd className="font-mono text-cian tabular-nums break-words">{c.lat.toFixed(6)}, {c.lng.toFixed(6)}</dd>
            </div>
          )}
        </dl>
      )}
    </Tarjeta>
  );
}
