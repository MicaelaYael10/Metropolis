# RiskGuard - agente de gestion de riesgo para rendimiento pasivo en DeFi

> **ETH Bolivia Buildathon 2026** - Bounty de **Avalanche** ($200)
> Cadena: **Avalanche C-Chain** (`43114`) - Pruebas: Fuji (`43113`)

## El problema

Una persona tiene stablecoins ociosas y podria generar rendimiento en DeFi, pero:

1. **No tiene el conocimiento tecnico** para evaluar el riesgo de un protocolo.
2. **La senal mas visible engana**: un APY muy alto suele anunciar un problema, no una oportunidad.
3. **El riesgo es costoso y real.** El documento de problematica del equipo cita mas de
   **$2.100 M** de perdidas historicas en protocolos de prestamos DeFi y **$635 M** en 28
   incidentes solo en abril de 2026. *(Cifras del documento del equipo - pendientes de verificar
   en DefiLlama; ver [`../../../../Documentacion-BlochainApps/fuentes/_origen-agente-avax.md`](../../../../Documentacion-BlochainApps/fuentes/_origen-agente-avax.md)*.)

## La pregunta que responde

> ?En que protocolo DeFi **ya existente** es seguro colocar los activos del usuario **ahora**,
> y sigue siendo seguro con el tiempo?

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
                |--> RiskGuard.checkOperation()      ?la politica lo permite?
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
| ?Concluyente? | **No** |

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

## Puesta en marcha

```powershell
# Contratos (Foundry)
forge build
forge test

# Motor de riesgo (Node puro, sin dependencias)
pnpm run test:engine

# Prueba end-to-end local: Anvil + despliegue + politica + bloqueo
pnpm run test:e2e

# Puntuar un protocolo a partir de sus senales (tabla por lapso)
pnpm run score -- --file mis-senales.json

# Datos y backtesting
pnpm run dataset:build                              # construye el dataset REAL (DefiLlama)
pnpm run backtest:real                              # backtest real + barrido de umbral
pnpm run collect:onchain -- --months 18 --max-snapshots 3   # suma senales on-chain
pnpm run backtest:onchain                           # backtest con el dataset enriquecido
pnpm run backtest -- --dataset data/dataset-avalanche.json --threshold 45
pnpm run backtest                                   # dataset sintetico (avisa en pantalla)
```

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

El repositorio **ya esta inicializado** localmente (`git init`, sin remoto) y `lib/forge-std` esta
agregado como **submodulo de git**. Falta configurar el remoto y hacer los commits:

```powershell
git add .
git commit -m "RiskGuard: contratos en Foundry, motor de riesgo y backtesting"
git branch -M main
git remote add origin <URL_DEL_REPO>
git push -u origin main
```

> Al clonar en otra maquina, traer el submodulo con
> `git submodule update --init --recursive`.
