// Carga y validacion de datasets. Una senal puede estar ausente (null) y eso no
// es un error: se cuenta como falta de cobertura. Un dataset mal formado si lo es.
// Esquema en data/README.md.

'use strict';

const fs = require('fs');
const path = require('path');

/** Campos que deben existir siempre en cada fila. */
const REQUIRED_ANY = ['snapshotId', 'protocolId', 'date', 'failedWithin90d'];

/** Senales del modelo: si estan, deben ser numericas; si no, deben ser null. */
const SIGNAL_FIELDS = [
  'failedTxRate',
  'tvlChange30d',
  'tvlDrawdown90d',
  'codeChangedDaysAgo',
  'adminTxCount30d',
  'topDepositorShare',
  'withdrawalSpikePct',
  'auditCount',
  'incidentCount',
  'chainConcentration',
];

/** Alias del esquema (se aceptan ambos nombres). */
const SIGNAL_ALIASES = { tvlDrawdown: 'tvlDrawdown90d', tvlDrop: 'tvlChange30d' };

const ALL_SIGNAL_KEYS = [...SIGNAL_FIELDS, ...Object.keys(SIGNAL_ALIASES)];

/**
 * @param {string} filePath
 * @param {{allowEmpty?:boolean}} [opts]
 * @returns {Array<Object>}
 */
function loadDataset(filePath, opts = {}) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`No existe el dataset: ${abs}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new Error(`El dataset no es JSON valido: ${e.message}`);
  }

  const rows = Array.isArray(parsed) ? parsed : parsed.snapshots;
  if (!Array.isArray(rows)) {
    throw new Error('El dataset debe ser un array, o un objeto con la clave `snapshots`.');
  }
  if (rows.length === 0 && !opts.allowEmpty) {
    throw new Error('El dataset esta vacio.');
  }

  rows.forEach((row, i) => {
    for (const key of REQUIRED_ANY) {
      if (row[key] === undefined) throw new Error(`Fila ${i}: falta el campo \`${key}\``);
    }
    if (typeof row.failedWithin90d !== 'boolean') {
      throw new Error(`Fila ${i}: \`failedWithin90d\` debe ser booleano`);
    }
    // amountAtRisk es obligatorio: sin el no hay metricas de capital.
    if (typeof row.amountAtRisk !== 'number' || !Number.isFinite(row.amountAtRisk) || row.amountAtRisk < 0) {
      throw new Error(`Fila ${i}: \`amountAtRisk\` debe ser numerico >= 0`);
    }
    // Las senales son opcionales, pero si estan deben ser numericas.
    for (const key of ALL_SIGNAL_KEYS) {
      const v = row[key];
      if (v === undefined || v === null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new Error(`Fila ${i}: \`${key}\` debe ser numerico o null (recibido ${JSON.stringify(v)})`);
      }
    }
  });

  return rows;
}

/**
 * Cobertura de senales: cuanta informacion REAL hay disponible.
 * Se reporta junto a las metricas para no presentar un backtest sobre datos
 * incompletos como si fuera concluyente.
 *
 * @param {Array<Object>} rows
 */
function signalCoverage(rows) {
  const bySignal = {};
  for (const key of SIGNAL_FIELDS) bySignal[key] = 0;

  let sumAvailable = 0;
  let rowsWithLowCoverage = 0;

  for (const row of rows) {
    let available = 0;
    for (const key of SIGNAL_FIELDS) {
      const v = row[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        bySignal[key] += 1;
        available += 1;
      }
    }
    sumAvailable += available;
    if (available < SIGNAL_FIELDS.length / 2) rowsWithLowCoverage += 1;
  }

  return {
    total: rows.length,
    bySignal,
    bySignalPct: Object.fromEntries(
      Object.entries(bySignal).map(([k, v]) => [k, rows.length ? Number(((v / rows.length) * 100).toFixed(1)) : 0]),
    ),
    avgAvailableSignals: rows.length ? Number((sumAvailable / rows.length).toFixed(2)) : 0,
    rowsWithLowCoverage,
  };
}

module.exports = { loadDataset, signalCoverage, REQUIRED_ANY, SIGNAL_FIELDS };
