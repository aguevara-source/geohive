import type L from "leaflet";
import { Crosshair, LocateFixed, Navigation } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Tarjeta } from "./ui/Tarjeta";

export function PanelUbicacion({ map, onMarcar }: { map: L.Map | null; onMarcar: (p: [number, number]) => void }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");

  function ir(e: FormEvent) {
    e.preventDefault();
    const [lat, lng] = texto.split(",").map(v => parseFloat(v));
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return setError("Escribe latitud y longitud separadas por coma, ej. -12.0464, -77.0428");
    }
    setError("");
    map?.setView([lat, lng], 16);
    onMarcar([lat, lng]);
  }

  function miUbicacion() {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setError("");
        map?.setView([coords.latitude, coords.longitude], 16);
        onMarcar([coords.latitude, coords.longitude]);
      },
      () => setError("No se pudo obtener tu ubicación. Revisa el permiso del navegador."),
    );
  }

  return (
    <Tarjeta icono={Navigation} titulo="Ubicación">
      <label htmlFor="coordenada" className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Ir a coordenada</label>
      <form onSubmit={ir} className="flex gap-2 mt-1">
        <input id="coordenada" value={texto} onChange={e => setTexto(e.target.value)} className="input-field !py-2 !text-xs" placeholder="-12.0464, -77.0428" />
        <button className="btn-gold rounded-lg px-3" title="Ir" aria-label="Ir a la coordenada"><Crosshair className="size-4" /></button>
      </form>
      <button onClick={miUbicacion} className="btn-ghost rounded-lg w-full py-2 mt-3 text-xs flex items-center justify-center gap-2">
        <LocateFixed className="size-4" /> Mi ubicación
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </Tarjeta>
  );
}
