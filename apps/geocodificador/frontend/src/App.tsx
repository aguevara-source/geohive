import { useAuth, useModulo } from "@geohive/auth";
import { AppHeader } from "@geohive/ui";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useGeocodificadorApi, type Resultado } from "./api/geocodificador";
import { ListaResultados } from "./components/ListaResultados";
import { Mapa } from "./components/Mapa";
import { TabLotes } from "./components/TabLotes";
import { APP_ID } from "./config";

type Tab = "directa" | "inversa" | "lote";
const TABS: { id: Tab; nombre: string }[] = [
  { id: "directa", nombre: "Dirección" },
  { id: "inversa", nombre: "Coordenadas" },
  { id: "lote", nombre: "Lote CSV" },
];

export default function App() {
  const { usuario, logout } = useAuth();
  const api = useGeocodificadorApi();
  const [tab, setTab] = useState<Tab>("directa");
  useModulo(tab);  // reporte de módulos más usados (auth.uso_modulos)
  const [soloPeru, setSoloPeru] = useState(true);
  const [direccion, setDireccion] = useState("");
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const pais = soloPeru ? "pe" : "";

  const mostrar = (r: Resultado[]) => { setResultados(r); setSeleccionado(null); };

  const directa = useMutation({ mutationFn: () => api.buscar(direccion, pais), onSuccess: mostrar });
  const inversa = useMutation({
    mutationFn: (p: { lat: number; lng: number }) => api.inversa(p.lat, p.lng),
    onSuccess: r => mostrar(r ? [r] : []),
  });
  const consulta = tab === "directa" ? directa : inversa;

  function buscarInversa(e?: FormEvent) {
    e?.preventDefault();
    const lat = parseFloat(coords.lat), lng = parseFloat(coords.lng);
    if (!isNaN(lat) && !isNaN(lng)) inversa.mutate({ lat, lng });
  }

  function clicMapa(lat: number, lng: number) {
    if (tab === "lote") return;
    setTab("inversa");
    setCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    inversa.mutate({ lat, lng });
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader appId={APP_ID} nombreUsuario={usuario.nombre} roles={usuario.roles} onLogout={logout} />

      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        <aside className="glass-panel w-full md:w-96 h-[45%] md:h-full overflow-y-auto flex flex-col">
          <nav className="flex border-b border-white/10 px-5 gap-5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`py-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.12em] border-b-2 transition ${tab === t.id ? "text-gold border-gold" : "text-gray-400 border-transparent"}`}>
                {t.nombre}
              </button>
            ))}
          </nav>

          <div className="p-5 space-y-4">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={soloPeru} onChange={e => setSoloPeru(e.target.checked)} className="accent-yellow-500" />
              Limitar resultados a Perú
            </label>

            {tab === "directa" && (
              <form onSubmit={e => { e.preventDefault(); directa.mutate(); }} className="space-y-3">
                <input value={direccion} onChange={e => setDireccion(e.target.value)} required minLength={3}
                  className="input-field" placeholder="Ej: Av. Arequipa 1200, Lince, Lima" />
                <button disabled={directa.isPending} className="btn-gold rounded-full w-full py-3 text-xs uppercase flex items-center justify-center gap-2">
                  <Search className="size-4" /> Geocodificar
                </button>
              </form>
            )}

            {tab === "inversa" && (
              <form onSubmit={buscarInversa} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input value={coords.lat} onChange={e => setCoords(c => ({ ...c, lat: e.target.value }))} required className="input-field" placeholder="Latitud" />
                  <input value={coords.lng} onChange={e => setCoords(c => ({ ...c, lng: e.target.value }))} required className="input-field" placeholder="Longitud" />
                </div>
                <p className="text-[11px] text-gray-500">También puedes hacer clic en el mapa.</p>
                <button disabled={inversa.isPending} className="btn-gold rounded-full w-full py-3 text-xs uppercase flex items-center justify-center gap-2">
                  <MapPin className="size-4" /> Obtener dirección
                </button>
              </form>
            )}

            {tab === "lote" && <TabLotes pais={pais} onVerEnMapa={mostrar} />}

            {tab !== "lote" && (
              <>
                <div className="text-xs text-gray-400">
                  {consulta.isPending && "Buscando…"}
                  {consulta.error && <span className="text-red-400">{consulta.error.message}</span>}
                  {consulta.isSuccess && (resultados.length ? `${resultados.length} resultado(s)` : "Sin resultados.")}
                </div>
                <ListaResultados resultados={resultados} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />
              </>
            )}
          </div>
        </aside>

        <Mapa puntos={resultados} seleccionado={seleccionado} onClickMapa={clicMapa} />
      </main>
    </div>
  );
}
