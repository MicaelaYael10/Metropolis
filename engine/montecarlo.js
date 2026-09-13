// Monte Carlo en dos capas: tiempo real (valor y volatilidad actuales) y ciclos
// (estacionalidad mensual). No predice precios, solo rangos de riesgo.
// Determinista por semilla para poder auditar el resultado.

"use strict";

const { resolveTimeframe } = require("./timeframes");

/** PRNG reproducible (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aproximacion de la normal estandar (Box-Muller). */
function normal(rnd) {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * @typedef {Object} MonteCarloInput
 * @property {number} score            puntaje actual 0..100
 * @property {number} [confidence]     confianza del puntaje 0..100
 * @property {number} [threshold]      umbral de politica (p. ej. 55)
 * @property {string|number} [horizon] lapso ('1h', '24h', '7d'...) o dias
 * @property {number} [horizonDays]    horizonte de la simulacion (alternativo a horizon)
 * @property {number} [paths]          numero de caminos
 * @property {number} [volPerDay]      volatilidad diaria del puntaje
 * @property {number} [driftPerDay]    deriva diaria base
 * @property {number[]} [cycleMonthly] 12 valores de estacionalidad (fracion de deriva extra)
 * @property {number} [seed]
 * @property {number} [startMonth]     0..11 mes inicial
 */

/**
 * @param {MonteCarloInput} input
 * @returns {{p5:number,p50:number,p95:number,maxP95:number,breachProbability:number,expectedDaysToBreach:number,paths:number,horizonDays:number,steps:number,stepDays:number,seed:number}}
 */
function simulate(input) {
  const {
    score: startScore,
    confidence = 100,
    threshold = 55,
    horizon = null,
    horizonDays: horizonDaysInput = 90,
    paths = 2000,
    volPerDay = 0.9,
    driftPerDay = 0,
    cycleMonthly = null,
    seed = 42,
    startMonth = 0,
  } = input;

  const horizonDays = horizon !== null && horizon !== undefined ? resolveTimeframe(horizon).days : horizonDaysInput;

  // Lapsos cortos se simulan en horas para que '1h' no quede en cero pasos.
  const totalHours = horizonDays * 24;
  const steps = horizonDays <= 1 ? Math.max(1, Math.round(totalHours)) : Math.max(1, Math.round(horizonDays));
  const stepDays = horizonDays / steps;

  const rnd = mulberry32(seed);
  const finals = [];
  const maxes = [];
  let breaches = 0;
  let daysToBreachSum = 0;

  // Menos confianza => mas dispersion. La volatilidad escala con sqrt(del paso).
  const vol = volPerDay * (1 + (100 - confidence) / 100);
  const volStep = vol * Math.sqrt(stepDays);
  const driftStep = driftPerDay * stepDays;

  for (let p = 0; p < paths; p++) {
    let v = startScore;
    let maxV = startScore;
    let breachedAt = -1;

    for (let s = 0; s < steps; s++) {
      const month = (startMonth + Math.floor((s * stepDays) / 30)) % 12;
      // CAPA B: la estacionalidad ajusta la deriva del mes en curso.
      const cycle = cycleMonthly && cycleMonthly.length === 12 ? cycleMonthly[month] : 0;
      const drift = driftStep + cycle * stepDays;
      v += drift + normal(rnd) * volStep;
      v = Math.max(0, Math.min(100, v));
      if (v > maxV) maxV = v;
      if (breachedAt < 0 && v > threshold) breachedAt = s + 1;
    }

    finals.push(v);
    maxes.push(maxV);
    if (breachedAt > 0) {
      breaches += 1;
      daysToBreachSum += breachedAt * stepDays;
    }
  }

  finals.sort((a, b) => a - b);
  maxes.sort((a, b) => a - b);

  return {
    p5: Number(percentile(finals, 5).toFixed(2)),
    p50: Number(percentile(finals, 50).toFixed(2)),
    p95: Number(percentile(finals, 95).toFixed(2)),
    maxP95: Number(percentile(maxes, 95).toFixed(2)),
    breachProbability: Number((breaches / paths).toFixed(4)),
    expectedDaysToBreach: breaches > 0 ? Number((daysToBreachSum / breaches).toFixed(3)) : 0,
    paths,
    horizonDays: Number(horizonDays.toFixed(6)),
    steps,
    stepDays,
    seed,
  };
}

module.exports = { simulate, mulberry32, percentile };
