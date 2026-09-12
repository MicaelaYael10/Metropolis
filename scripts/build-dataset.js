#!/usr/bin/env node
// Construye el dataset real de Avalanche desde DefiLlama (engine/defillama.js).
// Los positivos salen de los incidentes reales de /hacks, no del catalogo vivo:
// un protocolo hackeado suele desaparecer y sigue siendo un caso valido.
// Las senales que no se pueden obtener quedan en null, nunca se inventan.
//   node scripts/build-dataset.js --months 60 --min-tvl 500000 --max-negatives 30

'use strict';

const fs = require('fs');
const path = require('path');

const { fetchProtocols, fetchHacks, fetchProtocolHistory, BASE } = require('../engine/defillama');
const { score } = require('../engine/scoring');

const CHAIN = 'Avalanche';
const DAY = 86400;

/** Tipos de objetivo que NO son protocolos DeFi: fuera del alcance de RiskGuard. */
const EXCLUDED_TARGETS = new Set(['CEX', 'Wallet', 'Chain', 'Token']);

/** Categorias donde tiene sentido aplicar una politica de riesgo de deposito. */
const CATEGORIES = new Set([
  'Lending',
  'Liquid Staking',
  'Staking',
  'Yield',
  'CDP',
  'Restaking',
  'Dexes',
  'Algo-Stables',
]);

/* ---------------------------------------------------------------- utilidades */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const iso = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
const num = (v, d = 6) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

/**
 * Ultimo punto con date <= ts. Si el dato es mas antiguo que `tolDays`, devuelve
 * null: arrastrar el ultimo valor seria inventar datos de un protocolo ya muerto.
 */
