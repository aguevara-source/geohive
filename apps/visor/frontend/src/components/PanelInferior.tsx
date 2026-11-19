import { BarChart3, ChevronDown, Shapes, Table2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { Analisis, CapaMapa, PestanaInferior, Seleccion } from "../types";
import { atributosCategoricos, columnas, distribucion, etiquetaCampo, formatoNumero, tipoGeometria } from "../utils";
import { Barras } from "./ui/Barras";

const PESTANAS: { id: PestanaInferior; nombre: string; icono: typeof BarChart3 }[] = [
  { id: "estadisticas", nombre: "Estadísticas", icono: BarChart3 },
  { id: "tabla", nombre: "Tabla de atributos", icono: Table2 },
  { id: "analisis", nombre: "Resultado del análisis", icono: Shapes },
];

function Celda({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 mb-2 min-h-7">
        <h3 className="font-titulo text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-300 whitespace-nowrap">{titulo}</h3>
        {accion}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </section>
  );
}

const SinDatos = ({ texto = "Carga una capa para ver sus estadísticas." }) => (
  <p className="text-xs text-gray-500 py-6 text-center">{texto}</p>
);

function Estadisticas({ capas, analisis }: { capas: CapaMapa[]; analisis: Analisis | null }) {
  const visibles = capas.filter(c => c.visible && c.origen !== "analisis");
  const [capaAttrId, setCapaAttrId] = useState("");
  const capaAttr = visibles.find(c => c.id === capaAttrId) ?? visibles[0];
  const atributos = useMemo(() => (capaAttr ? atributosCategoricos(capaAttr.datos) : []), [capaAttr]);
  const [atributo, setAtributo] = useState("");
  const attr = atributos.includes(atributo) ? atributo : atributos[0];

  const porCapa = visibles.map(c => ({ etiqueta: c.nombre, valor: c.datos.features.length, color: c.color }));
  const porTipo = distribucion(visibles.flatMap(c => c.datos.features.map(tipoGeometria)));
  const porAtributo = capaAttr && attr
    ? distribucion(capaAttr.datos.features.map(f => String(f.properties?.[attr] ?? "Sin dato")))
    : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 h-full">
      <Celda titulo="Elementos por capa">{porCapa.length ? <Barras datos={porCapa} unidad="elementos" /> : <SinDatos />}</Celda>
      <Celda titulo="Tipo de geometría">{porTipo.length ? <Barras datos={porTipo} unidad="elementos" /> : <SinDatos />}</Celda>
      <Celda
        titulo="Distribución por atributo"
        accion={visibles.length > 0 && (
          <div className="flex gap-1.5">
            <select aria-label="Capa" className="input-field !w-auto !py-1 !px-2 !text-[11px] max-w-[7rem]" value={capaAttr?.id ?? ""} onChange={e => setCapaAttrId(e.target.value)}>
              {visibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {atributos.length > 0 && (
              <select aria-label="Atributo" className="input-field !w-auto !py-1 !px-2 !text-[11px] max-w-[7rem]" value={attr} onChange={e => setAtributo(e.target.value)}>
                {atributos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>
        )}
      >
        {!capaAttr ? <SinDatos /> : porAtributo.length ? <Barras datos={porAtributo} unidad="elementos" />
          : <SinDatos texto="Esta capa no tiene atributos de texto para agrupar." />}
      </Celda>
      <Celda titulo="Último análisis">
        {analisis ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-ink/60 p-3 col-span-2">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Capa analizada</div>
              <div className="text-sm font-semibold truncate">{analisis.capa}</div>
            </div>
            <div className="rounded-xl border border-line bg-ink/60 p-3">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Área del polígono</div>
              <div className="text-2xl font-bold tabular-nums">{formatoNumero(analisis.area_ha, 1)}<span className="text-xs text-gray-400 font-normal"> ha</span></div>
            </div>
            <div className="rounded-xl border border-line bg-ink/60 p-3">
              <div className="text-[10px] uppercase tracking-[0.15em] text-gray-500">Elementos que cruzan</div>
              <div className="text-2xl font-bold tabular-nums">{formatoNumero(analisis.total)}</div>
            </div>
          </div>
        ) : <SinDatos texto="Dibuja un polígono en «Análisis espacial» para ver el resultado aquí." />}
      </Celda>
    </div>
  );
}

function TablaAtributos({ capas, seleccion, onElegir, capaFija }: {
  capas: CapaMapa[];
  seleccion: Seleccion | null;
  onElegir: (s: Seleccion) => void;
  capaFija?: CapaMapa;
}) {
  const [capaId, setCapaId] = useState("");
  const capa = capaFija ?? capas.find(c => c.id === capaId) ?? capas[0];
  const cols = useMemo(() => (capa ? columnas(capa.datos) : []), [capa]);
  if (!capa) return <SinDatos texto={capaFija === undefined ? "Carga una capa para ver su tabla de atributos." : ""} />;
  const filas = capa.datos.features.slice(0, 1000);

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      {!capaFija && (
        <div className="flex items-center gap-2">
          <label htmlFor="capa-tabla" className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Capa</label>
          <select id="capa-tabla" className="input-field !w-auto !py-1 !text-xs" value={capa.id} onChange={e => setCapaId(e.target.value)}>
            {capas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <span className="text-[11px] text-gray-500">{formatoNumero(capa.datos.features.length)} filas{capa.datos.features.length > 1000 ? " (se muestran 1000)" : ""}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr>
              <th className="text-left font-semibold text-gold px-3 py-2 border-b border-line">#</th>
              <th className="text-left font-semibold text-gold px-3 py-2 border-b border-line">Geometría</th>
              {cols.map(c => <th key={c} className="text-left font-semibold text-gold px-3 py-2 border-b border-line whitespace-nowrap">{etiquetaCampo(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const activo = seleccion?.capaId === capa.id && seleccion.indice === i;
              return (
                <tr key={i} onClick={() => onElegir({ capaId: capa.id, indice: i })}
                  className={`cursor-pointer border-b border-line/60 ${activo ? "bg-gold/15" : "hover:bg-white/5"}`}>
                  <td className="px-3 py-1.5 text-gray-500 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-1.5 text-gray-400">{tipoGeometria(f)}</td>
                  {cols.map(c => (
                    <td key={c} className="px-3 py-1.5 text-gray-200 whitespace-nowrap max-w-[16rem] truncate">
                      {f.properties?.[c] === null || f.properties?.[c] === undefined ? "—" : String(f.properties[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PanelInferior({ abierto, onAlternar, pestana, onPestana, capas, capaResultado, analisis, seleccion, onElegir }: {
  abierto: boolean;
  onAlternar: () => void;
  pestana: PestanaInferior;
  onPestana: (p: PestanaInferior) => void;
  capas: CapaMapa[];
  capaResultado: CapaMapa | null;
  analisis: Analisis | null;
  seleccion: Seleccion | null;
  onElegir: (s: Seleccion) => void;
}) {
  return (
    <section className={`shrink-0 border-t border-line bg-ink flex flex-col transition-[height] ${abierto ? "h-80" : "h-9"}`}>
      <button onClick={onAlternar} aria-expanded={abierto} title={abierto ? "Ocultar panel" : "Mostrar panel"}
        className="h-9 shrink-0 flex items-center justify-center gap-3 text-gray-500 hover:text-gold">
        <span className="h-1 w-10 rounded-full bg-current opacity-60" />
        <ChevronDown className={`size-4 transition-transform ${abierto ? "" : "rotate-180"}`} />
      </button>

      {abierto && (
        <>
          <nav className="flex gap-1 px-4 border-b border-line overflow-x-auto shrink-0" aria-label="Paneles de datos">
            {PESTANAS.map(({ id, nombre, icono: Icono }) => (
              <button key={id} onClick={() => onPestana(id)} aria-pressed={pestana === id}
                className={`flex items-center gap-2 px-4 py-2.5 font-titulo text-[11px] font-semibold uppercase tracking-[0.15em] border-b-2 whitespace-nowrap transition-colors ${pestana === id ? "text-cian border-cian" : "text-gray-400 border-transparent hover:text-gray-200"}`}>
                <Icono className="size-4" /> {nombre}
                {id === "analisis" && analisis && <span className="rounded bg-cian/20 text-cian px-1.5 text-[10px] tabular-nums">{analisis.total}</span>}
              </button>
            ))}
          </nav>
          <div className="flex-1 min-h-0 p-4 overflow-hidden">
            {pestana === "estadisticas" && <Estadisticas capas={capas} analisis={analisis} />}
            {pestana === "tabla" && <TablaAtributos capas={capas.filter(c => c.origen !== "analisis")} seleccion={seleccion} onElegir={onElegir} />}
            {pestana === "analisis" && (capaResultado
              ? <TablaAtributos capas={[capaResultado]} capaFija={capaResultado} seleccion={seleccion} onElegir={onElegir} />
              : <SinDatos texto="Aún no hay resultados. Usa «Análisis espacial» en la barra izquierda." />)}
          </div>
        </>
      )}
    </section>
  );
}

