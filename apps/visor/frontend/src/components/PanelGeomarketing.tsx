import type L from "leaflet";
import {
  BarChart3, Check, ChevronDown, Crosshair, Download, Info, ListChecks, Loader2, LocateFixed, MapPinned, Scale, SlidersHorizontal,
  Search, Store, Target, Trash2, TrendingUp, Users, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCatalogo, useRubros, useVisorApi, type AnalisisGeo, type EstadoCobertura, type EvaluacionPunto, type PerfilZona, type Rubro,
} from "../api/visor";
import { iconoCategoria } from "../categorias";
import {
  VARIABLES, descargar, distanciaM, nombreUso, tablaCSV, type Pesos, type Recomendado, type ResultadoHex, type VariableMapa,
} from "../geomarketing";
import type { Zona } from "../types";
import { areaZonaKm2, formatoArea, formatoNumero, normalizar } from "../utils";
import { Tarjeta, Vacio } from "./ui/Tarjeta";

const AREA_MAXIMA_KM2 = 40;
/** Puntos que se pueden comparar a la vez */
export const MAX_PUNTOS = 3;
export const LETRAS = ["A", "B", "C"];

const CONTROLES: { clave: keyof Pesos; nombre: string; ayuda: string }[] = [
  { clave: "demanda", nombre: "Población cercana", ayuda: "Personas que viven a pocos minutos a pie" },
  { clave: "brecha", nombre: "Poca competencia", ayuda: "Habitantes por cada negocio del mismo rubro" },
  { clave: "imanes", nombre: "Lugares que atraen clientes", ayuda: "Colegios, paraderos, clínicas… según el rubro" },
];

type Modo = "donde" | "falta" | "punto";
const MODOS: { id: Modo; nombre: string; icono: LucideIcon }[] = [
  { id: "donde", nombre: "Dónde abrir", icono: Target },
  { id: "falta", nombre: "Qué falta", icono: ListChecks },
  { id: "punto", nombre: "Evaluar local", icono: Crosshair },
];

