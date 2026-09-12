// Modelo de riesgo CSBC: determinista y transparente.
// Una senal ausente NO se rellena. Se excluye del calculo y su peso se reparte
// entre las disponibles, reportando la cobertura resultante.
// Las bandas deben coincidir con contracts/ProtocolRegistry.sol.

'use strict';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const missing = (x) => x === null || x === undefined || (typeof x === 'number' && !Number.isFinite(x));

// Pesos del modelo (suman 100). `source` dice de donde sale cada senal.
const WEIGHTS = Object.freeze({
  failedTxRate: 14, // onchain  - tasa de transacciones fallidas
  tvlDrop: 12, // defillama - caida de TVL a 30 dias
  tvlDrawdown: 12, // defillama - maxima caida desde el pico en 90 dias
  codeChange: 14, // onchain  - antiguedad del ultimo cambio de bytecode/proxy
  adminActivity: 8, // onchain  - transacciones de la clave admin en 30 dias
  depositConcentration: 8, // onchain  - peso del mayor depositante
  withdrawalSpike: 10, // onchain  - pico de retiros vs. media
  auditCoverage: 8, // defillama - no de auditorias declaradas
  incidentHistory: 8, // defillama - incidentes historicos registrados
  chainConcentration: 6, // defillama - dependencia de una sola cadena
});

const SOURCE = Object.freeze({
  failedTxRate: 'onchain',
  tvlDrop: 'defillama',
  tvlDrawdown: 'defillama',
  codeChange: 'onchain',
  adminActivity: 'onchain',
  depositConcentration: 'onchain',
  withdrawalSpike: 'onchain',
  auditCoverage: 'defillama',
  incidentHistory: 'defillama',
  chainConcentration: 'defillama',
});

/** Bandas (identicas a ProtocolRegistry.band) */
const BANDS = Object.freeze({ verde: 29, ambar: 60 });

function bandOf(score) {
  if (score <= BANDS.verde) return 'verde';
  if (score <= BANDS.ambar) return 'ambar';
  return 'rojo';
}

/** Mapeadores senal -> riesgo normalizado 0..1 */
const MAPPERS = {
  failedTxRate: (v) => clamp01(v / 0.15),
  tvlDrop: (v) => clamp01(-v / 0.5), // v = cambio fraccional (ej. -0.6 => rojo)
  tvlDrawdown: (v) => clamp01(v / 0.6),
  codeChange: (d) => (d === null ? null : d < 7 ? 1 : d < 30 ? 0.6 : d < 90 ? 0.3 : 0),
  adminActivity: (v) => clamp01(v / 10),
  depositConcentration: (v) => clamp01((v - 0.2) / 0.6),
  withdrawalSpike: (v) => clamp01(v / 0.25),
  auditCoverage: (n) => (n <= 0 ? 1 : n === 1 ? 0.5 : 0),
  incidentHistory: (n) => clamp01(n / 3),
  chainConcentration: (v) => clamp01((v - 0.5) / 0.5),
};

/** Textos legibles para cada senal (se usan en `reasons`) */
const LABELS = Object.freeze({
  failedTxRate: 'tasa de transacciones fallidas',
  tvlDrop: 'caida de TVL a 30 dias',
  tvlDrawdown: 'maxima caida desde el pico (90 dias)',
  codeChange: 'antiguedad del ultimo cambio de codigo',
  adminActivity: 'actividad de la clave admin (30 dias)',
  depositConcentration: 'concentracion en el mayor depositante',
  withdrawalSpike: 'pico de retiros',
  auditCoverage: 'auditorias declaradas',
  incidentHistory: 'historial de incidentes',
  chainConcentration: 'concentracion en una sola cadena',
});

/**
 * Nombres alternativos de campo en el dataset (ver data/README.md).
 * Permite que el scorer consuma el esquema documentado sin renombrar columnas.
 */
const ALIASES = Object.freeze({
  tvlDrop: ['tvlChange30d'],
  tvlDrawdown: ['tvlDrawdown90d'],
  codeChange: ['codeChangedDaysAgo'],
  adminActivity: ['adminTxCount30d'],
  depositConcentration: ['topDepositorShare'],
  withdrawalSpike: ['withdrawalSpikePct'],
  auditCoverage: ['auditCount'],
  incidentHistory: ['incidentCount'],
});

function readSignal(input, signal) {
  if (!missing(input[signal])) return input[signal];
  for (const alias of ALIASES[signal] || []) {
    if (!missing(input[alias])) return input[alias];
  }
  return null;
}

/**
 * Puntua un snapshot.
 *
 * @param {object} s snapshot con las senales que existan; las ausentes se omiten
 * @returns {{score:number, band:string, coverage:number, confidence:number,
 *            contributions:object[], reasons:string[], missing:string[]}}
 */
function score(s) {
  const input = s && typeof s === 'object' ? s : {};

  const contributions = Object.keys(WEIGHTS).map((signal) => {
    const weight = WEIGHTS[signal];
    const raw = readSignal(input, signal);
    const base = { signal, weight, source: SOURCE[signal], input: missing(raw) ? null : raw };

    if (missing(raw)) {
      return { ...base, available: false, risk: null, points: 0 };
    }
    const r = MAPPERS[signal](raw);
    if (r === null || !isNum(r)) {
      return { ...base, available: false, risk: null, points: 0 };
    }
    const risk = clamp01(r);
    return { ...base, available: true, risk, points: weight * risk };
  });

  const available = contributions.filter((c) => c.available);
  const missingSignals = contributions.filter((c) => !c.available).map((c) => c.signal);

  const availableWeight = available.reduce((a, c) => a + c.weight, 0);
  const points = available.reduce((a, c) => a + c.points, 0);

  // Reponderacion: el puntaje se normaliza SOLO sobre el peso disponible.
  const scoreValue = availableWeight === 0 ? 100 : Math.round(clamp01(points / availableWeight) * 100);
  const coverage = Math.round((availableWeight / 100) * 100); // % del peso total cubierto

  // La confianza combina cuantas senales hay con la antiguedad del protocolo.
  const ageDays = isNum(input.ageDays) ? input.ageDays : null;
  const ageFactor = ageDays === null ? 0.5 : ageDays < 90 ? 0.3 : ageDays < 365 ? 0.7 : 1;
  const coverageFactor = availableWeight / 100;
  const confidence = Math.round(clamp01(0.7 * coverageFactor + 0.3 * ageFactor) * 100);

  const reasons = available
    .filter((c) => c.risk >= 0.5)
    .sort((a, b) => b.points - a.points)
    .map((c) => `${LABELS[c.signal]}: ${c.input} (riesgo ${(c.risk * 100).toFixed(0)}%)`);

  return {
    score: scoreValue,
    band: bandOf(scoreValue),
    coverage,
    confidence,
    availableWeight,
    contributions,
    reasons,
    missing: missingSignals,
  };
}

module.exports = { score, bandOf, WEIGHTS, SOURCE, BANDS, LABELS, MAPPERS, clamp01 };
