import { logo } from "@geohive/ui";
import { ArrowRight, Eye, Satellite } from "lucide-react";
import { PROYECTOS, SERVICIOS } from "../data/contenido";

export function Titulo({ resaltado, resto }: { resaltado: string; resto?: string }) {
  return (
    <>
      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center">
        <span className="text-gold">{resaltado}</span> {resto}
      </h2>
      <div className="w-28 h-1 bg-gold mx-auto mt-6 rounded-full" />
    </>
  );
}

export function Hero() {
  return (
    <header id="inicio" className="hero-gradient relative overflow-hidden pt-32 pb-20">
      <div className="space-bg"><div className="stars" /></div>
      <div className="glow-orb top-20 left-10" />
      <div className="glow-orb bottom-10 right-10" />

      <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10">
        <div data-aos="fade-right" className="max-w-xl">
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-5">
            EL FUTURO ES <br /><span className="text-gold">GEOESPACIAL</span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg mb-8 leading-relaxed">
            En <b className="text-white">AG-Y GEOHIVE</b> combinamos inteligencia satelital, sistemas avanzados
            y análisis de datos para transformar el territorio peruano con tecnología de clase mundial.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#aplicaciones" className="btn-gold px-8 py-3 rounded-full uppercase text-xs md:text-sm">Ver Aplicaciones</a>
            <a href="#servicios" className="border border-white/20 px-8 py-3 rounded-full hover:bg-white/10 transition uppercase text-xs md:text-sm">Servicios</a>
          </div>
        </div>
        <div className="flex justify-center md:justify-end" data-aos="zoom-in">
          <img src={logo} alt="AG-Y GEOHIVE" className="w-[240px] md:w-[360px] drop-shadow-[0_0_40px_rgba(212,175,55,0.4)] floating-logo" />
        </div>
      </div>
    </header>
  );
}

export function Nosotros() {
  return (
    <section id="nosotros" className="py-24 bg-slate-950">
      <div className="container mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="grid grid-cols-2 gap-4" data-aos="fade-up">
          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=700" className="rounded-xl shadow-2xl mt-8" alt="Tecnología" />
          <img src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=700" className="rounded-xl shadow-2xl" alt="Análisis" />
        </div>
        <div data-aos="fade-left">
          <h2 className="text-4xl font-black text-gold mb-6 uppercase tracking-wider">Quiénes Somos</h2>
          <p className="text-gray-300 text-lg mb-8 leading-relaxed">
            Somos una empresa peruana especializada en <b>Advanced Geoanalytics</b>. Diseñamos soluciones integrales
            basadas en GIS, inteligencia territorial, analítica espacial y plataformas WebGIS modernas para minería,
            agricultura, catastro y gestión pública.
          </p>
          <div className="space-y-5 text-gray-300">
            <p className="flex items-start gap-4">
              <Satellite className="size-6 text-gold shrink-0" />
              <span><b className="text-white">Misión:</b> Democratizar el uso de datos espaciales para el desarrollo sostenible del Perú.</span>
            </p>
            <p className="flex items-start gap-4">
              <Eye className="size-6 text-gold shrink-0" />
              <span><b className="text-white">Visión:</b> Ser el referente regional en sistemas de inteligencia territorial 360°.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Servicios() {
  return (
    <section id="servicios" className="py-24">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <Titulo resaltado="Nuestros" resto="Servicios" />
          <p className="text-gray-400 mt-6 max-w-3xl mx-auto text-sm leading-relaxed text-center">
            Brindamos soluciones tecnológicas integrales basadas en análisis espacial, inteligencia territorial,
            teledetección, automatización y transformación digital para instituciones públicas y privadas en el Perú.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICIOS.map(({ icono: Icono, titulo, texto }, i) => (
            <div key={titulo} className="glass-card p-10 rounded-3xl text-center" data-aos="fade-up" data-aos-delay={(i % 3) * 100}>
              <Icono className="size-12 text-gold mx-auto mb-7" />
              <h3 className="text-xl font-black mb-4">{titulo}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Proyectos() {
  return (
    <section id="proyectos" className="py-24 bg-slate-950">
      <div className="container mx-auto px-6">
        <div className="mb-16">
          <Titulo resaltado="Proyectos" resto="Involucrados" />
          <p className="text-gray-400 mt-6 max-w-3xl mx-auto text-sm leading-relaxed text-center">
            Soluciones geoespaciales desarrolladas e implementadas por nuestro equipo para la gestión social,
            territorial y la toma de decisiones basada en datos.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {PROYECTOS.map((p, i) => (
            <article key={p.titulo} className="glass-card rounded-3xl overflow-hidden group flex flex-col" data-aos="fade-up" data-aos-delay={i * 150}>
              <div className="relative h-[220px] overflow-hidden">
                <img src={p.imagen} alt={`Imagen referencial de ${p.titulo}`} loading="lazy"
                  className="h-full w-full object-cover transition duration-700 brightness-75 group-hover:brightness-100 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                <span className="absolute top-4 left-4 text-[10px] tracking-[0.2em] uppercase px-3 py-1 rounded-full border border-gold/60 text-gold bg-black/50 backdrop-blur">
                  {p.categoria}
                </span>
                <h3 className="absolute bottom-4 left-6 text-gold font-black text-2xl tracking-wider">{p.titulo}</h3>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <p className="text-sm text-gray-300 leading-relaxed flex-1">{p.texto}</p>
                <div className="flex flex-wrap gap-2 mt-5">
                  {p.etiquetas.map(e => (
                    <span key={e} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{e}</span>
                  ))}
                </div>
                {p.enlace && (
                  <a href={p.enlace} className="mt-6 text-gold text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-3 transition-all">
                    Ver proyecto <ArrowRight className="size-3.5" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
