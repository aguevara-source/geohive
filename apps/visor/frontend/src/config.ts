export const APP_ID = "visor";
export const APP_VERSION = "1.0";
export const API_URL = "/api/visor";
export const AUTH_CONFIG = { app: APP_ID };

/** Límites del Perú (sur-oeste, nor-este): la vista inicial encuadra todo el país en el mapa */
export const LIMITES_PERU: [[number, number], [number, number]] = [[-18.35, -81.33], [-0.04, -68.65]];
/** Márgenes (px) al encuadrar el Perú: arriba deja libre la barra de categorías */
export const MARGEN_PERU = { paddingTopLeft: [16, 64] as [number, number], paddingBottomRight: [16, 16] as [number, number] };

/**
 * Colores de identidad de cada capa (mapa, leyenda y gráficos). Paleta categórica validada sobre el
 * fondo de los paneles (#0a1430): separación para daltonismo ≥ 8.4 ΔE y contraste ≥ 3:1.
 * Se asignan en orden fijo y nunca se reciclan: la capa 9 en adelante se pinta en gris.
 */
export const COLORES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const COLOR_SIN_SLOT = "#898781";
export const COLOR_RESULTADO = "#f9d978";
export const COLOR_SELECCION = "#d4af37"; // dorado: se distingue en el mapa claro y en el oscuro
export const ORO_DATOS = "#b08a26";

// Las categorías de lugares vienen del backend (GET /api/visor/lugares/categorias).

export const MAPA_PREDETERMINADO = "OpenStreetMap";

// Mapas base. Los vectoriales son estilos propios sobre OpenFreeMap; los demás, teselas de imagen.
// Ninguno requiere API key (CARTO la exige desde 2025 y muestra "API KEY REQUIRED").
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
export const MAPAS_VECTORIALES = [
  { nombre: "GeoHive Claro", estilo: "claro" as const },        // predeterminado
  { nombre: "GeoHive Medianoche", estilo: "medianoche" as const },
];
const ATRIB_ESRI = "Tiles &copy; Esri";
// Google: acceso directo a sus teselas (no oficial; puede dejar de funcionar si Google lo bloquea)
const google = (capa: "r" | "s" | "y" | "p") => `https://mt{s}.google.com/vt/lyrs=${capa}&x={x}&y={y}&z={z}`;
const esri = (servicio: string) => `${ESRI}/${servicio}/MapServer/tile/{z}/{y}/{x}`;

/** Mapas base de imagen (sin API key). «etiquetas»: capas de nombres que se superponen. */
export const MAPAS_BASE: { nombre: string; url: string; etiquetas?: string[]; atribucion: string; maxNativeZoom: number }[] = [
  { nombre: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", atribucion: "&copy; OpenStreetMap", maxNativeZoom: 19 },
  { nombre: "Google Calles", url: google("r"), atribucion: "&copy; Google", maxNativeZoom: 20 },
  { nombre: "Google Satélite", url: google("s"), atribucion: "&copy; Google", maxNativeZoom: 20 },
  { nombre: "Google Híbrido", url: google("y"), atribucion: "&copy; Google", maxNativeZoom: 20 },
  { nombre: "Google Relieve", url: google("p"), atribucion: "&copy; Google", maxNativeZoom: 20 },
  { nombre: "Esri Calles", url: esri("World_Street_Map"), atribucion: ATRIB_ESRI, maxNativeZoom: 19 },
  { nombre: "Esri Topográfico", url: esri("World_Topo_Map"), atribucion: ATRIB_ESRI, maxNativeZoom: 19 },
  { nombre: "Esri Satélite", url: esri("World_Imagery"), atribucion: `${ATRIB_ESRI} &mdash; Maxar, Earthstar Geographics`, maxNativeZoom: 19 },
  { nombre: "Esri Híbrido (satélite + nombres)", url: esri("World_Imagery"),
    etiquetas: [esri("Reference/World_Transportation"), esri("Reference/World_Boundaries_and_Places")],
    atribucion: `${ATRIB_ESRI} &mdash; Maxar, Earthstar Geographics`, maxNativeZoom: 19 },
  { nombre: "Esri Gris claro", url: esri("Canvas/World_Light_Gray_Base"), etiquetas: [esri("Canvas/World_Light_Gray_Reference")], atribucion: ATRIB_ESRI, maxNativeZoom: 16 },
  { nombre: "Esri Gris oscuro", url: esri("Canvas/World_Dark_Gray_Base"), etiquetas: [esri("Canvas/World_Dark_Gray_Reference")], atribucion: ATRIB_ESRI, maxNativeZoom: 16 },
  { nombre: "Esri National Geographic", url: esri("NatGeo_World_Map"), atribucion: `${ATRIB_ESRI} &mdash; National Geographic`, maxNativeZoom: 16 },
  { nombre: "Esri Relieve", url: esri("World_Terrain_Base"), atribucion: ATRIB_ESRI, maxNativeZoom: 9 },
  { nombre: "Esri Océanos", url: esri("Ocean/World_Ocean_Base"), atribucion: `${ATRIB_ESRI} &mdash; GEBCO, NOAA`, maxNativeZoom: 10 },
];