function valueAt(series, ts, tolDays = 7) {
  let lo = 0;
  let hi = series.length - 1;
  let found = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= ts) {
      found = series[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (!found) return null;
  if (ts - found.date > tolDays * DAY) return null;
  return found.totalLiquidityUSD;
}

/** Maxima caida desde un pico en [from, to], como fraccion 0..1. */
function maxDrawdown(series, from, to) {
  let peak = null;
  let worst = 0;
  for (const p of series) {
    if (p.date < from || p.date > to) continue;
    const v = p.totalLiquidityUSD;
    if (!Number.isFinite(v) || v <= 0) continue;
    if (peak === null || v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
  }
  return worst;
}

/* ------------------------------------------------ resolucion de los positivos */

/**
 * Asocia cada incidente real de Avalanche con un slug consultable en DefiLlama.
 * Orden de preferencia: id del catalogo -> nombre normalizado -> slug derivado.
 * El metodo usado se registra para poder auditar cada caso.
 */
function resolveSlug(hack, catalogById, catalogByName) {
  if (hack.defillamaId !== null && hack.defillamaId !== undefined) {
    const p = catalogById.get(String(hack.defillamaId));
    if (p) return { slug: p.slug || p.name, via: `defillamaId=${hack.defillamaId}` };
  }
  const p = catalogByName.get(norm(hack.name));
  if (p) return { slug: p.slug || p.name, via: 'nombre (catalogo)' };

  const derived = String(hack.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return derived ? { slug: derived, via: 'slug derivado del nombre' } : null;
}

/* ----------------------------------------------------------------- principal */

async function main() {
  const months = Number(arg('months', 60));
  const minTvlNegative = Number(arg('min-tvl', 500000));
  const minTvlSnapshot = Number(arg('min-tvl-snapshot', 100000));
  const maxNegatives = Number(arg('max-negatives', 30));
  const force = Boolean(arg('force', false));
  const outPath = path.resolve(process.cwd(), String(arg('out', 'data/dataset-avalanche.json')));

  console.log(`\n== RiskGuard - dataset real (${CHAIN}) ==`);
  console.log(`fuente: ${BASE}`);
  console.log(`meses: ${months}  -  TVL min negativos: $${minTvlNegative.toLocaleString()}  -  TVL min snapshot: $${minTvlSnapshot.toLocaleString()}`);

  const { data: catalog, fetchedAt: catalogAt } = await fetchProtocols({ force });
  const { data: allHacks, fetchedAt: hacksAt } = await fetchHacks({ force });

  const avaxProtocols = catalog.filter((p) => Array.isArray(p.chains) && p.chains.includes(CHAIN));
  const avaxHacks = allHacks.filter((h) => Array.isArray(h.chain) && h.chain.includes(CHAIN));
  console.log(`catalogo: ${catalog.length} protocolos  -  en ${CHAIN}: ${avaxProtocols.length}`);
  console.log(`incidentes en ${CHAIN}: ${avaxHacks.length}`);

  // Indices del catalogo completo (permite resolver protocolos ya deslistados).
  const catalogById = new Map();
  const catalogByName = new Map();
  for (const p of catalog) {
    if (p.id !== undefined && p.id !== null) catalogById.set(String(p.id), p);
    if (p.name) catalogByName.set(norm(p.name), p);
    if (p.slug) catalogByName.set(norm(p.slug), p);
  }

  /* --- 1. positivos: de la verdad terreno hacia el historial --- */
  const positives = new Map(); // slug -> { slug, name, incidents: [], byName }
  const rejectedHacks = [];

  for (const h of avaxHacks) {
    if (EXCLUDED_TARGETS.has(h.targetType)) {
      rejectedHacks.push({ name: h.name, date: iso(h.date), reason: `targetType=${h.targetType} no es un protocolo DeFi` });
      continue;
    }
    const res = resolveSlug(h, catalogById, catalogByName);
    if (!res) {
      rejectedHacks.push({ name: h.name, date: iso(h.date), reason: 'no se pudo resolver un slug' });
      continue;
    }
    const entry = positives.get(res.slug) || { slug: res.slug, name: h.name, via: res.via, incidents: [] };
    entry.incidents.push({ date: iso(h.date), ts: h.date, amount: h.amount, classification: h.classification, technique: h.technique, targetType: h.targetType, ref: h.name });
    positives.set(res.slug, entry);
  }

  // Descarga de historial: se descartan los que no tengan serie utilizable.
  console.log(`\npositivos candidatos: ${positives.size}  (se verifica historial)`);
  const positivesWithHistory = [];
  for (const entry of positives.values()) {
    let hist;
    try {
      hist = await fetchProtocolHistory(entry.slug, { force });
    } catch (e) {
      console.log(`  x ${entry.slug.padEnd(30)} sin historial (${e.message})`);
      rejectedHacks.push({ name: entry.name, date: entry.incidents[0].date, reason: `sin historial en DefiLlama (${e.message})` });
      continue;
    }
    if (!Array.isArray(hist.tvl) || hist.tvl.length < 40) {
      console.log(`  x ${entry.slug.padEnd(30)} serie insuficiente (${hist.tvl.length} puntos)`);
      rejectedHacks.push({ name: entry.name, date: entry.incidents[0].date, reason: `serie insuficiente (${hist.tvl.length} puntos)` });
      continue;
    }
    const inCatalog = avaxProtocols.find((p) => (p.slug || p.name) === entry.slug) || null;
    positivesWithHistory.push({ ...entry, hist, catalog: inCatalog });
    console.log(`  + ${entry.slug.padEnd(30)} puntos=${String(hist.tvl.length).padStart(4)}  incidentes=${entry.incidents.length}  (${entry.via})`);
  }

  /* --- 2. negativos: protocolos vivos de Avalanche --- */
  const positiveSlugs = new Set(positivesWithHistory.map((p) => p.slug));
  const negatives = avaxProtocols
    .filter((p) => Number.isFinite(p.tvl) && p.tvl >= minTvlNegative)
    .filter((p) => CATEGORIES.has(p.category))
    .filter((p) => !positiveSlugs.has(p.slug || p.name))
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
    .slice(0, maxNegatives);
  console.log(`\nnegativos seleccionados: ${negatives.length}`);

  /* --- 3. snapshots --- */
  const nowTs = Math.floor(Date.now() / 1000);
  const snapshots = [];
  const usedProtocols = [];

  const metas = [
    ...positivesWithHistory.map((p) => ({
      slug: p.slug,
      name: p.catalog?.name || p.name,
      category: p.catalog?.category || null,
      live: Boolean(p.catalog),
      series: p.hist.tvl.filter((x) => Number.isFinite(x.totalLiquidityUSD)),
      listedAt: Number.isFinite(p.hist.listedAt) ? p.hist.listedAt : Number.isFinite(p.catalog?.listedAt) ? p.catalog.listedAt : null,
      audits: Number.isFinite(Number(p.catalog?.audits)) ? Number(p.catalog.audits) : null,
      chainTvls: p.catalog?.chainTvls || null,
      chains: p.catalog?.chains || [],
      address: p.catalog?.address || null,
      tvlNow: p.catalog?.tvl ?? null,
      incidents: p.incidents.sort((a, b) => a.ts - b.ts),
      role: 'positivo',
      resolution: p.via,
    })),
    ...negatives.map((p) => ({
      slug: p.slug || p.name,
      name: p.name,
      category: p.category || null,
      live: true,
      series: null, // se carga abajo
      listedAt: Number.isFinite(p.listedAt) ? p.listedAt : null,
      audits: Number.isFinite(Number(p.audits)) ? Number(p.audits) : null,
      chainTvls: p.chainTvls || null,
      chains: p.chains || [],
      address: p.address || null,
      tvlNow: p.tvl,
      incidents: [],
      role: 'negativo',
      resolution: 'catalogo',
    })),
  ];

  console.log('\nconstruyendo snapshots...');
  for (const meta of metas) {
    let series = meta.series;
    if (!series) {
      try {
        const hist = await fetchProtocolHistory(meta.slug, { force });
        series = (hist.tvl || []).filter((x) => Number.isFinite(x.totalLiquidityUSD));
      } catch (e) {
        console.log(`  x ${meta.slug}: ${e.message}`);
        continue;
      }
    }
    if (!series || series.length < 40) continue;

    // Concentracion de cadena (aproximacion: composicion actual declarada).
    const chainTvls = meta.chainTvls && typeof meta.chainTvls === 'object' ? meta.chainTvls : {};
    const chainVals = Object.entries(chainTvls)
      .filter(([k, v]) => meta.chains.includes(k) && Number.isFinite(v) && v > 0)
      .map(([, v]) => v);
    const chainTotal = chainVals.reduce((a, b) => a + b, 0);
    const chainConcentration = chainTotal > 0 ? num(Math.max(...chainVals) / chainTotal, 4) : null;

    let rows = 0;
    for (let m = months; m >= 0; m--) {
      const d = new Date(nowTs * 1000);
      const snapTs = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m + 1, 1) / 1000) - 3600;
      if (snapTs > nowTs) continue;

      const tvl = valueAt(series, snapTs);
      if (!Number.isFinite(tvl) || tvl < minTvlSnapshot) continue;

      const ageDays = meta.listedAt ? Math.round((snapTs - meta.listedAt) / DAY) : null;
      if (ageDays !== null && ageDays < 30) continue;

      const tvl30 = valueAt(series, snapTs - 30 * DAY);
      const tvlChange30d = Number.isFinite(tvl30) && tvl30 > 0 ? num((tvl - tvl30) / tvl30) : null;
      const has90 = series.some((x) => x.date >= snapTs - 90 * DAY && x.date <= snapTs);
      const tvlDrawdown90d = has90 ? num(maxDrawdown(series, snapTs - 90 * DAY, snapTs)) : null;

      const pastIncidents = meta.incidents.filter((i) => i.ts <= snapTs).length;
      const futureIncident = meta.incidents.find((i) => i.ts > snapTs && i.ts <= snapTs + 90 * DAY) || null;

      snapshots.push({
        snapshotId: `${meta.slug}@${iso(snapTs)}`,
        protocolId: meta.slug,
        protocolName: meta.name,
        protocolAddress: meta.address,
        category: meta.category,
        chain: CHAIN,
        role: meta.role,
        date: iso(snapTs),
        // --- senales REALES (DefiLlama) ---
        tvlChange30d,
        tvlDrawdown90d,
        auditCount: meta.audits,
        incidentCount: pastIncidents,
        chainConcentration,
        ageDays,
        // --- senales no disponibles (on-chain). null, nunca inventadas ---
        failedTxRate: null,
        codeChangedDaysAgo: null,
        adminTxCount30d: null,
        topDepositorShare: null,
        withdrawalSpikePct: null,
        // --- exposicion y etiqueta real ---
        amountAtRisk: num(tvl, 2),
        failedWithin90d: futureIncident !== null,
        futureIncident: futureIncident
          ? { date: futureIncident.date, amount: futureIncident.amount, classification: futureIncident.classification, technique: futureIncident.technique }
          : null,
      });
      rows += 1;
    }

    if (rows > 0) {
      const pos = snapshots.filter((s) => s.protocolId === meta.slug && s.failedWithin90d).length;
      usedProtocols.push({
        slug: meta.slug,
        name: meta.name,
        category: meta.category,
        role: meta.role,
        live: meta.live,
        resolution: meta.resolution,
        tvlNow: meta.tvlNow,
        audits: meta.audits,
        listedAt: meta.listedAt ? iso(meta.listedAt) : null,
        incidents: meta.incidents.length,
        snapshots: rows,
        positiveSnapshots: pos,
      });
      console.log(`  ${meta.role === 'positivo' ? '+' : ' '} ${meta.slug.padEnd(30)} snapshots=${String(rows).padStart(3)}  positivos=${pos}`);
    }
  }

  /* --- 4. resumen de calidad --- */
  const positivesTotal = snapshots.filter((s) => s.failedWithin90d).length;
  const positiveProtocols = new Set(snapshots.filter((s) => s.failedWithin90d).map((s) => s.protocolId)).size;
  const probe = snapshots.map((s) => score(s));
  const withOnchain = probe.filter((p) => p.coverage >= 80).length;

  const dataset = {
    meta: {
      chain: CHAIN,
      generatedAt: new Date().toISOString(),
      generator: 'scripts/build-dataset.js',
      sources: [
        { name: 'DefiLlama /protocols', url: `${BASE}/protocols`, consultado: catalogAt, uso: 'catalogo, TVL, auditorias, listedAt, chains, chainTvls' },
        { name: 'DefiLlama /protocol/{slug}', url: `${BASE}/protocol/{slug}`, consultado: catalogAt, uso: 'serie historica de TVL' },
        { name: 'DefiLlama /hacks', url: `${BASE}/hacks`, consultado: hacksAt, uso: 'incidentes reales = verdad terreno de la etiqueta' },
      ],
      realSignals: ['tvlChange30d', 'tvlDrawdown90d', 'auditCount', 'incidentCount', 'chainConcentration', 'ageDays'],
      unavailableSignals: ['failedTxRate', 'codeChangedDaysAgo', 'adminTxCount30d', 'topDepositorShare', 'withdrawalSpikePct'],
      label: 'failedWithin90d = incidente real de DefiLlama ocurrido en (fecha, fecha+90d]',
      amountAtRiskDefinition: 'TVL real del protocolo en la fecha del snapshot (USD)',
      labelSource: 'DefiLlama /hacks filtrado por chain=Avalanche y targetType != CEX/Wallet/Chain/Token',
      notes: [
        'Las senales no disponibles se dejan en null y se EXCLUYEN del puntaje (repoderacion, ver engine/scoring.js).',
        'chainConcentration usa la composicion de cadenas actual como aproximacion constante.',
        'Los snapshots de positivos anteriores a su incidente no siempre existen: si el protocolo murio, su serie termina.',
      ],
      stats: {
        snapshots: snapshots.length,
        positiveSnapshots: positivesTotal,
        positivesPerProtocol: positiveProtocols,
        protocols: usedProtocols.length,
        coverageAverage: probe.length ? Number((probe.reduce((a, p) => a + p.coverage, 0) / probe.length).toFixed(1)) : 0,
        snapshotsWithOnchainSignals: withOnchain,
      },
    },
    protocols: usedProtocols,
    incidentsRejected: rejectedHacks,
    snapshots,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');

  console.log(`\nsnapshots: ${snapshots.length}  -  positivos: ${positivesTotal}  -  protocolos positivos: ${positiveProtocols}`);
  console.log(`cobertura media de senales: ${dataset.meta.stats.coverageAverage}%`);
  console.log(`escrito: ${outPath}\n`);
}

main().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});
