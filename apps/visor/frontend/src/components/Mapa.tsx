import type { Geometry } from "geojson";
import L, { type LatLng, type LatLngExpression } from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  Circle, CircleMarker, GeoJSON, LayerGroup, LayersControl, MapContainer, Marker, Polygon, Rectangle, ScaleControl, TileLayer, Tooltip, ZoomControl,
  useMap, useMapEvents,
} from "react-leaflet";
import type { AnalisisGeo, EvaluacionPunto } from "../api/visor";
import { iconoCategoria, marcadorCategoria } from "../categorias";
import { COLOR_NO_RESIDENCIAL, UMBRAL_NO_RESIDENCIAL, nombreUso, type Recomendado, type ResultadoHex, type VariableMapa } from "../geomarketing";
import { COLOR_SELECCION, LIMITES_PERU, MAPA_PREDETERMINADO, MAPAS_BASE, MAPAS_VECTORIALES, MARGEN_PERU } from "../config";
import { crearEstilo } from "../mapa/estilos";
import { LimitesPoliticos } from "../mapa/LimitesPoliticos";
import { MapaVectorial } from "../mapa/MapaVectorial";
import type { Dibujo } from "../hooks";
import type { CapaMapa, Seleccion, Zona } from "../types";
import { areaZonaKm2, coincideNombre, formatoArea, formatoNumero } from "../utils";

const SUPERFICIE = "#0a1430";

function opcionesCapa(capa: CapaMapa, onClic: (indice: number) => void, filtro: string): L.GeoJSONOptions {
  return {
    filter: f => coincideNombre(f, filtro, capa.datos.features.indexOf(f)),
    // El estilo también se aplica a los puntos: se separa por tipo de geometría
    style: f => /Point/.test(f?.geometry?.type ?? "")
      ? { color: SUPERFICIE, weight: 2, fillColor: capa.color, fillOpacity: 0.95 }
      : { color: capa.color, weight: 2, fillColor: capa.color, fillOpacity: 0.22 },
    // Punto: relleno del color de la capa con un anillo del color de fondo, para separar puntos superpuestos
    // Lugares de interés: marcador con el ícono de su categoría; el resto, un punto
    pointToLayer: (f, latlng) => capa.origen === "lugares"
      ? L.marker(latlng, { icon: marcadorCategoria(f.properties?.subcategoria ?? capa.categoria, capa.color, String(f.properties?.nombre ?? "")), riseOnHover: true })
      : L.circleMarker(latlng, { radius: 7, color: SUPERFICIE, weight: 2, fillColor: capa.color, fillOpacity: 0.95 }),
    onEachFeature: (f, capaLeaflet) => {
      capaLeaflet.on("click", () => onClic(capa.datos.features.indexOf(f)));
    },
  };
}

