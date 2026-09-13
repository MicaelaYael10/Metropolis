// Colector de senales on-chain. Cierra el hueco del 45,2 % de cobertura:
// las cinco senales que el dataset real deja en null y que detectan el estres
// previo a un exploit.
//
// Fuentes:
//   - Glacier Data API (engine/glacier.js): transacciones y transfers ERC20 historicos.
//   - RPC de C-Chain: eth_getCode (cambios de bytecode) y eth_call owner() (clave admin).
//
// Regla de honestidad: si no hay evidencia suficiente para una senal, se devuelve
// null y se explica por que. Nunca se rellena con un valor inventado.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { listTransactions, listErc20Transfers } = require('./glacier');

const DAY = 86400;
const AVG_BLOCK_SECONDS = 2; // C-Chain produce ~1 bloque cada 2 s
const DEFAULT_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const BLOCK_CACHE_FILE = path.join(__dirname, '..', 'data', 'cache', 'onchain-blocks.json');
const OWNER_SELECTOR = '0x8da5cb5b'; // owner()

/* --------------------------------------------------------------- utilidades */

const lower = (a) => (a ? String(a).toLowerCase() : null);
const same = (a, b) => lower(a) !== null && lower(a) === lower(b);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

/* ------------------------------------------------- funciones puras (probables) */

/**
 * Tasa de transacciones fallidas CONTRA un protocolo: transacciones cuyo destino
 * es la direccion del protocolo y que revirtieron. Sin transacciones no hay
 * evidencia suficiente -> null (no se asume 0).
 */
function failedTxRate(txs, address) {
  const inbound = (txs || []).filter((t) => same(t.to, address));
  if (inbound.length === 0) return null;
  const failed = inbound.filter((t) => String(t.txStatus) === '0').length;
  return { total: inbound.length, failed, rate: failed / inbound.length };
}

/** Numero de transacciones enviadas por la clave de administracion. */
function adminTxCount(txs, admin) {
  if (!admin) return null;
  const rows = txs || [];
  if (rows.length === 0) return null;
  return rows.filter((t) => same(t.from, admin)).length;
}

/**
 * Concentracion en el mayor depositante: suma de inflows agrupados por origen.
 * El protocolo es el destino del transfer.
 */
function depositConcentration(transfers, address) {
  const bySender = new Map();
  let total = 0;
  for (const t of transfers || []) {
    if (!same(t.to, address)) continue;
    const amount = t.valueFloat;
    if (!isNum(amount) || amount <= 0) continue;
    const sender = lower(t.from);
    if (!sender) continue;
    bySender.set(sender, (bySender.get(sender) || 0) + amount);
    total += amount;
  }
  if (total <= 0 || bySender.size === 0) return null;
  const top = Math.max(...bySender.values());
  return { share: top / total, depositors: bySender.size, total };
}

/**
 * Pico de retiros: mayor salida diaria (flujo desde el protocolo) contra la media.
 * Se expresa como exceso relativo sobre la media, acorde a la senal `withdrawalSpike`.
 * Requiere al menos 2 dias con actividad; si no, null.
 */
function withdrawalSpike(transfers, address, windowDays = 30) {
  const byDay = new Map();
  for (const t of transfers || []) {
    if (!same(t.from, address)) continue;
    const amount = t.valueFloat;
    if (!isNum(amount) || amount <= 0) continue;
    const day = Math.floor(t.blockTimestamp / DAY);
    byDay.set(day, (byDay.get(day) || 0) + amount);
  }
  if (byDay.size < 2) return null;
  const days = windowDays > 0 ? Math.max(2, Math.round(windowDays)) : byDay.size;
  const daily = [...byDay.values()];
  const peak = Math.max(...daily);
  const mean = daily.reduce((a, b) => a + b, 0) / days;
  if (mean <= 0) return null;
  return { spike: Math.max(0, (peak - mean) / mean), peak, mean, activeDays: byDay.size };
}

/**
 * Antiguedad del ultimo cambio de codigo, a partir de comparaciones de hash.
 * `samples` viene ordenado por `daysAgo` ascendente: [{daysAgo, hash}, ...].
 * Devuelve un valor representativo en dias (para las bandas de scoring).
 */
function codeChangeDaysAgo(currentHash, samples) {
  if (!currentHash || !Array.isArray(samples) || samples.length === 0) return null;
  const ordered = [...samples].sort((a, b) => a.daysAgo - b.daysAgo);
  let previous = 0;
  for (const s of ordered) {
    if (s.hash && s.hash !== currentHash) {
      // Cambio ocurrido entre `previous` y `s.daysAgo`.
      return Math.floor((previous + s.daysAgo) / 2);
    }
    previous = s.daysAgo;
  }
  // Sin cambios en toda la ventana observada.
  return ordered[ordered.length - 1].daysAgo + 1;
}

