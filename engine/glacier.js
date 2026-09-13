// Cliente de la Avalanche Data API (Glacier). Fuente oficial, publica y sin clave.
// Da el historial de transacciones y de transfers ERC20 de una direccion, que es lo
// que alimenta las senales on-chain del modelo (retiros, concentracion, fallos, admin).
// Cachea en disco (data/cache/glacier) para que una corrida sea reproducible sin red.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'https://glacier-api.avax.network';
const CHAIN_ID = 43114; // Avalanche C-Chain
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache', 'glacier');
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET con cache en disco y reintentos con backoff (Glacier responde 429/5xx
 * cuando se le exige de mas). Devuelve {data, fetchedAt, fromCache, url}.
 */
async function getJson(url, opts = {}) {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const retries = opts.retries ?? 3;
  const file = path.join(CACHE_DIR, `${cacheKey(url)}.json`);
  ensureCacheDir();

  if (!opts.force && fs.existsSync(file)) {
    try {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (Number.isFinite(age) && age < ttl) {
        return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true, url };
      }
    } catch {
      /* cache corrupta: se ignora y se vuelve a descargar */
    }
  }

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'riskguard-avax/1.0 (buildathon)' },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Glacier ${res.status} en ${url}`);
        await sleep(400 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Glacier ${res.status} en ${url}`);

      const data = await res.json();
      const fetchedAt = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify({ url, fetchedAt, data }), 'utf8');
      return { data, fetchedAt, fromCache: false, url };
    } catch (e) {
      lastErr = e;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastErr || new Error(`Glacier fallo en ${url}`);
}

function toQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

/**
 * Transacciones nativas (y de contrato) en las que participa una direccion.
 * Si se pasan startBlock/endBlock, Glacier acota el rango antes de paginar.
 *
 * @returns {Promise<Array<{blockNumber:number, blockTimestamp:number, txHash:string,
 *   txStatus:string, from:string, to:string|null, value:string, method:string|null}>>}
 */
async function listTransactions(address, opts = {}) {
  const out = [];
  let pageToken = null;
  let pages = 0;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  do {
    const url = `${BASE}/v1/chains/${CHAIN_ID}/addresses/${address}/transactions?${toQuery({
      pageSize,
      pageToken,
      startBlock: opts.startBlock,
      endBlock: opts.endBlock,
      sortOrder: opts.sortOrder,
    })}`;
    const { data } = await getJson(url, opts);
    for (const item of data.transactions || []) {
      // Glacier envuelve la transaccion nativa en `nativeTransaction`.
      const t = item.nativeTransaction || item;
      out.push({
        blockNumber: Number(t.blockNumber),
        blockTimestamp: Number(t.blockTimestamp),
        txHash: t.txHash,
        txStatus: String(t.txStatus),
        from: (t.from && t.from.address) || null,
        to: (t.to && t.to.address) || null,
        value: t.value ?? null,
        method: (t.method && t.method.methodName) || null,
      });
    }
    pageToken = data.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return out;
}

/**
 * Transfers ERC20 en los que participa una direccion (como origen o destino).
 * Es la base de la concentracion de depositantes y del pico de retiros.
 */
async function listErc20Transfers(address, opts = {}) {
  const out = [];
  let pageToken = null;
  let pages = 0;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  do {
    const url = `${BASE}/v1/chains/${CHAIN_ID}/addresses/${address}/transactions:listErc20?${toQuery({
      pageSize,
      pageToken,
      startBlock: opts.startBlock,
      endBlock: opts.endBlock,
    })}`;
    const { data } = await getJson(url, opts);
    for (const t of data.transactions || []) {
      const decimals = t.erc20Token && Number.isFinite(Number(t.erc20Token.decimals)) ? Number(t.erc20Token.decimals) : 18;
      out.push({
        blockNumber: Number(t.blockNumber),
        blockTimestamp: Number(t.blockTimestamp),
        txHash: t.txHash,
        from: (t.from && t.from.address) || null,
        to: (t.to && t.to.address) || null,
        value: t.value ?? null,
        valueFloat: t.value === null || t.value === undefined ? null : Number(t.value) / 10 ** decimals,
        symbol: (t.erc20Token && t.erc20Token.symbol) || null,
        tokenAddress: (t.erc20Token && t.erc20Token.address) || null,
      });
    }
    pageToken = data.nextPageToken || null;
    pages += 1;
  } while (pageToken && pages < maxPages);

  return out;
}

module.exports = {
  BASE,
  CHAIN_ID,
  CACHE_DIR,
  getJson,
  listTransactions,
  listErc20Transfers,
};
