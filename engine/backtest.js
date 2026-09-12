// Arnes de backtesting: puntua cada snapshot y compara la decision con lo que
// realmente paso (failedWithin90d). Reporta las cuatro metricas en tension, no
// solo el recall, mas el capital preservado y el perdido.

"use strict";

const { score } = require("./scoring");

/** Umbral de politica: por encima de maxRiskScore se bloquea. */

const DEFAULT_POLICY = { maxRiskScore: 55 };

/**
 * @param {Array<Object>} dataset  snapshots (ver data/README.md)
 * @param {BacktestPolicy} [policy]
 * @returns {Object} metricas + detalle por protocolo
 */
function runBacktest(dataset, policy = DEFAULT_POLICY) {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    throw new Error("El dataset esta vacio");
  }

  let blocked = 0;
  let allowed = 0;
  let blockedFailures = 0;
  let blockedSurvivors = 0;
  let allowedFailures = 0;
  let allowedSurvivors = 0;
  let capitalPreserved = 0;
  let capitalLost = 0;
  let capitalAtRiskTotal = 0;

  const scoreHistogram = new Array(10).fill(0);
  const perProtocol = new Map();
  let coverageSum = 0;
  let lowCoverageRows = 0;

  for (const row of dataset) {
    const result = score(row);
    const isFailure = row.failedWithin90d === true;
    const amount = Number(row.amountAtRisk || 0);
    const isBlocked = result.score > policy.maxRiskScore;

    capitalAtRiskTotal += amount;
    scoreHistogram[Math.min(9, Math.floor(result.score / 10))] += 1;
    coverageSum += result.coverage;
    if (result.coverage < 50) lowCoverageRows += 1;

    if (isBlocked) {
      blocked += 1;
      if (isFailure) {
        blockedFailures += 1;
        capitalPreserved += amount;
      } else {
        blockedSurvivors += 1;
      }
    } else {
      allowed += 1;
      if (isFailure) {
        allowedFailures += 1;
        capitalLost += amount;
      } else {
        allowedSurvivors += 1;
      }
    }

    const key = row.protocolId || row.snapshotId;
    const acc = perProtocol.get(key) || { protocolId: key, snapshots: 0, maxScore: 0, failures: 0, blocked: 0 };
    acc.snapshots += 1;
    acc.maxScore = Math.max(acc.maxScore, result.score);
    if (isFailure) acc.failures += 1;
    if (isBlocked) acc.blocked += 1;
    perProtocol.set(key, acc);
  }

  const totalFailures = blockedFailures + allowedFailures;
  const totalSurvivors = blockedSurvivors + allowedSurvivors;

  return {
    policy,
    snapshots: dataset.length,
    decisions: { blocked, allowed },
    confusion: {
      blockedFailures,
      blockedSurvivors,
      allowedFailures,
      allowedSurvivors,
    },
    metrics: {
      recall: totalFailures > 0 ? Number((blockedFailures / totalFailures).toFixed(4)) : null,
      falsePositiveRate: totalSurvivors > 0 ? Number((blockedSurvivors / totalSurvivors).toFixed(4)) : null,
      precision: blocked > 0 ? Number((blockedFailures / blocked).toFixed(4)) : null,
      specificity: totalSurvivors > 0 ? Number((allowedSurvivors / totalSurvivors).toFixed(4)) : null,
    },
    capital: {
      atRiskTotal: capitalAtRiskTotal,
      preserved: capitalPreserved,
      lost: capitalLost,
      preservedPctOfAtRisk: capitalAtRiskTotal > 0 ? Number((capitalPreserved / capitalAtRiskTotal).toFixed(4)) : null,
    },
    labels: {
      failures: totalFailures,
      survivors: totalSurvivors,
      failureRate: dataset.length > 0 ? Number((totalFailures / dataset.length).toFixed(4)) : null,
    },
    // Honestidad: si la cobertura de senales es baja, las metricas NO son concluyentes.
    dataQuality: (() => {
      const avgCoveragePct = dataset.length > 0 ? Number((coverageSum / dataset.length).toFixed(1)) : 0;
      return {
        avgCoveragePct,
        rowsBelow50PctCoverage: lowCoverageRows,
        conclusive: avgCoveragePct >= 60 && totalFailures >= 10,
        note:
          avgCoveragePct < 60
            ? 'Cobertura de senales baja: el puntaje se apoya en pocas senales reales. NO concluyente.'
            : totalFailures < 10
              ? 'Muy pocos casos positivos: el recall es inestable. NO concluyente.'
              : 'Cobertura y positivos suficientes para una lectura preliminar.',
      };
    })(),
    scoreHistogram,
    perProtocol: Array.from(perProtocol.values()).sort((a, b) => b.maxScore - a.maxScore),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { runBacktest, DEFAULT_POLICY };
