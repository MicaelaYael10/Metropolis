// Timeframes del agente: lapsos cortos (tiempo real) y largos (ciclos).
// Unifica la unidad de tiempo en todo el motor: scoring, Monte Carlo, colector
// on-chain y CLI. El documento de problematica pide dos capas: analisis en tiempo
// real y estudio de ciclos anuales; aqui se declaran los lapsos con nombre.

'use strict';

const DAY = 86400;

/** Lapsos con nombre. `seconds` es la duracion; `nature` la capa del modelo. */
const TIMEFRAMES = Object.freeze({
  '1h': { name: '1h', seconds: 3600, days: 1 / 24, label: '1 hora', nature: 'tiempo real' },
  '6h': { name: '6h', seconds: 6 * 3600, days: 6 / 24, label: '6 horas', nature: 'tiempo real' },
  '24h': { name: '24h', seconds: DAY, days: 1, label: '24 horas', nature: 'tiempo real' },
  '7d': { name: '7d', seconds: 7 * DAY, days: 7, label: '7 dias', nature: 'corto plazo' },
  '30d': { name: '30d', seconds: 30 * DAY, days: 30, label: '30 dias', nature: 'medio plazo' },
  '90d': { name: '90d', seconds: 90 * DAY, days: 90, label: '90 dias', nature: 'medio plazo' },
  '180d': { name: '180d', seconds: 180 * DAY, days: 180, label: '180 dias', nature: 'ciclo' },
  '1y': { name: '1y', seconds: 365 * DAY, days: 365, label: '1 ano', nature: 'ciclo' },
});

/** Lapsos cortos por defecto para la capa de tiempo real. */
const SHORT = Object.freeze(['1h', '6h', '24h', '7d']);

const UNIT_SECONDS = { m: 60, h: 3600, d: DAY, w: 7 * DAY, y: 365 * DAY };

/**
 * Acepta un nombre ('24h'), un numero (dias) o una expresion ('90m', '3d', '2w').
 * Devuelve siempre el mismo objeto de lapso.
 *
 * @param {string|number} input
 * @returns {{name:string, seconds:number, days:number, label:string, nature:string}}
 */
function resolveTimeframe(input) {
  if (input === undefined || input === null || input === '') {
    throw new Error('Timeframe vacio');
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) throw new Error(`Timeframe invalido: ${input}`);
    return { name: `${input}d`, seconds: input * DAY, days: input, label: `${input} dias`, nature: input <= 1 ? 'tiempo real' : 'medio plazo' };
  }
  const key = String(input).trim().toLowerCase();
  if (TIMEFRAMES[key]) return TIMEFRAMES[key];

  const m = key.match(/^(\d+)\s*(m|h|d|w|y)$/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    if (n <= 0) throw new Error(`Timeframe invalido: ${input}`);
    const seconds = n * UNIT_SECONDS[unit];
    return {
      name: `${n}${unit}`,
      seconds,
      days: seconds / DAY,
      label: `${n} ${unit}`,
      nature: seconds <= DAY ? 'tiempo real' : 'medio plazo',
    };
  }
  throw new Error(`Timeframe desconocido: ${input}`);
}

/** Lista de lapsos; sin argumento, los cortos por defecto. */
function listTimeframes(which = 'short') {
  if (which === 'all') return Object.values(TIMEFRAMES);
  if (which === 'short') return SHORT.map((k) => TIMEFRAMES[k]);
  return String(which)
    .split(',')
    .map((s) => resolveTimeframe(s.trim()));
}

module.exports = { DAY, TIMEFRAMES, SHORT, resolveTimeframe, listTimeframes };
