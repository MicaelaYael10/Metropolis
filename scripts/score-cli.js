// Puntua un protocolo a partir de sus senales.
//   pnpm run score -- --file senales.json
//   pnpm run score -- --signals '{"failedTxRate":0.22,"tvlChange30d":-0.4}'

"use strict";

const fs = require("fs");
const { score } = require("../engine/scoring");
const { simulate } = require("../engine/montecarlo");
const { resolveTimeframe, listTimeframes } = require("../engine/timeframes");

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
  console.log(`PUNTAJE DE RIESGO: ${result.score}/100  ->  banda ${String(result.band).toUpperCase()} (cobertura ${result.coverage}%)`);
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
  const single = arg("horizon", null);
  const horizonsArg = arg("horizons", null);

  if (single) {
    const mc = simulate({ score: result.score, confidence: result.confidence, threshold, horizon: single, seed: 42 });
    console.log("");
    console.log(`Monte Carlo a ${resolveTimeframe(single).label} (umbral ${threshold}):`);
    console.log(`  p5 ${mc.p5} / p50 ${mc.p50} / p95 ${mc.p95}`);
    console.log(`  P(superar el umbral) = ${(mc.breachProbability * 100).toFixed(2)} %`);
  } else {
    // Por defecto, la tabla de lapsos cortos (capa de tiempo real) + medio/ciclo.
    const names = horizonsArg ? String(horizonsArg).split(",").map((s) => s.trim()) : ["1h", "6h", "24h", "7d", "30d", "90d"];
    console.log("");
    console.log(`Monte Carlo por lapso (umbral ${threshold}):`);
    for (const name of names) {
      const tf = resolveTimeframe(name);
      const mc = simulate({ score: result.score, confidence: result.confidence, threshold, horizon: name, seed: 42 });
      const breach = (mc.breachProbability * 100).toFixed(2).padStart(6);
      console.log(`  ${tf.label.padEnd(10)} p5 ${String(mc.p5).padStart(6)} / p50 ${String(mc.p50).padStart(6)} / p95 ${String(mc.p95).padStart(6)}   P(brecha) ${breach}%`);
    }
  }
  console.log("");
}

main();
