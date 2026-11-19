import { Marca, logo } from "@geohive/ui";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MENU, SOLO_PRESENTACION } from "../data/contenido";

export function Navbar() {
  const [scroll, setScroll] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 top-0 left-0 backdrop-blur-md transition-all duration-300 border-b ${scroll ? "bg-ink/90 border-gold/40 shadow-2xl" : "bg-ink/50 border-gold/15"}`}>
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <a href="#inicio" className="flex items-center gap-3">
          <img src={logo} alt="AG-Y Logo" className="h-11 w-auto drop-shadow-lg" />
          <div className="leading-tight">
            <Marca className="text-lg" />
            <div className="text-[10px] text-gray-400 tracking-[0.25em] uppercase hidden md:block">
              Advanced • Geoanalytics • Intelligence • Systems
            </div>
          </div>
        </a>

        <div className="hidden lg:flex items-center gap-8 text-xs font-bold uppercase tracking-[0.25em] font-display">
          {MENU.map(m => <a key={m.href} href={m.href} className="hover:text-gold transition">{m.texto}</a>)}
          {!SOLO_PRESENTACION && (
            <a href={`${import.meta.env.BASE_URL}login/`} className="text-gold border border-gold px-5 py-2 rounded-full hover:bg-gold hover:text-black transition">
              Ingresar
            </a>
          )}
        </div>

        <button onClick={() => setAbierto(true)} className="lg:hidden text-gold p-2 rounded-lg hover:bg-white/10" aria-label="Abrir menú">
          <Menu className="size-7" />
        </button>
      </div>

      {/* Menú móvil */}
      {abierto && <div onClick={() => setAbierto(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 h-screen" />}
      <div className={`lg:hidden fixed top-0 right-0 w-[85%] max-w-sm h-screen bg-black/90 backdrop-blur-xl border-l border-white/10 transition-transform duration-300 z-50 ${abierto ? "" : "translate-x-full"}`}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/10">
          <span className="text-gold font-black tracking-widest font-display">MENÚ</span>
          <button onClick={() => setAbierto(false)} className="hover:text-gold" aria-label="Cerrar menú"><X className="size-6" /></button>
        </div>
        <div className="flex flex-col px-6 py-6 gap-6 text-sm uppercase font-bold tracking-[0.25em]">
          {MENU.map(m => <a key={m.href} href={m.href} onClick={() => setAbierto(false)} className="hover:text-gold">{m.texto}</a>)}
          {!SOLO_PRESENTACION && (
            <a href={`${import.meta.env.BASE_URL}login/`} className="btn-gold text-center px-6 py-3 rounded-full text-xs">Ingresar</a>
          )}
        </div>
      </div>
    </nav>
  );
}
