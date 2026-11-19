import { Check, ChevronLeft, ChevronRight, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { Catalogo } from "../api/visor";
import { iconoCategoria } from "../categorias";
import { normalizar } from "../utils";

function Fila({ icono: Icono, texto, detalle, onClick, flecha = false, activo = false, cargando = false, fuerte = false }: {
  icono: LucideIcon;
  texto: string;
  detalle?: string;
  onClick: () => void;
  flecha?: boolean;
  activo?: boolean;
  cargando?: boolean;
  fuerte?: boolean;
}) {
  return (
    <button onClick={onClick} aria-pressed={flecha ? undefined : activo}
      className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${activo ? "bg-cyan-50" : "hover:bg-gray-50"}`}>
      <span className={`size-9 shrink-0 grid place-items-center rounded-full ${activo ? "bg-cian text-ink" : "bg-[#f3f1ec] text-gray-700"}`}>
        {cargando ? <Loader2 className="size-4 animate-spin" /> : <Icono className="size-4" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-titulo text-sm truncate ${fuerte ? "font-semibold text-gray-900" : "text-gray-800"}`}>{texto}</span>
        {detalle && <span className="block text-[11px] text-gray-600 truncate">{detalle}</span>}
      </span>
      {flecha && <ChevronRight className="size-4 text-gray-400 shrink-0" />}
      {!flecha && activo && <Check className="size-4 text-cyan-600 shrink-0" />}
    </button>
  );
}

/**
 * Menú «Más»: buscador de categorías y lugares, grupos y subcategorías.
 * Elegir una categoría activa o quita su capa; las búsquedas por nombre traen lugares de cualquier tipo.
 */
export function MenuMas({ catalogo, activas, cargando, onElegir, onBuscarNombre, onCerrar }: {
  catalogo: Catalogo;
  activas: Set<string>;
  cargando: Set<string>;
  onElegir: (id: string, nombre: string) => void;
  onBuscarNombre: (texto: string) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const consulta = normalizar(texto.trim());
  const grupo = catalogo.grupos.find(g => g.id === grupoId);

  const coincidencias = consulta.length >= 2
    ? [
        ...catalogo.grupos.filter(g => normalizar(g.nombre).includes(consulta))
          .map(g => ({ id: g.id, nombre: `Todo ${g.nombre}`, detalle: "Grupo completo" })),
        ...catalogo.grupos.flatMap(g => g.subcategorias
          .filter(s => normalizar(`${s.nombre} ${s.claves}`).includes(consulta))
          .map(s => ({ id: s.id, nombre: s.nombre, detalle: g.nombre }))),
      ]
    : [];

  return (
    <div className="absolute right-0 mt-2 w-[23rem] max-w-[calc(100vw-6rem)] max-h-[70vh] flex flex-col rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-[0_8px_30px_rgba(0,0,0,0.25)] overflow-hidden"
      role="dialog" aria-label="Más categorías">
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 shrink-0">
        <label className="relative flex-1">
          <span className="sr-only">Buscar categorías o lugares</span>
          <Search className="size-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar: chifa, botica, cajero…"
            onKeyDown={e => { if (e.key === "Enter" && texto.trim().length >= 3) onBuscarNombre(texto.trim()); if (e.key === "Escape") onCerrar(); }}
            className="w-full rounded-full bg-[#f3f1ec] py-2.5 pl-10 pr-8 font-titulo text-sm text-gray-900 placeholder:text-gray-500 outline-none border border-transparent focus:border-cian focus:bg-white transition-colors" />
          {texto && (
            <button onClick={() => setTexto("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900" aria-label="Borrar búsqueda">
              <X className="size-4" />
            </button>
          )}
        </label>
        <button onClick={onCerrar} className="size-9 grid place-items-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900" aria-label="Cerrar">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {consulta ? (
          <>
            {consulta.length >= 3 && (
              <Fila icono={Search} texto={`Buscar «${texto.trim()}» por nombre`} detalle="Lugares de cualquier tipo en la zona visible"
                onClick={() => onBuscarNombre(texto.trim())} fuerte />
            )}
            {coincidencias.length > 0 && (
              <div className="px-2.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Categorías</div>
            )}
            {coincidencias.map(c => (
              <Fila key={c.id} icono={iconoCategoria(c.id)} texto={c.nombre} detalle={c.detalle}
                activo={activas.has(c.id)} cargando={cargando.has(c.id)} onClick={() => onElegir(c.id, c.nombre.replace(/^Todo /, ""))} />
            ))}
            {consulta.length >= 2 && coincidencias.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-600">No hay categorías con «{texto.trim()}». Puedes buscarlo por nombre.</p>
            )}
          </>
        ) : grupo ? (
          <>
            <button onClick={() => setGrupoId(null)} className="flex items-center gap-2 px-2.5 py-2 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="size-4" /> Todas las categorías
            </button>
            <Fila icono={iconoCategoria(grupo.id)} texto={`Todo ${grupo.nombre}`} fuerte
              activo={activas.has(grupo.id)} cargando={cargando.has(grupo.id)} onClick={() => onElegir(grupo.id, grupo.nombre)} />
            {grupo.subcategorias.map(s => (
              <Fila key={s.id} icono={iconoCategoria(s.id)} texto={s.nombre}
                activo={activas.has(s.id)} cargando={cargando.has(s.id)} onClick={() => onElegir(s.id, s.nombre)} />
            ))}
          </>
        ) : (
          catalogo.grupos.map(g => {
            const activasGrupo = g.subcategorias.filter(s => activas.has(s.id)).length + (activas.has(g.id) ? 1 : 0);
            return (
              <Fila key={g.id} icono={iconoCategoria(g.id)} texto={g.nombre} flecha
                detalle={activasGrupo ? `${activasGrupo} en el mapa` : undefined} onClick={() => setGrupoId(g.id)} />
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 px-4 py-2 text-[11px] text-gray-600">
        {catalogo.fuente.tipo === "local"
          ? <>Base de datos GeoHive: OpenStreetMap + Overture Maps{catalogo.fuente.fecha_datos && <> · {new Date(catalogo.fuente.fecha_datos).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</>}</>
          : <>Consulta en línea (puede tardar)</>}
      </div>
    </div>
  );
}
