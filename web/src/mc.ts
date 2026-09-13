// Monte Carlo del motor, portado al navegador para la seccion de estrategia.
// Misma matematica determinista que engine/montecarlo.js (mulberry32 + normal).
// No predice precios: simula el puntaje de riesgo en el tiempo.

export interface McResult {
  p5: number;
  p50: number;
  p95: number;
  maxP95: number;
  breachProbability: number;
  steps: number;
  stepDays: number;
}

export const TIMEFRAMES: Record<string, { days: number; label: string }> = {
  "1h": { days: 1 / 24, label: "1 hora" },
  "6h": { days: 6 / 24, label: "6 horas" },
  "24h": { days: 1, label: "24 horas" },
  "7d": { days: 7, label: "7 dias" },
  "30d": { days: 30, label: "30 dias" },
  "90d": { days: 90, label: "90 dias" },
};

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

function normal(rnd: () => number) {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function simulate(opts: {
  score: number;
  confidence?: number;
  threshold?: number;
  horizon: string;
  paths?: number;
  volPerDay?: number;
  seed?: number;
}): McResult {
  const { score, confidence = 80, threshold = 55, horizon, paths = 800, volPerDay = 0.9, seed = 42 } = opts;
  const tf = TIMEFRAMES[horizon] ?? TIMEFRAMES["90d"];
  const horizonDays = tf.days;
  const totalHours = horizonDays * 24;
  const steps = horizonDays <= 1 ? Math.max(1, Math.round(totalHours)) : Math.max(1, Math.round(horizonDays));
  const stepDays = horizonDays / steps;

  const rnd = mulberry32(seed);
  const finals: number[] = [];
  const maxes: number[] = [];
  let breaches = 0;

  const vol = volPerDay * (1 + (100 - confidence) / 100);
  const volStep = vol * Math.sqrt(stepDays);

  for (let p = 0; p < paths; p++) {
    let v = score;
    let maxV = score;
    for (let s = 0; s < steps; s++) {
      v += normal(rnd) * volStep;
      v = Math.max(0, Math.min(100, v));
      if (v > maxV) maxV = v;
    }
    if (maxV > threshold) breaches += 1;
    finals.push(v);
    maxes.push(maxV);
  }

  finals.sort((a, b) => a - b);
  maxes.sort((a, b) => a - b);

  return {
    p5: Number(percentile(finals, 5).toFixed(2)),
    p50: Number(percentile(finals, 50).toFixed(2)),
    p95: Number(percentile(finals, 95).toFixed(2)),
    maxP95: Number(percentile(maxes, 95).toFixed(2)),
    breachProbability: Number((breaches / paths).toFixed(4)),
    steps,
    stepDays,
  };
}
