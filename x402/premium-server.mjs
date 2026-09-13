// Servidor de datos premium de riesgo, detras de un pago x402.
// El agente (agent-client.mjs) paga por HTTP 402 en Avalanche y recibe el puntaje.
//
//   pnpm run server
//
// Variables (ver .env.example):
//   PAY_TO, FACILITATOR_URL, NETWORK (eip155:43114 Avalanche / eip155:43113 Fuji), PORT
//
// El nucleo del motor (engine/scoring.js) se reutiliza tal cual: este servicio no
// reimplementa el riesgo, solo lo expone y cobra por el.

import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { score } = require("../engine/scoring.js");

const PORT = Number(process.env.PORT || 4021);
const NETWORK = process.env.NETWORK || "eip155:43114"; // Avalanche C-Chain
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.payai.network";
const PAY_TO = process.env.PAY_TO || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // cuenta de prueba
const SYNC_FACILITATOR = process.env.X402_SYNC !== "false";
const PRICE = process.env.PRICE || "$0.01";

/* --------------------------------------------------------------- datos */

function loadDataset() {
  const candidates = [
    path.join(__dirname, "..", "data", "dataset-avalanche-onchain.json"),
    path.join(__dirname, "..", "data", "dataset-avalanche.json"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
  }
  throw new Error("No se encontro ningun dataset. Corre `pnpm run dataset:build`.");
}

const { file: datasetFile, data: dataset } = loadDataset();

/** Ultimo snapshot (mas reciente) de cada protocolo, con sus senales. */
const latestByProtocol = new Map();
for (const row of dataset.snapshots || []) {
  const prev = latestByProtocol.get(row.protocolId);
  if (!prev || row.date > prev.date) latestByProtocol.set(row.protocolId, row);
}

function riskFor(protocolId) {
  const row = latestByProtocol.get(protocolId);
  if (!row) return null;
  const result = score(row);
  return {
    protocolId,
    protocolName: row.protocolName,
    address: row.protocolAddress,
    asOf: row.date,
    score: result.score,
    band: result.band,
    confidence: result.confidence,
    coverage: result.coverage,
    reasons: result.reasons,
    missingSignals: result.missing,
    signals: {
      failedTxRate: row.failedTxRate,
      adminTxCount30d: row.adminTxCount30d,
      topDepositorShare: row.topDepositorShare,
      withdrawalSpikePct: row.withdrawalSpikePct,
      codeChangedDaysAgo: row.codeChangedDaysAgo,
      tvlChange30d: row.tvlChange30d,
      tvlDrawdown90d: row.tvlDrawdown90d,
      auditCount: row.auditCount,
      incidentCount: row.incidentCount,
    },
  };
}

/* ------------------------------------------------------------- servidor */

const app = express();

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(NETWORK, new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
      "GET /premium/risk/*": {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
          maxTimeoutSeconds: 60,
        },
        description: "Puntaje de riesgo on-chain de un protocolo DeFi en Avalanche",
      },
    },
    resourceServer,
    undefined,
    undefined,
    SYNC_FACILITATOR,
  ),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, dataset: path.basename(datasetFile), protocols: latestByProtocol.size, network: NETWORK });
});

app.get("/catalog", (_req, res) => {
  res.json({ protocols: [...latestByProtocol.keys()].sort() });
});

app.get("/premium/risk/:protocolId", (req, res) => {
  const data = riskFor(req.params.protocolId);
  if (!data) return res.status(404).json({ error: `protocolo desconocido: ${req.params.protocolId}` });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`RiskGuard x402 en http://127.0.0.1:${PORT}`);
  console.log(`  dataset:     ${datasetFile}`);
  console.log(`  red:         ${NETWORK}`);
  console.log(`  facilitador: ${FACILITATOR_URL}`);
  console.log(`  payTo:       ${PAY_TO}`);
  console.log(`  precio:      ${PRICE} por consulta premium`);
});
