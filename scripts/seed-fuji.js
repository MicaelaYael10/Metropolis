#!/usr/bin/env node
// Siembra la demo en Fuji: registra los protocolos con mejor cobertura on-chain en
// ProtocolRegistry (con su puntaje real del motor) y fija una politica de ejemplo.
//
//   node scripts/seed-fuji.js
//   node scripts/seed-fuji.js --limit 3 --max-risk 55
//
// Lee PRIVATE_KEY, REGISTRY_ADDRESS y RISKGUARD_ADDRESS de .env.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { score } = require('../engine/scoring');

const RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
const ROOT = path.join(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) throw new Error('No existe .env (copia de .env.example y completa PRIVATE_KEY)');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
  return env;
}

function cast(args) {
  const r = spawnSync('cast', args, { encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function send(pk, to, sig, ...rest) {
  return cast(['send', to, sig, ...rest, '--private-key', pk, '--rpc-url', RPC]);
}

function stripAddress(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^(?:avax:)?(0x[0-9a-fA-F]{40})$/);
  return m ? m[1] : null;
}

function main() {
  const env = loadEnv();
  const pk = env.PRIVATE_KEY;
  const registry = env.REGISTRY_ADDRESS;
  const riskGuard = env.RISKGUARD_ADDRESS;
  const user = env.ADDRESS;
  if (!pk || !registry || !riskGuard) throw new Error('Faltan PRIVATE_KEY, REGISTRY_ADDRESS o RISKGUARD_ADDRESS en .env');

  const limit = Number(arg('limit', 3));
  const maxRisk = String(arg('max-risk', '55'));

  const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dataset-avalanche-onchain.json'), 'utf8'));
  const latest = new Map();
  for (const row of dataset.snapshots || []) {
    const prev = latest.get(row.protocolId);
    if (!prev || row.date > prev.date) latest.set(row.protocolId, row);
  }

  // Candidatos: con direccion valida de Avalanche y cobertura on-chain razonable.
  const candidates = [];
  const seenAddr = new Set();
  for (const [protocolId, row] of latest) {
    const address = stripAddress(row.protocolAddress);
    if (!address) continue;
    const key = address.toLowerCase();
    if (seenAddr.has(key)) continue; // una direccion por protocolo (Evita duplicados)
    seenAddr.add(key);
    const result = score(row);
    candidates.push({
      protocolId,
      address,
      name: row.protocolName || protocolId,
      score: result.score,
      coverage: result.coverage,
      band: result.band,
      onchain: Boolean(row.onchainEvidence),
    });
  }

  // Preferir los protocolos con evidencia on-chain real (Avalanche) para la demo.
  const onchain = candidates.filter((c) => c.onchain);
  const safePool = onchain.length >= 2 ? onchain : candidates;
  const safe = safePool
    .filter((c) => c.score <= Number(maxRisk))
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, limit - 1));
  const risky = candidates
    .filter((c) => c.score > Number(maxRisk))
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
  const chosen = [...safe, ...risky].slice(0, limit);

  console.log(`\n== Sembrando la demo en Fuji ==`);
  console.log(`registry: ${registry}`);
  console.log(`candidatos con direccion: ${candidates.length}  -  elegidos: ${chosen.length}\n`);

  for (const c of chosen) {
    const reg = send(pk, registry, 'registerProtocol(address,string,uint8)', c.address, c.name, '1');
    if (reg.status !== 0 && !/already/i.test(reg.err)) {
      console.log(`  x ${c.protocolId}: ${reg.err.split('\n')[0]}`);
      continue;
    }
    send(pk, registry, 'setRiskScore(address,uint8,uint8,bytes32)', c.address, String(c.score), String(c.coverage), '0x' + '00'.repeat(32));
    send(pk, registry, 'setActive(address,bool)', c.address, 'true');
    console.log(`  + ${c.protocolId.padEnd(22)} riesgo=${String(c.score).padStart(3)} (${c.band})  cobertura=${c.coverage}%`);
  }

  const policy = send(pk, riskGuard, 'setPolicy(uint8,uint8,uint256,uint256)', maxRisk, '5', '1000000', '500000');
  console.log(`\n  politica del usuario: maxRiskScore=${maxRisk}, maxProtocols=5, tope/protocolo=1000000, tope/op=500000  -> ${policy.status === 0 ? 'OK' : policy.err.split('\n')[0]}`);
  console.log(`\nListo. Abre el frontend y conecta ${user || 'tu billetera'}.\n`);
}

main();
