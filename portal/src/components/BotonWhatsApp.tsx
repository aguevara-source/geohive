import { Send, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CONTACTO, SERVICIOS } from "../data/contenido";

const MOTIVOS = ["Realizar un pedido", "Solicitar una cotización", "Información sobre servicios", "Acceso a aplicaciones", "Otra consulta"];

function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.2 4.24-9.44 9.45-9.44a9.38 9.38 0 0 1 6.68 2.77 9.38 9.38 0 0 1 2.76 6.68c0 5.21-4.24 9.44-9.45 9.44zm8.04-17.48A11.3 11.3 0 0 0 12.05.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.7l6.1-1.6a11.33 11.33 0 0 0 5.37 1.37h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03z" />
    </svg>
  );
}

/** Botón flotante: arma un mensaje con el pedido o la consulta y lo abre en WhatsApp. */
export function BotonWhatsApp() {
  const [abierto, setAbierto] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const servicio = d.get("servicio");
    const texto = [
      `Hola AG-Y GEOHIVE, soy ${d.get("nombre")}.`,
      `Motivo: ${d.get("motivo")}`,
      servicio ? `Servicio de interés: ${servicio}` : null,
      "",
      String(d.get("mensaje")),
    ].filter(l => l !== null).join("\n");
    window.open(`${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    setAbierto(false);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {abierto && (
        <form onSubmit={enviar} className="glass-panel bg-slate-950/95 w-[320px] max-w-[calc(100vw-3rem)] rounded-3xl p-6 space-y-3 shadow-2xl border border-white/10">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-black text-gold uppercase tracking-wider text-sm">Escríbenos por WhatsApp</h3>
              <p className="text-gray-400 text-xs mt-1">Pedidos, cotizaciones o cualquier consulta.</p>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-gray-400 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
          <input name="nombre" required placeholder="Tu nombre" className="input-field text-sm" />
          <select name="motivo" className="input-field text-sm" defaultValue={MOTIVOS[0]}>
            {MOTIVOS.map(m => <option key={m} className="bg-slate-900">{m}</option>)}
          </select>
          <select name="servicio" className="input-field text-sm" defaultValue="">
            <option value="" className="bg-slate-900">Servicio de interés (opcional)</option>
            {SERVICIOS.map(s => <option key={s.titulo} className="bg-slate-900">{s.titulo}</option>)}
          </select>
          <textarea name="mensaje" required placeholder="Cuéntanos qué necesitas..." className="input-field text-sm min-h-[90px] resize-none" />
          <button className="w-full rounded-full bg-[#25D366] hover:bg-[#1ebe5b] text-white font-bold uppercase text-xs py-3 flex items-center justify-center gap-2 transition">
            <Send className="size-4" /> Enviar por WhatsApp
          </button>
        </form>
      )}
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-label="Contactar por WhatsApp"
        className="size-14 rounded-full bg-[#25D366] text-white shadow-[0_0_25px_rgba(37,211,102,0.5)] flex items-center justify-center hover:scale-110 transition"
      >
        {abierto ? <X className="size-6" /> : <IconoWhatsApp className="size-8" />}
      </button>
    </div>
  );
}
