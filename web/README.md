# RiskGuard - Frontend

App web no custodial del agente. El usuario conecta su billetera, define su **politica**,
ve los **protocolos** con su puntaje on-chain, ejecuta el **control previo** y consulta el
**registro de decisiones**. Ademas muestra el **motor off-chain** (senales, cobertura y
Monte Carlo por lapso).

## Stack

- **Vite + React 19 + TypeScript**
- **TailwindCSS v4** (`@tailwindcss/vite`) con la paleta de marca RiskGuard
- **Three.js** para el hero 3D (monedas USDC / AVAX / BTC)
- **wagmi + viem** para la billetera (Core Wallet, inyectada)

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

Por defecto apunta a los contratos desplegados en **Fuji** (43113). Para mainnet, copia
`.env.example` a `.env` y completa las direcciones `VITE_*`.

## Datos del motor

El panel "Motor de riesgo off-chain" lee `public/data/latest.json`, generado desde el
dataset enriquecido:

```powershell
# desde la raiz del proyecto
pnpm run export:web
```

## Requisitos de la demo

1. Billetera en **Fuji** con un poco de AVAX (faucet:
   https://build.avax.network/console/primary-network/faucet).
2. Que `ProtocolRegistry` tenga protocolos y que el usuario tenga politica:

```powershell
# desde la raiz del proyecto
pnpm run seed:fuji
```

3. Conecta la billetera y usa "Evaluar (control previo)". Un protocolo de riesgo bajo
   (p. ej. 15) aparece **PERMITIDA**; uno de riesgo alto (p. ej. 88) aparece **BLOQUEADA**
   con el motivo leido del contrato.
