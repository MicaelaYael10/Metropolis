#!/usr/bin/env node
// Genera los conceptos de logotipo en pixel art como SVG.
// El dibujo es texto: edita una fila y vuelve a ejecutar.
//   node brand/make-logos.js
// Salida: brand/*.svg y brand/preview.html

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = __dirname;

// cada caracter es una celda: '#' pinta, cualquier otra cosa deja vacio
const PATTERNS = {
  burbuja: [
    '............',
    '....####....',
    '..##....##..',
    '.#........#.',
    '.#........#.',
    '#..........#',
    '#..........#',
    '.#........#.',
    '.#........#.',
    '..##....##..',
    '....####....',
    '............',
    '############',
  ],
  anillo: [
    '............',
    '...######...',
    '..#......#..',
    '.#........#.',
    '.#........#.',
    '#....##....#',
    '#....##....#',
    '.#........#.',
    '.#........#.',
    '..#......#..',
    '...######...',
    '............',
  ],
  escudo: [
    '############',
    '#..........#',
    '#..........#',
    '#....##....#',
    '.#...##...#.',
    '.#........#.',
    '..#......#..',
    '..#......#..',
    '...#....#...',
    '...#....#...',
    '....#..#....',
    '.....##.....',
  ],
};

const DEFAULT_COLOR = '#0f1115';

function toPath(rows) {
  let d = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x += 1;
        continue;
      }
      let run = 0;
      while (x + run < row.length && row[x + run] === '#') run += 1;
      d += `M${x} ${y}h${run}v1H${x}z`;
      x += run;
    }
  });
  return d;
}

function toSvg(rows) {
  const w = rows[0].length;
  const h = rows.length;
  const d = toPath(rows);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 16}" height="${h * 16}" shape-rendering="crispEdges" style="color:${DEFAULT_COLOR}">`,
    `  <path fill="currentColor" d="${d}"/>`,
    '</svg>',
    '',
  ].join('\n');
}

function toPreview(entries) {
  const cells = entries
    .map(([name, rows]) => {
      const svg = toSvg(rows);
      const scale = (w) => `width="${w}" height="${Math.round((w * rows.length) / rows[0].length)}"`;
      const big = svg.replace(/width="\d+" height="\d+"/, scale(96));
      const mid = svg.replace(/width="\d+" height="\d+"/, scale(28));
      const tiny = svg.replace(/width="\d+" height="\d+"/, scale(16));
      return `    <figure>
      <div class="light">${big}</div>
      <div class="dark">${big}</div>
      <figcaption>${name}<div class="row">${mid}${tiny}</div></figcaption>
    </figure>`;
    })
    .join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>riskGuard - conceptos de logotipo</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 32px; background: #f6f7f9; color: #0f1115; }
  h1 { font-size: 18px; font-weight: 600; }
  .grid { display: flex; flex-wrap: wrap; gap: 24px; }
  figure { margin: 0; }
  .light, .dark { display: flex; align-items: center; justify-content: center; width: 132px; height: 132px; border-radius: 12px; }
  .light { background: #fff; border: 1px solid #e3e6ea; }
  .dark { background: #0f1115; margin-top: 8px; }
  .dark svg { color: #f6f7f9 !important; }
  figcaption { margin-top: 8px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; }
  .row { display: flex; gap: 10px; align-items: flex-end; margin-top: 6px; }
</style>
<h1>riskGuard - conceptos de logotipo</h1>
<p>Cada concepto sobre fondo claro y oscuro, y el mismo dibujo a 32 px para comprobar que no se rompe.</p>
<div class="grid">
${cells}
</div>
`;
}

const entries = Object.entries(PATTERNS);
for (const [name, rows] of entries) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), toSvg(rows), 'utf8');
  console.log(`brand/${name}.svg  ${rows[0].length}x${rows.length}`);
}
fs.writeFileSync(path.join(OUT, 'preview.html'), toPreview(entries), 'utf8');
console.log('brand/preview.html');
