// CLI de backtesting. Informe completo en reports/backtest-<fecha>.json.
//   pnpm run backtest -- --dataset data/dataset-avalanche.json --threshold 45
//   pnpm run backtest -- --sweep

"use strict";

const fs = require("fs");
const path = require("path");
const { generate } = require("../engine/synthetic");
const { loadDataset, signalCoverage } = require("../engine/dataset");
const { runBacktest } = require("../engine/backtest");
const { score } = require("../engine/scoring");
const { simulate } = require("../engine/montecarlo");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const datasetPath = arg("dataset");
  const threshold = Number(arg("threshold", 55));
  const seed = Number(arg("seed", 7));

  let rows;
  let sourceLabel;
  let provenance = null;
  if (datasetPath) {
    rows = loadDataset(datasetPath);
    sourceLabel = `dataset real: ${datasetPath}`;
    // Provenance: se copia al informe para que las metricas sean trazables.
    try {
      const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), datasetPath), "utf8"));
      if (raw && raw.meta) provenance = raw.meta;
    } catch {
      /* el dataset ya se valido; si no trae meta, se sigue sin provenance */
    }
  } else {
    rows = generate({ seed });
    sourceLabel = `dataset SINTETICO (semilla ${seed}) - NO es evidencia de desempeno real`;
  }

  const report = runBacktest(rows, { maxRiskScore: threshold });
  const coverage = signalCoverage(rows);

  console.log("");
  console.log("=== RISKGUARD - INFORME DE BACKTESTING ===");
  console.log(`Origen:      ${sourceLabel}`);
  console.log(`Umbral:      score > ${threshold} se bloquea`);
  console.log(`Snapshots:   ${report.snapshots}`);
  console.log("");
  console.log("Confusion (sobre resultados reales a 90 dias):");
  console.log(`  Fallas bloqueadas      (bien)      ${report.confusion.blockedFailures}`);
  console.log(`  Fallas permitidas      (mal)       ${report.confusion.allowedFailures}`);
  console.log(`  Sanos bloqueados       (falso pos) ${report.confusion.blockedSurvivors}`);
  console.log(`  Sanos permitidos       (bien)      ${report.confusion.allowedSurvivors}`);
  console.log("");
  console.log("Metricas:");
  console.log(`  recall             ${fmt(report.metrics.recall)}`);
  console.log(`  precision          ${fmt(report.metrics.precision)}`);
  console.log(`  tasa falsos pos.   ${fmt(report.metrics.falsePositiveRate)}`);
  console.log(`  especificidad      ${fmt(report.metrics.specificity)}`);
  console.log("");
  console.log("Etiquetas (verdad terreno, resultados a 90 dias):");
  console.log(`  fallas             ${report.labels.failures}  (${fmt(report.labels.failureRate)} del total)`);
  console.log(`  supervivientes     ${report.labels.survivors}`);
  console.log("");
  console.log("Calidad de datos:");
  console.log(`  cobertura media    ${report.dataQuality.avgCoveragePct} %`);
  console.log(`  filas < 50 % cov.  ${report.dataQuality.rowsBelow50PctCoverage}`);
  console.log(`  CONCLUYENTE        ${report.dataQuality.conclusive ? "si" : "NO"}`);
  console.log(`  nota               ${report.dataQuality.note}`);
  console.log("");
  console.log("Cobertura por senal (% de filas con dato real):");
  for (const [k, v] of Object.entries(coverage.bySignalPct)) {
    console.log(`  ${k.padEnd(22)} ${String(v).padStart(5)} %`);
  }
  console.log("");
  console.log("Capital:");
  console.log(`  en riesgo total    ${report.capital.atRiskTotal}`);
  console.log(`  preservado         ${report.capital.preserved}  (bloqueado que si fallo)`);
  console.log(`  perdido            ${report.capital.lost}  (permitido que fallo)`);
  console.log("");
  console.log("Top 5 protocolos por riesgo maximo:");
  for (const p of report.perProtocol.slice(0, 5)) {
    console.log(`  ${p.protocolId}  score max ${String(p.maxScore).padStart(3)}  snapshots ${p.snapshots}  fallas ${p.failures}`);
  }

  // Ejemplo de Monte Carlo sobre el peor protocolo observado.
  const worst = report.perProtocol[0];
  if (worst) {
    const worstRow = rows.find((r) => (r.protocolId || r.snapshotId) === worst.protocolId);
    if (worstRow) {
      const base = score(worstRow);
      const mc = simulate({
        score: base.score,
        confidence: base.confidence,
        threshold,
        horizonDays: 90,
        paths: 2000,
        seed,
      });
      console.log("");
      console.log(`Monte Carlo (peor protocolo ${worst.protocolId}, score ${base.score}):`);
      console.log(`  percentiles      p5 ${mc.p5} / p50 ${mc.p50} / p95 ${mc.p95}`);
      console.log(`  P(superar umbral) ${(mc.breachProbability * 100).toFixed(2)} %`);
      console.log(`  dias esperados hasta la brecha ${mc.expectedDaysToBreach}`);
    }
  }

  if (process.argv.includes("--sweep")) {
    console.log("");
    console.log("Barrido de umbral (mismo dataset, misma politica salvo el umbral):");
    console.log("  umbral   recall  precision     FPR   espec.  bloqueos  preservado");
    for (let t = 20; t <= 80; t += 5) {
      const r = runBacktest(rows, { maxRiskScore: t });
      console.log(
        `  ${String(t).padStart(6)}  ${fmt(r.metrics.recall).padStart(8)}  ${fmt(r.metrics.precision).padStart(9)}` +
          `  ${fmt(r.metrics.falsePositiveRate).padStart(6)}  ${fmt(r.metrics.specificity).padStart(7)}` +
          `  ${String(r.decisions.blocked).padStart(8)}  ${String(r.capital.preserved).padStart(10)}`
      );
    }
    console.log("");
  }

  const outDir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(outDir, `backtest-${stamp}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ source: sourceLabel, threshold, seed, provenance, coverage, report }, null, 2),
    "utf8"
  );
  console.log("");
  console.log(`Informe guardado en: ${outFile}`);
  console.log("");
}

function fmt(x) {
  return x === null ? "n/d" : `${(x * 100).toFixed(2)} %`;
}

main();
