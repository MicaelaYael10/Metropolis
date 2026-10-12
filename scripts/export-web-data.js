#!/usr/bin/env node
// Exporta el resultado del motor off-chain al frontend como JSON estatico, para que la
// UI muestre lo que el agente calcula de verdad (senales, cobertura y Monte Carlo por
// lapso), no texto de relleno.
//
//   node scripts/export-web-data.js
//
// Salida: web/public/data/latest.json

'use strict';

const fs = require('fs');
const path = require('path');

const { score, LABELS } = require('../engine/scoring');
const { simulate } = require('../engine/montecarlo');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'web', 'public', 'data', 'latest.json');
const TIMEFRAMES = ['1h', '6h', '24h', '7d', '30d', '90d'];
const THRESHOLD = 55;

function strip(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(?:avax:)?(0x[0-9a-fA-F]{40})$/);
  return m ? m[1] : null;
}

function main() {
  const datasetPath = path.join(ROOT, 'data', 'dataset-avalanche-onchain.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const latest = new Map();
  for (const row of dataset.snapshots || []) {
    const prev = latest.get(row.protocolId);
    if (!prev || row.date > prev.date) latest.set(row.protocolId, row);
  }

  const protocols = [];
  for (const [id, row] of latest) {
    const address = strip(row.protocolAddress);
    if (!address) continue;
    const r = score(row);

    const montecarlo = {};
    for (const tf of TIMEFRAMES) {
      const mc = simulate({ score: r.score, confidence: r.confidence, threshold: THRESHOLD, horizon: tf, seed: 42 });
      montecarlo[tf] = { p5: mc.p5, p50: mc.p50, p95: mc.p95, breachProbability: mc.breachProbability };
    }

    protocols.push({
      id,
      name: row.protocolName || id,
      address,
      asOf: row.date,
      score: r.score,
      band: r.band,
      confidence: r.confidence,
      coverage: r.coverage,
      onchain: Boolean(row.onchainEvidence),
      signals: r.contributions.map((c) => ({
        signal: c.signal,
        label: LABELS[c.signal],
        source: c.source,
        weight: c.weight,
        input: c.input,
        risk: c.risk,
        points: Number(c.points.toFixed(2)),
        available: c.available,
      })),
      reasons: r.reasons,
      missing: r.missing,
      montecarlo,
    });
  }
  // Demo de Monad Testnet: los mock vaults hermeticos no tienen dataset de mercado
  // real, asi que se anaden como perfiles de demo con su puntaje on-chain. El
  // dashboard filtra por la cadena conectada, de modo que cada red muestra lo suyo.
  const monadPath = path.join(ROOT, 'data', 'dataset-monad-demo.json');
  let monadCount = 0;
  if (fs.existsSync(monadPath)) {
    const demo = JSON.parse(fs.readFileSync(monadPath, 'utf8'));
    for (const p of demo.protocols || []) {
      const montecarlo = {};
      for (const tf of TIMEFRAMES) {
        const mc = simulate({ score: p.score, confidence: p.confidence, threshold: THRESHOLD, horizon: tf, seed: 42 });
        montecarlo[tf] = { p5: mc.p5, p50: mc.p50, p95: mc.p95, breachProbability: mc.breachProbability };
      }
      protocols.push({ onchain: true, ...p, montecarlo });
      monadCount += 1;
    }
  }

  protocols.sort((a, b) => a.id.localeCompare(b.id));

  const stats = (dataset.meta && dataset.meta.stats) || {};
  const out = {
    generatedAt: new Date().toISOString(),
    threshold: THRESHOLD,
    timeframes: TIMEFRAMES,
    dataset: {
      source: 'data/dataset-avalanche-onchain.json',
      monadDemo: 'data/dataset-monad-demo.json',
      snapshots: stats.snapshots || (dataset.snapshots || []).length,
      protocols: stats.protocols || protocols.length,
      coverageAverage: stats.coverageAverage ?? null,
      onchainRows: dataset.meta && dataset.meta.onchain ? dataset.meta.onchain.rowsEnriched : 0,
    },
    protocols,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`exportados ${protocols.length} protocolos (${monadCount} de demo Monad) -> ${OUT}`);
}

main();
