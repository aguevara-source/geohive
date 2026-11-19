import type L from "leaflet";
import { FileUp } from "lucide-react";
import { useState } from "react";
import type { CapasMapa } from "../hooks";
import { aFeatureCollection, ajustarVista } from "../utils";
import { Tarjeta } from "./ui/Tarjeta";

/** Carga de archivos GeoJSON locales (se procesan en el navegador, no se suben al servidor). */
export function PanelArchivos({ map, capas }: { map: L.Map | null; capas: CapasMapa }) {
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState("");

  async function leer(archivos: FileList | null) {
    setError("");
    for (const archivo of Array.from(archivos ?? [])) {
      try {
        const datos = aFeatureCollection(JSON.parse(await archivo.text()));
        capas.agregar(archivo.name, datos, "archivo");
        ajustarVista(map, datos);
      } catch {
        setError(`«${archivo.name}» no es un GeoJSON válido.`);
      }
    }
  }

  return (
    <Tarjeta icono={FileUp} titulo="Cargar archivo" abiertaInicial={false}>
      <label
        className={`block border border-dashed rounded-xl p-5 text-center text-sm text-gray-400 cursor-pointer transition ${arrastrando ? "border-gold bg-gold/5" : "border-white/20 hover:border-gold"}`}
        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); leer(e.dataTransfer.files); }}
      >
        <FileUp className="size-6 text-gold mx-auto mb-2" />
        Arrastra o selecciona un archivo<br /><span className="text-xs">.geojson / .json — no se sube al servidor</span>
        <input type="file" accept=".geojson,.json" multiple className="hidden"
          onChange={e => { leer(e.target.files); e.target.value = ""; }} />
      </label>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </Tarjeta>
  );
}
