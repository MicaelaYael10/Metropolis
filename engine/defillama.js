// Cliente de datos reales de DefiLlama: /protocols, /protocol/{slug} y /hacks.
// Cachea en disco (data/cache) para que el dataset sea reproducible sin red.
// Ningun valor se inventa: si un endpoint falla, se propaga el error.

'use strict';

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.llama.fi';
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cachePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

/**
 * GET con cache en disco. Devuelve {data, fetchedAt, fromCache, url}.
 * @param {string} url
 * @param {string} key nombre de archivo de cache (sin extension)
 * @param {{ttlMs?:number, force?:boolean}} [opts]
 */
async function getJson(url, key, opts = {}) {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const file = cachePath(key);
  ensureCacheDir();

  if (!opts.force && fs.existsSync(file)) {
    try {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (Number.isFinite(age) && age < ttl) {
        return { data: cached.data, fetchedAt: cached.fetchedAt, fromCache: true, url, key };
      }
    } catch {
      /* cache corrupta: se ignora y se vuelve a descargar */
    }
  }

  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'riskguard-avax/1.0 (buildathon)' },
  });
  if (!res.ok) {
    throw new Error(`DefiLlama ${res.status} en ${url}`);
  }
  const data = await res.json();
  const fetchedAt = new Date().toISOString();

  fs.writeFileSync(file, JSON.stringify({ url, fetchedAt, data }, null, 2), 'utf8');
  return { data, fetchedAt, fromCache: false, url, key };
}

/** Catalogo completo de protocolos (8.2k+), con TVL actual por cadena. */
function fetchProtocols(opts = {}) {
  return getJson(`${BASE}/protocols`, 'protocols', opts);
}

/** Historial de hacks/exploits. 1.2k+ registros con fecha, cadena y monto. */
function fetchHacks(opts = {}) {
  return getJson(`${BASE}/hacks`, 'hacks', opts);
}

/**
 * Reduce la respuesta de DefiLlama a lo estrictamente necesario.
 * El payload completo incluye `chainTvls` historicos por cadena y puede pesar
 * decenas de MB por protocolo; aqui solo se usan la serie total y `listedAt`.
 */
function slimHistory(d) {
  if (!d || !Array.isArray(d.tvl)) return null;
  return {
    slug: d.slug ?? null,
    listedAt: d.listedAt ?? null,
    currentChainTvls: d.currentChainTvls ?? null,
    tvl: d.tvl
      .filter((p) => p && Number.isFinite(p.date) && Number.isFinite(p.totalLiquidityUSD))
      .map((p) => ({ date: p.date, totalLiquidityUSD: p.totalLiquidityUSD })),
  };
}

/** Serie historica de TVL de un protocolo: {slug, tvl:[{date,totalLiquidityUSD}], listedAt} */
async function fetchProtocolHistory(slug, opts = {}) {
  const key = `protocol-${String(slug).replace(/[^a-z0-9._-]/gi, '_')}`;
  const file = cachePath(key);
  ensureCacheDir();

  if (!opts.force && fs.existsSync(file)) {
    try {
      const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      const slim = slimHistory(cached.data);
      if (slim && Number.isFinite(age) && age < (opts.ttlMs ?? DEFAULT_TTL_MS)) {
        return { ...slim, fetchedAt: cached.fetchedAt, fromCache: true };
      }
    } catch {
      /* cache corrupta: se vuelve a descargar */
    }
  }

  const url = `${BASE}/protocol/${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'riskguard-avax/1.0 (buildathon)' },
  });
  if (!res.ok) throw new Error(`DefiLlama ${res.status} en ${url}`);
  const slim = slimHistory(await res.json());
  if (!slim) throw new Error(`DefiLlama no devolvio una serie valida para ${slug}`);

  const fetchedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify({ url, fetchedAt, data: slim }), 'utf8');
  return { ...slim, fetchedAt, fromCache: false };
}

/** Protocolos de una cadena concreta. */
async function protocolsOnChain(chain, opts = {}) {
  const { data, fetchedAt } = await fetchProtocols(opts);
  const list = data.filter((p) => Array.isArray(p.chains) && p.chains.includes(chain));
  return { protocols: list, fetchedAt };
}

/** Incidentes registrados en una cadena concreta. */
async function hacksOnChain(chain, opts = {}) {
  const { data, fetchedAt } = await fetchHacks(opts);
  const list = data.filter((h) => Array.isArray(h.chain) && h.chain.includes(chain));
  return { hacks: list, fetchedAt };
}

module.exports = {
  BASE,
  CACHE_DIR,
  getJson,
  fetchProtocols,
  fetchHacks,
  fetchProtocolHistory,
  protocolsOnChain,
  hacksOnChain,
};
