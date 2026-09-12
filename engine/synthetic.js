// Generador de datasets SINTETICOS para probar el arnes.
// Estos datos NO son evidencia de rendimiento real. Para metricas reales usar
// scripts/build-dataset.js (DefiLlama). Determinista: misma semilla, mismo dataset.

'use strict';

/** PRNG reproducible (mulberry32). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
const num = (v, d = 4) => Number(v.toFixed(d));

/**
 * @param {{protocolCount?:number, months?:number, seed?:number, badShare?:number,
 *          failRate?:number, withOnchainSignals?:boolean}} [opts]
 * @returns {Array<object>} snapshots con el esquema de data/README.md
 */
function generate(opts = {}) {
  const protocolCount = opts.protocolCount ?? 60;
  const months = opts.months ?? 36;
  const seed = opts.seed ?? 20260913;
  const badShare = opts.badShare ?? 0.3;
  const failRate = opts.failRate ?? 0.75;
  // Si es false, las senales on-chain quedan en null (simula disponibilidad parcial).
  const withOnchain = opts.withOnchainSignals !== false;

  const rand = mulberry32(seed);
  const rows = [];
  const DAY = 86400;
  const endTs = Math.floor(Date.UTC(2026, 8, 1) / 1000); // 2026-09-01

  for (let i = 0; i < protocolCount; i++) {
    const q = rand(); // calidad latente: 0 = mala, 1 = buena
    const willFail = q < badShare && rand() < failRate;
    // Dia del fallo, dentro de la ventana observada.
    const failOffsetDays = willFail ? Math.floor(rand() * (months * 30 - 120)) + 60 : null;
    const failTs = willFail ? endTs - (months * 30 - failOffsetDays) * DAY : null;

    const baseTvl = 1e6 + rand() * 5e8;
    const age0 = Math.floor(rand() * 1200) + 30;
    const audits = rand() < 0.35 ? 0 : rand() < 0.6 ? 1 : 2 + Math.floor(rand() * 2);

    for (let m = months; m >= 0; m--) {
      const ts = endTs - m * 30 * DAY;
      if (ts > endTs) continue;

      // Cercania al fallo: 0 = lejos, 1 = inminente.
      const daysToFail = willFail ? (failTs - ts) / DAY : Infinity;
      const proximity = daysToFail > 0 && daysToFail <= 180 ? 1 - daysToFail / 180 : 0;
      const stress = 0.55 * (1 - q) + 0.45 * proximity; // 0..1

      const noise = (k) => (rand() - 0.5) * k;
      const tvlChange30d = num(-0.6 * stress + noise(0.14));
      const tvlDrawdown90d = num(Math.max(0, 0.7 * stress + noise(0.12)));
      const failedTxRate = withOnchain ? num(Math.max(0, 0.12 * stress + noise(0.03))) : null;
      const adminTxCount30d = withOnchain ? Math.max(0, Math.round(12 * stress + noise(4))) : null;
      const topDepositorShare = withOnchain ? num(Math.min(1, Math.max(0, 0.35 + 0.4 * stress + noise(0.1)))) : null;
      const withdrawalSpikePct = withOnchain ? num(Math.max(0, 0.2 * stress + noise(0.06))) : null;
      const codeChangedDaysAgo = withOnchain
        ? Math.max(0, Math.round(90 * stress + noise(20)))
        : null;

      const failedWithin90d = willFail && daysToFail > 0 && daysToFail <= 90;

      rows.push({
        snapshotId: `syn-${String(i).padStart(3, '0')}@${iso(ts)}`,
        protocolId: `syn-${String(i).padStart(3, '0')}`,
        date: iso(ts),
        // --- senales ---
        failedTxRate,
        tvlChange30d,
        tvlDrawdown90d,
        codeChangedDaysAgo,
        adminTxCount30d,
        topDepositorShare,
        withdrawalSpikePct,
        auditCount: audits,
        incidentCount: willFail && proximity > 0 ? 1 : 0,
        chainConcentration: num(Math.min(1, Math.max(0, 0.5 + 0.4 * stress + noise(0.15)))),
        ageDays: age0 + m * 30,
        // --- exposicion y etiqueta ---
        amountAtRisk: num(baseTvl * (1 - 0.3 * stress), 2),
        failedWithin90d,
        _synthetic: true,
      });
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.snapshotId.localeCompare(b.snapshotId)));
  return rows;
}

module.exports = { generate, mulberry32 };
