#!/usr/bin/env node
// Enriquece el dataset real con las cinco senales on-chain que faltaban,
// usando Glacier Data API + RPC de C-Chain (engine/onchain.js).
//
// No inventa nada: si una senal no se puede medir, queda en null y se anota por que.
// Solo procesa direcciones que existen como contrato en C-Chain; las de otras
// cadenas (p. ej. `arbitrum:0x...`) se descartan y quedan registradas.
//
//   node scripts/collect-onchain.js --months 12 --max-snapshots 6
//   node scripts/collect-onchain.js --protocols aave-v3,benqi-lending
//   node scripts/collect-onchain.js --out data/dataset-avalanche-onchain.json

'use strict';

const fs = require('fs');
const path = require('path');

const { collectOnchainSignals, codeHashAt, blockForTimestamp, loadBlockCache } = require('../engine/onchain');
const { signalCoverage } = require('../engine/dataset');
const { resolveTimeframe } = require('../engine/timeframes');

const ONCHAIN_FIELDS = ['failedTxRate', 'adminTxCount30d', 'topDepositorShare', 'withdrawalSpikePct', 'codeChangedDaysAgo'];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const bool = (v, d = false) => (v === true ? true : v === false || v === undefined ? d : String(v) !== 'false');

/** Extrae una direccion de Avalanche del campo `protocolAddress` de DefiLlama. */
function sanitizeAddress(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(?:([a-zA-Z0-9_-]+):)?(0x[0-9a-fA-F]{40})$/);
  if (!m) return null;
  const prefix = m[1] ? m[1].toLowerCase() : null;
  if (prefix && prefix !== 'avax') return null; // otra cadena: fuera de alcance
  return { address: m[2], prefixed: prefix === 'avax' };
}

