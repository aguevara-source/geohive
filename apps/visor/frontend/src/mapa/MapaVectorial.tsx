import { createLayerComponent, type LayerProps } from "@react-leaflet/core";
import L from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 carga su worker desde un archivo aparte; «?url» hace que Vite lo copie al empaquetar
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(urlWorker);

interface Props extends LayerProps {
  estilo: StyleSpecification;
}

/** Mapa base vectorial (MapLibre GL) usable como capa de Leaflet / react-leaflet. */
export const MapaVectorial = createLayerComponent<L.MaplibreGL, Props>(
  ({ estilo, ...opciones }, contexto) => ({
    instance: L.maplibreGL({ style: estilo, ...opciones }),
    context: contexto,
  }),
  (instancia, props, anteriores) => {
    if (props.estilo !== anteriores.estilo) instancia.getMaplibreMap().setStyle(props.estilo);
  },
);
