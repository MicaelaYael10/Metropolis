#!/usr/bin/env node
/*
 * ascii-lint - convencion del repo: codigo y documentos en ASCII puro.
 * Sin acentos, sin emojis, sin comillas tipograficas.
 *
 *   node scripts/ascii-lint.js           solo revisa (falla si encuentra algo)
 *   node scripts/ascii-lint.js --fix     reescribe los archivos
 *   node scripts/ascii-lint.js --list    inventario de caracteres encontrados
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXTENSIONS = new Set(['.sol', '.js', '.md', '.json', '.toml', '.svg', '.html']);

// Carpetas que no son codigo propio.
const SKIP_DIRS = new Set(['node_modules', 'lib', 'out', 'cache', 'broadcast', 'reports', 'dist', '.git']);

// Excluidos: los datasets traen nombres de protocolo tal como los publica DefiLlama.
const SKIP_FILES = new Set([
  path.join('data', 'dataset-avalanche.json'),
  path.join('data', 'dataset-avalanche-onchain.json'),
]);

const MAP = {
  '\u00e1': 'a', '\u00e0': 'a', '\u00e4': 'a', '\u00e2': 'a', '\u00e3': 'a', '\u00e5': 'a',
  '\u00e9': 'e', '\u00e8': 'e', '\u00eb': 'e', '\u00ea': 'e',
  '\u00ed': 'i', '\u00ec': 'i', '\u00ef': 'i', '\u00ee': 'i',
  '\u00f3': 'o', '\u00f2': 'o', '\u00f6': 'o', '\u00f4': 'o', '\u00f5': 'o',
  '\u00fa': 'u', '\u00f9': 'u', '\u00fc': 'u', '\u00fb': 'u',
  '\u00f1': 'n', '\u00e7': 'c',
  '\u00c1': 'A', '\u00c0': 'A', '\u00c4': 'A', '\u00c2': 'A', '\u00c3': 'A', '\u00c5': 'A',
  '\u00c9': 'E', '\u00c8': 'E', '\u00cb': 'E', '\u00ca': 'E',
  '\u00cd': 'I', '\u00cc': 'I', '\u00cf': 'I', '\u00ce': 'I',
  '\u00d3': 'O', '\u00d2': 'O', '\u00d6': 'O', '\u00d4': 'O', '\u00d5': 'O',
  '\u00da': 'U', '\u00d9': 'U', '\u00dc': 'U', '\u00db': 'U',
  '\u00d1': 'N', '\u00c7': 'C',
  '\u00bf': '?', '\u00a1': '!',
  '\u2014': '-', '\u2013': '-', '\u2010': '-', '\u2011': '-', '\u2212': '-',
  '\u201c': '"', '\u201d': '"', '\u2018': "'", '\u2019': "'", '\u00ab': '"', '\u00bb': '"',
  '\u2026': '...',
  '\u2192': '->', '\u2190': '<-', '\u2191': '^', '\u2193': 'v',
  '\u2264': '<=', '\u2265': '>=', '\u2260': '!=', '\u2248': '~=',
  '\u00d7': 'x', '\u00f7': '/',
  '\u00b7': '-', '\u2022': '-', '\u25cf': '-', '\u25e6': '-',
  '\u2714': '[ok]', '\u2713': '[ok]', '\u2717': '[x]', '\u2718': '[x]', '\u2716': '[x]',
  '\u26a0': '!',
  '\u2705': '[ok]', '\u274c': '[x]', '\u2b50': '*',
  '\u2500': '-', '\u2502': '|', '\u251c': '|-', '\u2514': '`-', '\u25ba': '>',
  '\u00ba': 'o', '\u00aa': 'a',
  '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ',
  '\ufeff': '', '\u200b': '', '\u200d': '', '\ufe0f': '',
};

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
    } else if (EXTENSIONS.has(path.extname(entry.name)) && !SKIP_FILES.has(rel)) {
      acc.push(full);
    }
  }
  return acc;
}

function transliterate(text, dropped) {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 128) {
      out += ch;
    } else if (MAP[ch] !== undefined) {
      out += MAP[ch];
    } else {
      dropped.add(ch);
    }
  }
  return out;
}

const fix = process.argv.includes('--fix');
const listOnly = process.argv.includes('--list');

const files = walk(ROOT, []);
const dropped = new Set();
const offenders = [];
const inventory = new Map();

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  if (!/[\u0080-\uffff]/.test(original)) continue;

  for (const ch of original) {
    if (ch.codePointAt(0) > 127) {
      inventory.set(ch, (inventory.get(ch) || 0) + 1);
    }
  }

  const fixed = transliterate(original, dropped);
  const hits = (original.match(/[^\x00-\x7F]/g) || []).length;
  offenders.push({ rel: path.relative(ROOT, file), hits, fixed });

  if (fix) fs.writeFileSync(file, fixed, 'utf8');
}

if (listOnly) {
  const sorted = [...inventory.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`${sorted.length} caracteres distintos:\n`);
  for (const [ch, n] of sorted) {
    const code = 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const target = MAP[ch] === undefined ? '(SIN MAPA)' : JSON.stringify(MAP[ch]);
    console.log(`  ${String(n).padStart(4)}  ${code}  ${JSON.stringify(ch).padEnd(10)} -> ${target}`);
  }
  process.exit(0);
}

if (offenders.length === 0) {
  console.log(`ascii-lint: limpio. ${files.length} archivos revisados, 0 con caracteres no-ASCII.`);
  process.exit(0);
}

console.log(`${offenders.length} archivos con caracteres no-ASCII:`);
for (const o of offenders) console.log(`  ${String(o.hits).padStart(4)}  ${o.rel}`);

if (dropped.size > 0) {
  console.log('\nCaracteres SIN MAPA (se perderian):');
  for (const ch of dropped) {
    const code = 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    console.log(`  ${code}  ${JSON.stringify(ch)}`);
  }
  console.log('\nAnade el mapa antes de usar --fix.');
  process.exit(2);
}

if (fix) {
  console.log('\nReescritos. Vuelve a ejecutar sin --fix para confirmar.');
  process.exit(0);
}

console.log('\nEjecuta con --fix para reescribir.');
process.exit(1);
