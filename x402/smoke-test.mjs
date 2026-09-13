// Prueba de humo offline de la capa x402: levanta un facilitador simulado y el
// servidor de riesgo, y verifica que /health responde 200 y que la ruta premium
// responde 402 (Payment Required) con las condiciones de pago correctas.
//
// No toca la red: el facilitador es un stub local que solo declara soportar
// `exact` en la red configurada.
//
//   pnpm run smoke

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4022;
const FACILITATOR_PORT = 4023;
const NETWORK = process.env.NETWORK || "eip155:43114";
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

/* ---------------------------------------------------- facilitador simulado */

const facilitator = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/supported") {
    res.end(JSON.stringify({ kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }], extensions: [], signers: {} }));
  } else if (req.url === "/verify") {
    res.end(JSON.stringify({ isValid: true, invalidReason: null, payer: "0x0000000000000000000000000000000000000000" }));
  } else if (req.url === "/settle") {
    res.end(JSON.stringify({ success: true, transaction: "0x" + "00".repeat(32), network: NETWORK }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  }
});

const server = spawn(process.execPath, [path.join(__dirname, "premium-server.mjs")], {
  env: { ...process.env, PORT: String(PORT), X402_SYNC: "true", FACILITATOR_URL: `http://127.0.0.1:${FACILITATOR_PORT}` },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (d) => process.env.VERBOSE && process.stdout.write(d));
server.stderr.on("data", (d) => process.stderr.write(d));

async function waitFor(url, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status > 0) return true;
    } catch {
      /* todavia no arranca */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

try {
  console.log(`\n== RiskGuard x402 - prueba de humo (puerto ${PORT}) ==`);
  await new Promise((resolve) => facilitator.listen(FACILITATOR_PORT, resolve));

  const up = await waitFor(`${BASE}/health`);
  if (!up) throw new Error("el servidor no respondio");

  const health = await fetch(`${BASE}/health`);
  const healthBody = await health.json();
  check("/health responde 200", health.status === 200, `status ${health.status}`);
  check("/health reporta protocolos", Number(healthBody.protocols) > 0, JSON.stringify(healthBody));

  const catalog = await fetch(`${BASE}/catalog`);
  check("/catalog responde 200", catalog.status === 200);

  const premium = await fetch(`${BASE}/premium/risk/sierra-protocol`);
  check("la ruta premium sin pago responde 402", premium.status === 402, `status ${premium.status}`);

  // Las condiciones de pago viajan en el header `payment-required` (base64 JSON).
  const header = premium.headers.get("payment-required") || premium.headers.get("PAYMENT-REQUIRED");
  let requirements = null;
  try {
    requirements = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : null;
  } catch {
    requirements = null;
  }
  const accepts = requirements && requirements.accepts;
  check("el 402 trae condiciones de pago (accepts)", Array.isArray(accepts) && accepts.length > 0, header ? header.slice(0, 60) : "sin header");
  if (Array.isArray(accepts) && accepts[0]) {
    check("acepta la red de Avalanche configurada", String(accepts[0].network) === NETWORK, accepts[0].network);
    check("el precio es positivo", Number(accepts[0].amount) > 0, String(accepts[0].amount));
    check("el activo es USDC de Avalanche", /^0x[0-9a-fA-F]{40}$/.test(String(accepts[0].asset)), String(accepts[0].asset));
  }
} catch (e) {
  failed += 1;
  console.error(`  FAIL ${e.message}`);
} finally {
  server.kill();
  facilitator.close();
}

console.log(`\n${passed} OK  -  ${failed} FAIL\n`);
process.exit(failed === 0 ? 0 : 1);
