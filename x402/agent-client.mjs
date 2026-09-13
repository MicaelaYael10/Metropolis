// Agente que paga por datos premium de riesgo usando x402.
// Hace la peticion; si recibe 402, firma un pago EIP-3009 con su billetera y reintenta.
//
//   node agent-client.mjs sierra-protocol
//
// Variables:
//   PRIVATE_KEY   clave de la billetera del agente (con USDC en la red elegida)
//   SERVER_URL    por defecto http://127.0.0.1:4021
//   NETWORK       eip155:43114 (Avalanche) | eip155:43113 (Fuji)

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("Falta PRIVATE_KEY (billetera del agente con USDC).");
  process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:4021";
const NETWORK = process.env.NETWORK || "eip155:43114";
const protocolId = process.argv[2] || "sierra-protocol";

const account = privateKeyToAccount(pk);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
});

console.log(`Agente ${account.address}`);
console.log(`Consultando ${SERVER_URL}/premium/risk/${protocolId} (red ${NETWORK})...`);

const response = await fetchWithPayment(`${SERVER_URL}/premium/risk/${protocolId}`, { method: "GET" });

const paymentResponse = response.headers.get("PAYMENT-RESPONSE") || response.headers.get("X-PAYMENT-RESPONSE");
if (paymentResponse) {
  try {
    console.log("Pago liquidado:", decodePaymentResponseHeader(paymentResponse));
  } catch {
    console.log("Pago liquidado (header crudo):", paymentResponse);
  }
}

if (!response.ok) {
  console.error(`HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const data = await response.json();
console.log("\nDato premium recibido:");
console.log(`  protocolo: ${data.protocolName} (${data.protocolId})`);
console.log(`  riesgo:    ${data.score}/100 -> banda ${String(data.band).toUpperCase()}`);
console.log(`  confianza: ${data.confidence}/100  cobertura: ${data.coverage}%`);
console.log(`  fecha:     ${data.asOf}`);
if (data.reasons && data.reasons.length) console.log(`  motivos:   ${data.reasons.join("; ")}`);
