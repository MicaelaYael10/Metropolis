#!/usr/bin/env node
// Genera el lockup horizontal (marca + wordmark + tagline).
// La marca es brand/mark.png (recortada y con fondo transparente).
//   node brand/make-lockup.js
// Salida: lockup.svg, lockup-alt.svg y lockup-preview.html

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = __dirname;

const BRAND = '#1f7488';
const MUTED = '#7b9aa3';
const INK = '#0f2229';
const MIST = '#e8f4f6';

const TAGLINES = {
  'lockup': 'NAVIGATION DEFI RISK',
  'lockup-alt': 'NAVIGATING DEFI RISK',
};

const MARK_W = 283;
const MARK_H = 200;
const GAP = 52;
const TEXT_X = MARK_W + GAP;

function svg(tagline, fg, fgMuted) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 980 200" width="980" height="200" role="img" aria-label="riskGuard - ${tagline}">
  <title>riskGuard</title>
  <image x="0" y="0" width="${MARK_W}" height="${MARK_H}" href="mark.png" xlink:href="mark.png"/>
  <text x="${TEXT_X}" y="126" font-family="Segoe UI, system-ui, Helvetica, Arial, sans-serif" font-size="94" font-weight="800" letter-spacing="-1" fill="${fg}">RiskGuard</text>
  <text x="${TEXT_X + 4}" y="176" font-family="Segoe UI, system-ui, Helvetica, Arial, sans-serif" font-size="21" font-weight="600" letter-spacing="5.5" fill="${fgMuted}">${tagline}</text>
</svg>
`;
}

for (const [name, tagline] of Object.entries(TAGLINES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg(tagline, BRAND, MUTED), 'utf8');
  console.log(`brand/${name}.svg   "${tagline}"`);
}

// variante para fondo oscuro
fs.writeFileSync(path.join(OUT, 'lockup-dark.svg'), svg(TAGLINES['lockup'], MIST, '#96cde1'), 'utf8');
console.log('brand/lockup-dark.svg   (sobre fondo oscuro)');

const panels = [
  ['lockup.svg', 'NAVIGATION DEFI RISK (pedida)', '#ffffff'],
  ['lockup-alt.svg', 'NAVIGATING DEFI RISK (recomendada)', '#ffffff'],
  ['lockup-dark.svg', 'version fondo oscuro', INK],
];

const html = `<!doctype html>
<meta charset="utf-8">
<title>riskGuard - lockup</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 32px; background: #f6f7f9; color: ${INK}; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  p { color: #6b7280; margin: 0 0 24px; }
  .panel { padding: 24px; border-radius: 14px; margin-bottom: 18px; border: 1px solid #e3e6ea; }
  .panel img { max-width: 100%; display: block; }
  .label { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; margin-bottom: 14px; }
</style>
<h1>riskGuard - lockup</h1>
<p>La marca sale de brand/mark.png (fondo ya quitado y recortada).</p>
${panels
  .map(
    ([file, label, bg]) =>
      `<div class="panel" style="background:${bg}"><div class="label" style="color:${
        bg === INK ? '#96cde1' : '#6b7280'
      }">${label}</div><img src="${file}" alt="${label}"></div>`,
  )
  .join('\n')}
`;
fs.writeFileSync(path.join(OUT, 'lockup-preview.html'), html, 'utf8');
console.log('brand/lockup-preview.html');
