import L from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Resultado } from "../api/geocodificador";
import { CENTRO_INICIAL, MAPA_BASE, ZOOM_INICIAL } from "../config";

function AjustarVista({ puntos }: { puntos: Resultado[] }) {
  const map = useMap();
  useEffect(() => {
    if (!puntos.length) return;
    map.fitBounds(L.latLngBounds(puntos.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 17 });
  }, [map, puntos]);
  return null;
}

function Clics({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function Mapa({ puntos, seleccionado, onClickMapa }: {
  puntos: Resultado[];
  seleccionado: number | null;
  onClickMapa: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={CENTRO_INICIAL} zoom={ZOOM_INICIAL} className="flex-1 h-full">
      <TileLayer url={MAPA_BASE.url} attribution={MAPA_BASE.atribucion} maxNativeZoom={MAPA_BASE.maxNativeZoom} maxZoom={19} />
      <TileLayer url={MAPA_BASE.etiquetas} maxNativeZoom={MAPA_BASE.maxNativeZoom} maxZoom={19} />
      {puntos.map((p, i) => (
        <CircleMarker
          key={`${p.lat},${p.lng},${i}`}
          center={[p.lat, p.lng]}
          radius={i === seleccionado ? 10 : 7}
          pathOptions={{ color: i === seleccionado ? "#4ade80" : "#d4af37", fillOpacity: 0.85 }}
        >
          <Popup>
            <b>{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</b><br />{p.direccion}
          </Popup>
        </CircleMarker>
      ))}
      <AjustarVista puntos={puntos} />
      <Clics onClick={onClickMapa} />
    </MapContainer>
  );
}
