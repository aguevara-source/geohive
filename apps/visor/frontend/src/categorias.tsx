import L from "leaflet";
import {
  ArrowLeftRight, Baby, Banknote, Bath, Droplets, Puzzle, BedDouble, Beer, BookOpen, Briefcase, Building2, BusFront, Camera, CarTaxiFront,
  Church, Clapperboard, Coffee, CreditCard, Croissant, Drama, Drumstick, Dumbbell, Eye, Factory, FerrisWheel, Fish,
  FlaskConical, Flame, Fuel, Glasses, GraduationCap, Hammer, HeartPulse, Home, Hospital, Hotel, IceCreamCone, Landmark,
  LayoutGrid, Library, Mail, MapPin, Mountain, Music, PartyPopper, PawPrint, Pill, Plane, Printer, Scale, School,
  Scissors, Search, Shield, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, Smartphone, Soup, Sparkles, SquareParking,
  Stamp, Stethoscope, Store, Tent, TrainFront, Trees, Trophy, Umbrella, Users, UtensilsCrossed, Warehouse,
  WashingMachine, Waves, Wrench, type LucideIcon,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { esc } from "./utils";

/** Ícono de cada subcategoría y grupo (los ids vienen del backend: app/services/lugares.py). */
export const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  // grupos
  comer: UtensilsCrossed, compras: ShoppingBag, salud: HeartPulse, bienestar: Dumbbell, educacion: GraduationCap,
  entretenimiento: Music, servicios: Briefcase, hospedaje: BedDouble, eventos: PartyPopper, turismo: Mountain,
  publicos: Landmark, transporte: BusFront, dinero: Banknote, empresas: Building2, vivienda: Home,
  // comer y beber
  restaurantes: UtensilsCrossed, comida_rapida: Drumstick, chifas: Soup, pollerias: Drumstick, cevicherias: Fish,
  cafeterias: Coffee, panaderias: Croissant, bares: Beer, heladerias: IceCreamCone,
  // compras
  bodegas: Store, supermercados: ShoppingCart, mercados: ShoppingBasket, centros_comerciales: ShoppingBag,
  ropa: Shirt, tecnologia: Smartphone, ferreterias: Hammer, librerias: BookOpen,
  // salud
  farmacias: Pill, hospitales: Hospital, clinicas: Stethoscope, consultorios: Stethoscope, dentistas: Sparkles,
  laboratorios: FlaskConical, veterinarias: PawPrint, opticas: Glasses,
  // bienestar y deporte
  gimnasios: Dumbbell, deportes: Trophy, piscinas: Waves, peluquerias: Scissors, spa: Sparkles,
  // educación
  inicial: Baby, colegios: School, universidades: GraduationCap, bibliotecas: Library,
  // entretenimiento
  cines: Clapperboard, teatros: Drama, discotecas: Music, juegos_infantiles: Puzzle, diversion: FerrisWheel,
  // servicios
  grifos: Fuel, talleres: Wrench, estacionamientos: SquareParking, lavanderias: WashingMachine, correos: Mail,
  notarias: Stamp, imprentas: Printer,
  // hospedaje
  hoteles: Hotel, hostales: BedDouble, departamentos: Building2, campamentos: Tent,
  // espacios y eventos
  locales_eventos: PartyPopper, centros_comunales: Users, templos: Church,
  // turismo y naturaleza
  museos: Landmark, atractivos: Camera, miradores: Eye, parques: Trees, piletas: Droplets, playas: Umbrella,
  // servicios públicos
  municipalidades: Landmark, comisarias: Shield, bomberos: Flame, juzgados: Scale, banos: Bath, gobierno: Building2,
  // transporte
  paraderos: BusFront, estaciones: TrainFront, terminales: BusFront, aeropuertos: Plane, taxis: CarTaxiFront,
  // bancos y dinero
  bancos: Landmark, cajeros: CreditCard, agentes: Store, cambio: ArrowLeftRight,
  // empresas, vivienda
  oficinas: Briefcase, industrias: Factory, almacenes: Warehouse, edificios: Building2, urbanizaciones: Home,
  // búsqueda libre
  nombre: MapPin,
};

export const iconoCategoria = (id?: string): LucideIcon =>
  id?.startsWith("nombre:") ? Search : (id && ICONOS_CATEGORIA[id]) || LayoutGrid;

const svgs = new Map<string, string>();
function svg(categoria: string | undefined, tamano: number) {
  const clave = `${categoria}|${tamano}`;
  if (!svgs.has(clave)) {
    const Icono = iconoCategoria(categoria);
    svgs.set(clave, renderToStaticMarkup(<Icono size={tamano} color="#ffffff" strokeWidth={2.5} aria-hidden="true" />));
  }
  return svgs.get(clave)!;
}

/**
 * Marcador de un lugar: círculo del color de su capa con el ícono de su subcategoría y el nombre al lado
 * (el nombre se muestra al acercarse; ver la clase .gh-etiquetas). El seleccionado es más grande,
 * con un anillo dorado que pulsa y el nombre siempre visible.
 */
export function marcadorCategoria(categoria: string | undefined, color: string, nombre: string, seleccionado = false): L.DivIcon {
  const tamano = seleccionado ? 34 : 24;
  return L.divIcon({
    className: "gh-poi-contenedor",
    html: `<span class="gh-poi${seleccionado ? " gh-poi--sel" : ""}" style="--c:${color}">`
      + `<span class="gh-poi-icono">${svg(categoria, seleccionado ? 18 : 13)}</span>`
      + `<span class="gh-poi-texto">${esc(nombre)}</span></span>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
  });
}
