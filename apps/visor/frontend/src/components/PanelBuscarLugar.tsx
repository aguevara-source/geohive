import { useQuery } from "@tanstack/react-query";
import type { Geometry } from "geojson";
import type L from "leaflet";
import {
  Building2, Camera, Castle, GraduationCap, Home, Landmark, Loader2, Map as IconoMapa, MapPin, MapPinned, Mountain,
  Plane, Search, Trees, Trophy, Waves, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useVisorApi, type Localidad, type SugerenciaEsri } from "../api/visor";
import { Tarjeta, Vacio } from "./ui/Tarjeta";

const ICONOS: Record<string, LucideIcon> = {
  departamento: Landmark, provincia: IconoMapa, distrito: MapPinned, ciudad: Building2, pueblo: Home,
  "centro poblado": Home, caserío: Home, urbanización: Home, barrio: Home, plaza: MapPin,
  "asentamiento humano": Home, "pueblo joven": Home, residencial: Home, "cooperativa de vivienda": Home,
  "asociación de vivienda": Home, sector: Home, "zona residencial": Home,
  "sitio arqueológico": Castle, monumento: Castle, museo: Landmark, "atractivo turístico": Camera, mirador: Camera,
  "cerro / nevado": Mountain, volcán: Mountain, nevado: Mountain, playa: Waves, bahía: Waves, "laguna / lago": Waves,
  isla: Waves, aeropuerto: Plane, estadio: Trophy, universidad: GraduationCap, "área natural": Trees,
};

/** Acercamiento para los lugares que no tienen límite (puntos) */
const ZOOM: Record<string, number> = {
  ciudad: 13, pueblo: 14, "centro poblado": 15, caserío: 16, urbanización: 16, barrio: 16, plaza: 17, isla: 12,
  "cerro / nevado": 13, volcán: 12, nevado: 12, "laguna / lago": 12, "área natural": 11, aeropuerto: 14,
};

const EJEMPLOS = ["Chiclayo", "Kuélap", "Miraflores", "Lago Titicaca", "Huaraz"];

