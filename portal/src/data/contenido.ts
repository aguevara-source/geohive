import {
  AreaChart, Bot, BrainCircuit, Code2, Globe2, GraduationCap, MapPinned, MonitorCog, Satellite, type LucideIcon,
} from "lucide-react";

export const CONTACTO = {
  ubicacion: "Lima Metropolitana, Perú",
  telefono: "+51 989 983 651",
  whatsapp: "https://wa.me/51989983651",
  tiktok: "https://www.tiktok.com/@quipugeoia",
  youtube: "https://www.youtube.com/channel/UCoDu7V6_ilE5ebXSclY0VTg",
  email: "geohivevisor@gmail.com",
  // Clave de Web3Forms (https://app.web3forms.com): los mensajes del formulario llegan al correo
  // del formulario creado allí. Es pública por diseño (va en la página), no es una contraseña.
  web3formsClave: "d080e5f2-e607-42cd-9a3c-d4b52106c6b1",
  mapa: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d62421.761950985!2d-77.090158!3d-12.046374!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105c8d3b0a5d4d5%3A0x8d0c2d6b9b9c0f56!2sLima%2C%20Per%C3%BA!5e0!3m2!1ses!2spe!4v1720000000000",
};

export const MENU = [
  { href: "#inicio", texto: "Inicio" },
  { href: "#nosotros", texto: "Nosotros" },
  { href: "#servicios", texto: "Servicios" },
  { href: "#aplicaciones", texto: "Aplicaciones" },
  { href: "#proyectos", texto: "Proyectos" },
  { href: "#contacto", texto: "Contacto" },
];

export const SERVICIOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  { icono: AreaChart, titulo: "Análisis Espacial y Geoestadística",
    texto: "Asesoría en análisis espacial y geoestadística, aplicando modelos analíticos para la toma de decisiones basadas en datos territoriales." },
  { icono: MapPinned, titulo: "Georreferenciación y Gestión SIG",
    texto: "Georreferenciación, levantamiento, integración y procesamiento de bases de datos espaciales para gestión territorial." },
  { icono: Satellite, titulo: "Teledetección y Sensores Remotos",
    texto: "Procesamiento y análisis de imágenes satelitales y datos de sensores remotos para monitoreo ambiental, territorial y urbano." },
  { icono: Code2, titulo: "Desarrollo de Software GIS",
    texto: "Diseño y desarrollo de software GIS, aplicaciones web y móviles orientadas al análisis geoespacial y gestión territorial." },
  { icono: Globe2, titulo: "Geoportales y Visores WebGIS",
    texto: "Implementación de geoportales y plataformas territoriales con tecnologías ArcGIS, QGIS, PostGIS, GeoServer, Leaflet u OpenLayers." },
  { icono: MonitorCog, titulo: "Transformación Digital Territorial",
    texto: "Consultoría en transformación digital basada en datos geográficos para entidades públicas y privadas, optimizando procesos y gestión de información territorial." },
  { icono: GraduationCap, titulo: "Capacitación y Transferencia Tecnológica",
    texto: "Capacitación especializada en Sistemas de Información Geográfica (SIG), análisis espacial y desarrollo de aplicaciones geoespaciales para equipos técnicos y profesionales." },
  { icono: BrainCircuit, titulo: "Inteligencia Territorial y Geoanalítica",
    texto: "Desarrollo de sistemas de inteligencia territorial y geoanalítica, integrando datos espaciales con herramientas avanzadas de análisis y visualización." },
  { icono: Bot, titulo: "Sistemas y Automatización RPA",
    texto: "Optimización de la gestión administrativa y flujos de trabajo operativos mediante software a medida y bots automatizados." },
];

export type Proyecto = {
  titulo: string;
  categoria: string;
  imagen: string;
  texto: string;
  etiquetas: string[];
  enlace?: string;
};

export const PROYECTOS: Proyecto[] = [
  {
    titulo: "GEOSISFOH",
    categoria: "Focalización de Hogares",
    imagen: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=900",
    texto: "Plataforma geoespacial de apoyo a la gestión social que georreferencia los hogares registrados en el "
      + "Sistema de Focalización de Hogares (SISFOH). Permite visualizar la clasificación socioeconómica en el "
      + "mapa, identificar zonas de pobreza y vulnerabilidad, y priorizar la atención de programas sociales.",
    etiquetas: ["Hogares", "Programas sociales", "Vulnerabilidad"],
  },
  {
    titulo: "GEOLLAPTA",
    categoria: "Catastro",
    imagen: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=900",
    texto: "Sistema de información catastral para el registro y la gestión de predios. Integra el levantamiento "
      + "y la digitalización de lotes, manzanas y sectores con sus fichas catastrales, permitiendo consultar "
      + "linderos, áreas y titularidad, y mantener actualizada la base gráfica del territorio.",
    etiquetas: ["Predios", "Levantamiento catastral", "Base gráfica"],
  },
  {
    titulo: "VISOR GEOHIVE",
    categoria: "Plataforma WebGIS",
    imagen: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=900",
    texto: "Visor WebGIS propio de AG-Y GEOHIVE: consulta de capas publicadas en PostGIS, carga de archivos "
      + "GeoJSON, mapas base y análisis espacial de intersección procesado en el servidor, con acceso seguro "
      + "por usuario.",
    etiquetas: ["WebGIS", "PostGIS", "Análisis espacial"],
  },
];

/**
 * Versión solo de presentación (GitHub Pages): sin backends, así que se desactivan
 * el inicio de sesión y el acceso a las aplicaciones. Se activa con VITE_SOLO_PRESENTACION=true.
 */
export const SOLO_PRESENTACION = import.meta.env.VITE_SOLO_PRESENTACION === "true";
