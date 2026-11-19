import type L from "leaflet";
import { ChevronLeft, ChevronRight, Crop, LayoutGrid, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalogo, useVisorApi } from "../api/visor";
import { iconoCategoria } from "../categorias";
import type { CapasMapa } from "../hooks";
import type { Zona } from "../types";
import { areaZonaKm2, formatoArea, normalizar } from "../utils";

/** Área máxima de consulta (igual que en el servidor) */
const AREA_MAXIMA_KM2 = 40;
import { MenuMas } from "./MenuMas";

type Lugares = Awaited<ReturnType<ReturnType<typeof useVisorApi>["lugares"]>>;

/**
 * Botones de lugares de interés sobre el mapa. Al pulsar uno se buscan esos lugares en la vista actual
 * (base de datos GeoHive) y se agregan como capa; al pulsarlo de nuevo, la capa se quita.
 * La zona se define con la primera consulta y todas las demás categorías usan la misma,
 * aunque se acerque o mueva el mapa. «Nueva zona» la redefine con la vista actual.
 * «Más» abre el menú completo de categorías y la búsqueda por nombre.
 */
export function BarraCategorias({ map, capas, zona, onZona, onConsulta, onNuevaZona, zonaEnUso }: {
  map: L.Map | null;
  capas: CapasMapa;
  /** Zona de consulta común a todas las categorías (la define la primera consulta) */
  zona: Zona | null;
  onZona: (zona: Zona | null) => void;
  /** Se llama al empezar una nueva zona: limpia selección y búsquedas de la zona anterior */
  onNuevaZona: (zona: Zona) => void;
  /** Otro módulo (geomarketing) usa la zona: no se libera aunque no haya categorías */
  zonaEnUso: boolean;
  /** Avisa la zona que se está consultando (null al terminar con error) */
  onConsulta: (consulta: { zona: Zona; cargando: boolean } | null) => void;
}) {
  const api = useVisorApi();
  const { data: catalogo } = useCatalogo();
  const fila = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [cargando, setCargando] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const [masAbierto, setMasAbierto] = useState(false);
  const [desplazable, setDesplazable] = useState({ izquierda: false, derecha: false });

  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    catalogo?.grupos.forEach(g => { m.set(g.id, g.nombre); g.subcategorias.forEach(s => m.set(s.id, s.nombre)); });
    return m;
  }, [catalogo]);

  const capaDe = (clave: string) => capas.lista.find(c => c.categoria === clave);
  const activas = new Set(capas.lista.map(c => c.categoria).filter((c): c is string => !!c));

  function medir() {
    const el = fila.current;
    if (!el) return;
    setDesplazable({ izquierda: el.scrollLeft > 4, derecha: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }

  useEffect(() => {
    medir();
    const obs = new ResizeObserver(medir);
    if (fila.current) obs.observe(fila.current);
    return () => obs.disconnect();
  }, [catalogo]);

  useEffect(() => {
    if (!masAbierto) return;
    const cerrar = (e: MouseEvent) => !menu.current?.contains(e.target as Node) && setMasAbierto(false);
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [masAbierto]);

  useEffect(() => {
    if (!aviso || cargando.size) return;
    const t = setTimeout(() => setAviso(""), 6000);
    return () => clearTimeout(t);
  }, [aviso, cargando]);

  // Zona nueva: la vista actual con un margen del 8 %, para que su borde punteado se vea dentro del mapa
  function zonaDeLaVista(): Zona | null {
    if (!map) return null;
    const b = map.getBounds().pad(-0.08);
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }
  const aBbox = (z: Zona) => z.map(v => v.toFixed(5)).join(",");

  /** ¿La zona supera el máximo? Si es así, avisa y no se consulta. */
  function zonaMuyGrande(z: Zona): boolean {
    const km2 = areaZonaKm2(z);
    if (km2 <= AREA_MAXIMA_KM2) return false;
    setAviso(`Acércate un poco más a una zona: el área visible es de ${formatoArea(km2)} y el máximo es ${AREA_MAXIMA_KM2} km².`);
    return true;
  }

  // Sin capas de lugares, la zona se libera: la próxima consulta define una nueva
  const hayLugares = capas.lista.some(c => c.origen === "lugares");
  useEffect(() => {
    if (!hayLugares && !zonaEnUso && zona && !cargando.size) onZona(null);
  }, [hayLugares, zonaEnUso]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Redefine la zona con la vista actual y vuelve a consultar todas las categorías cargadas. */
  async function nuevaZona() {
    const nueva = zonaDeLaVista();
    if (!nueva || zonaMuyGrande(nueva)) return;
    const activasLugares = capas.lista.filter(c => c.origen === "lugares" && c.categoria);

    // 1. Limpiar todo lo de la zona anterior: marcadores, selección y búsquedas
    onNuevaZona(nueva);
    activasLugares.forEach(c => capas.actualizarDatos(c.id, { type: "FeatureCollection", features: [] }, nueva));
    onZona(nueva);
    if (!activasLugares.length) return;

    // 2. Cargar todas las categorías activas en la nueva zona (si una falla, las demás siguen)
    setAviso("Cargando datos…");
    onConsulta({ zona: nueva, cargando: true });
    setCargando(new Set(activasLugares.map(c => c.categoria!)));
    const resultados = await Promise.allSettled(activasLugares.map(async c => {
      const clave = c.categoria!;
      const datos = clave.startsWith("nombre:")
        ? await api.buscarPorNombre(clave.slice(7), aBbox(nueva))
        : await api.lugares(clave, aBbox(nueva));
      capas.actualizarDatos(c.id, datos, nueva);
      return datos.truncado ? c.nombre : null;
    }));
    setCargando(new Set());
    onConsulta({ zona: nueva, cargando: false });
    const fallidas = activasLugares.filter((_, i) => resultados[i].status === "rejected").map(c => c.nombre);
    const truncadas = resultados.flatMap(r => (r.status === "fulfilled" && r.value ? [r.value] : []));
    setAviso(fallidas.length ? `No se pudo cargar: ${fallidas.join(", ")}. Pulsa «Nueva zona» para reintentar.`
      : truncadas.length ? `${truncadas.join(", ")}: se muestran los primeros resultados. Acerca el mapa y pulsa «Nueva zona» para ver todos.` : "");
  }

  /** Activa o quita una capa de lugares identificada por «clave». */
  async function alternar(clave: string, nombre: string, obtener: (bbox: string) => Promise<Lugares>) {
    const existente = capaDe(clave);
    if (existente) return capas.quitar(existente.id);
    if (!map || cargando.has(clave)) return;
    const zonaConsulta = zona ?? zonaDeLaVista();
    if (!zonaConsulta || (!zona && zonaMuyGrande(zonaConsulta))) return;
    if (!zona) onZona(zonaConsulta);
    const bbox = aBbox(zonaConsulta);
    setCargando(prev => new Set(prev).add(clave));
    setAviso(`Cargando ${nombre.toLowerCase()}…`);
    onConsulta({ zona: zonaConsulta, cargando: true });
    try {
      const datos = await obtener(bbox);
      onConsulta({ zona: zonaConsulta, cargando: false });
      if (!datos.features.length) return setAviso(`No se encontraron ${nombre.toLowerCase()} en esta zona.`);
      capas.agregar(nombre, datos, "lugares", clave, zonaConsulta);
      setAviso(datos.truncado ? `Se muestran los primeros ${datos.features.length}. Acerca el mapa para ver todos.` : "");
    } catch (e) {
      onConsulta(null);
      setAviso((e as Error).message);
    } finally {
      setCargando(prev => { const s = new Set(prev); s.delete(clave); return s; });
    }
  }

  const elegirCategoria = (id: string, nombre: string) => {
    setMasAbierto(false);
    alternar(id, nombre, bbox => api.lugares(id, bbox));
  };

  const buscarNombre = (texto: string) => {
    setMasAbierto(false);
    alternar(`nombre:${normalizar(texto)}`, `«${texto}»`, bbox => api.buscarPorNombre(texto, bbox));
  };

  function chip(id: string) {
    const nombre = nombres.get(id) ?? id;
    const Icono = iconoCategoria(id);
    const capa = capaDe(id);
    return (
      <button key={id} onClick={() => elegirCategoria(id, nombre)} aria-pressed={!!capa} aria-busy={cargando.has(id)}
        title={capa ? `Quitar ${nombre.toLowerCase()}` : `Buscar ${nombre.toLowerCase()} en esta zona`}
        className={`shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full border font-titulo text-[13px] shadow-[0_1px_4px_rgba(0,0,0,0.25)] transition-colors ${capa ? "bg-cian border-cian text-ink font-semibold" : "bg-white border-gray-200 text-gray-800 font-medium hover:bg-gray-50 hover:border-gray-300"}`}>
        {cargando.has(id) ? <Loader2 className="size-[15px] animate-spin" /> : <Icono className="size-[15px]" />}
        <span className="whitespace-nowrap">{nombre}</span>
        {capa && <span className="size-2 rounded-full ring-2 ring-white" style={{ background: capa.color }} />}
      </button>
    );
  }

  const principales = catalogo?.principales ?? [];
  const activasFueraDeLaBarra = [...activas].filter(c => !principales.includes(c)).length;
  const cargandoFueraDeLaBarra = [...cargando].some(c => !principales.includes(c));
  const flecha = "absolute top-1/2 -translate-y-1/2 z-10 size-8 grid place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-[0_2px_6px_rgba(0,0,0,0.3)] hover:bg-gray-50";
  // Los botones se desvanecen bajo las flechas en vez de verse cortados
  const borde = (visible: boolean) => (visible ? "transparent 0, #000 56px" : "#000 0");
  const mascara = `linear-gradient(to right, ${borde(desplazable.izquierda)}, ${desplazable.derecha ? "#000 calc(100% - 56px), transparent 100%" : "#000 100%"})`;

  return (
    <div className="pointer-events-none">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-initial">
          {desplazable.izquierda && (
            <button onClick={() => fila.current?.scrollBy({ left: -240, behavior: "smooth" })} className={`pointer-events-auto left-0 ${flecha}`} aria-label="Ver categorías anteriores">
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div ref={fila} onScroll={medir} style={{ maskImage: mascara, WebkitMaskImage: mascara }}
            className="pointer-events-auto flex gap-1.5 overflow-x-auto py-1.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {principales.map(chip)}
          </div>
          {desplazable.derecha && (
            <button onClick={() => fila.current?.scrollBy({ left: 240, behavior: "smooth" })} className={`pointer-events-auto right-0 ${flecha}`} aria-label="Ver más categorías">
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>

        {zona && (
          <button onClick={nuevaZona} disabled={cargando.size > 0} title="Consultar todas las categorías cargadas en la vista actual del mapa"
            className="pointer-events-auto shrink-0 order-last flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-gray-200 bg-white font-titulo text-[13px] font-medium text-gray-800 shadow-[0_1px_4px_rgba(0,0,0,0.25)] hover:bg-gray-50">
            <Crop className="size-[15px]" /> Nueva zona
          </button>
        )}
        <div ref={menu} className="relative pointer-events-auto shrink-0">
          <button onClick={() => setMasAbierto(a => !a)} aria-expanded={masAbierto} disabled={!catalogo} aria-busy={cargandoFueraDeLaBarra}
            className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full border font-titulo text-[13px] font-medium shadow-[0_1px_4px_rgba(0,0,0,0.25)] transition-colors ${masAbierto ? "bg-ink border-ink text-white" : activasFueraDeLaBarra ? "bg-white border-cian text-gray-800 ring-1 ring-cian" : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"}`}>
            {cargandoFueraDeLaBarra ? <Loader2 className="size-[15px] animate-spin" /> : <LayoutGrid className="size-[15px]" />} Más
            {activasFueraDeLaBarra > 0 && <span className="rounded-full bg-cian text-ink text-[10px] font-bold px-1.5 tabular-nums">{activasFueraDeLaBarra}</span>}
          </button>
          {masAbierto && catalogo && (
            <MenuMas catalogo={catalogo} activas={activas} cargando={cargando}
              onElegir={elegirCategoria} onBuscarNombre={buscarNombre} onCerrar={() => setMasAbierto(false)} />
          )}
        </div>
      </div>

      {aviso && (
        <div role="status" className="pointer-events-auto mt-2 inline-block rounded-lg border border-cian/40 bg-ink/95 px-3 py-2 text-xs text-cian shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  );
}