/* --------------------------------------------------------------- RPC client */

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status} en ${method}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

/** Varias llamadas JSON-RPC en una sola peticion HTTP (menos latencia).
 *  El RPC publico rechaza lotes grandes, asi que se parten en trozos de 20. */
async function rpcBatch(rpcUrl, calls) {
  if (calls.length === 0) return [];
  const out = [];
  const CHUNK = 20;
  for (let start = 0; start < calls.length; start += CHUNK) {
    const slice = calls.slice(start, start + CHUNK);
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(slice.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params }))),
    });
    if (!res.ok) throw new Error(`RPC batch ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json) ? json : [json];
    const byId = new Map(list.map((r) => [r.id, r]));
    for (let i = 0; i < slice.length; i += 1) out.push(byId.get(i) || null);
  }
  return out;
}

/* --------------------------------------------------------- indice de bloques */

function loadBlockCache() {
  try {
    return JSON.parse(fs.readFileSync(BLOCK_CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveBlockCache(cache) {
  try {
    fs.mkdirSync(path.dirname(BLOCK_CACHE_FILE), { recursive: true });
    fs.writeFileSync(BLOCK_CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch {
    /* la cache es una optimizacion: si no se puede escribir, no es fatal */
  }
}

/** Bloque cuyo timestamp es el mayor <= ts. Busqueda por interpolacion en lotes. */
async function blockForTimestamp(ts, opts = {}) {
  const rpcUrl = opts.rpcUrl || DEFAULT_RPC;
  const cache = opts.cache || loadBlockCache();
  const key = String(Math.floor(ts));
  if (cache[key]) return cache[key];

  const head = parseInt(await rpcCall(rpcUrl, 'eth_blockNumber', []), 16);
  const SAMPLES = 64;

  const timesAt = async (nums) => {
    const results = await rpcBatch(
      rpcUrl,
      nums.map((n) => ({ method: 'eth_getBlockByNumber', params: ['0x' + n.toString(16), false] })),
    );
    return results.map((r) => (r && r.result ? parseInt(r.result.timestamp, 16) : null));
  };

  // Invariante: timestamp(lo) <= ts < timestamp(hi). Se estrecha por interpolacion.
  let lo = 1;
  let hi = head;
  for (let round = 0; round < 8 && hi - lo > SAMPLES; round += 1) {
    const step = Math.max(1, Math.floor((hi - lo) / SAMPLES));
    const nums = [];
    for (let b = lo; b < hi; b += step) nums.push(b);
    nums.push(hi);
    const times = await timesAt(nums);

    let nextLo = lo;
    let nextHi = hi;
    for (let i = 0; i < nums.length; i += 1) {
      if (times[i] === null) continue;
      if (times[i] < ts) nextLo = nums[i];
      else {
        nextHi = nums[i];
        break;
      }
    }
    if (nextLo === lo && nextHi === hi) break;
    lo = nextLo;
    hi = nextHi;
  }

  // Refinamiento final dentro del intervalo estrecho.
  const finalNums = [];
  for (let b = lo; b <= hi; b += 1) finalNums.push(b);
  const finalTimes = await timesAt(finalNums);
  let result = lo;
  for (let i = 0; i < finalNums.length; i += 1) {
    if (finalTimes[i] !== null && finalTimes[i] <= ts) result = finalNums[i];
  }

  cache[key] = result;
  if (opts.persist !== false) saveBlockCache(cache);
  return result;
}

async function codeHashAt(address, blockNumber, rpcUrl = DEFAULT_RPC) {
  const code = await rpcCall(rpcUrl, 'eth_getCode', [address, '0x' + blockNumber.toString(16)]);
  if (!code || code === '0x') return null;
  return sha1(code);
}

async function ownerOf(address, blockNumber, rpcUrl = DEFAULT_RPC) {
  try {
    const result = await rpcCall(rpcUrl, 'eth_call', [
      { to: address, data: OWNER_SELECTOR },
      '0x' + blockNumber.toString(16),
    ]);
    if (!result || result === '0x' || result.length < 42) return null;
    const addr = '0x' + result.slice(-40);
    return /^0x0{40}$/.test(addr) ? null : addr;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ colector */

/**
 * Colecta las cinco senales on-chain para un protocolo, en una ventana que termina
 * en `asOfTs`. Las senales sin evidencia quedan en null y se registran en `notes`.
 *
 * @param {object} opts
 * @param {string} opts.address direccion del contrato del protocolo
 * @param {number} [opts.asOfTs] timestamp de fin de ventana (por defecto, ahora)
 * @param {number} [opts.windowDays] ventana de analisis (por defecto 30)
 * @param {string} [opts.rpcUrl]
 * @param {boolean} [opts.force] ignora la cache de Glacier
 * @param {number} [opts.maxPages] tope de paginas por endpoint
 * @param {boolean} [opts.includeCodeChange] incluir cambio de bytecode (RPC)
 * @returns {Promise<{signals:object, evidence:object, notes:string[]}>}
 */
async function collectOnchainSignals(opts) {
  const address = opts.address;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Direccion invalida: ${address}`);
  }
  const rpcUrl = opts.rpcUrl || DEFAULT_RPC;
  const asOfTs = isNum(opts.asOfTs) ? opts.asOfTs : Math.floor(Date.now() / 1000);
  const windowDays = isNum(opts.windowDays) ? opts.windowDays : 30;
  const includeCodeChange = opts.includeCodeChange !== false;
  const cache = opts.cache || loadBlockCache();

  const notes = [];
  const toBlock = await blockForTimestamp(asOfTs, { rpcUrl, cache, persist: opts.persist });
  // El inicio de ventana se estima por offset de bloques (~2 s/bloque en C-Chain):
  // no se necesita precision al segundo para una ventana de 30 dias.
  const windowBlocks = Math.round((windowDays * DAY) / AVG_BLOCK_SECONDS);
  const fromBlock = Math.max(1, toBlock - windowBlocks);

  // --- transacciones (fallos y actividad admin) ---
  let txs = [];
  try {
    txs = await listTransactions(address, { startBlock: fromBlock, endBlock: toBlock, maxPages: opts.maxPages, force: opts.force });
  } catch (e) {
    notes.push(`transacciones: ${e.message}`);
  }
  const fail = failedTxRate(txs, address);
  const failedTxRateValue = fail ? Number(fail.rate.toFixed(4)) : null;
  if (!fail) notes.push('failedTxRate: sin transacciones al protocolo en la ventana');

  let adminTxCount30d = null;
  const admin = await ownerOf(address, toBlock, rpcUrl);
  if (admin) {
    try {
      const adminTxs = await listTransactions(admin, { startBlock: fromBlock, endBlock: toBlock, maxPages: opts.maxPages, force: opts.force });
      adminTxCount30d = adminTxCount(adminTxs, admin);
    } catch (e) {
      notes.push(`admin: ${e.message}`);
    }
  } else {
    notes.push('adminTxCount30d: el contrato no expone owner()');
  }

  // --- transfers ERC20 (concentracion de depositos y pico de retiros) ---
  let transfers = [];
  try {
    transfers = await listErc20Transfers(address, { startBlock: fromBlock, endBlock: toBlock, maxPages: opts.maxPages, force: opts.force });
  } catch (e) {
    notes.push(`transfers: ${e.message}`);
  }
  const concentration = depositConcentration(transfers, address);
  const spike = withdrawalSpike(transfers, address, windowDays);
  if (!concentration) notes.push('topDepositorShare: sin depositos ERC20 identificables');
  if (!spike) notes.push('withdrawalSpikePct: menos de 2 dias con retiros');

  // --- cambio de bytecode (requiere RPC con estado historico). Sondeo perezoso:
  // solo se sigue mirando hacia atras mientras el hash siga cambiando o no haya
  // cambio; se corta apenas se encuentra la ventana del ultimo cambio. ---
  let codeChangedDaysAgo = null;
  if (includeCodeChange) {
    try {
      const current = await codeHashAt(address, toBlock, rpcUrl);
      if (current) {
        const samples = [];
        for (const daysAgo of [7, 30, 90]) {
          const blk = await blockForTimestamp(asOfTs - daysAgo * DAY, { rpcUrl, cache, persist: opts.persist });
          const hash = await codeHashAt(address, blk, rpcUrl);
          samples.push({ daysAgo, hash });
          if (hash && hash !== current) break; // ya se encontro el cambio
        }
        codeChangedDaysAgo = codeChangeDaysAgo(current, samples);
      } else {
        notes.push('codeChangedDaysAgo: sin bytecode en la direccion (EOA?)');
      }
    } catch (e) {
      notes.push(`codeChange: ${e.message}`);
    }
  }

  return {
    signals: {
      failedTxRate: failedTxRateValue,
      adminTxCount30d,
      topDepositorShare: concentration ? Number(concentration.share.toFixed(4)) : null,
      withdrawalSpikePct: spike ? Number(spike.spike.toFixed(4)) : null,
      codeChangedDaysAgo,
    },
    evidence: {
      address,
      asOfTs,
      windowDays,
      fromBlock,
      toBlock,
      transactions: txs.length,
      erc20Transfers: transfers.length,
      adminAddress: admin,
    },
    notes,
  };
}

module.exports = {
  DAY,
  DEFAULT_RPC,
  AVG_BLOCK_SECONDS,
  failedTxRate,
  adminTxCount,
  depositConcentration,
  withdrawalSpike,
  codeChangeDaysAgo,
  rpcCall,
  rpcBatch,
  blockForTimestamp,
  codeHashAt,
  ownerOf,
  collectOnchainSignals,
  loadBlockCache,
  saveBlockCache,
};
