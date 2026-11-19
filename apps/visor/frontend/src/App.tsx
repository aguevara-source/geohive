import { useModulo } from "@geohive/auth";
import type { Geometry } from "geojson";
import type L from "leaflet";
import { ChevronsLeft, ChevronsRight, PanelRightOpen } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useCapasBD } from "./api/visor";
import { BarraCategorias } from "./components/BarraCategorias";
import { BarraSuperior } from "./components/BarraSuperior";
import { Mapa } from "./components/Mapa";
import { PanelArchivos } from "./components/PanelArchivos";
import { PanelCapas } from "./components/PanelCapas";
import { PanelCapasBD } from "./components/PanelCapasBD";
import { Detalles, ListaElementos } from "./components/PanelDerecho";
import { PanelInferior } from "./components/PanelInferior";
import { PanelGeomarketing } from "./components/PanelGeomarketing";
import { PanelInterseccion } from "./components/PanelInterseccion";
import { PanelBuscarLugar } from "./components/PanelBuscarLugar";
import { PanelUbicacion } from "./components/PanelUbicacion";
import { Riel } from "./components/Riel";
import { COLOR_RESULTADO, LIMITES_PERU, MARGEN_PERU } from "./config";
import { useVisorApi, type AnalisisGeo, type EvaluacionPunto } from "./api/visor";
import { calcular, PESOS_INICIALES, recomendar, VARIABLES, type Pesos, type VariableMapa } from "./geomarketing";
import { useCapasMapa, useDibujo } from "./hooks";
import type { CapaMapa, PestanaInferior, Seleccion, Vista, Zona } from "./types";
import { ajustarVista, areaZonaKm2, coincideNombre, formatoArea, normalizar } from "./utils";

function CabeceraPanel({ titulo, onOcultar, lado }: { titulo: string; onOcultar: () => void; lado: "izquierdo" | "derecho" }) {
  const Icono = lado === "izquierdo" ? ChevronsLeft : ChevronsRight;
  return (
    <div className="flex items-center justify-between px-1">
      <span className="font-titulo text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">{titulo}</span>
      <button onClick={onOcultar} title="Ocultar panel" aria-label={`Ocultar panel ${lado}`}
        className="size-8 grid place-items-center rounded-lg text-gray-400 hover:text-gold hover:bg-white/5">
        <Icono className="size-4" />
      </button>
    </div>
  );
}

const TITULOS: Record<Vista, string> = { capas: "Capas", analisis: "Análisis espacial", ubicacion: "Ubicación", geomarketing: "Geomarketing", buscar: "Buscar lugares" };

