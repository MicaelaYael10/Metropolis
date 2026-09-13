#!/usr/bin/env node
// Pruebas del motor con node:assert, sin dependencias.
// Cubre scoring (incl. senales ausentes), dataset, generador sintetico, backtest
// y Monte Carlo.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { score, WEIGHTS, bandOf, clamp01 } = require('../engine/scoring');
const { loadDataset, signalCoverage } = require('../engine/dataset');
const { generate } = require('../engine/synthetic');
const { runBacktest } = require('../engine/backtest');
const { simulate } = require('../engine/montecarlo');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  OK   ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL ${name}\n         ${e.message}`);
  }
}

/* ------------------------------------------------------------------ fixtures */

const SAFE = {
  failedTxRate: 0.01,
  tvlChange30d: 0.05,
  tvlDrawdown90d: 0.03,
  codeChangedDaysAgo: 400,
  adminTxCount30d: 0,
  topDepositorShare: 0.1,
  withdrawalSpikePct: 0.01,
  auditCount: 3,
  incidentCount: 0,
  chainConcentration: 0.4,
  ageDays: 900,
};

const RISKY = {
  failedTxRate: 0.14,
  tvlChange30d: -0.7,
  tvlDrawdown90d: 0.8,
  codeChangedDaysAgo: 2,
  adminTxCount30d: 25,
  topDepositorShare: 0.95,
  withdrawalSpikePct: 0.5,
  auditCount: 0,
  incidentCount: 3,
  chainConcentration: 1.0,
  ageDays: 120,
};

function row(over) {
  return {
    snapshotId: 'x@2026-01-01',
    protocolId: 'x',
    date: '2026-01-01',
    amountAtRisk: 1000,
    failedWithin90d: false,
    ...over,
  };
}

/* -------------------------------------------------------------------- scoring */

console.log('\n== scoring ==');

test('los pesos suman 100', () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(sum, 100);
});

test('banda: verde <=29, ambar 30..60, rojo >60', () => {
  assert.equal(bandOf(0), 'verde');
  assert.equal(bandOf(29), 'verde');
  assert.equal(bandOf(30), 'ambar');
  assert.equal(bandOf(60), 'ambar');
  assert.equal(bandOf(61), 'rojo');
  assert.equal(bandOf(100), 'rojo');
});

test('clamp01 limita a [0,1]', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(9), 1);
  assert.equal(clamp01(0.25), 0.25);
});

test('un protocolo sano con todas las senales queda en verde y cobertura 100', () => {
  const r = score(SAFE);
  assert.equal(r.band, 'verde', `score=${r.score}`);
  assert.equal(r.coverage, 100);
  assert.equal(r.missing.length, 0);
});

test('un protocolo riesgoso queda en rojo', () => {
  const r = score(RISKY);
  assert.equal(r.band, 'rojo', `score=${r.score}`);
  assert.ok(r.score >= 90, `score=${r.score}`);
});

test('una senal ausente NO se cuenta como riesgo: se excluye y baja la cobertura', () => {
  const sinIncidentes = { ...RISKY };
  delete sinIncidentes.incidentCount;
  const r = score(sinIncidentes);
  assert.equal(r.coverage, 92, `coverage=${r.coverage}`); // 100 - 8
  assert.ok(r.missing.includes('incidentHistory'));
  const c = r.contributions.find((x) => x.signal === 'incidentHistory');
  assert.equal(c.available, false);
  assert.equal(c.points, 0);
});

test('sin ninguna senal el puntaje es 100 (desconocido = riesgo maximo)', () => {
  const r = score({});
  assert.equal(r.score, 100);
  assert.equal(r.coverage, 0);
  assert.equal(r.missing.length, 10);
});

test('reponderacion: el faltante no deprime ni infla el puntaje', () => {
  // Solo tvlDrop disponible y en rojo => 100 (no 12/100).
  const a = score({ tvlChange30d: -0.6 });
  assert.equal(a.score, 100, `score=${a.score}`);
  assert.equal(a.coverage, 12);
  // Al anadir senales tranquilas, el puntaje baja de forma proporcional.
  const b = score({ tvlChange30d: -0.6, auditCount: 2, incidentCount: 0 });
  assert.equal(b.coverage, 28);
  assert.ok(b.score > 40 && b.score < 50, `score=${b.score}`);
});

test('alias: tvlChange30d se lee como la senal tvlDrop', () => {
  const conAlias = score({ tvlChange30d: -0.6 });
  const sinAlias = score({ tvlDrop: -0.6 });
  assert.equal(conAlias.score, sinAlias.score);
});

test('la confianza sube con la cobertura y la antiguedad', () => {
  const poco = score({ tvlChange30d: 0.1 });
  const mucho = score(SAFE);
  assert.ok(mucho.confidence > poco.confidence);
});

test('scoring es determinista', () => {
  assert.deepEqual(score(RISKY), score(RISKY));
});

test('las contribuciones disponibles cuadran con el puntaje', () => {
  const r = score(RISKY);
  const points = r.contributions.filter((c) => c.available).reduce((a, c) => a + c.points, 0);
  const expected = Math.round(clamp01(points / r.availableWeight) * 100);
  assert.equal(r.score, expected);
});

test('reasons explica los factores de riesgo', () => {
  const r = score(RISKY);
  assert.ok(r.reasons.length > 0);
  assert.ok(r.reasons.some((t) => t.includes('concentracion') || t.includes('concentracion')));
});

/* ------------------------------------------------------------------ synthetic */

console.log('\n== synthetic ==');

test('el generador es reproducible con la misma semilla', () => {
  const a = generate({ protocolCount: 8, months: 12, seed: 7 });
  const b = generate({ protocolCount: 8, months: 12, seed: 7 });
  assert.deepEqual(a, b);
});

test('semillas distintas producen datasets distintos', () => {
  const a = generate({ protocolCount: 8, months: 12, seed: 1 });
  const b = generate({ protocolCount: 8, months: 12, seed: 2 });
  assert.notDeepEqual(a, b);
});

test('el dataset sintetico trae positivos y negativos', () => {
  const rows = generate({ protocolCount: 40, months: 24, seed: 99 });
  const pos = rows.filter((r) => r.failedWithin90d).length;
  assert.ok(pos > 0, 'sin positivos no se puede backtestear');
  assert.ok(rows.length - pos > 0, 'sin negativos el FPR no es medible');
});

test('withOnchainSignals:false deja las senales on-chain en null', () => {
  const rows = generate({ protocolCount: 5, months: 6, seed: 3, withOnchainSignals: false });
  assert.equal(rows[0].failedTxRate, null);
  assert.equal(rows[0].adminTxCount30d, null);
  assert.equal(rows[0].topDepositorShare, null);
  assert.equal(rows[0].withdrawalSpikePct, null);
  assert.equal(rows[0].codeChangedDaysAgo, null);
  // Las de DefiLlama siguen presentes.
  assert.equal(typeof rows[0].tvlChange30d, 'number');
});

/* -------------------------------------------------------------------- dataset */

console.log('\n== dataset ==');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'riskguard-test-'));
const write = (name, obj) => {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
};

test('acepta filas con senales en null (dato ausente, no error)', () => {
  const p = write('ok.json', { snapshots: [row({ tvlChange30d: null, failedTxRate: null })] });
  const rows = loadDataset(p);
  assert.equal(rows.length, 1);
});

test('rechaza una fila sin failedWithin90d', () => {
  const bad = row();
  delete bad.failedWithin90d;
  const p = write('bad-label.json', { snapshots: [bad] });
  assert.throws(() => loadDataset(p), /failedWithin90d/);
});

test('rechaza failedWithin90d no booleano', () => {
  const p = write('bad-label2.json', { snapshots: [row({ failedWithin90d: 'si' })] });
  assert.throws(() => loadDataset(p), /booleano/);
});

test('rechaza amountAtRisk no numerico o negativo', () => {
  const p1 = write('bad-amt1.json', { snapshots: [row({ amountAtRisk: '1000' })] });
  assert.throws(() => loadDataset(p1), /amountAtRisk/);
  const p2 = write('bad-amt2.json', { snapshots: [row({ amountAtRisk: -5 })] });
  assert.throws(() => loadDataset(p2), /amountAtRisk/);
});

test('rechaza una senal con valor no numerico', () => {
  const p = write('bad-signal.json', { snapshots: [row({ tvlChange30d: 'mucho' })] });
  assert.throws(() => loadDataset(p), /tvlChange30d/);
});

test('rechaza un dataset vacio', () => {
  const p = write('empty.json', { snapshots: [] });
  assert.throws(() => loadDataset(p), /vacio|vacio/);
});

test('rechaza un dataset inexistente', () => {
  assert.throws(() => loadDataset(path.join(tmpDir, 'no-existe.json')), /No existe/);
});

test('signalCoverage cuenta la disponibilidad real por senal', () => {
  const rows = [row({ tvlChange30d: 0.1 }), row({})];
  const cov = signalCoverage(rows);
  assert.equal(cov.total, 2);
  assert.equal(cov.bySignal.tvlChange30d, 1);
  assert.equal(cov.bySignalPct.tvlChange30d, 50);
  assert.equal(cov.rowsWithLowCoverage, 2);
});

/* ------------------------------------------------------------------- backtest */

console.log('\n== backtest ==');

const separable = [
  ...[1, 2, 3, 4, 5].map((i) => row({ protocolId: `r${i}`, snapshotId: `r${i}`, ...RISKY, failedWithin90d: true })),
  ...[1, 2, 3, 4, 5].map((i) => row({ protocolId: `s${i}`, snapshotId: `s${i}`, ...SAFE, failedWithin90d: false })),
];

test('separa perfectamente un dataset separable (recall y precision = 1)', () => {
  const r = runBacktest(separable, { maxRiskScore: 55 });
  assert.equal(r.metrics.recall, 1);
  assert.equal(r.metrics.precision, 1);
  assert.equal(r.metrics.falsePositiveRate, 0);
  assert.equal(r.metrics.specificity, 1);
});

test('reporta capital preservado y capital perdido', () => {
  const r = runBacktest(separable, { maxRiskScore: 55 });
  assert.equal(r.capital.preserved, 5000);
  assert.equal(r.capital.lost, 0);
});

test('devuelve null en recall sin casos positivos', () => {
  const soloBuenos = [1, 2, 3].map((i) => row({ protocolId: `s${i}`, snapshotId: `s${i}`, ...SAFE }));
  const r = runBacktest(soloBuenos);
  assert.equal(r.metrics.recall, null);
  assert.equal(r.labels.failures, 0);
});

test('marca NO concluyente cuando la cobertura de senales es baja', () => {
  const pobres = [
    ...Array.from({ length: 12 }, (_, i) => row({ protocolId: `p${i}`, snapshotId: `p${i}`, tvlChange30d: -0.7, failedWithin90d: true })),
    ...Array.from({ length: 12 }, (_, i) => row({ protocolId: `q${i}`, snapshotId: `q${i}`, tvlChange30d: 0.1, failedWithin90d: false })),
  ];
  const r = runBacktest(pobres);
  assert.ok(r.dataQuality.avgCoveragePct <= 12, `cov=${r.dataQuality.avgCoveragePct}`);
  assert.equal(r.dataQuality.conclusive, false);
  assert.match(r.dataQuality.note, /Cobertura/);
});

test('marca NO concluyente cuando hay pocos positivos', () => {
  const r = runBacktest(separable);
  assert.equal(r.dataQuality.conclusive, false);
  assert.match(r.dataQuality.note, /positivos/);
});

test('un dataset vacio lanza error', () => {
  assert.throws(() => runBacktest([]), /vacio|vacio/);
});

/* ----------------------------------------------------------------- montecarlo */

console.log('\n== montecarlo ==');

test('los percentiles estan ordenados p5 <= p50 <= p95', () => {
  const s = simulate({ score: 40, confidence: 80, paths: 500, horizonDays: 90, seed: 11 });
  assert.ok(s.p5 <= s.p50, `${s.p5} <= ${s.p50}`);
  assert.ok(s.p50 <= s.p95, `${s.p50} <= ${s.p95}`);
});

test('la simulacion es reproducible con la misma semilla', () => {
  const a = simulate({ score: 40, paths: 300, seed: 5 });
  const b = simulate({ score: 40, paths: 300, seed: 5 });
  assert.deepEqual(a, b);
});

test('breachProbability esta en [0,1] y maxP95 >= p95', () => {
  const s = simulate({ score: 50, paths: 400, seed: 8 });
  assert.ok(s.breachProbability >= 0 && s.breachProbability <= 1);
  assert.ok(s.maxP95 >= s.p95, `${s.maxP95} >= ${s.p95}`);
});

test('menos confianza implica mas dispersion', () => {
  const alta = simulate({ score: 40, confidence: 100, paths: 800, seed: 21 });
  const baja = simulate({ score: 40, confidence: 10, paths: 800, seed: 21 });
  assert.ok(baja.p95 - baja.p5 >= alta.p95 - alta.p5);
});

/* ----------------------------------------------------------------- timeframes */

console.log('\n== timeframes ==');

const { resolveTimeframe, listTimeframes, TIMEFRAMES } = require('../engine/timeframes');

test('resolveTimeframe entiende nombres con unidad', () => {
  assert.equal(resolveTimeframe('1h').seconds, 3600);
  assert.equal(resolveTimeframe('24h').days, 1);
  assert.equal(resolveTimeframe('7d').days, 7);
});

test('resolveTimeframe acepta un numero como dias', () => {
  assert.equal(resolveTimeframe(90).days, 90);
  assert.equal(resolveTimeframe(1).nature, 'tiempo real');
});

test('resolveTimeframe parsea expresiones libres (90m, 3d, 2w)', () => {
  assert.equal(resolveTimeframe('90m').seconds, 5400);
  assert.equal(resolveTimeframe('3d').days, 3);
  assert.equal(resolveTimeframe('2w').days, 14);
});

test('resolveTimeframe rechaza lapsos invalidos', () => {
  assert.throws(() => resolveTimeframe(''), /vacio/);
  assert.throws(() => resolveTimeframe('xyz'), /desconocido/);
  assert.throws(() => resolveTimeframe('0h'), /invalido/);
});

test('los lapsos cortos declarados incluyen 1h, 6h, 24h y 7d', () => {
  const names = listTimeframes('short').map((t) => t.name);
  assert.deepEqual(names, ['1h', '6h', '24h', '7d']);
  assert.ok(TIMEFRAMES['1y']);
});

test('el Monte Carlo de 1h simula en pasos sub-diarios', () => {
  const s = simulate({ score: 50, threshold: 55, horizon: '1h', paths: 500, seed: 3 });
  assert.ok(s.horizonDays < 1);
  assert.ok(s.steps >= 1);
  assert.ok(s.p5 <= s.p50 && s.p50 <= s.p95);
});

test('un lapso corto tiene menos dispersion que uno largo', () => {
  const corto = simulate({ score: 50, threshold: 55, horizon: '1h', paths: 1000, seed: 9 });
  const largo = simulate({ score: 50, threshold: 55, horizon: '90d', paths: 1000, seed: 9 });
  assert.ok(largo.p95 - largo.p5 >= corto.p95 - corto.p5);
});

/* ------------------------------------------------------------- onchain/glacier */

console.log('\n== onchain (senales puras) ==');

const {
  failedTxRate,
  adminTxCount,
  depositConcentration,
  withdrawalSpike,
  codeChangeDaysAgo,
  AVG_BLOCK_SECONDS,
} = require('../engine/onchain');

const PROTO = '0x1111111111111111111111111111111111111111';
const ADMIN = '0x2222222222222222222222222222222222222222';

test('failedTxRate solo cuenta transacciones ENTRANTES al protocolo', () => {
  const txs = [
    { to: PROTO, txStatus: '1' },
    { to: PROTO, txStatus: '0' },
    { to: '0x9999999999999999999999999999999999999999', txStatus: '0' },
  ];
  const r = failedTxRate(txs, PROTO);
  assert.equal(r.total, 2);
  assert.equal(r.failed, 1);
  assert.equal(r.rate, 0.5);
});

test('failedTxRate devuelve null sin transacciones (no asume 0)', () => {
  assert.equal(failedTxRate([], PROTO), null);
  assert.equal(failedTxRate([{ to: ADMIN, txStatus: '0' }], PROTO), null);
});

test('adminTxCount cuenta solo las enviadas por la clave admin', () => {
  const txs = [{ from: ADMIN }, { from: ADMIN }, { from: PROTO }];
  assert.equal(adminTxCount(txs, ADMIN), 2);
  assert.equal(adminTxCount([], ADMIN), null);
  assert.equal(adminTxCount(txs, null), null);
});

test('depositConcentration calcula la cuota del mayor depositante', () => {
  const transfers = [
    { to: PROTO, from: '0xaaa0000000000000000000000000000000000000', valueFloat: 75 },
    { to: PROTO, from: '0xbbb0000000000000000000000000000000000000', valueFloat: 25 },
    { to: PROTO, from: '0xbbb0000000000000000000000000000000000000', valueFloat: 0 }, // se ignora
  ];
  const r = depositConcentration(transfers, PROTO);
  assert.equal(Math.round(r.share * 100), 75);
  assert.equal(r.depositors, 2);
});

test('depositConcentration devuelve null sin depositos', () => {
  assert.equal(depositConcentration([{ from: PROTO, to: ADMIN, valueFloat: 5 }], PROTO), null);
});

test('withdrawalSpike exige al menos 2 dias con retiros', () => {
  const oneDay = [{ from: PROTO, to: ADMIN, valueFloat: 10, blockTimestamp: 1000 }];
  assert.equal(withdrawalSpike(oneDay, PROTO, 30), null);
});

test('withdrawalSpike mide el pico contra la media', () => {
  const day = 86400;
  const transfers = [
    { from: PROTO, to: ADMIN, valueFloat: 10, blockTimestamp: 0 },
    { from: PROTO, to: ADMIN, valueFloat: 10, blockTimestamp: day },
    { from: PROTO, to: ADMIN, valueFloat: 100, blockTimestamp: 2 * day },
  ];
  const r = withdrawalSpike(transfers, PROTO, 30);
  assert.ok(r.spike > 0);
  assert.equal(r.activeDays, 3);
});

test('codeChangeDaysAgo encuentra la ventana del ultimo cambio', () => {
  assert.equal(codeChangeDaysAgo('now', [{ daysAgo: 7, hash: 'old' }]), 3);
  assert.equal(
    codeChangeDaysAgo('now', [
      { daysAgo: 7, hash: 'now' },
      { daysAgo: 30, hash: 'old' },
    ]),
    18,
  );
});

test('codeChangeDaysAgo sin cambios devuelve mas que la ventana observada', () => {
  const samples = [
    { daysAgo: 7, hash: 'now' },
    { daysAgo: 30, hash: 'now' },
    { daysAgo: 90, hash: 'now' },
  ];
  assert.equal(codeChangeDaysAgo('now', samples), 91);
  assert.equal(codeChangeDaysAgo(null, samples), null);
});

test('el bloque promedio de C-Chain es coherente (~2 s)', () => {
  assert.ok(AVG_BLOCK_SECONDS >= 1 && AVG_BLOCK_SECONDS <= 4);
});

/* -------------------------------------------------------------------- resumen */

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${passed} OK  -  ${failed} FAIL\n`);
process.exit(failed === 0 ? 0 : 1);