function Coordenadas() {
  const [pos, setPos] = useState<LatLng | null>(null);
  useMapEvents({ mousemove: e => setPos(e.latlng) });
  return (
    <div className="absolute bottom-2 left-4 z-[450] pointer-events-none rounded-md bg-ink/80 px-2.5 py-1 text-[11px] text-gray-300 font-mono tabular-nums">
      {pos ? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}` : "Mueve el cursor sobre el mapa"}
    </div>
  );
}

/** Muestra los nombres de los lugares solo desde el zoom 16, para no saturar el mapa. */
function EtiquetasPorZoom() {
  const map = useMap();
  useEffect(() => {
    const actualizar = () => map.getContainer().classList.toggle("gh-etiquetas", map.getZoom() >= 16);
    actualizar();
    map.on("zoomend", actualizar);
    return () => { map.off("zoomend", actualizar); };
  }, [map]);
  return null;
}

/** Recalcula el tamaño del mapa cuando se abren o cierran los paneles. */
function AjusteTamano() {
  const map = useMap();
  useEffect(() => {
    const obs = new ResizeObserver(() => map.invalidateSize());
    obs.observe(map.getContainer());
    return () => obs.disconnect();
  }, [map]);
  return null;
}

function HerramientaDibujo({ dibujo }: { dibujo: Dibujo }) {
  const map = useMap();
  useMapEvents({ click: e => dibujo.activo && dibujo.agregar(e.latlng) });
  useEffect(() => {
    map.getContainer().style.cursor = dibujo.activo ? "crosshair" : "";
  }, [map, dibujo.activo]);
  return dibujo.vertices.length > 0 ? (
    <Polygon positions={dibujo.vertices} pathOptions={{ color: "#d4af37", weight: 2, dashArray: "6 4", fillOpacity: 0.08 }} />
  ) : null;
}

const OPCIONES_POPUP_GEO: L.PopupOptions = { className: "gh-popup-geo", maxWidth: 300, autoPan: false };

const limites = ([w, s, e, n]: Zona): L.LatLngBoundsExpression => [[s, w], [n, e]];

const ESTILOS = Object.fromEntries(MAPAS_VECTORIALES.map(m => [m.estilo, crearEstilo(m.estilo)]));

export function Mapa({ onMapa, capas, seleccion, onSeleccionar, marcador, contorno, dibujo, filtros, consulta, zonaLugares, geo, locales }: {
  onMapa: (m: L.Map) => void;
  capas: CapaMapa[];
  seleccion: Seleccion | null;
  onSeleccionar: (s: Seleccion) => void;
  marcador: LatLngExpression | null;
  /** Límite del departamento, provincia o distrito buscado */
  contorno: { id: number; geometria: Geometry } | null;
  dibujo: Dibujo;
  /** Filtro por nombre de cada capa (id de capa → texto normalizado). Las demás capas no se filtran. */
  filtros: Record<string, string>;
  /** Zona que se está consultando ahora (se dibuja punteada y animada) */
  consulta: { zona: Zona; cargando: boolean } | null;
  /** Zona común de consulta de lugares (se dibuja una sola vez) */
  zonaLugares: Zona | null;
  /** Análisis de geomarketing (hexágonos de oportunidad, competidores y top 3) */
  geo: { analisis: AnalisisGeo; resultado: Map<number, ResultadoHex>; top: Recomendado[]; resaltado: number | null; clave: string; variable: VariableMapa } | null;
  /** Locales evaluados en geomarketing: el activo muestra sus anillos de 5, 10 y 15 min y sus competidores */
  locales: { evaluaciones: EvaluacionPunto[]; activa: number; onActiva: (i: number) => void };
}) {
  const local = locales.evaluaciones[locales.activa] ?? null;
  // Mientras se dibuja, los clics agregan vértices aunque caigan sobre un elemento
  const dibujando = useRef(dibujo.activo);
  dibujando.current = dibujo.activo;

  const visibles = capas.filter(c => c.visible);
  const capaSel = seleccion && capas.find(c => c.id === seleccion.capaId);
  const elementoSel = capaSel?.datos.features[seleccion!.indice];

  return (
    <div className="relative h-full w-full">
      {/* zoomSnap fino: el país llena el contenedor sin dejar márgenes grandes */}
      <MapContainer ref={m => m && onMapa(m)} bounds={LIMITES_PERU} boundsOptions={MARGEN_PERU}
        zoomSnap={0.25} zoomDelta={0.5} wheelPxPerZoomLevel={90} zoomControl={false} className="h-full w-full">
        <LayersControl position="topright">
          {[...MAPAS_BASE].sort((a, b) => Number(b.nombre === MAPA_PREDETERMINADO) - Number(a.nombre === MAPA_PREDETERMINADO)).slice(0, 1).map(b => (
            <LayersControl.BaseLayer key={b.nombre} name={b.nombre} checked>
              <LayerGroup>
                <TileLayer url={b.url} attribution={b.atribucion} maxNativeZoom={b.maxNativeZoom} maxZoom={19} />
              </LayerGroup>
            </LayersControl.BaseLayer>
          ))}
          {MAPAS_VECTORIALES.map(m => (
            <LayersControl.BaseLayer key={m.nombre} name={m.nombre}>
              <MapaVectorial estilo={ESTILOS[m.estilo]} />
            </LayersControl.BaseLayer>
          ))}
          {MAPAS_BASE.filter(b => b.nombre !== MAPA_PREDETERMINADO).map(b => (
            <LayersControl.BaseLayer key={b.nombre} name={b.nombre}>
              <LayerGroup>
                <TileLayer url={b.url} attribution={b.atribucion} maxNativeZoom={b.maxNativeZoom} maxZoom={20}
                  subdomains={b.url.includes("google.com") ? ["0", "1", "2", "3"] : ["a", "b", "c"]} />
                {b.etiquetas?.map(url => <TileLayer key={url} url={url} maxNativeZoom={b.maxNativeZoom} maxZoom={19} />)}
              </LayerGroup>
            </LayersControl.BaseLayer>
          ))}
          <LayersControl.Overlay checked name="Límites políticos">
            <LayerGroup><LimitesPoliticos /></LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
        <ZoomControl position="topright" />
        <ScaleControl imperial={false} position="bottomright" />

        {visibles.map(c => (
          <GeoJSON key={`${c.id}|${c.version ?? 0}|${filtros[c.id] ?? ""}`} data={c.datos}
            {...opcionesCapa(c, indice => !dibujando.current && onSeleccionar({ capaId: c.id, indice }), filtros[c.id] ?? "")} />
        ))}

        {elementoSel && capaSel?.origen === "lugares" && elementoSel.geometry.type === "Point" && (
          <Marker
            key={`sel-${seleccion!.capaId}-${seleccion!.indice}`}
            position={[elementoSel.geometry.coordinates[1], elementoSel.geometry.coordinates[0]]}
            icon={marcadorCategoria(elementoSel.properties?.subcategoria ?? capaSel.categoria, capaSel.color, String(elementoSel.properties?.nombre ?? ""), true)}
            zIndexOffset={10000}
            interactive={false}
          />
        )}
        {elementoSel && capaSel?.origen !== "lugares" && (
          <>
            {/* Doble trazo (oscuro + dorado) para que se vea sobre cualquier mapa base */}
            <GeoJSON key={`sel-fondo-${seleccion!.capaId}-${seleccion!.indice}`} data={elementoSel} interactive={false}
              style={{ color: "#0a1430", weight: 8, fillOpacity: 0 }}
              pointToLayer={(_f, ll) => L.circleMarker(ll, { radius: 13, color: "#0a1430", weight: 7, fillOpacity: 0, interactive: false })} />
            <GeoJSON key={`sel-${seleccion!.capaId}-${seleccion!.indice}`} data={elementoSel} interactive={false}
              style={{ color: COLOR_SELECCION, weight: 4, fillColor: COLOR_SELECCION, fillOpacity: 0.12 }}
              pointToLayer={(_f, ll) => L.circleMarker(ll, { radius: 13, color: COLOR_SELECCION, weight: 3, fillOpacity: 0, interactive: false })} />
          </>
        )}

        {/* Geomarketing: oportunidad por hexágono */}
        {geo && (
          <GeoJSON key={`geo-${geo.clave}-${geo.resaltado}`} data={geo.analisis.hexagonos}
            style={f => {
              const r = geo.resultado.get(f?.properties.id);
              if (!r && (f?.properties.no_residencial ?? 0) >= UMBRAL_NO_RESIDENCIAL) {
                return { fillColor: COLOR_NO_RESIDENCIAL, fillOpacity: 0.6, color: "#ffffff", weight: 0.8, opacity: 0.6, dashArray: "3 3" };
              }
              if (!r) return { stroke: false, fillOpacity: 0 };
              const resaltado = f?.properties.id === geo.resaltado;
              return { fillColor: geo.variable.colores[r.clase], fillOpacity: 0.5, color: resaltado ? "#d4af37" : "#ffffff",
                       weight: resaltado ? 3.5 : 0.6, opacity: resaltado ? 1 : 0.7 };
            }}
            onEachFeature={(f, capa) => {
              const r = geo.resultado.get(f.properties.id);
              const p = f.properties;
              if (!r) {
                if (p.no_residencial >= UMBRAL_NO_RESIDENCIAL) {
                  capa.bindPopup(`<b>Zona no residencial · no se evalúa</b><br>El ${Math.round(p.no_residencial * 100)} % del hexágono está registrado ` +
                    `como <b>${nombreUso(p.uso_principal)}</b> u otros usos donde no vive gente (datos de OpenStreetMap).`,
                    OPCIONES_POPUP_GEO);
                }
                return;
              }
              // La información sale solo al hacer clic (al pasar el mouse tapaba la vista)
              capa.bindPopup(
                `<b>Oportunidad ${r.puntaje}/100</b><br>` +
                `Habitantes en este hexágono: ${formatoNumero(p.poblacion)}` +
                (p.recomendable ? "" : " · pocos para recomendarlo") + "<br>" +
                `Población a ${geo.analisis.rubro.minutos} min a pie: ${formatoNumero(p.demanda)}<br>` +
                `Competencia en ese radio: ${formatoNumero(p.competencia, 1)}` +
                (p.competidor_cercano !== null ? ` · la más cercana a ${formatoNumero(p.competidor_cercano)} m` : "") +
                `<br>Lugares que atraen clientes: ${formatoNumero(p.imanes, 1)}`,
                OPCIONES_POPUP_GEO);
            }} />
        )}
        {/* Competidores: solo los que están dentro de la zona analizada (los del borde cuentan en el cálculo) */}
        {geo?.analisis.puntos.filter(p => p.competidor && p.lon >= geo.analisis.zona[0] && p.lat >= geo.analisis.zona[1]
          && p.lon <= geo.analisis.zona[2] && p.lat <= geo.analisis.zona[3]).map((p, i) => (
          <CircleMarker key={`comp-${geo.clave}-${i}`} center={[p.lat, p.lon]} radius={4} interactive={false}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: "#111827", fillOpacity: 1 }} />
        ))}
        {geo?.top.map(t => (
          <Marker key={`top-${geo.clave}-${t.puesto}`} position={[t.hex.lat, t.hex.lon]} zIndexOffset={9000} interactive={false}
            icon={L.divIcon({ className: "gh-top", html: `<span>${t.puesto}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] })} />
        ))}

        {/* Local evaluado: anillos de minutos a pie (de afuera hacia adentro) y sus competidores */}
        {local && [...local.anillos].reverse().map(a => (
          <Circle key={`anillo-${local.punto.lat}-${local.punto.lon}-${local.rubro.id}-${a.minutos}`} center={[local.punto.lat, local.punto.lon]}
            radius={a.radio} interactive={false}
            pathOptions={{ color: "#22d3ee", weight: 1.8, dashArray: a.minutos === 15 ? "8 6" : a.minutos === 10 ? "4 4" : undefined,
                           fillColor: "#22d3ee", fillOpacity: 0.05 }} />
        ))}
        {local?.anillos.map(a => (
          // Etiqueta en el borde norte de cada anillo
          <Marker key={`etq-${local.punto.lat}-${local.punto.lon}-${local.rubro.id}-${a.minutos}`} interactive={false}
            position={[local.punto.lat + a.radio / 111_320, local.punto.lon]}
            icon={L.divIcon({ className: "gh-anillo", html: `<span class="gh-anillo-etiqueta">${a.minutos} min · ${formatoNumero(a.poblacion)} hab.</span>`, iconSize: [0, 0] })} />
        ))}
        {local?.competidores.map((c, i) => (
          <CircleMarker key={`comp-local-${local.punto.lat}-${local.rubro.id}-${i}`} center={[c.lat, c.lon]} radius={5}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: "#ea580c", fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -4]}>{c.nombre ?? "Sin nombre"} · {formatoNumero(c.distancia)} m</Tooltip>
          </CircleMarker>
        ))}
        {locales.evaluaciones.map((e, i) => (
          <Marker key={`local-${i}-${e.punto.lat}-${e.punto.lon}-${i === locales.activa}`} position={[e.punto.lat, e.punto.lon]} zIndexOffset={9500}
            eventHandlers={{ click: () => locales.onActiva(i) }}
            icon={L.divIcon({ className: `gh-top gh-local ${i === locales.activa ? "" : "gh-inactivo"}`, html: `<span><b>${"ABC"[i]}</b></span>`,
                              iconSize: [30, 30], iconAnchor: [15, 36] })} />
        ))}

        {/* Zona consultada de cada capa de lugares */}
        {zonaLugares && !consulta?.cargando && (
          <Rectangle key={`zona-${zonaLugares.join()}`} bounds={limites(zonaLugares)} interactive={false}
            pathOptions={{ color: "#0891b2", weight: 2, dashArray: "6 6", fill: false }} />
        )}
        {/* Zona que se está consultando ahora */}
        {consulta?.cargando && (
          <Rectangle key={`consulta-${consulta.zona.join()}`} bounds={limites(consulta.zona)}
            pathOptions={{ color: "#0891b2", weight: 2.5, dashArray: "8 6", fillColor: "#22d3ee", fillOpacity: 0.06, className: "gh-zona-cargando" }}>
            <Tooltip permanent direction="center" className="gh-zona-etiqueta">
              Cargando datos · {formatoArea(areaZonaKm2(consulta.zona))}
            </Tooltip>
          </Rectangle>
        )}

        {contorno && (
          <GeoJSON key={`contorno-${contorno.id}`} data={contorno.geometria} interactive={false}
            style={{ color: "#0891b2", weight: 2.5, dashArray: "8 5", fillColor: "#22d3ee", fillOpacity: 0.05 }} />
        )}
        {marcador && <CircleMarker center={marcador} radius={9} pathOptions={{ color: "#d4af37", weight: 3, fillOpacity: 0.3 }} />}

        <HerramientaDibujo dibujo={dibujo} />
        <AjusteTamano />
        <EtiquetasPorZoom />
        <Coordenadas />
      </MapContainer>

      <div className="absolute bottom-10 left-4 z-[450] flex flex-col gap-2 items-start">
      {/* Leyenda de geomarketing */}
      {geo && (
        <div className="glass-panel rounded-xl px-4 py-3 w-[16rem]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-300 mb-2">{geo.variable.nombre} · {geo.analisis.rubro.nombre}</div>
          <div className="flex h-2.5 rounded overflow-hidden">{geo.variable.colores.map(c => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{geo.variable.bajo}</span><span>{geo.variable.alto}</span></div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-300">
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-[#111827] ring-1 ring-white" /> Competencia</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: COLOR_NO_RESIDENCIAL }} /> No residencial</span>
            <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm ring-1 ring-white/40" /> Sin habitantes</span>
            <span className="flex items-center gap-1"><span className="size-3.5 rounded-full bg-gold text-ink text-[8px] font-bold grid place-items-center">1</span> Mejores lugares</span>
          </div>
        </div>
      )}

      {/* Leyenda */}
      {visibles.length > 0 && (
        <div className="glass-panel rounded-xl px-4 py-3 max-w-[16rem]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-300 mb-2">Capas</div>
          <ul className="space-y-1.5">
            {visibles.map(c => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <MarcaCapa capa={c} />
                <span className="truncate text-gray-200 flex-1">{c.nombre}</span>
                <span className="text-gray-500 tabular-nums">
                  {filtros[c.id] ? `${formatoNumero(c.datos.features.filter((f, i) => coincideNombre(f, filtros[c.id], i)).length)} de ` : ""}
                  {formatoNumero(c.datos.features.length)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}

/** Marca de la capa en leyendas y listas: el ícono de su categoría o un punto de color. */
export function MarcaCapa({ capa }: { capa: CapaMapa }) {
  if (capa.origen !== "lugares") {
    return <span className="size-3 rounded-full shrink-0 ring-2 ring-ink" style={{ background: capa.color }} />;
  }
  const Icono = iconoCategoria(capa.categoria);
  return (
    <span className="size-5 grid place-items-center rounded-full shrink-0 ring-2 ring-white/80" style={{ background: capa.color }}>
      <Icono className="size-3 text-white" strokeWidth={2.5} />
    </span>
  );
}