function useDemorado(valor: string, ms = 250) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/** Buscador nacional: lleva el mapa a cualquier departamento, provincia, distrito, ciudad o sitio conocido del Perú. */
export function PanelBuscarLugar({ map, onMarcar, onContorno }: {
  map: L.Map | null;
  onMarcar: (p: [number, number] | null) => void;
  onContorno: (c: { id: number; geometria: Geometry } | null) => void;
}) {
  const api = useVisorApi();
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const [elegido, setElegido] = useState<number | null>(null);
  const consulta = useDemorado(texto.trim());
  const { data: resultados, isFetching, isError } = useQuery({
    queryKey: ["localidades", consulta],
    queryFn: () => api.localidades(consulta),
    enabled: consulta.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: previo => previo,
  });
  const lista = consulta.length >= 2 ? resultados ?? [] : [];
  // Complemento en vivo: urbanizaciones, direcciones y negocios del geocodificador de Esri
  const esri = useQuery({
    queryKey: ["esri", consulta],
    queryFn: () => api.sugerenciasEsri(consulta),
    enabled: consulta.length >= 3,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const listaEsri = consulta.length >= 3 ? esri.data ?? [] : [];
  const [elegidoEsri, setElegidoEsri] = useState<string | null>(null);
  const [errorEsri, setErrorEsri] = useState("");

  useEffect(() => setActivo(0), [consulta]);

  async function ir(l: Localidad) {
    if (!map) return;
    setElegido(l.id);
    setElegidoEsri(null);
    if (l.caja) {
      const [o, s, e, n] = l.caja;
      map.fitBounds([[s, o], [n, e]], { padding: [30, 30], maxZoom: 17 });
      onMarcar(null);
      onContorno(null);
      try {
        onContorno({ id: l.id, geometria: await api.limiteLocalidad(l.id) });
      } catch {
        /* sin contorno: el mapa igual ya está en el lugar */
      }
    } else {
      map.setView([l.lat, l.lon], ZOOM[l.tipo] ?? 15);
      onContorno(null);
      onMarcar([l.lat, l.lon]);
    }
  }

  async function irEsri(s: SugerenciaEsri) {
    if (!map) return;
    setElegidoEsri(s.clave);
    setElegido(null);
    setErrorEsri("");
    try {
      const u = await api.ubicarEsri(s);
      onContorno(null);
      onMarcar([u.lat, u.lon]);
      // Esri solo da un recuadro (sin polígono): si es grande se encuadra, si no se acerca al punto
      if (u.caja && Math.max(u.caja[2] - u.caja[0], u.caja[3] - u.caja[1]) > 0.01) {
        map.fitBounds([[u.caja[1], u.caja[0]], [u.caja[3], u.caja[2]]], { padding: [30, 30], maxZoom: 17 });
      } else {
        map.setView([u.lat, u.lon], u.tipo === "dirección" || u.tipo === "lugar" ? 18 : 16);
      }
    } catch {
      setErrorEsri("No se pudo ubicar ese resultado de Esri.");
    }
  }

  function teclas(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo(i => Math.min(i + 1, lista.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActivo(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && lista[activo]) ir(lista[activo]);
    if (e.key === "Escape") setTexto("");
  }

  return (
    <Tarjeta icono={MapPinned} titulo="Todo el Perú">
      <label className="relative block">
        <span className="sr-only">Buscar departamento, provincia, distrito, ciudad o sitio</span>
        <Search className="size-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={teclas}
          placeholder="Ciudad, urbanización, dirección…" role="combobox" aria-expanded={lista.length > 0} aria-controls="resultados-localidades"
          className="input-field !py-2 !pl-9 !pr-8 !text-xs" />
        {isFetching
          ? <Loader2 className="size-4 text-cian animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
          : texto && (
            <button onClick={() => { setTexto(""); onContorno(null); onMarcar(null); setElegido(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" aria-label="Borrar búsqueda">
              <X className="size-4" />
            </button>
          )}
      </label>

      {consulta.length < 2 ? (
        <div className="mt-3">
          <p className="text-[11px] text-gray-400 mb-2">
            Departamentos, provincias, distritos, ciudades, centros poblados, urbanizaciones y sitios conocidos de todo el Perú.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EJEMPLOS.map(ej => (
              <button key={ej} onClick={() => setTexto(ej)}
                className="rounded-full border border-line bg-ink/60 px-2.5 py-1 text-[11px] text-gray-300 hover:border-cian/60 hover:text-white">
                {ej}
              </button>
            ))}
          </div>
        </div>
      ) : isError ? (
        <p className="text-xs text-red-400 mt-3" role="alert">No se pudo buscar. Intenta nuevamente.</p>
      ) : lista.length === 0 && listaEsri.length === 0 && !isFetching && !esri.isFetching ? (
        <div className="mt-3"><Vacio>No se encontró «{consulta}».</Vacio></div>
      ) : (
        <ul id="resultados-localidades" role="listbox" className="mt-2 space-y-0.5">
          {lista.map((l, i) => {
            const Icono = ICONOS[l.tipo] ?? MapPin;
            const resaltado = i === activo || l.id === elegido;
            return (
              <li key={l.id} role="option" aria-selected={i === activo}>
                <button onClick={() => ir(l)} onMouseEnter={() => setActivo(i)}
                  className={`w-full flex items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${resaltado ? "bg-cian/10" : "hover:bg-white/5"}`}>
                  <span className={`mt-0.5 size-7 shrink-0 grid place-items-center rounded-full ${l.id === elegido ? "bg-cian text-ink" : "bg-white/5 text-cian"}`}>
                    <Icono className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-titulo text-white truncate">{l.nombre}</span>
                    <span className="block text-[10px] text-gray-400 truncate">
                      <span className="capitalize">{l.tipo}</span>{l.contexto && <> · {l.contexto}</>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {consulta.length >= 3 && (listaEsri.length > 0 || esri.isFetching) && (
        <div className="mt-3 pt-2 border-t border-line">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">Más resultados · Esri</span>
            {esri.isFetching && <Loader2 className="size-3 text-cian animate-spin" />}
          </div>
          <ul className="space-y-0.5" aria-label="Resultados de Esri">
            {listaEsri.map(s => {
              const [nombre, ...resto] = s.texto.split(", ");
              return (
                <li key={s.clave}>
                  <button onClick={() => irEsri(s)}
                    className={`w-full flex items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${s.clave === elegidoEsri ? "bg-cian/10" : "hover:bg-white/5"}`}>
                    <span className={`mt-0.5 size-7 shrink-0 grid place-items-center rounded-full ${s.clave === elegidoEsri ? "bg-cian text-ink" : "bg-white/5 text-gray-300"}`}>
                      <MapPin className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-titulo text-white truncate">{nombre}</span>
                      {resto.length > 0 && <span className="block text-[10px] text-gray-400 truncate">{resto.join(", ")}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {errorEsri && <p className="text-[11px] text-red-400 mt-1 px-2" role="alert">{errorEsri}</p>}
        </div>
      )}
      <p className="text-[10px] text-gray-500 mt-3">
        Fuente: OpenStreetMap{listaEsri.length > 0 && <> · Más resultados: Esri (en vivo, solo ubicación)</>}
      </p>
    </Tarjeta>
  );
}
