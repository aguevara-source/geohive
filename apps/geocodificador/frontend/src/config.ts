export const APP_ID = "geocodificador";
export const API_URL = "/api/geocodificador";
export const AUTH_CONFIG = { app: APP_ID };

export const CENTRO_INICIAL: [number, number] = [-12.0464, -77.0428]; // Lima
export const ZOOM_INICIAL = 12;

// Esri Dark Gray: no requiere API key (CARTO sí la exige desde 2025)
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
export const MAPA_BASE = {
  url: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  etiquetas: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  atribucion: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap",
  maxNativeZoom: 16,
};