async function main() {
  const datasetPath = path.resolve(process.cwd(), String(arg('dataset', 'data/dataset-avalanche.json')));
  const outPath = path.resolve(process.cwd(), String(arg('out', 'data/dataset-avalanche-onchain.json')));
  const months = Number(arg('months', 12));
  const maxSnapshots = Number(arg('max-snapshots', 6));
  const only = String(arg('protocols', '')).split(',').map((s) => s.trim()).filter(Boolean);
  const windowTf = resolveTimeframe(arg('window', '30d'));
  const windowDays = windowTf.days;
  const force = bool(arg('force', false), false);
  const verifyAddresses = bool(arg('verify-addresses', true), true);
  const rpcUrl = String(arg('rpc', process.env.AVAX_MAINNET_RPC || 'https://api.avax.network/ext/bc/C/rpc'));

  if (!fs.existsSync(datasetPath)) throw new Error(`No existe el dataset: ${datasetPath}`);
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const rows = dataset.snapshots || [];
  const cutoff = Date.now() / 1000 - months * 30 * 86400;

  console.log(`\n== RiskGuard - enriquecimiento on-chain ==`);
  console.log(`entrada: ${datasetPath}`);
  console.log(`meses: ${months}  -  snapshots max por protocolo: ${maxSnapshots}  -  ventana: ${windowDays} d`);

  // Agrupa por protocolo y elige las filas mas recientes con direccion valida.
  const byProtocol = new Map();
  const skipped = [];
  for (const row of rows) {
    const parsed = sanitizeAddress(row.protocolAddress);
    if (!parsed) continue;
    if (!byProtocol.has(row.protocolId)) byProtocol.set(row.protocolId, { address: parsed.address, prefixed: parsed.prefixed, rows: [] });
    byProtocol.get(row.protocolId).rows.push(row);
  }

  const cache = loadBlockCache();
  let processed = 0;
  let enrichedRows = 0;
  const perProtocol = [];

  for (const [protocolId, entry] of byProtocol) {
    if (only.length && !only.includes(protocolId)) continue;

    // Verificacion: el address debe tener bytecode en C-Chain (una sola vez por protocolo).
    if (verifyAddresses && !entry.prefixed) {
      // `eth_getCode` en la cabeza; si no hay codigo, no es un contrato de C-Chain.
      let code = null;
      try {
        const block = await blockForTimestamp(Math.floor(Date.now() / 1000), { rpcUrl, cache });
        code = await codeHashAt(entry.address, block, rpcUrl);
      } catch (e) {
        skipped.push({ protocolId, address: entry.address, reason: `no verificable: ${e.message}` });
        continue;
      }
      if (!code) {
        skipped.push({ protocolId, address: entry.address, reason: 'sin bytecode en C-Chain (direccion de otra cadena o EOA)' });
        continue;
      }
    }

    const candidates = entry.rows
      .filter((r) => Date.parse(`${r.date}T00:00:00Z`) / 1000 >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxSnapshots);

    if (candidates.length === 0) {
      skipped.push({ protocolId, address: entry.address, reason: `sin snapshots en los ultimos ${months} meses` });
      continue;
    }

    console.log(`\n${protocolId}  ${entry.address}`);
    let signalsFound = 0;
    for (const row of candidates) {
      const asOfTs = Math.floor(Date.parse(`${row.date}T23:59:59Z`) / 1000);
      try {
        const res = await collectOnchainSignals({
          address: entry.address,
          asOfTs,
          windowDays,
          rpcUrl,
          force,
          cache,
          maxPages: 10,
        });
        for (const f of ONCHAIN_FIELDS) {
          if (res.signals[f] !== null && res.signals[f] !== undefined) {
            row[f] = res.signals[f];
            signalsFound += 1;
          }
        }
        row.onchainEvidence = res.evidence;
        if (res.notes.length) row.onchainNotes = res.notes;
        enrichedRows += 1;
        const found = ONCHAIN_FIELDS.filter((f) => row[f] !== null && row[f] !== undefined).length;
        console.log(`  ${row.date}  senales on-chain: ${found}/5  (tx=${res.evidence.transactions}, erc20=${res.evidence.erc20Transfers})`);
      } catch (e) {
        console.log(`  ${row.date}  ERROR: ${e.message}`);
        skipped.push({ protocolId, address: entry.address, date: row.date, reason: e.message });
      }
    }
    perProtocol.push({ protocolId, address: entry.address, prefixed: entry.prefixed, snapshots: candidates.length, signalsFound });
    processed += 1;
  }

  // Actualiza la metadata con la procedencia y la cobertura resultante.
  const cover = signalCoverage(rows);
  dataset.meta = dataset.meta || {};
  dataset.meta.onchain = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/collect-onchain.js',
    sources: [
      { name: 'Avalanche Data API (Glacier)', url: 'https://glacier-api.avax.network', uso: 'transacciones y transfers ERC20 historicos' },
      { name: 'RPC C-Chain', url: rpcUrl, uso: 'eth_getCode (bytecode), eth_call owner() (clave admin)' },
    ],
    fields: ONCHAIN_FIELDS,
    windowDays,
    protocolsProcessed: processed,
    rowsEnriched: enrichedRows,
    coverageBySignalPct: cover.bySignalPct,
    averageCoverage: dataset.meta.stats ? dataset.meta.stats.coverageAverage : null,
    notes: [
      'Las senales sin evidencia suficiente quedan en null; nunca se rellenan.',
      'La concentracion de depositantes y el pico de retiros usan transfers ERC20 del address del protocolo.',
      'codeChangedDaysAgo se aproxima comparando hashes de bytecode a 7/30/90 dias (requiere RPC con estado historico).',
      'Procesar la historia completa exige un indexer; por defecto se enriquecen los snapshots mas recientes.',
    ],
  };
  dataset.meta.onchain.perProtocol = perProtocol;
  dataset.meta.onchain.skipped = skipped;

  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');
  console.log(`\nprotocolos procesados: ${processed}  -  filas enriquecidas: ${enrichedRows}`);
  console.log(`cobertura por senal (%): ${JSON.stringify(cover.bySignalPct)}`);
  console.log(`escrito: ${outPath}\n`);
}

main().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});
