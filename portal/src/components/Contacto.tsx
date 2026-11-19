import { logo } from "@geohive/ui";
import { Mail, MapPin, Phone, Youtube } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CONTACTO } from "../data/contenido";
import { Titulo } from "./Secciones";

type Estado = "listo" | "enviando" | "enviado" | "error";

export function Contacto() {
  const [estado, setEstado] = useState<Estado>("listo");

  // Sin servidor propio: Web3Forms (web3forms.com) reenvía el mensaje al correo de la clave.
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    setEstado("enviando");
    try {
      const r = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: CONTACTO.web3formsClave,
          subject: `Nuevo mensaje desde la web AG-Y GEOHIVE — ${d.get("nombre")}`,
          from_name: "Web AG-Y GEOHIVE",
          replyto: d.get("correo"),
          Nombre: d.get("nombre"),
          Teléfono: d.get("telefono") || "—",
          Correo: d.get("correo"),
          Mensaje: d.get("mensaje"),
          botcheck: d.get("botcheck") ? true : "",
        }),
      });
      const res = await r.json().catch(() => ({}));
      if (r.ok && res.success) {
        setEstado("enviado");
        form.reset();
      } else {
        console.error("Web3Forms:", res);
        setEstado("error");
      }
    } catch {
      setEstado("error");
    }
  }

  return (
    <section id="contacto" className="py-24 bg-black border-t border-gold">
      <div className="container mx-auto px-6">
        <div className="mb-14">
          <Titulo resaltado="Contacto" />
          <p className="text-gray-400 mt-6 text-sm max-w-2xl mx-auto leading-relaxed text-center">
            Contáctanos para desarrollar soluciones GIS, WebGIS y análisis territorial avanzado en Lima, Perú.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <form onSubmit={enviar} className="glass-panel p-10 rounded-3xl space-y-4" data-aos="fade-right">
            <h3 className="text-2xl font-black text-gold mb-2 uppercase tracking-wider">Envíanos un mensaje</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <input name="nombre" required placeholder="Nombre" className="input-field" />
              <input name="telefono" placeholder="Teléfono" className="input-field" />
            </div>
            <input name="correo" type="email" required placeholder="Correo electrónico" className="input-field" />
            <textarea name="mensaje" required maxLength={2000} placeholder="Escribe tu mensaje..." className="input-field min-h-[120px] resize-none" />
            {/* Campo trampa contra bots: oculto para las personas */}
            <input name="botcheck" type="checkbox" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {estado === "enviado" && (
              <p className="text-sm text-green-300 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                ¡Gracias! Recibimos tu mensaje y te responderemos pronto.
              </p>
            )}
            {estado === "error" && (
              <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                No se pudo enviar el mensaje. Inténtalo de nuevo o escríbenos a {CONTACTO.email}.
              </p>
            )}
            <button disabled={estado === "enviando"} className="btn-gold px-10 py-4 rounded-full uppercase text-xs w-full disabled:opacity-60">
              {estado === "enviando" ? "Enviando..." : "Enviar Mensaje"}
            </button>
          </form>

          <div className="glass-panel p-10 rounded-3xl" data-aos="fade-left">
            <h3 className="text-2xl font-black text-gold mb-6 uppercase tracking-wider">Ubicación</h3>
            <div className="space-y-4 text-gray-300 text-sm mb-6">
              <p className="flex items-center gap-2"><MapPin className="size-4 text-gold" /> {CONTACTO.ubicacion}</p>
              <p className="flex items-center gap-2"><Phone className="size-4 text-gold" /> {CONTACTO.telefono}</p>
              <p className="flex items-center gap-2"><Mail className="size-4 text-gold" /> {CONTACTO.email}</p>
            </div>
            <iframe src={CONTACTO.mapa} title="Mapa" width="100%" height="320" loading="lazy"
              className="rounded-2xl border border-white/10 shadow-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="py-10 bg-black border-t border-white/10 text-center">
      <img src={logo} className="h-14 mx-auto mb-4 drop-shadow-lg" alt="Logo" />
      <p className="text-gray-400 text-sm italic mb-4">"Advanced Geoanalytics / Intelligence / Systems"</p>
      <div className="flex justify-center gap-6 mb-6 text-gold">
        <a href={CONTACTO.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="hover:text-white">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden="true">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
          </svg>
        </a>
        <a href={CONTACTO.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="hover:text-white"><Youtube /></a>
      </div>
      <div className="text-gray-600 text-[10px] tracking-[0.5em] uppercase border-t border-white/10 pt-8 mx-6">
        © {new Date().getFullYear()} AG-Y GEOHIVE SAC | LIMA - PERÚ | TODOS LOS DERECHOS RESERVADOS
      </div>
    </footer>
  );
}
