# RiskGuard - Frontend

App web no custodial del agente. El usuario conecta su billetera, define su **politica**,
ve los **protocolos** con su puntaje on-chain, ejecuta el **control previo** y consulta el
**registro de decisiones**. Ademas muestra el **motor off-chain** (senales, cobertura y
Monte Carlo por lapso).

## Stack

- **Vite + React 19 + TypeScript**
- **TailwindCSS v4** (`@tailwindcss/vite`) con la paleta de marca RiskGuard
- **Three.js** para el hero 3D (monedas USDC / AVAX / BTC)
- **wagmi + viem** para la billetera (MetaMask / inyectada, EIP-6963)

Diseno basado en el template `frontend-templates/cyberfin-3d-crypto-v4`, ya reskinado con la
paleta del proyecto y con el contenido propio de RiskGuard.

## Secciones

- **Hero 3D** con monedas USDC / USDT / BTC / AVAX (logos oficiales en `public/assets/coins/`).
- **Kit de billetera** (EIP-6963) y **perfil** (politica, exposicion, registro).
- **Panel**: politica, protocolos, evaluacion (control previo) y motor off-chain.
- **Matriz de riesgo** por lapso y **estrategia** interactiva (Monte Carlo en el navegador).
- **Fuentes y seguimiento** (APIs) y **fondeo** con Stereum (punto de enganche).

Todo local: sin CDN de fuentes ni de imagenes; `three` se carga en diferido.

## Uso

```powershell
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # build de produccion (dist/)
pnpm preview
```

Por defecto apunta a los contratos desplegados en **Monad Testnet** (10143); las
direcciones estan compiladas en `web/src/config.ts` y se pueden sobrescribir con las
variables `VITE_*` (ver `.env.example`).

## Datos del motor

El panel "Motor de riesgo off-chain" lee `public/data/latest.json`. El archivo se genera
desde el dataset enriquecido de Avalanche y se le anaden los dos mock vaults de Monad
(perfiles de demo en `data/dataset-monad-demo.json`, con el puntaje real on-chain):

```powershell
# desde la raiz del proyecto
pnpm run export:web
```

El dashboard filtra por la cadena conectada, asi que en Monad solo se muestran los dos
vaults (Safe 18 / Risky 82) y en Fuji el dataset de Avalanche.

## Requisitos de la demo

1. Billetera en **Monad Testnet** con MON para gas (faucet: https://faucet.monad.xyz/).
2. `ProtocolRegistry` ya viene sembrado por `DeployMonad` (Safe Vault 18, Risky Vault 82).
3. Conecta la billetera y usa "Evaluar (control previo)". El Safe Vault (riesgo 18)
   aparece **PERMITIDA**; el Risky Vault (riesgo 82) aparece **BLOQUEADA** con el motivo
   leido del contrato.

## Deploy (Vercel)

`vercel.json` en la raiz ya define install/build/output para `web/dist`. En Vercel:

1. Importar el repositorio `MicaelaYael10/Metropolis`.
2. (Opcional) definir `VITE_RISKGUARD_MONAD`, `VITE_REGISTRY_MONAD` y
   `VITE_AGENTLOG_MONAD`; sin ellas se usan las direcciones por defecto.
3. Deploy. El resultado es la URL publica de la demo.
