import { APPS, type EstadoApp } from "@geohive/ui";
import { ArrowRight, Lock } from "lucide-react";
import { SOLO_PRESENTACION } from "../data/contenido";
import { Titulo } from "./Secciones";

const ETIQUETA: Record<EstadoApp, string> = { disponible: "Disponible", beta: "Beta", proximamente: "Próximamente" };

/**
 * Catálogo de aplicaciones. El portal no maneja sesión: cada tarjeta redirige a su app
 * y es la app la que pide credenciales (código de acceso enviado por correo).
 */
export function Aplicaciones() {
  return (
    <section id="aplicaciones" className="py-24">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <Titulo resaltado="Plataforma" resto="GeoHive" />
          <p className="text-gray-400 mt-6 max-w-3xl mx-auto text-sm leading-relaxed text-center">
            Accede a nuestras aplicaciones geoespaciales: visores WebGIS, geocodificadores y herramientas de análisis
            territorial. Ingresa con las credenciales asignadas por tu organización.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {APPS.map(({ id, nombre, categoria, descripcion, icono: Icono, ruta, estado: real }, i) => {
            const estado: EstadoApp = SOLO_PRESENTACION ? "proximamente" : real;
            const activa = estado !== "proximamente";
            const contenido = (
              <>
                <div className="flex justify-between items-start mb-6">
                  <Icono className="size-10 text-gold" />
                  <span className={`text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border ${activa ? "border-gold/50 text-gold" : "border-white/20 text-gray-400"}`}>
                    {ETIQUETA[estado]}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] mb-2">{categoria}</div>
                <h3 className="text-lg font-black mb-3">{nombre}</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">{descripcion}</p>
                {activa && (
                  <div className="mt-6 text-gold text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <Lock className="size-3.5" /> Ingresar <ArrowRight className="size-3.5" />
                  </div>
                )}
              </>
            );
            const clase = `glass-card p-8 rounded-3xl flex flex-col h-full ${activa ? "" : "opacity-60 pointer-events-none"}`;
            return activa ? (
              <a key={id} href={ruta} className={clase} data-aos="fade-up" data-aos-delay={i * 100}>{contenido}</a>
            ) : (
              <div key={id} className={clase} data-aos="fade-up" data-aos-delay={i * 100}>{contenido}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
