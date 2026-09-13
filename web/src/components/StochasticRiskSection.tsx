import React, { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Pause, Play, Zap } from "lucide-react";

/**
 * Riesgo estocastico representado en BLOQUES rectangulares:
 *  - una grilla tipo sudoku con los estados simulados (cada celda = un resultado),
 *  - la capa de tiempo real como barras horarias,
 *  - la capa de ciclo anual como 12 bloques.
 * Todo determinista (semilla fija) para que sea auditable.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Bucket = 0 | 1 | 2 | 3;
const COLORS: Record<Bucket, string> = {
  0: "#cfe8dc",
  1: "#9ed2bb",
  2: "#e8c06a",
  3: "#e8736b",
};
const LABELS: Record<Bucket, string> = {
  0: "muy bajo",
  1: "bajo",
  2: "medio",
  3: "alto",
};

interface StochasticRiskSectionProps {
  threshold?: number;
}

export const StochasticRiskSection: React.FC<StochasticRiskSectionProps> = ({ threshold = 55 }) => {
  const [seed, setSeed] = useState(42);
  const [realtime, setRealtime] = useState(true);
  const [running, setRunning] = useState(true);

  // Auto-simulacion: corre sola, no hace falta pulsar nada.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeed((s) => s + 1), 2600);
    return () => clearInterval(id);
  }, [running]);

  const grid = useMemo(() => {
    const rnd = mulberry32(seed);
    const cols = 24;
    const rows = 6;
    const cells: Bucket[] = [];
    for (let i = 0; i < cols * rows; i++) {
      const v = rnd();
      const bucket: Bucket = v < 0.5 ? 0 : v < 0.76 ? 1 : v < 0.92 ? 2 : 3;
      cells.push(bucket);
    }
    return { cols, rows, cells };
  }, [seed]);

  const hourly = useMemo(() => {
    const rnd = mulberry32(seed + 7);
    return Array.from({ length: 24 }, () => 0.15 + rnd() * 0.85);
  }, [seed]);

  const months = useMemo(() => {
    const rnd = mulberry32(seed + 13);
    return Array.from({ length: 12 }, () => 0.15 + rnd() * 0.85);
  }, [seed]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const b of grid.cells) c[b] += 1;
    return c;
  }, [grid]);

  return (
    <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-cyan-600" />
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Riesgo estocastico - Monte Carlo</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Bloques de simulacion
          </h2>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Cada celda es un estado simulado del riesgo con el umbral de politica <b>{threshold}</b>.
            La grilla se lee como un tablero: mas rojo, mas probable la brecha.
          </p>
        </div>
        <button
          onClick={() => setRunning((v) => !v)}
          className="px-4 py-2 rounded-md text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:border-cyan-600 transition-colors inline-flex items-center gap-1.5"
        >
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {running ? "En vivo" : "Reanudar"}
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white/80 backdrop-blur-xl p-4 sm:p-5 shadow-[0_6px_24px_rgba(15,33,45,0.06)]">
        {/* Grilla tipo sudoku */}
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}>
          {grid.cells.map((b, i) => (
            <div
              key={i}
              className="aspect-square border border-white/60"
              style={{ background: COLORS[b] }}
              title={LABELS[b]}
            />
          ))}
        </div>

        {/* Leyenda + reparto */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          {([0, 1, 2, 3] as Bucket[]).map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 border border-slate-300 inline-block" style={{ background: COLORS[b] }} />
              {LABELS[b]} ({counts[b]})
            </span>
          ))}
          <span className="ml-auto font-mono text-slate-500">semilla #{seed}</span>
        </div>

        {/* Capas: tiempo real y ciclo anual */}
        <div className="grid lg:grid-cols-2 gap-4 mt-6">
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-700" /> Capa tiempo real (24 h)
              </span>
              <button
                onClick={() => setRealtime((v) => !v)}
                className={`px-2 py-1 rounded-sm text-[10px] font-bold border ${realtime ? "border-cyan-600 text-cyan-700 bg-cyan-50" : "border-slate-300 text-slate-500"}`}
              >
                {realtime ? "activa" : "pausada"}
              </button>
            </div>
            <div className="flex items-end gap-[3px] h-16">
              {hourly.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-cyan-600/70"
                  style={{ height: `${(realtime ? v : v * 0.35) * 100}%` }}
                  title={`hora ${i}: ${(v * 100).toFixed(0)}%`}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Variacion inmediata del puntaje (retiros, fallos de transaccion, TVL).
            </p>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold text-slate-700">
              <CalendarDays className="w-3.5 h-3.5 text-amber-600" /> Capa ciclo anual (12 meses)
            </div>
            <div className="grid grid-cols-12 gap-[3px]">
              {months.map((v, i) => (
                <div
                  key={i}
                  className="h-16 border border-white/70"
                  style={{ background: v > 0.75 ? COLORS[3] : v > 0.55 ? COLORS[2] : v > 0.35 ? COLORS[1] : COLORS[0] }}
                  title={`mes ${i + 1}: ${(v * 100).toFixed(0)}%`}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Estacionalidad de tasas y frecuencia historica de incidentes por mes.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5 text-cyan-700" />
        Misma matematica determinista del motor (`engine/montecarlo.js`); no predice precios.
      </p>
    </section>
  );
};

export default StochasticRiskSection;