const ESTADOS: Record<EstadoCobertura, { nombre: string; clase: string }> = {
  falta: { nombre: "Faltan", clase: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" },
  equilibrio: { nombre: "Equilibrado", clase: "bg-sky-400/15 text-sky-300 ring-sky-400/30" },
  saturado: { nombre: "Saturado", clase: "bg-orange-400/15 text-orange-300 ring-orange-400/30" },
  poca_poblacion: { nombre: "Zona chica", clase: "bg-white/5 text-gray-400 ring-white/10" },
};
const FILTROS: { id: EstadoCobertura | "todos"; nombre: string }[] = [
  { id: "falta", nombre: "Faltan" }, { id: "equilibrio", nombre: "Equilibrados" }, { id: "saturado", nombre: "Saturados" }, { id: "todos", nombre: "Todos" },
];

const VEREDICTOS: Record<EvaluacionPunto["veredicto"], { nombre: string; texto: string; clase: string }> = {
  favorable: { nombre: "Favorable", texto: "Hay bastante población por cada competidor.", clase: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" },
  moderado: { nombre: "Moderado", texto: "El mercado está cerca del estándar: hay que diferenciarse.", clase: "bg-sky-400/15 text-sky-300 ring-sky-400/30" },
  dificil: { nombre: "Difícil", texto: "Mucha competencia para la población que vive cerca.", clase: "bg-orange-400/15 text-orange-300 ring-orange-400/30" },
};

function Insignia({ clase, children }: { clase: string; children: React.ReactNode }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${clase}`}>{children}</span>;
}

function Dato({ titulo, valor, ancho = false }: { titulo: string; valor: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={`rounded-lg border border-line bg-ink/60 p-2.5 ${ancho ? "col-span-2" : ""}`}>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-gray-500">{titulo}</dt>
      <dd className="text-lg font-bold tabular-nums">{valor}</dd>
    </div>
  );
}

/** Ícono de cada grupo de rubros (los grupos vienen de app/services/geomarketing.py: GRUPOS_RUBROS) */
const ICONO_GRUPO: Record<string, string> = {
  "Comida y bebida": "comer", "Comercio": "compras", "Salud": "salud", "Belleza y deporte": "bienestar",
  "Servicios": "servicios", "Educación y hospedaje": "educacion",
};

/**
 * Rubros en una lista propia (no un <select> nativo): se abre siempre hacia abajo, dentro del panel,
 * con buscador y el ícono de cada rubro. Teclado: ↑ ↓ para moverse, Enter para elegir, Esc para cerrar.
 */
function SelectorRubro({ rubros, valor, onCambio }: { rubros: Rubro[]; valor: string; onCambio: (id: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [indice, setIndice] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const sel = rubros.find(r => r.id === valor);
  const Icono = iconoCategoria(sel?.icono);

  const visibles = useMemo(() => {
    const consulta = normalizar(texto.trim());
    return consulta ? rubros.filter(r => normalizar(`${r.nombre} ${r.grupo}`).includes(consulta)) : rubros;
  }, [rubros, texto]);
  const grupos = [...new Set(visibles.map(r => r.grupo))];

  const abrir = () => {
    setTexto("");
    setIndice(Math.max(0, rubros.findIndex(r => r.id === valor)));
    setAbierto(true);
  };
  const elegir = (id: string) => {
    onCambio(id);
    setAbierto(false);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // La lista entera a la vista dentro del panel, y la opción marcada dentro de la lista
  useEffect(() => {
    if (abierto) lista.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [abierto]);
  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice, abierto]);

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndice(i => Math.min(visibles.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndice(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (visibles[indice]) elegir(visibles[indice].id); }
    else if (e.key === "Escape") { e.preventDefault(); setAbierto(false); }
  };

  return (
    <div ref={caja} className="mb-2">
      <span className="block text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Rubro</span>
      <div className="relative">
        <button
          type="button" onClick={() => (abierto ? setAbierto(false) : abrir())} aria-expanded={abierto} aria-haspopup="listbox"
          className="input-field !py-2 !pl-2 !pr-8 !text-xs flex items-center gap-2 text-left relative"
        >
          <span className="grid place-items-center size-6 shrink-0 rounded-md bg-cian/15 text-cian"><Icono className="size-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-white">{sel?.nombre ?? "Elige un rubro"}</span>
            {sel && <span className="block truncate text-[10px] text-gray-500">{sel.grupo}</span>}
          </span>
          <ChevronDown className={`size-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
  
        {abierto && (
          <div ref={lista} className="absolute left-0 right-0 top-full mt-1 z-[1000] rounded-lg border border-line bg-[#0a1430] shadow-2xl shadow-black/60">
            <div className="relative p-2 border-b border-line">
              <Search className="size-3.5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                autoFocus value={texto} placeholder="Buscar rubro… (ej. farmacia, café)"
                onChange={e => { setTexto(e.target.value); setIndice(0); }} onKeyDown={teclas}
                className="input-field !py-1.5 !pl-7 !text-xs"
              />
            </div>
            <div role="listbox" className="max-h-72 overflow-y-auto py-1">
              {visibles.length === 0 && <p className="px-3 py-4 text-center text-xs text-gray-500">Ningún rubro coincide con «{texto}»</p>}
              {grupos.map(g => {
                const IconoGrupo = iconoCategoria(ICONO_GRUPO[g]);
                return (
                  <div key={g}>
                    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                      <IconoGrupo className="size-3" /> {g}
                    </div>
                    {visibles.filter(r => r.grupo === g).map(r => {
                      const i = visibles.indexOf(r);
                      const IconoRubro = iconoCategoria(r.icono);
                      const elegido = r.id === valor;
                      return (
                        <button
                          key={r.id} type="button" role="option" aria-selected={elegido} data-indice={i}
                          onMouseEnter={() => setIndice(i)} onClick={() => elegir(r.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs ${i === indice ? "bg-cian/10" : ""}`}
                        >
                          <span className={`grid place-items-center size-6 shrink-0 rounded-md ${elegido ? "bg-cian text-ink" : "bg-white/5 text-cian"}`}>
                            <IconoRubro className="size-3.5" />
                          </span>
                          <span className={`flex-1 truncate ${elegido ? "font-semibold text-cian" : "text-gray-200"}`}>{r.nombre}</span>
                          <span className="shrink-0 text-[10px] text-gray-500 tabular-nums">{r.minutos} min</span>
                          {elegido && <Check className="size-3.5 text-cian shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {sel && (
        <span className="block text-[11px] text-gray-500 mt-1.5">
          Radio de influencia: <b className="text-gray-300">{sel.minutos} min a pie</b> ({sel.radio} m) ·
          estándar referencial: 1 cada {formatoNumero(sel.estandar)} hab.
        </span>
      )}
    </div>
  );
}

export function PanelGeomarketing({
  map, zona, onZona, analisis, onAnalisis, resultado, pesos, onPesos, top, onElegirTop, variable, onVariable, nTop, onNTop,
  evaluaciones, onEvaluaciones, activa, onActiva,
}: {
  map: L.Map | null;
  zona: Zona | null;
  onZona: (z: Zona) => void;
  analisis: AnalisisGeo | null;
  onAnalisis: (a: AnalisisGeo | null) => void;
  resultado: Map<number, ResultadoHex> | null;
  pesos: Pesos;
  onPesos: (p: Pesos) => void;
  top: Recomendado[];
  onElegirTop: (id: number, lat: number, lon: number) => void;
  variable: VariableMapa;
  onVariable: (v: VariableMapa) => void;
  nTop: number;
  onNTop: (n: number) => void;
  evaluaciones: EvaluacionPunto[];
  onEvaluaciones: (e: EvaluacionPunto[]) => void;
  activa: number;
  onActiva: (i: number) => void;
}) {
  const api = useVisorApi();
  const { data: rubros } = useRubros();
  const { data: catalogo } = useCatalogo();
  const [modo, setModo] = useState<Modo>("donde");
  const [rubroId, setRubroId] = useState("botica");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [perfil, setPerfil] = useState<PerfilZona | null>(null);
  const [filtro, setFiltro] = useState<EstadoCobertura | "todos">("falta");
  const [esperandoClic, setEsperandoClic] = useState(false);

  const nombreSub = useMemo(() => {
    const m = new Map<string, string>();
    catalogo?.grupos.forEach(g => g.subcategorias.forEach(s => m.set(s.id, s.nombre)));
    return m;
  }, [catalogo]);
  const sub = (id: string) => (nombreSub.get(id) ?? id).toLowerCase();

  /** Zona ya elegida o, si no hay, la vista actual del mapa (sin los bordes) */
  function zonaActual(): Zona | null {
    if (!map) return null;
    let z = zona;
    if (!z) {
      const b = map.getBounds().pad(-0.08);
      z = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    }
    const km2 = areaZonaKm2(z);
    if (km2 > AREA_MAXIMA_KM2) {
      setError(`Acércate un poco más a una zona: el área visible es de ${formatoArea(km2)} y el máximo es ${AREA_MAXIMA_KM2} km².`);
      return null;
    }
    setError("");
    return z;
  }
  const bbox = (z: Zona) => z.map(v => v.toFixed(5)).join(",");

  async function analizar(id = rubroId) {
    const z = zonaActual();
    if (!z) return;
    setCargando(true);
    try {
      const datos = await api.geomarketing(id, bbox(z));
      if (!zona) onZona(z);
      onAnalisis(datos);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function analizarFaltantes() {
    const z = zonaActual();
    if (!z) return;
    setCargando(true);
    try {
      const datos = await api.perfilZona(bbox(z));
      if (!zona) onZona(z);
      setPerfil(datos);
      // Si nada falta, se muestran todos
      if (!datos.rubros.some(r => r.estado === "falta")) setFiltro("todos");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  // ---- Evaluar un local ----
  async function evaluar(lat: number, lon: number) {
    setEsperandoClic(false);
    setCargando(true);
    setError("");
    try {
      const ev = await api.evaluarPunto(rubroId, lon, lat);
      const lista = [...evaluaciones, ev].slice(-MAX_PUNTOS);
      onEvaluaciones(lista);
      onActiva(lista.length - 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  // Esperando el clic en el mapa: cursor de mira y el clic no abre la ficha de los hexágonos
  useEffect(() => {
    if (!map || !esperandoClic) return;
    const contenedor = map.getContainer();
    contenedor.classList.add("gh-mira");
    // «preclick» llega aunque el clic caiga en un hexágono (su ficha detiene el «click»); la ficha se cierra enseguida
    const clic = (e: L.LeafletMouseEvent) => { setTimeout(() => map.closePopup()); evaluar(e.latlng.lat, e.latlng.lng); };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setEsperandoClic(false);
    map.on("preclick", clic);
    window.addEventListener("keydown", tecla);
    return () => { contenedor.classList.remove("gh-mira"); map.off("preclick", clic); window.removeEventListener("keydown", tecla); };
  });

  /** Al cambiar de rubro, los puntos ya elegidos se vuelven a evaluar con el nuevo */
  async function cambiarRubro(id: string) {
    setRubroId(id);
    if (modo !== "punto" || evaluaciones.length === 0) return;
    setCargando(true);
    try {
      onEvaluaciones(await Promise.all(evaluaciones.map(ev => api.evaluarPunto(id, ev.punto.lon, ev.punto.lat))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  const r = analisis?.resumen;
  const ev = evaluaciones[activa] ?? null;
  // Puntaje del hexágono donde cae el punto, si el mapa de oportunidad es del mismo rubro
  const hexDelPunto = useMemo(() => {
    if (!ev || !analisis || !resultado || analisis.rubro.id !== ev.rubro.id) return null;
    let mejor: { id: number; d: number } | null = null;
    for (const f of analisis.hexagonos.features) {
      const d = distanciaM(f.properties, ev.punto);
      if (d < 130 && (!mejor || d < mejor.d)) mejor = { id: f.properties.id, d };
    }
    return mejor ? resultado.get(mejor.id) ?? null : null;
  }, [ev, analisis, resultado]);

  return (
    <>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-panel p-1" role="tablist" aria-label="Tipo de análisis">
        {MODOS.map(m => (
          <button key={m.id} role="tab" aria-selected={modo === m.id} onClick={() => { setModo(m.id); setError(""); setEsperandoClic(false); }}
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 font-titulo text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${modo === m.id ? "bg-cian/15 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
            <m.icono className={`size-4 ${modo === m.id ? "text-cian" : ""}`} />
            {m.nombre}
          </button>
        ))}
      </div>

      {/* ============ ¿Dónde abro mi negocio? ============ */}
      {modo === "donde" && (
        <>
          <Tarjeta icono={Target} titulo="¿Dónde pongo mi negocio?">
            <p className="text-[11px] text-gray-400 mb-3">
              {zona
                ? <>Se analizará la <b className="text-cian">zona ya seleccionada</b> ({formatoArea(areaZonaKm2(zona))}). Para otra área usa «Nueva zona».</>
                : <>El primer análisis define la zona (la vista actual del mapa) y las categorías usarán la misma.</>}
            </p>
            {rubros && <SelectorRubro rubros={rubros} valor={rubroId} onCambio={cambiarRubro} />}
            <button onClick={() => analizar()} disabled={cargando || !map} className="btn-gold rounded-full w-full py-2.5 mt-1 text-xs uppercase flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
              {cargando ? "Analizando…" : "Analizar zona"}
            </button>
            {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
          </Tarjeta>

          {analisis && r && (
            <>
              <Tarjeta icono={Users} titulo={`Resumen · ${analisis.rubro.nombre}`}>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Dato titulo="Población estimada" valor={formatoNumero(r.poblacion)} />
                  <Dato titulo="Registrados" valor={formatoNumero(r.competidores)} />
                  <div className="rounded-lg border border-line bg-ink/60 p-2.5 col-span-2">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Habitantes por establecimiento</dt>
                    <dd className="text-sm">
                      <b className="text-lg tabular-nums">{r.habitantes_por_establecimiento ? formatoNumero(r.habitantes_por_establecimiento) : "—"}</b>
                      <span className="text-gray-400"> · estándar 1 cada {formatoNumero(analisis.rubro.estandar)}</span>
                    </dd>
                    <dd className="text-[11px] mt-1 text-gray-300">
                      {r.brecha > 0
                        ? <>Según el estándar, faltarían unos <b className="text-cian">{formatoNumero(r.brecha)}</b> establecimientos.</>
                        : <>La zona está cubierta o saturada según el estándar.</>}
                    </dd>
                  </div>
                </dl>
                <p className="flex gap-1.5 text-[10px] text-gray-500 mt-2 leading-snug">
                  <Info className="size-3 shrink-0 mt-0.5" />
                  Población: Kontur 2023 (estimada). Negocios: OpenStreetMap + Overture Maps, que no registran todos
                  (sobre todo bodegas): la brecha es referencial; el mapa compara lugares dentro de la zona.
                </p>
              </Tarjeta>

              <Tarjeta icono={BarChart3} titulo="Ver en el mapa">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variable pintada en los hexágonos">
                  {VARIABLES.map(v => (
                    <button key={v.id} role="radio" aria-checked={v.id === variable.id} onClick={() => onVariable(v)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${v.id === variable.id ? "border-cian bg-cian/15 text-white" : "border-line bg-ink/60 text-gray-300 hover:border-white/25"}`}>
                      {v.id === "demanda" ? `Población a ${analisis.rubro.minutos} min` : v.nombre}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex h-2.5 rounded overflow-hidden" aria-hidden="true">
                    {variable.colores.map(c => <span key={c} className="flex-1" style={{ background: c }} />)}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1"><span>{variable.bajo}</span><span>{variable.alto}</span></div>
                </div>
              </Tarjeta>

              <Tarjeta icono={SlidersHorizontal} titulo="¿Qué es más importante para ti?">
                <div className="space-y-3">
                  {CONTROLES.map(c => (
                    <label key={c.clave} className="block">
                      <span className="flex justify-between text-xs">
                        <span className="text-gray-200">{c.nombre}</span>
                        <span className="tabular-nums text-cian">{pesos[c.clave]}</span>
                      </span>
                      <input type="range" min={0} max={100} step={5} value={pesos[c.clave]} aria-describedby={`ayuda-${c.clave}`}
                        onChange={e => onPesos({ ...pesos, [c.clave]: Number(e.target.value) })}
                        className="w-full accent-cyan-400 cursor-pointer" />
                      <span id={`ayuda-${c.clave}`} className="block text-[10px] text-gray-500">{c.ayuda}</span>
                    </label>
                  ))}
                </div>
              </Tarjeta>

              <Tarjeta icono={MapPinned} titulo="Mejores lugares" extra={
                <select value={nTop} onChange={e => onNTop(Number(e.target.value))} aria-label="Cantidad de lugares"
                  className="rounded-md border border-line bg-ink px-1.5 py-0.5 text-[11px] text-gray-200 cursor-pointer">
                  {[3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
                </select>
              }>
                {top.length === 0 ? <Vacio>No se encontraron lugares con población en la zona.</Vacio> : (
                  <ol className="space-y-2">
                    {top.map(t => (
                      <li key={t.hex.id}>
                        <button onClick={() => onElegirTop(t.hex.id, t.hex.lat, t.hex.lon)}
                          className="w-full text-left rounded-lg border border-line bg-ink/60 p-3 hover:border-cian/60 transition-colors">
                          <span className="flex items-center gap-2 mb-1">
                            <span className="size-6 grid place-items-center rounded-full bg-gold text-ink font-bold text-xs">{t.puesto}</span>
                            <span className="font-titulo text-sm font-semibold">Oportunidad {t.puntaje}/100</span>
                          </span>
                          <span className="block text-[11px] text-gray-300 leading-snug">
                            Unas <b>{formatoNumero(t.hex.demanda)}</b> personas viven a {analisis.rubro.minutos} min a pie.{" "}
                            {t.competidoresCerca === 0
                              ? <>No hay {analisis.rubro.nombre.toLowerCase()} registrados en ese radio.</>
                              : <>{t.competidoresCerca} {t.competidoresCerca === 1 ? "competidor" : "competidores"} en ese radio
                                {t.hex.competidor_cercano !== null && <>; el más cercano a {formatoNumero(t.hex.competidor_cercano)} m</>}.</>}
                            {t.imanesCerca.length > 0 && (
                              <> Cerca: {t.imanesCerca.slice(0, 3).map(i => `${i.cantidad} ${sub(i.subcategoria)}`).join(", ")}.</>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => resultado && descargar(`geomarketing-${analisis.rubro.id}.csv`, tablaCSV(analisis, resultado))}
                    disabled={!resultado} className="btn-ghost rounded-full py-2 text-xs flex items-center justify-center gap-1.5">
                    <Download className="size-3.5" /> Exportar CSV
                  </button>
                  <button onClick={() => onAnalisis(null)} className="btn-ghost rounded-full py-2 text-xs">Quitar del mapa</button>
                </div>
              </Tarjeta>
            </>
          )}
        </>
      )}

      {/* ============ ¿Qué negocio falta aquí? ============ */}
      {modo === "falta" && (
        <>
          <Tarjeta icono={ListChecks} titulo="¿Qué negocio falta aquí?">
            <p className="text-[11px] text-gray-400 mb-3">
              Para cada uno de los {rubros?.length ?? ""} rubros, compara los negocios por habitante
              de {zona ? <b className="text-cian">la zona seleccionada</b> : "la vista actual del mapa"} con los de su
              entorno (unos 5 km alrededor): así se ve qué falta y qué sobra en comparación con los barrios vecinos.
            </p>
            <button onClick={analizarFaltantes} disabled={cargando || !map} className="btn-gold rounded-full w-full py-2.5 text-xs uppercase flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
              {cargando ? "Analizando…" : perfil ? "Volver a analizar" : "Analizar zona"}
            </button>
            {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
          </Tarjeta>

          {perfil && (
            <>
              <Tarjeta icono={Users} titulo="Perfil de la zona">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Dato titulo="Población estimada" valor={formatoNumero(perfil.poblacion)} />
                  <Dato titulo="Lugares registrados" valor={formatoNumero(perfil.negocios)} />
                  <div className="rounded-lg border border-line bg-ink/60 p-2.5 col-span-2">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Lugares por cada 1 000 hab.</dt>
                    <dd className="text-sm">
                      <b className="text-lg tabular-nums">{perfil.negocios_por_mil ?? "—"}</b>
                      {perfil.negocios_por_mil_entorno !== null && <span className="text-gray-400"> · entorno {perfil.negocios_por_mil_entorno}</span>}
                    </dd>
                    {perfil.negocios_por_mil !== null && perfil.negocios_por_mil_entorno !== null && (
                      <dd className="text-[11px] mt-1 text-gray-300">
                        {perfil.negocios_por_mil > perfil.negocios_por_mil_entorno * 1.3
                          ? "Zona comercial: atrae a gente de otros barrios (trabajo, compras)."
                          : perfil.negocios_por_mil < perfil.negocios_por_mil_entorno * 0.7
                            ? "Zona sobre todo residencial: sus vecinos compran fuera."
                            : "Comercio parecido al de los barrios vecinos."}
                      </dd>
                    )}
                  </div>
                </dl>
              </Tarjeta>

              <Tarjeta icono={Store} titulo="Rubros según la población">
                <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Filtrar rubros">
                  {FILTROS.map(f => {
                    const n = f.id === "todos" ? perfil.rubros.length : perfil.rubros.filter(x => x.estado === f.id).length;
                    return (
                      <button key={f.id} role="radio" aria-checked={filtro === f.id} onClick={() => setFiltro(f.id)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${filtro === f.id ? "border-cian bg-cian/15 text-white" : "border-line bg-ink/60 text-gray-300 hover:border-white/25"}`}>
                        {f.nombre} <span className="text-gray-500 tabular-nums">{n}</span>
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const lista = perfil.rubros.filter(x => filtro === "todos" || x.estado === filtro);
                  if (lista.length === 0) return <Vacio>Ningún rubro en este grupo.</Vacio>;
                  return (
                    <ul className="space-y-1.5">
                      {lista.map(x => {
                        const Icono = iconoCategoria(x.icono);
                        const e = ESTADOS[x.estado];
                        // Barra: registrados vs. esperados; la marca blanca es la densidad del entorno (cobertura = 1)
                        const ancho = x.cobertura === null ? 0 : Math.min(x.cobertura, 2) / 2 * 100;
                        return (
                          <li key={x.id} className="rounded-lg border border-line bg-ink/60 p-2.5">
                            <div className="flex items-center gap-2">
                              <Icono className="size-4 text-cian shrink-0" />
                              <span className="flex-1 min-w-0 truncate text-xs font-titulo text-white">{x.nombre}</span>
                              <Insignia clase={e.clase}>{e.nombre}</Insignia>
                            </div>
                            <div className="relative h-1.5 rounded bg-white/10 mt-2" aria-hidden="true">
                              <span className={`absolute inset-y-0 left-0 rounded ${x.estado === "saturado" ? "bg-orange-400" : x.estado === "falta" ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${ancho}%` }} />
                              <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-white/70" />
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                              <b className="text-gray-200">{formatoNumero(x.competidores)}</b> registrados · {x.referencia === "mezcla" ? "con la mezcla de negocios del entorno" : "con la densidad del entorno"} serían ~{formatoNumero(x.esperados)}
                              {x.habitantes_por_establecimiento !== null && <> · 1 cada {formatoNumero(x.habitantes_por_establecimiento)} hab.</>}
                            </p>
                            <button onClick={() => { setRubroId(x.id); setModo("donde"); analizar(x.id); }}
                              className="mt-1.5 text-[11px] text-cian hover:underline">
                              Ver dónde abrir →
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
                <p className="flex gap-1.5 text-[10px] text-gray-500 mt-3 leading-snug">
                  <Info className="size-3 shrink-0 mt-0.5" />
                  «Faltan»: menos del 60 % de lo esperado; «Saturado»: más del 130 %. Lo esperado usa la referencia más exigente:
                  los negocios por habitante del entorno o, en zonas comerciales, la proporción de cada rubro entre todos sus negocios. En zonas
                  comerciales es normal que haya más negocios: atienden también a quienes trabajan o compran ahí.
                </p>
              </Tarjeta>

              <Tarjeta icono={BarChart3} titulo="Qué hay en la zona" abiertaInicial={false}>
                <ul className="space-y-1.5">
                  {perfil.perfil.map(p => (
                    <li key={p.subcategoria} className="text-[11px]">
                      <span className="flex justify-between gap-2">
                        <span className="text-gray-300 truncate first-letter:uppercase">{sub(p.subcategoria)}</span>
                        <span className="tabular-nums text-gray-400">{formatoNumero(p.cantidad)}</span>
                      </span>
                      <span className="block h-1 rounded bg-cian/70 mt-0.5" style={{ width: `${(p.cantidad / perfil.perfil[0].cantidad) * 100}%` }} />
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            </>
          )}
        </>
      )}

      {/* ============ Evaluar un local ============ */}
      {modo === "punto" && (
        <>
          <Tarjeta icono={Crosshair} titulo="Evaluar un local">
            <p className="text-[11px] text-gray-400 mb-3">
              ¿Ya tienes un local en mente? Márcalo en el mapa y mira cuánta gente vive a 5, 10 y 15 minutos a pie y quién compite
              contigo. Puedes comparar hasta {MAX_PUNTOS} locales.
            </p>
            {rubros && <SelectorRubro rubros={rubros} valor={rubroId} onCambio={cambiarRubro} />}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => setEsperandoClic(e => !e)} disabled={cargando || !map} aria-pressed={esperandoClic}
                className={`rounded-full py-2.5 text-xs uppercase flex items-center justify-center gap-1.5 ${esperandoClic ? "btn-ghost ring-2 ring-cian" : "btn-gold"}`}>
                {cargando ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
                {esperandoClic ? "Haz clic…" : "En el mapa"}
              </button>
              <button onClick={() => { const c = map?.getCenter(); if (c) evaluar(c.lat, c.lng); }} disabled={cargando || !map}
                className="btn-ghost rounded-full py-2.5 text-xs flex items-center justify-center gap-1.5">
                <LocateFixed className="size-4" /> Centro del mapa
              </button>
            </div>
            {esperandoClic && <p className="text-[11px] text-cian mt-2">Haz clic en el mapa donde estaría el local (Esc para cancelar).</p>}
            {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}
          </Tarjeta>

          {evaluaciones.length > 0 && (
            <div className="flex gap-1.5" role="tablist" aria-label="Locales evaluados">
              {evaluaciones.map((e, i) => (
                <button key={`${e.punto.lat},${e.punto.lon}`} role="tab" aria-selected={i === activa} onClick={() => { onActiva(i); map?.panTo([e.punto.lat, e.punto.lon]); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-titulo transition-colors ${i === activa ? "border-cian bg-cian/15 text-white" : "border-line bg-panel text-gray-400 hover:text-white"}`}>
                  <span className="size-5 grid place-items-center rounded-full bg-cian text-ink text-[10px] font-bold">{LETRAS[i]}</span>
                  {VEREDICTOS[e.veredicto].nombre}
                </button>
              ))}
              <button onClick={() => { onEvaluaciones([]); onActiva(0); }} title="Quitar los locales" aria-label="Quitar los locales"
                className="rounded-lg border border-line bg-panel px-2 text-gray-400 hover:text-red-300">
                <Trash2 className="size-4" />
              </button>
            </div>
          )}

          {ev && (
            <Tarjeta icono={Store} titulo={`Local ${LETRAS[activa]} · ${ev.rubro.nombre}`}>
              <div className="flex items-start gap-2 mb-3">
                <Insignia clase={VEREDICTOS[ev.veredicto].clase}>{VEREDICTOS[ev.veredicto].nombre}</Insignia>
                <p className="text-[11px] text-gray-300 leading-snug">{VEREDICTOS[ev.veredicto].texto}</p>
              </div>
              {ev.uso_suelo && (
                <p className="text-[11px] text-amber-300/90 mb-3 leading-snug">
                  Ojo: el punto cae en un área registrada como <b>{nombreUso(ev.uso_suelo)}</b>. Verifica que ahí pueda haber un local.
                </p>
              )}
              <table className="w-full text-[11px] tabular-nums mb-3">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.1em] text-gray-500">
                    <th className="text-left font-normal pb-1">A pie</th><th className="text-right font-normal pb-1">Hab.</th>
                    <th className="text-right font-normal pb-1 pl-2">Compet.</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.anillos.map(a => (
                    <tr key={a.minutos} className="border-t border-line">
                      <td className="py-1.5 text-gray-300">{a.minutos} min <span className="text-gray-500">({formatoNumero(a.radio)} m)</span></td>
                      <td className="py-1.5 text-right text-white">{formatoNumero(a.poblacion)}</td>
                      <td className="py-1.5 text-right text-white">{a.competidores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Dato titulo="Hab. por competidor" valor={formatoNumero(ev.habitantes_por_competidor)} />
                <Dato titulo="Competidor más cerca" valor={ev.competidor_cercano === null ? "—" : `${formatoNumero(ev.competidor_cercano)} m`} />
              </dl>
              <p className="text-[10px] text-gray-500 mt-1.5">
                En {ev.rubro.minutos} min a pie (radio del rubro) viven {formatoNumero(ev.poblacion_radio)} personas;
                el estándar es 1 {ev.rubro.nombre.toLowerCase()} cada {formatoNumero(ev.rubro.estandar)} hab.
                {hexDelPunto && <> En el mapa de oportunidad, este punto tiene <b className="text-cian">{hexDelPunto.puntaje}/100</b>.</>}
              </p>

              {ev.competidores.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Competidores más cercanos</div>
                  <ul className="space-y-0.5">
                    {ev.competidores.slice(0, 5).map((c, i) => (
                      <li key={i}>
                        <button onClick={() => map?.setView([c.lat, c.lon], Math.max(map.getZoom(), 17))}
                          className="w-full flex justify-between gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-white/5 text-left">
                          <span className="truncate text-gray-200">{c.nombre ?? `(${sub(c.subcategoria)} sin nombre)`}</span>
                          <span className="tabular-nums text-gray-400 shrink-0">{formatoNumero(c.distancia)} m</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ev.imanes.length > 0 && (
                <p className="text-[11px] text-gray-300 mt-3 leading-snug">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500 block mb-1">Atraen clientes ({ev.rubro.minutos} min)</span>
                  {ev.imanes.map(i => `${i.cantidad} ${sub(i.subcategoria)}`).join(" · ")}
                </p>
              )}
            </Tarjeta>
          )}

          {evaluaciones.length >= 2 && <Comparacion evaluaciones={evaluaciones} />}
        </>
      )}
    </>
  );
}

/** Tabla comparativa de los locales evaluados; se resalta el mejor de cada fila. */
function Comparacion({ evaluaciones }: { evaluaciones: EvaluacionPunto[] }) {
  const filas: { nombre: string; valores: (number | null)[]; mejor: "max" | "min"; sufijo?: string }[] = [
    ...evaluaciones[0].anillos.map((a, k) => ({ nombre: `Hab. a ${a.minutos} min`, valores: evaluaciones.map(e => e.anillos[k].poblacion), mejor: "max" as const })),
    { nombre: "Competencia (radio)", valores: evaluaciones.map(e => e.competencia_radio), mejor: "min" },
    { nombre: "Hab. por competidor", valores: evaluaciones.map(e => e.habitantes_por_competidor), mejor: "max" },
    { nombre: "Competidor más cerca", valores: evaluaciones.map(e => e.competidor_cercano), mejor: "max", sufijo: " m" },
    { nombre: "Atractores", valores: evaluaciones.map(e => e.imanes.reduce((s, i) => s + i.cantidad, 0)), mejor: "max" },
  ];
  const mismoRubro = evaluaciones.every(e => e.rubro.id === evaluaciones[0].rubro.id);
  return (
    <Tarjeta icono={Scale} titulo="Comparar locales">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr>
            <th />
            {evaluaciones.map((_, i) => (
              <th key={i} className="text-right pb-1">
                <span className="inline-grid size-5 place-items-center rounded-full bg-cian text-ink text-[10px] font-bold">{LETRAS[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const validos = f.valores.filter((v): v is number => v !== null);
            const objetivo = validos.length > 1 ? (f.mejor === "max" ? Math.max(...validos) : Math.min(...validos)) : null;
            return (
              <tr key={f.nombre} className="border-t border-line">
                <td className="py-1.5 text-gray-400">{f.nombre}</td>
                {f.valores.map((v, i) => (
                  <td key={i} className={`py-1.5 text-right ${v !== null && v === objetivo ? "text-cian font-bold" : "text-gray-200"}`}>
                    {v === null ? "—" : `${formatoNumero(v, Number.isInteger(v) ? 0 : 1)}${f.sufijo ?? ""}`}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t border-line">
            <td className="py-1.5 text-gray-400">Veredicto</td>
            {evaluaciones.map((e, i) => <td key={i} className="py-1.5 text-right text-white">{VEREDICTOS[e.veredicto].nombre}</td>)}
          </tr>
        </tbody>
      </table>
      {!mismoRubro && <p className="text-[10px] text-amber-300/80 mt-2">Los locales se evaluaron con rubros distintos.</p>}
      <p className="text-[10px] text-gray-500 mt-2">En celeste, el mejor valor de cada fila.</p>
    </Tarjeta>
  );
}

