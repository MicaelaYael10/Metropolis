// Puntua un protocolo a partir de sus senales.
//   pnpm run score -- --file senales.json
//   pnpm run score -- --signals '{"failedTxRate":0.22,"tvlChange30d":-0.4}'

"use strict";

const fs = require("fs");
const { score } = require("../engine/scoring");
const { simulate } = require("../engine/montecarlo");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const file = arg("file");
  const inline = arg("signals");

  let input;
  if (file) {
    input = JSON.parse(fs.readFileSync(file, "utf8"));
  } else if (inline) {
    input = JSON.parse(inline);
  } else {
    console.error("Uso: npm run score -- --signals '<json>'  |  --file <ruta.json>");
    process.exit(1);
  }

  const result = score(input);

  console.log("");
  console.log(`Protocolo: ${input.name || input.id || "(sin nombre)"}`);
  console.log(`PUNTAJE DE RIESGO: ${result.score}/100  ->  banda ${result.band.name.toUpperCase()} (codigo ${result.band.code})`);
  console.log(`Confianza del puntaje: ${result.confidence}/100`);
  console.log("");
  console.log("Aporte por senal:");
  for (const c of result.contributions) {
    const bar = "#".repeat(Math.round(c.risk * 20)).padEnd(20, ".");
    console.log(`  ${c.signal.padEnd(22)} ${bar} ${String(c.points).padStart(5)} pts`);
  }
  console.log("");
  console.log("Motivos principales:");
  result.reasons.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  const threshold = Number(arg("threshold", 55));
  const mc = simulate({ score: result.score, confidence: result.confidence, threshold, seed: 42 });
  console.log("");
  console.log(`Monte Carlo a 90 dias (umbral ${threshold}):`);
  console.log(`  p5 ${mc.p5} / p50 ${mc.p50} / p95 ${mc.p95}`);
  console.log(`  P(superar el umbral) = ${(mc.breachProbability * 100).toFixed(2)} %`);
  console.log("");
}

main();
