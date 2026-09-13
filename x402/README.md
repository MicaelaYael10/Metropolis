# RiskGuard x402 - pago de datos premium de riesgo

Capa de pago agente-a-agente del proyecto. El agente **paga con x402** (HTTP 402 +
EIP-3009 sobre Avalanche) para obtener el **puntaje de riesgo on-chain** de un protocolo,
en lugar del conjunto de senales crudo. Es la pieza que le da funcion real a la
integracion con Avalanche segun el criterio del bounty (40 %).

> **Aislada a proposito.** El nucleo (`contracts/`, `engine/`) sigue **sin dependencias**.
> Esta carpeta tiene su propio `package.json` con el SDK oficial `@x402/*` v2 y `viem`.
> Usa `pnpm`, nunca `npm` ni `yarn`.

## Que hace

```text
Agente (agent-client.mjs)
   |  GET /premium/risk/:protocol  (sin pago)
   v
Servidor (premium-server.mjs)  --402-->  condiciones de pago (USDC, red, payTo)
   ^                                          |
   |  X-PAYMENT (firma EIP-3009)  <-----------/
   |
   |  -> facilitador /verify + /settle (Avalanche)
   v
Dato premium: puntaje 0..100, banda, confianza, cobertura y motivos
```

- **Servidor**: `premium-server.mjs` (Express + `@x402/express`). Reutiliza el motor real
  (`../engine/scoring.js`), no reimplementa el riesgo. Lee
  `../data/dataset-avalanche-onchain.json` (o el dataset base si no existe).
- **Agente**: `agent-client.mjs` (`@x402/fetch` + `@x402/evm`). Firma el pago y reintenta.
- **Prueba offline**: `smoke-test.mjs` levanta un facilitador simulado y verifica que el
  servidor responde `402` con condiciones validas (red, precio y USDC). No toca la red.

## Uso

```powershell
pnpm install            # instala @x402/* v2, express y viem
pnpm run smoke          # prueba offline del 402 (8 comprobaciones)

# 1) arranca el servidor
$env:FACILITATOR_URL = "https://facilitator.payai.network"
$env:NETWORK = "eip155:43113"        # Fuji; mainnet: eip155:43114
pnpm run server

# 2) en otra terminal, paga y consulta
$env:PRIVATE_KEY = "0x..."           # agente con USDC en la red elegida
$env:NETWORK = "eip155:43113"
node agent-client.mjs sierra-protocol
```

## Facilitadores con soporte Avalanche

| Facilitador | URL | Nota |
|-------------|-----|------|
| **PayAI** | `https://facilitator.payai.network` | Documentado para Avalanche en la Academy |
| **0xGasless** | `https://x402.0xgasless.com/` | Facilitador + AgentKit ERC-4337 |
| **thirdweb** | (SDK `thirdweb/x402`) | Verifica y liquida en C-Chain via EIP-7702 |

El facilitador paga el gas y liquida el USDC (`0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`
en C-Chain, soporta EIP-3009). Para una demo **sin fondos** basta `pnpm run smoke`.

## Variables

Ver [`.env.example`](./.env.example). La mas importante es `NETWORK`:
`eip155:43114` (mainnet) o `eip155:43113` (Fuji).