export default function App() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [vista, setVista] = useState<Vista>("capas");
  // Al abrir, todos los paneles están ocultos: el mapa ocupa todo el espacio
  const [panelIzquierdo, setPanelIzquierdo] = useState(false);
  const [panelDerecho, setPanelDerecho] = useState(false);
  // Reporte de módulos más usados (auth.uso_modulos): con el panel cerrado solo se usa el mapa
  useModulo(panelIzquierdo ? vista : "mapa");
  const [inferiorAbierto, setInferiorAbierto] = useState(false);
  const [pestana, setPestana] = useState<PestanaInferior>("estadisticas");
  const [marcador, setMarcador] = useState<[number, number] | null>(null);
  // Contorno del departamento, provincia o distrito elegido en el buscador
  const [contorno, setContorno] = useState<{ id: number; geometria: Geometry } | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  // Búsqueda por nombre: una por categoría (capa). Solo filtra la capa donde se escribió.
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [consulta, setConsulta] = useState<{ zona: Zona; cargando: boolean } | null>(null);
  // Zona común de consulta de lugares: la define la primera categoría que se carga
  const [zonaLugares, setZonaLugares] = useState<Zona | null>(null);
  // Geomarketing
  const [geoAnalisis, setGeoAnalisis] = useState<AnalisisGeo | null>(null);
  const api = useVisorApi();
  const [pesos, setPesos] = useState<Pesos>(PESOS_INICIALES);
  const [geoResaltado, setGeoResaltado] = useState<number | null>(null);
  const [geoVariable, setGeoVariable] = useState<VariableMapa>(VARIABLES[0]);
  const [geoNTop, setGeoNTop] = useState(3);
  // Locales evaluados (hasta 3, para compararlos) y el que se muestra con sus anillos
  const [geoPuntos, setGeoPuntos] = useState<EvaluacionPunto[]>([]);
  const [geoPuntoActivo, setGeoPuntoActivo] = useState(0);
  const geoResultado = useMemo(() => (geoAnalisis ? calcular(geoAnalisis, pesos, geoVariable) : null), [geoAnalisis, pesos, geoVariable]);
  const geoTop = useMemo(() => (geoAnalisis && geoResultado ? recomendar(geoAnalisis, geoResultado, geoNTop) : []), [geoAnalisis, geoResultado, geoNTop]);
  const geoClave = useMemo(() => (geoAnalisis ? `${geoAnalisis.rubro.id}-${geoAnalisis.resumen.area_km2}-${pesos.demanda}-${pesos.brecha}-${pesos.imanes}-${geoVariable.id}` : ""), [geoAnalisis, pesos, geoVariable]);
  // Área de la última consulta (zona de lugares o polígono del análisis), en km²
  const [areaKm2, setAreaKm2] = useState<number | null>(null);
  const filtrosNorm = useMemo(
    () => Object.fromEntries(Object.entries(filtros).map(([id, t]) => [id, normalizar(t.trim())]).filter(([, t]) => t)),
    [filtros],
  );
  const cambiarFiltro = (capaId: string, texto: string) => setFiltros(f => ({ ...f, [capaId]: texto }));
  const capasBD = useCapasBD();
  const capas = useCapasMapa();
  const dibujo = useDibujo();

  // El resultado del análisis se trata como una capa más (seleccionable y con tabla)
  const capaResultado = useMemo<CapaMapa | null>(() => dibujo.resultado && {
    id: `analisis-${dibujo.version}`,
    nombre: "Resultado del análisis",
    color: COLOR_RESULTADO,
    visible: true,
    origen: "analisis",
    datos: dibujo.resultado,
  }, [dibujo.resultado, dibujo.version]);

  const todas = useMemo(() => (capaResultado ? [...capas.lista, capaResultado] : capas.lista), [capas.lista, capaResultado]);
  const capaSel = seleccion ? todas.find(c => c.id === seleccion.capaId) ?? null : null;
  const elementoSel = capaSel?.datos.features[seleccion!.indice] ?? null;

  function elegir(s: Seleccion, acercar = true) {
    setSeleccion(s);
    setPanelDerecho(true); // muestra los detalles del elemento elegido
    const f = todas.find(c => c.id === s.capaId)?.datos.features[s.indice];
    if (f && acercar) ajustarVista(map, f);
  }

  function cambiarVista(v: Vista) {
    // Pulsar el icono activo pliega el panel; otro icono lo abre con su contenido
    setPanelIzquierdo(abierto => !(abierto && v === vista));
    setVista(v);
  }

  const visiblesTodas = capas.lista.filter(c => c.visible);
  const elementos = visiblesTodas.reduce(
    (s, c) => s + c.datos.features.filter((f, i) => coincideNombre(f, filtrosNorm[c.id] ?? "", i)).length, 0);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-ink">
      <BarraSuperior
        indicadores={{ capasBD: capasBD.data?.length ?? 0, enMapa: capas.lista.length, elementos, area: areaKm2 === null ? null : formatoArea(areaKm2) }}
        onRecargar={() => capasBD.refetch()}
        recargando={capasBD.isFetching}
        onVistaInicial={() => map?.fitBounds(LIMITES_PERU, MARGEN_PERU)}
        onAjustarCapas={() => ajustarVista(map, todas.filter(c => c.visible).map(c => c.datos))}
        enLinea={!capasBD.isError}
      />

      <div className="flex-1 flex min-h-0">
        <Riel vista={vista} panelAbierto={panelIzquierdo} onVista={cambiarVista}
          onEstadisticas={() => { setInferiorAbierto(true); setPestana("estadisticas"); }} />

        {/* Siempre montado: al plegar el panel, el geomarketing conserva su modo y resultados */}
          <aside className={`w-[300px] max-w-[80vw] shrink-0 overflow-y-auto p-3 space-y-3 border-r border-line bg-ink absolute md:static inset-y-16 left-16 z-[900] ${panelIzquierdo ? "" : "hidden"}`}>
            <CabeceraPanel titulo={TITULOS[vista]} lado="izquierdo" onOcultar={() => setPanelIzquierdo(false)} />
            {vista === "capas" && (
              <>
                <PanelCapasBD map={map} capas={capas} />
                <PanelCapas map={map} capas={capas} />
                <PanelArchivos map={map} capas={capas} />
              </>
            )}
            {vista === "analisis" && (
              <PanelInterseccion map={map} dibujo={dibujo} onResultado={areaHa => { setAreaKm2(areaHa / 100); setInferiorAbierto(true); setPestana("analisis"); }} />
            )}
            {vista === "ubicacion" && <PanelUbicacion map={map} onMarcar={setMarcador} />}
            {vista === "buscar" && <PanelBuscarLugar map={map} onMarcar={setMarcador} onContorno={setContorno} />}
            <div className={vista === "geomarketing" ? "space-y-3" : "hidden"}>
              <PanelGeomarketing map={map} zona={zonaLugares} onZona={setZonaLugares} resultado={geoResultado}
                variable={geoVariable} onVariable={setGeoVariable} nTop={geoNTop} onNTop={setGeoNTop}
                evaluaciones={geoPuntos} onEvaluaciones={setGeoPuntos} activa={geoPuntoActivo} onActiva={setGeoPuntoActivo}
                analisis={geoAnalisis} onAnalisis={a => {
                  setGeoAnalisis(a); setGeoResaltado(null);
                  if (a) setAreaKm2(a.resumen.area_km2);
                  // Sin análisis ni categorías, la zona se libera: el próximo encuadre define una nueva
                  else if (!capas.lista.some(c => c.origen === "lugares")) setZonaLugares(null);
                }}
                pesos={pesos} onPesos={setPesos} top={geoTop}
                onElegirTop={(id, lat, lon) => { setGeoResaltado(id); map?.setView([lat, lon], 16); }} />
            </div>
          </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex min-h-0">
            <div className="flex-1 min-w-0 relative">
              <Mapa onMapa={setMap} capas={todas} seleccion={seleccion} onSeleccionar={s => elegir(s, false)}
                marcador={marcador} contorno={contorno} dibujo={dibujo} filtros={filtrosNorm} consulta={consulta} zonaLugares={zonaLugares}
                geo={geoAnalisis && geoResultado ? { analisis: geoAnalisis, resultado: geoResultado, top: geoTop, resaltado: geoResaltado, clave: geoClave, variable: geoVariable } : null}
                locales={{ evaluaciones: geoPuntos, activa: geoPuntoActivo, onActiva: setGeoPuntoActivo }} />

              <div className="absolute top-3 left-4 right-16 z-[455]">
                <BarraCategorias map={map} capas={capas} zona={zonaLugares} onZona={setZonaLugares}
                  zonaEnUso={!!geoAnalisis}
                  onNuevaZona={nueva => {
                    setSeleccion(null); setFiltros({}); setGeoResaltado(null);
                    // El análisis de geomarketing también se rehace en la nueva zona, con el mismo rubro
                    if (geoAnalisis) {
                      const rubro = geoAnalisis.rubro.id;
                      setGeoAnalisis(null);
                      api.geomarketing(rubro, nueva.map(v => v.toFixed(5)).join(","))
                        .then(a => { setGeoAnalisis(a); setAreaKm2(a.resumen.area_km2); })
                        .catch(() => undefined);
                    }
                  }} onConsulta={c => {
                  setConsulta(c);
                  if (c) setAreaKm2(areaZonaKm2(c.zona));
                }} />
              </div>

              {!panelDerecho && (
                <BotonFlotante titulo="Mostrar panel de elementos y detalles" onClick={() => setPanelDerecho(true)}>
                  <PanelRightOpen className="size-4" />
                </BotonFlotante>
              )}

              {/* En pantallas angostas los detalles flotan sobre el mapa */}
              {elementoSel && (
                <div className="lg:hidden absolute right-3 bottom-10 z-[460] w-[min(22rem,calc(100%-1.5rem))] max-h-[60%] overflow-y-auto">
                  <Detalles capa={capaSel} elemento={elementoSel} indice={seleccion!.indice} onCerrar={() => setSeleccion(null)} />
                </div>
              )}
            </div>

            {panelDerecho && <aside className="hidden lg:flex w-[400px] shrink-0 flex-col gap-3 p-3 border-l border-line bg-ink overflow-hidden">
              <CabeceraPanel titulo="Información" lado="derecho" onOcultar={() => setPanelDerecho(false)} />
              <ListaElementos capas={todas} seleccion={seleccion} onElegir={s => elegir(s)} filtros={filtros} onFiltro={cambiarFiltro} />
              <Detalles capa={capaSel} elemento={elementoSel} indice={seleccion?.indice ?? 0} onCerrar={() => setSeleccion(null)} />
            </aside>}
          </div>

          <PanelInferior
            abierto={inferiorAbierto} onAlternar={() => setInferiorAbierto(a => !a)}
            pestana={pestana} onPestana={setPestana}
            capas={todas} capaResultado={capaResultado} analisis={dibujo.analisis}
            seleccion={seleccion} onElegir={s => elegir(s)}
          />
        </div>
      </div>
    </div>
  );
}

function BotonFlotante({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo}
      className="hidden lg:grid absolute right-[10px] top-[132px] z-[455] size-[34px] place-items-center rounded-md border-2 border-black/30 bg-ink/90 text-gold hover:text-gold-light">
      {children}
    </button>
  );
}
