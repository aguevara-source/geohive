import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, MapPinned, Upload } from "lucide-react";
import { useState } from "react";
import { useGeocodificadorApi, useLotes, type Lote, type Resultado } from "../api/geocodificador";

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Geocodificación masiva: el CSV se procesa en el servidor y se puede cerrar la página. */
export function TabLotes({ pais, onVerEnMapa }: { pais: string; onVerEnMapa: (r: Resultado[]) => void }) {
  const api = useGeocodificadorApi();
  const qc = useQueryClient();
  const lotes = useLotes();
  const [archivo, setArchivo] = useState<File | null>(null);

  const subir = useMutation({
    mutationFn: () => api.crearLote(archivo!, pais),
    onSuccess: () => {
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["lotes"] });
    },
  });

  async function verEnMapa(lote: Lote) {
    const fc = await api.geojsonLote(lote.id);
    onVerEnMapa(fc.features.map(f => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      direccion: String(f.properties?.encontrada ?? f.properties?.direccion ?? ""),
    })));
  }

  async function bajarCsv(lote: Lote) {
    descargar(await api.csvLote(lote.id), `geocodificado_${lote.nombre_archivo}`);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 leading-relaxed">
        Sube un CSV con una columna <b className="text-gold">direccion</b>. Se procesa en el servidor
        (≈1 fila por segundo); puedes cerrar la página y volver luego.
      </p>
      <input type="file" accept=".csv" className="input-field !text-xs"
        onChange={e => setArchivo(e.target.files?.[0] ?? null)} key={subir.isSuccess ? "limpio" : "archivo"} />
      <button disabled={!archivo || subir.isPending} onClick={() => subir.mutate()}
        className="btn-gold rounded-full w-full py-3 text-xs uppercase flex items-center justify-center gap-2">
        {subir.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Procesar
      </button>
      {subir.error && <p className="text-xs text-red-400">{subir.error.message}</p>}

      <h4 className="panel-titulo !mt-6">Mis procesos</h4>
      {lotes.data?.length === 0 && <p className="text-xs text-gray-500">Aún no has subido archivos.</p>}
      <ul className="space-y-2">
        {lotes.data?.map(l => {
          const pct = Math.round((l.procesados / l.total) * 100);
          return (
            <li key={l.id} className="bg-white/5 rounded-lg p-3 text-xs space-y-2">
              <div className="flex justify-between gap-2">
                <span className="truncate text-gray-200" title={l.nombre_archivo}>{l.nombre_archivo}</span>
                <span className={l.estado === "completado" ? "text-green-400" : "text-gold"}>{l.estado}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div className="bg-gold h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span>{l.procesados}/{l.total} · {l.encontrados} encontradas</span>
                <span className="flex gap-3">
                  <button onClick={() => verEnMapa(l)} title="Ver en el mapa" className="hover:text-gold"><MapPinned className="size-4" /></button>
                  <button onClick={() => bajarCsv(l)} title="Descargar CSV" className="hover:text-gold"><Download className="size-4" /></button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
