// Proxy server-side para la API de Stereum (pagos Bolivia con stablecoin).
// Las credenciales NO pueden ir en el frontend (todo VITE_* es publico): viven en .env
// y este proceso firma las peticiones con HMAC-SHA256.
//
//   node --env-file=.env server/stereum-proxy.mjs
//
// Endpoints:
//   GET  /health                      -> prueba credenciales y resume el estado de la cuenta
//   GET  /rates?currency=BOB          -> comision/estimacion (si el key lo permite)
//   POST /api/stereum/transfers/send  -> firma y reenvia a Stereum

import http from "node:http";
import crypto from "node:crypto";

// Carga .env si existe (Node 20.12+).
try {
  process.loadEnvFile?.(".env");
} catch {
  /* sin .env: se usan variables del entorno */
}

const BASE = process.env.STEREUM_BASE || "https://api.stereum.tech";
const API_KEY = process.env.STEREUM_API_KEY || "";
const SECRET = process.env.STEREUM_SECRET_KEY || "";
const PORT = Number(process.env.STEREUM_PROXY_PORT || 8788);

if (!API_KEY || !SECRET) {
  console.error("Faltan STEREUM_API_KEY / STEREUM_SECRET_KEY en .env");
  process.exit(1);
}

const hmac = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("hex");

/** Firma una peticion y la envia a Stereum. Devuelve {status, body}. */
async function stereumFetch(method, path, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers = {
    "content-type": "application/json",
    "x-api-key": API_KEY,
    "x-signature": hmac(body),
    "x-timestamp": String(Math.floor(Date.now() / 1000)),
  };
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload === undefined ? undefined : body });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

const json = (res, status, data) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(data));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "OPTIONS") return json(res, 204, {});

  // Diagnostico: no crea nada; solo reporta que responde Stereum.
  if (req.method === "GET" && url.pathname === "/health") {
    try {
      const probe = await stereumFetch("POST", "/api/v1/transfers/send", {
        amount: "0.01",
        currency: "BOB",
        description: "RiskGuard healthcheck",
      });
      const msg = typeof probe.body === "object" ? probe.body.message || probe.body.error : String(probe.body);
      const ready = probe.status === 400 && /cuenta/i.test(String(msg)) ? false : probe.status < 400;
      return json(res, 200, {
        configured: true,
        base: BASE,
        stereumStatus: probe.status,
        message: msg || null,
        ready,
        hint: ready
          ? "La cuenta esta habilitada para transferir."
          : "Habilita la Cuenta Mainnet en console.stereum.tech para operar transferencias.",
      });
    } catch (e) {
      return json(res, 502, { configured: true, error: e.message });
    }
  }

  // Comision / estimacion (si el key lo permite).
  if (req.method === "GET" && url.pathname === "/rates") {
    const currency = url.searchParams.get("currency") || "BOB";
    try {
      const r = await stereumFetch("GET", `/api/v1/commissions/BO/to-transfer?currency=${encodeURIComponent(currency)}`);
      return json(res, r.status, r.body);
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }

  // Envio de transferencia firmado.
  if (req.method === "POST" && url.pathname === "/api/stereum/transfers/send") {
    const payload = await readBody(req);
    if (!payload.amount) return json(res, 400, { error: "Falta `amount`" });
    try {
      const r = await stereumFetch("POST", "/api/v1/transfers/send", payload);
      return json(res, r.status, r.body);
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }

  json(res, 404, { error: "not found", endpoints: ["/health", "/rates", "/api/stereum/transfers/send"] });
});

server.listen(PORT, () => {
  console.log(`Stereum proxy en http://localhost:${PORT}`);
  console.log(`  base: ${BASE}`);
  console.log(`  key:  ${API_KEY.slice(0, 8)}...`);
});
