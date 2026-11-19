import { LayoutGrid, Loader2, Lock, LogOut, User, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { APPS, buscarApp } from "./catalog";
import logo from "./logo.png";

export { logo };

export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-black tracking-tight ${className}`}>
      AG-Y <span className="text-gold">GEOHIVE</span>
    </span>
  );
}

/** Encabezado común de todas las aplicaciones. */
export function AppHeader({ appId, nombreUsuario, roles, onLogout, children }: {
  appId: string;
  nombreUsuario: string;
  roles: string[];
  onLogout: () => void;
  children?: ReactNode;
}) {
  const app = buscarApp(appId);
  const Icono = app?.icono;
  const otras = APPS.filter(a => a.id !== appId && a.estado !== "proximamente" && roles.includes(a.id));

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 bg-ink/95 border-b border-gold/30 relative z-[1000]">
      <a href="/" className="flex items-center gap-3 shrink-0" title="Volver al portal">
        <img src={logo} alt="AG-Y GEOHIVE" className="h-9 w-auto" />
        <Marca className="hidden sm:block text-sm" />
      </a>

      <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-[0.15em] truncate">
        {Icono && <Icono className="size-4 text-gold shrink-0" />}
        <span className="truncate">{app?.nombre ?? appId}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {otras.length > 0 && (
          <select
            className="input-field !py-1.5 !text-xs !w-auto hidden md:block"
            defaultValue=""
            onChange={e => e.target.value && (window.location.href = e.target.value)}
            title="Cambiar de aplicación"
          >
            <option value="">Ir a…</option>
            {otras.map(a => <option key={a.id} value={a.ruta}>{a.nombre}</option>)}
          </select>
        )}
        <span className="hidden lg:flex items-center gap-1 text-xs text-gray-400">
          <User className="size-3.5 text-gold" /> {nombreUsuario}
        </span>
        <a href="/#aplicaciones" className="btn-ghost rounded-full p-2" title="Portal">
          <LayoutGrid className="size-4" />
        </a>
        <button onClick={onLogout} className="btn-ghost rounded-full p-2" title="Cerrar sesión">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

/** Pantalla completa para estados: cargando, sin acceso, error. */
export function PantallaMensaje({ icono: Icono = Lock, titulo, children, accion }: {
  icono?: LucideIcon;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center bg-ink text-white">
      <div className="glass-panel rounded-3xl p-10 max-w-md">
        <img src={logo} alt="" className="h-14 mx-auto mb-6" />
        <Icono className="size-10 text-gold mx-auto mb-4" />
        <h1 className="font-display text-xl font-black mb-3">{titulo}</h1>
        {children && <div className="text-gray-400 text-sm mb-8">{children}</div>}
        {accion ?? (
          <a href="/#aplicaciones" className="btn-gold rounded-full px-8 py-3 text-xs uppercase inline-block">
            Volver al portal
          </a>
        )}
      </div>
    </div>
  );
}

export const Cargando = () => (
  <div className="min-h-screen flex items-center justify-center bg-ink">
    <Loader2 className="size-10 text-gold animate-spin" />
  </div>
);

export const SinAcceso = ({ appId }: { appId: string }) => (
  <PantallaMensaje titulo="Sin acceso">
    Tu usuario no tiene permiso para <b className="text-gold">{buscarApp(appId)?.nombre ?? appId}</b>.
    Solicítalo al administrador de la plataforma.
  </PantallaMensaje>
);

export const ErrorAutenticacion = () => (
  <PantallaMensaje titulo="Servicio no disponible">
    No se pudo conectar con el servidor de autenticación. Intenta nuevamente en unos minutos.
  </PantallaMensaje>
);
