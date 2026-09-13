# RiskGuard - agente de gestion de riesgo para rendimiento pasivo en DeFi

> **ETH Bolivia Buildathon 2026** - Bounty de **Avalanche** ($200)
> Cadena: **Avalanche C-Chain** (`43114`) - Pruebas: Fuji (`43113`)

## Demo

| Que | Donde |
|-----|-------|
| App en vivo | **https://9c33b468a129d9.lhr.life** |
| Contratos en Fuji | [`RiskGuard`](https://testnet.snowtrace.io/address/0xF3Cf73E668F33FB83476aD689170Eb9E0F2bf197) - [`ProtocolRegistry`](https://testnet.snowtrace.io/address/0xdefff21917B5Efbf6BAf85B597686B2DaB8dD135) - [`AgentLog`](https://testnet.snowtrace.io/address/0x26c59009A3b771aBCb6A14227E17763aA6b0Da36) |
| Codigo | https://gitlab.com/0xronaldo/agentavaxt1 |
| Guion de demo | [5 minutos](#guion-de-demo-5-minutos) |

La URL de la app sale de un **tunel SSH desde el portatil del equipo**: anda mientras esa terminal
siga abierta. Para levantarla de nuevo, ver [Publicar](#publicar).

## El problema

Una persona tiene stablecoins ociosas y podria generar rendimiento en DeFi, pero:

1. **No tiene el conocimiento tecnico** para evaluar el riesgo de un protocolo.
2. **La senal mas visible engana**: un APY muy alto suele anunciar un problema, no una oportunidad.
3. **El riesgo es costoso y real.** El documento de problematica del equipo cita mas de
   **$2.100 M** de perdidas historicas en protocolos de prestamos DeFi y **$635 M** en 28
   incidentes solo en abril de 2026. *(Cifras del documento del equipo - pendientes de verificar
   en DefiLlama; ver [`../../../../Documentacion-BlochainApps/fuentes/_origen-agente-avax.md`](../../../../Documentacion-BlochainApps/fuentes/_origen-agente-avax.md)*.)

## La pregunta que responde

> En que protocolo DeFi **ya existente** conviene poner los activos del usuario **ahora**, y
> sigue siendo seguro con el tiempo.

**No es** un agente de trading, no predice precios, no es casa de cambio, **no custodia fondos** y
no da asesoria de inversion. Ver el alcance completo en
[`../../../../Documentacion-BlochainApps/ideas/avalanche-agente-riesgo.md`](../../../../Documentacion-BlochainApps/ideas/avalanche-agente-riesgo.md).

## Como entra Avalanche (y por que no es decorativo)

El **control de riesgo previo a la operacion vive on-chain**. El agente propone; el contrato
dispone:

| Componente | Donde vive | Que impide |
|------------|-----------|------------|
| **`RiskGuard.sol`** | Avalanche C-Chain | Que la asignacion ocurra si viola la politica del usuario |
| **`ProtocolRegistry.sol`** | Avalanche C-Chain | Que el agente **mienta sobre el riesgo**: el puntaje se lee del contrato, no lo pasa el agente |
| **`AgentLog.sol`** | Avalanche C-Chain | Que una decision -aprobada **o bloqueada**- quede sin registro |

Sin Avalanche, el control depende de que el agente se comporte bien. Con Avalanche, la politica es
**ejecutable y verificable por cualquiera**.

## Arquitectura

```text
Usuario --> App web (billetera conectada, sin custodia)
                |
                |--> Motor de riesgo (off-chain)
                |      |-- scoring CSBC    -> puntaje 0..100 con motivos explicables
                |      `-- Monte Carlo     -> rango esperado + P(brecha)
                |
                |--> RiskGuard.checkOperation()      (revisa la politica)
                |--> RiskGuard.commitOperation()     solo si paso (si no, revierte)
                `--> RiskGuard.recordRejection()     guarda la perdida evitada
```

**Principio de diseno:** *la decision la toma matematica determinista; el LLM solo explica.*
Un producto de riesgo no puede alucinar, y asi toda decision es auditable.

## Estructura

```text
riskguard-avax/
|--- contracts/                     # Solidity (Foundry, src = "contracts")
|   |--- RiskGuard.sol              # politica + control previo (el corazon)
|   |--- ProtocolRegistry.sol       # catalogo con puntajes de riesgo
|   `--- AgentLog.sol               # registro append-only de decisiones
|--- test/                          # pruebas en Solidity
|   |--- RiskGuard.t.sol            # 18 pruebas del control previo
|   |--- ProtocolRegistry.t.sol     # 9 pruebas del catalogo
|   `--- AgentLog.t.sol             # 6 pruebas del registro
|--- script/
|   `--- Deploy.s.sol               # despliegue con forge script
|--- engine/                        # motor de riesgo (JavaScript puro, sin dependencias)
|   |--- scoring.js                 # puntaje CSBC; repesa pesos si faltan senales
|   |--- montecarlo.js              # simulacion por lapso (sub-diaria y ciclos)
|   |--- timeframes.js              # lapsos con nombre (1h, 6h, 24h, 7d, 30d, 90d...)
|   |--- backtest.js                # arnes de backtesting con 4 metricas + cobertura
|   |--- defillama.js               # cliente de datos REALES (DefiLlama) con cache
|   |--- glacier.js                 # cliente de la Avalanche Data API (tx y transfers)
|   |--- onchain.js                 # 5 senales on-chain via Glacier + RPC
|   |--- synthetic.js               # dataset sintetico reproducible (solo pruebas)
|   `--- dataset.js                 # carga y validacion de datasets
|--- scripts/                       # utilidades CLI en Node (sin dependencias)
|   |--- test-engine.js             # 52 pruebas del motor
|   |--- e2e-anvil.js               # prueba end-to-end local (Anvil + cast)
|   |--- score-cli.js               # puntuar un protocolo desde la terminal
|   |--- build-dataset.js           # construye el dataset REAL de Avalanche
|   |--- collect-onchain.js         # enriquece el dataset con senales on-chain
|   `--- backtest.js                # informe de backtesting
|--- x402/                          # pago de datos premium (SDK @x402/* v2, aislado)
|   |--- premium-server.mjs         # endpoint de riesgo detras de HTTP 402
|   |--- agent-client.mjs           # agente que paga y consulta
|   `--- smoke-test.mjs             # prueba offline del 402
|--- web/                           # frontend (Vite + React + wagmi/viem)
|   `--- src/App.tsx                # politica, protocolos, control previo y log
|--- data/
|   |--- dataset-avalanche.json     # dataset REAL (1 474 snapshots) - se versiona
|   `--- cache/                     # respuestas de DefiLlama (ignorado por git)
|--- docs/BACKTESTING.md            # metodologia, resultados reales y limites
|--- lib/forge-std/                 # submodulo de git
`--- foundry.toml
```

**Cero dependencias de paquetes**: los contratos usan **Foundry** y el motor de riesgo es
**JavaScript puro** con modulos nativos de Node. La superficie de ataque de cadena de suministro
es nula.

## Datos reales y backtesting honesto

El dataset de backtesting se construye desde la **API publica de DefiLlama**, no a mano:

```powershell
pnpm run dataset:build     # 1 474 snapshots de 38 protocolos de Avalanche
pnpm run backtest:real     # metricas + barrido de umbral
```

La etiqueta (`failedWithin90d`) sale del **historial real de incidentes**, no de las senales que
puntua el modelo. Los protocolos hackeados que ya desaparecieron del catalogo **se incluyen**, para
no caer en sesgo de supervivencia.

| Resultado real (umbral 55) | Valor |
|----------------------------|-------|
| Recall | 32,14 % |
| Precision | 7,56 % |
| Tasa de falsos positivos | 7,61 % |
| Cobertura de senales | 45,2 % |
| Resultado concluyente | **No** |

**El modelo es debil, y el repositorio lo dice.** Solo el 45,2 % del peso del modelo tiene datos
disponibles: las cinco senales que detectan el estres previo a un exploit (retiros masivos, cambios
de bytecode, actividad de la clave admin) requieren un **colector on-chain que todavia no existe**.
En lugar de rellenar ese hueco con estimaciones -lo que fabricaria un resultado-, el motor excluye
las senales ausentes, repesa las disponibles y **reporta la cobertura**. Ver
[`docs/BACKTESTING.md`](docs/BACKTESTING.md).


## Lapsos cortos (timeframes)

El documento de problematica pide **dos capas**: analisis en tiempo real y ciclos.
`engine/timeframes.js` declara los lapsos con nombre y los unifica en scoring, Monte
Carlo, colector y CLI:

| Lapso | Capa | Uso |
|-------|------|-----|
| `1h`, `6h`, `24h` | tiempo real | estres inmediato (retiros, fallos) |
| `7d` | corto plazo | primera senal de deterioro |
| `30d`, `90d` | medio plazo | ventana del puntaje y del backtest |
| `180d`, `1y` | ciclo | estacionalidad y consistencia |

El Monte Carlo simula en pasos **sub-diarios** para lapsos menores a 24 h (la
volatilidad escala con `sqrt(del paso)`), de modo que `1h` no queda en cero pasos.

```powershell
pnpm run score -- --signals '{"tvlChange30d":-0.1,"withdrawalSpikePct":0.05}'
pnpm run score -- --signals '{...}' --horizon 6h
```

## Colector on-chain

`engine/onchain.js` + `engine/glacier.js` completan las **5 senales que el dataset
dejaba en null**:

| Senal | Fuente |
|-------|--------|
| `failedTxRate` | Glacier: transacciones al protocolo y su estado |
| `adminTxCount30d` | RPC `owner()` + Glacier: actividad de la clave admin |
| `topDepositorShare` | Glacier: transfers ERC20 entrantes agrupados por origen |
| `withdrawalSpikePct` | Glacier: salidas diarias contra la media |
| `codeChangedDaysAgo` | RPC `eth_getCode` historico (hash del bytecode) |

```powershell
pnpm run collect:onchain -- --months 18 --max-snapshots 3
pnpm run backtest:onchain
```

**Honestidad:** la cobertura sube en las filas enriquecidas (evaluacion **en vivo**),
pero **no** al 100 % de la historia: cubrir 1.474 snapshots de 2021-2026 exige un
**indexer** sostenido; los RPC publicos y Glacier no permiten barrer esa profundidad en
una corrida. Cada senal sin evidencia queda en `null` y se anota; nunca se rellena.

## Pagos x402

`x402/` expone el puntaje como **dato premium** que el agente paga en Avalanche
(HTTP 402 + EIP-3009). Es la integracion que le da funcion, no adorno, al 40 % del
criterio. Ver [`x402/README.md`](x402/README.md).

```powershell
cd x402
pnpm install
pnpm run smoke     # 8 comprobaciones offline del 402
```

## Frontend (demo no custodial)

`web/` es la app del agente, construida sobre el **template de diseno v4**
(`frontend-templates/cyberfin-3d-crypto-v4`, ya reskinado con la paleta RiskGuard):
**Vite + React + TypeScript + TailwindCSS + Three.js** para el hero 3D, con **wagmi/viem**
para la billetera. El usuario conecta Core Wallet, define su politica, ve los protocolos
con su puntaje on-chain y dispara el control previo. Si `checkOperation` permite,
`commitOperation` ejecuta; si no, `recordRejection` guarda la perdida evitada.

Ademas del estado on-chain, muestra el **motor off-chain** con datos reales: las **senales**
del modelo (valor, fuente y puntos), la **cobertura** y el **Monte Carlo por lapso**
(1h, 6h, 24h, 7d, 30d, 90d). Esos datos salen de `web/public/data/latest.json`, que se
genera desde el dataset enriquecido:

```powershell
pnpm run export:web    # escribe web/public/data/latest.json (senales + Monte Carlo)
```

#### Secciones de la app

| Panel | Que muestra |
|-------|-------------|
| Kit de billetera | Billeteras detectadas (EIP-6963) para conectar |
| Perfil | Direccion, red, politica, exposicion, registro y desconexion |
| Mi politica | Lectura de `RiskGuard.policyOf` y formulario `setPolicy` |
| Protocolos registrados | `ProtocolRegistry.list` + riesgo y banda de cada uno |
| Evaluar y ejecutar | `checkOperation` y luego `commitOperation`/`recordRejection` |
| Motor de riesgo off-chain | Senales, cobertura y Monte Carlo por lapso del protocolo |
| Matriz de riesgo | Variabilidad (p95-p5) de cada protocolo por lapso |
| Estrategia | Tolerancia -> habilitados/bloqueados y brecha a 30 d (Monte Carlo) |
| Fuentes y seguimiento | APIs que alimentan el puntaje (Glacier, DefiLlama, RPC...) |
| Fondeo (Stereum) | Rampa Bs -> USDC/USDT (punto de enganche, API por integrar) |
| Registro de decisiones | `AgentLog` en vivo (conteo y ultima decision) |

Los logos de las monedas 3D (USDC, USDT, BTC, AVAX) son **SVG locales** en
`web/public/assets/coins/`; la app no depende de CDN.

```powershell
cd web
pnpm install
pnpm dev        # http://localhost:3000
```

Apunta a Fuji por defecto. Requiere sembrar la demo (una vez):

```powershell
pnpm run seed:fuji     # registra protocolos con su puntaje real + politica de ejemplo
```

## Fondeo con Stereum (rampa fiat)

Stereum (https://stereum.tech) es una API de pagos en Bolivia con stablecoin. La integracion
es **server-side**: las credenciales viven en `.env` y un proxy firma las peticiones con
**HMAC-SHA256** (`x-api-key`, `x-signature`, `x-timestamp`). El navegador nunca las ve.

```powershell
pnpm run stereum:proxy     # http://localhost:8788
#   GET  /health                      estado de credenciales/cuenta
#   GET  /rates?currency=BOB          comision estimada
#   POST /api/stereum/transfers/send  transferencia firmada
```

El endpoint usado es `POST /api/v1/transfers/send`. Si Stereum responde
"**No existe la cuenta del que inicia la transferencia**", hay que **habilitar la Cuenta
Mainnet** en https://console.stereum.tech. El frontend (seccion **Datos -> Fondeo**) muestra
ese estado en vivo.

## Puesta en marcha

```powershell
git clone --recurse-submodules https://gitlab.com/0xronaldo/agentavaxt1
cd agentavaxt1
pnpm install     # no baja nada: el proyecto no tiene dependencias de paquetes
```

| Comando | Que hace |
|---------|----------|
| `forge build` | Compila los contratos |
| `forge test` | 33 pruebas de Solidity |
| `pnpm run test:engine` | 52 pruebas del motor de riesgo |
| `pnpm run test:e2e` | Anvil + despliegue + politica + bloqueo, de punta a punta |
| `pnpm run score -- --file mis-senales.json` | Puntua un protocolo (tabla por lapso) |
| `pnpm run dataset:build` | Construye el dataset real desde DefiLlama |
| `pnpm run backtest:real` | Backtest real + barrido de umbral |
| `pnpm run collect:onchain -- --months 18 --max-snapshots 3` | Suma las senales on-chain |
| `pnpm run backtest:onchain` | Backtest con el dataset enriquecido |
| `pnpm run export:web` | Regenera `web/public/data/latest.json` |
| `pnpm run serve:web` | Sirve `web/dist` compilado (para tuneles) |
| `pnpm run ascii` / `pnpm run check` | Revisa ASCII / ASCII + motor |

> El proyecto **no tiene dependencias de paquetes**: `pnpm` se usa solo como lanzador de scripts.
> Convencion del workspace: `pnpm`, nunca `npm` ni `yarn` (ver `AGENTS.md` de la raiz).

### Desplegar en Avalanche

```powershell
# La clave vive en .env (gitignored); ver .env.example
pnpm run deploy:fuji                 # testnet
pnpm run deploy:fuji:verify          # + verificacion (requiere SNOWTRACE_API_KEY)
pnpm run deploy:mainnet              # C-Chain
```

El script despliega los tres contratos, conecta `RiskGuard` como escritor del `AgentLog` y
habilita al desplegador como actualizador de puntajes.
Faucet de Fuji: https://build.avax.network/console/primary-network/faucet

#### Despliegue ya hecho en Fuji (2026-09-13)

| Contrato | Direccion | Explorador |
|----------|-----------|------------|
| `AgentLog` | `0x26c59009A3b771aBCb6A14227E17763aA6b0Da36` | https://testnet.snowtrace.io/address/0x26c59009A3b771aBCb6A14227E17763aA6b0Da36 |
| `ProtocolRegistry` | `0xdefff21917B5Efbf6BAf85B597686B2DaB8dD135` | https://testnet.snowtrace.io/address/0xdefff21917B5Efbf6BAf85B597686B2DaB8dD135 |
| `RiskGuard` | `0xF3Cf73E668F33FB83476aD689170Eb9E0F2bf197` | https://testnet.snowtrace.io/address/0xF3Cf73E668F33FB83476aD689170Eb9E0F2bf197 |

Cableado verificado en cadena: `AgentLog.writer = RiskGuard`,
`ProtocolRegistry.owner = desplegador` y `RiskGuard.registry = ProtocolRegistry`.

#### Verificacion del codigo (Sourcify, sin API key)

Los tres contratos estan verificados con **match completo** en Sourcify:

```powershell
forge verify-contract <direccion> contracts/<Archivo>.sol:<Contrato> --chain 43113 --verifier sourcify
```

| Contrato | Sourcify |
|----------|----------|
| `AgentLog` | https://repo.sourcify.dev/contracts/full_match/43113/0x26c59009A3b771aBCb6A14227E17763aA6b0Da36/ |
| `ProtocolRegistry` | https://repo.sourcify.dev/contracts/full_match/43113/0xdefff21917B5Efbf6BAf85B597686B2DaB8dD135/ |
| `RiskGuard` | https://repo.sourcify.dev/contracts/full_match/43113/0xF3Cf73E668F33FB83476aD689170Eb9E0F2bf197/ |

> Snowtrace dejo de ser el explorador de referencia; su sucesor es **RouteScan**
> (https://routescan.io, API Etherscan-compatible y sin clave). Ademas de Sourcify,
> se puede verificar ahi con `--verifier blockscout/custom`. Sourcify cubre Fuji y
> mainnet sin necesitar ninguna API key.

#### Flujo real firmado en Fuji (evidencia, 2026-09-13)

Con la clave de testnet se ejecutaron las dos rutas del control previo:

| Accion | Protocolo | Resultado | Transaccion |
|--------|-----------|-----------|-------------|
| `commitOperation` | Folks (riesgo 15) | **ejecutada** (permitida) | [`0xdd33b8...b29f6`](https://testnet.snowtrace.io/tx/0xdd33b894b94d8fc4ea81faab0e186e7ac07a746c1dd6f76935b1ae3f801b29f6) |
| `recordRejection` | Zabu (riesgo 88) | **bloqueada** (motivo 4) | [`0xaab4fa...7a28`](https://testnet.snowtrace.io/tx/0xaab4fa53952f1ca79ab2bd0a2fd9bc8ac6125972191830f011c0b2f0c27b7a28) |

Estado resultante leido on-chain: `AgentLog.count() = 2`, `totalCommitted = 100`,
`totalRejections = 1`, y la ultima entrada del `AgentLog` es el bloqueo con puntaje 88 y
motivo 4. El frontend muestra ese registro en vivo.

## Guion de demo (5 minutos)

| Tiempo | Que se muestra |
|--------|----------------|
| 0:00-0:40 | El problema: capital ocioso + la trampa del APY alto |
| 0:40-1:40 | El usuario conecta su billetera y **define su politica** (`setPolicy`) |
| 1:40-2:40 | El agente evalua un protocolo: puntaje con sus motivos y rango Monte Carlo |
| 2:40-3:40 | **Intento bloqueado**: el contrato revierte y el bloqueo queda registrado on-chain |
| 3:40-4:30 | El mismo agente opera un protocolo dentro de politica -> `commitOperation` pasa |
| 4:30-5:00 | Backtesting: que se evito y a que costo (recall vs. falsos positivos) |

## Encaje con los criterios del bounty

| Criterio | Peso | Como se cubre |
|----------|:----:|---------------|
| Integracion con Avalanche | **40 %** | El control pre-trade **es** un contrato en C-Chain; el agente no puede saltarselo |
| Proyecto y caso de uso | 25 % | Pregunta acotada y real: capital ocioso que hoy no produce |
| Implementacion tecnica | 25 % | MVP funcional + contratos desplegados **y verificados** |
| Potencial | 10 % | Umbrales que se auto-ajustan: ningun producto comercial lo hace hoy |

## Limitaciones (declaradas a proposito)

- **El backtest no es concluyente**: recall 32,14 % con una cobertura de senales del 45,2 %. Las
  senales on-chain que detectan estres previo a un exploit todavia no se recolectan. El informe lo
  marca explicitamente (`dataQuality.conclusive = false`) en vez de presentar el numero como logro.
- Hay **8 protocolos positivos** en el dataset real: suficiente para una lectura preliminar, escaso
  para una conclusion estadistica.
- El puntaje de riesgo es un **modelo transparente de pesos declarados**, no un modelo entrenado.
- Los topes de politica son **montos absolutos**, no porcentajes del portafolio (requeriria un
  oraculo de valoracion).
- `chainConcentration` usa la composicion de cadenas **actual** de forma constante (fuga leve desde
  el presente); esta documentada.
- Las cifras de perdidas del sector provienen del documento del equipo y estan **sin verificar**.

## Estado del repositorio

- Repositorio con remoto en **GitLab** (`0xronaldo/agentavaxt1`); `main` al dia.
- `lib/forge-std` esta como **submodulo de git**: traerlo con
  `git submodule update --init --recursive` (o clonar con `--recurse-submodules`).
- Commits cortos, en minuscula y en ASCII.

### Verificacion final

| Suite | Resultado |
|-------|-----------|
| `forge test` | 33/33 |
| `pnpm run test:engine` | 52/52 |
| `pnpm run test:e2e` | 10/10 |
| `x402 pnpm run smoke` | 8/8 |
| `ascii-lint` | limpio (49 archivos) |

Servicios locales: web (dev) en `http://localhost:4173` y proxy de Stereum en
`http://localhost:8788`.

## Publicar

Dos caminos: el **tunel SSH** (URL temporal, la de la demo de arriba) y **Vercel** (deploy
permanente).

### Vercel

El frontend vive en `web/`; la raiz del repositorio es contratos y motor, asi que **no se puede
desplegar desde la raiz sin decirle a Vercel donde esta la app**.

**Opcion A (la mas simple): desplegar solo la carpeta del frontend.**

```sh
cd web
pnpm install
pnpm build
vercel --prod
```

**Opcion B (desde la raiz, ya configurada):** `vercel.json` redirige la instalacion y el build a
`web/` y publica `web/dist`. Sirve igual para el CLI lanzado en la raiz del repositorio y para la
integracion con GitLab (Root Directory = raiz del repositorio).

```sh
pnpm install
vercel --prod
```

Reglas que no hay que romper:

- `pnpm run build` en la raiz **construye el frontend**. Los contratos se compilan aparte con
  `pnpm run build:contracts` (`forge build`).
- **Foundry no existe en el contenedor de Vercel.** Cualquier script de build que llame a `forge`
  rompe el deploy con `forge: command not found`.
- Si en el panel de Vercel hay un *Build Command* propio, debe quedar en `pnpm run build` (o
  vaciarse, para que mande `vercel.json`).
- `.vercelignore` deja fuera `lib/`, `out/`, `data/cache/`, `reports/` y `x402/`: sin el, el
  CLI intenta subir cientos de MB que no se usan.

### Tunel SSH (la URL de la demo)

El dev server de Vite **rechaza las peticiones cuyo *Host* no conoce** (proteccion contra DNS
rebinding). Por eso `web/vite.config.ts` autoriza los dominios de **localhost.run**
(`allowedHosts: ['.lhr.life']`). Con el frontend corriendo en el puerto 4173:

```sh
ssh -R 80:localhost:4173 nokey@localhost.run
```

El comando imprime una URL `https://<algo>.lhr.life` que apunta a este equipo mientras la sesion
SSH siga abierta. Es un tunel **anonimo y temporal**: se cae al cerrar la terminal.

Para publicar la version **compilada** (mas liviana y sin HMR) en vez del dev server:

```sh
pnpm run build
pnpm run serve:web
ssh -R 80:localhost:3000 nokey@localhost.run
```

**No expongas el proxy de Stereum (8788)**: firma peticiones con tu clave.

## Pendientes

- [ ] Habilitar la **Cuenta Mainnet** en Stereum para operar `transfers/send`.
- [ ] Indexer on-chain sostenido para cobertura historica completa.
- [ ] `SNOWTRACE_API_KEY` (opcional) para verificacion adicional ademas de Sourcify.
