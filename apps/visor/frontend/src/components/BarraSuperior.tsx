import { useAuth } from "@geohive/auth";
import { APPS, logo } from "@geohive/ui";
import { Globe2, LayoutGrid, LogOut, Maximize2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { APP_ID, APP_VERSION } from "../config";
import { formatoNumero } from "../utils";

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="px-4 py-1 text-center leading-tight">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gray-400 whitespace-nowrap">{etiqueta}</div>
      <div className="font-titulo text-lg font-bold text-cian tabular-nums">{valor}</div>
    </div>
  );
}

function BotonAccion({ titulo, onClick, children, girando = false }: {
  titulo: string; onClick: () => void; children: ReactNode; girando?: boolean;
}) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo}
      className={`size-9 grid place-items-center rounded-lg text-gray-300 hover:bg-cian/10 hover:text-cian transition-colors ${girando ? "[&_svg]:animate-spin" : ""}`}>
      {children}
    </button>
  );
}

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("") || "?";

export function BarraSuperior({ indicadores, onRecargar, recargando, onVistaInicial, onAjustarCapas, enLinea }: {
  indicadores: { capasBD: number; enMapa: number; elementos: number; area: string | null };
  onRecargar: () => void;
  recargando: boolean;
  onVistaInicial: () => void;
  onAjustarCapas: () => void;
  enLinea: boolean;
}) {
  const { usuario, logout } = useAuth();
  const otras = APPS.filter(a => a.id !== APP_ID && a.estado !== "proximamente" && usuario.roles.includes(a.id));

  return (
    <header className="h-16 shrink-0 flex items-center gap-4 px-4 border-b border-line bg-ink relative z-[1000]">
      {/* Marca */}
      <a href="/" className="flex items-center gap-3 shrink-0" title="Volver al portal">
        <img src={logo} alt="" className="h-10 w-auto" />
        <span className="leading-none">
          <span className="font-titulo text-xl font-bold text-cian tracking-tight">GeoHive</span>
          <span className="ml-1.5 font-titulo text-xs font-semibold text-cian/75">V{APP_VERSION}</span>
          <span className="block mt-1 text-[10px] uppercase tracking-[0.28em] text-gray-400">Visor geoespacial</span>
        </span>
      </a>

      {/* Acciones del mapa */}
      <div className="flex-1 flex justify-center min-w-0">
        <div className="flex items-center gap-0.5 rounded-xl border border-line bg-panel p-1">
          <BotonAccion titulo="Recargar capas de la base de datos" onClick={onRecargar} girando={recargando}>
            <RefreshCw className="size-[18px]" />
          </BotonAccion>
          <BotonAccion titulo="Ajustar el mapa a las capas cargadas" onClick={onAjustarCapas}>
            <Maximize2 className="size-[18px]" />
          </BotonAccion>
          <BotonAccion titulo="Volver a la vista de Perú" onClick={onVistaInicial}>
            <Globe2 className="size-[18px]" />
          </BotonAccion>
        </div>
      </div>

      {/* Indicadores */}
      <div className="hidden xl:flex items-center divide-x divide-line rounded-xl border border-line bg-panel shrink-0">
        <Indicador etiqueta="Capas BD" valor={formatoNumero(indicadores.capasBD)} />
        <Indicador etiqueta="En mapa" valor={formatoNumero(indicadores.enMapa)} />
        <Indicador etiqueta="Elementos" valor={formatoNumero(indicadores.elementos)} />
        <Indicador etiqueta="Área analizada" valor={indicadores.area ?? "—"} />
      </div>

      {/* Sesión */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${enLinea ? "border-cian/40 text-cian" : "border-red-400/40 text-red-300"}`}
          title={enLinea ? "Conectado al servidor" : "Sin conexión con el servidor"}>
          <span className={`size-1.5 rounded-full ${enLinea ? "bg-cian animate-pulse" : "bg-red-400"}`} />
          {enLinea ? "En línea" : "Sin conexión"}
        </span>

        {otras.length > 0 && (
          <select className="input-field !py-1.5 !text-xs !w-auto hidden min-[1800px]:block" defaultValue=""
            onChange={e => e.target.value && (window.location.href = e.target.value)} aria-label="Cambiar de aplicación">
            <option value="">Ir a…</option>
            {otras.map(a => <option key={a.id} value={a.ruta}>{a.nombre}</option>)}
          </select>
        )}

        <span className="flex items-center gap-2 pl-1" title={usuario.email}>
          <span className="size-8 grid place-items-center rounded-full bg-cian/15 font-titulo text-xs font-bold text-cian ring-1 ring-cian/40">
            {iniciales(usuario.nombre)}
          </span>
          <span className="hidden lg:block font-titulo text-sm font-medium text-gray-200 max-w-[9rem] truncate">{usuario.nombre}</span>
        </span>
        <a href="/#aplicaciones" className="size-9 grid place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-cian" title="Portal" aria-label="Portal">
          <LayoutGrid className="size-4" />
        </a>
        <button onClick={logout} className="size-9 grid place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-red-300" title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
