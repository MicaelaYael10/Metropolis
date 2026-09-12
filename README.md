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
|   |--- montecarlo.js              # simulacion en 2 capas (tiempo real + ciclos)
|   |--- backtest.js                # arnes de backtesting con 4 metricas + cobertura
|   |--- defillama.js               # cliente de datos REALES (DefiLlama) con cache
|   |--- synthetic.js               # dataset sintetico reproducible (solo pruebas)
|   `--- dataset.js                 # carga y validacion de datasets
|--- scripts/                       # utilidades CLI en Node (sin dependencias)
|   |--- test-engine.js             # 35 pruebas del motor
|   |--- score-cli.js               # puntuar un protocolo desde la terminal
|   |--- build-dataset.js           # construye el dataset REAL de Avalanche
|   `--- backtest.js                # informe de backtesting
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


## Puesta en marcha

```powershell
# Contratos (Foundry)
forge build
forge test

# Motor de riesgo (Node puro, sin dependencias)
pnpm run test:engine

# Puntuar un protocolo a partir de sus senales
pnpm run score -- --file mis-senales.json

# Datos y backtesting
pnpm run dataset:build                              # construye el dataset REAL (DefiLlama)
pnpm run backtest:real                              # backtest real + barrido de umbral
pnpm run backtest -- --dataset data/dataset-avalanche.json --threshold 45
pnpm run backtest                                   # dataset sintetico (avisa en pantalla)
```

> El proyecto **no tiene dependencias de paquetes**: `pnpm` se usa solo como lanzador de scripts.
> Convencion del workspace: `pnpm`, nunca `npm` ni `yarn` (ver `AGENTS.md` de la raiz).

### Desplegar en Avalanche

```powershell
$env:PRIVATE_KEY = "0x..."   # nunca versionar la clave
forge script script/Deploy.s.sol --rpc-url avax_fuji --broadcast
forge script script/Deploy.s.sol --rpc-url avax_mainnet --broadcast --verify
```

El script despliega los tres contratos, conecta `RiskGuard` como escritor del `AgentLog` y
habilita al desplegador como actualizador de puntajes.
Faucet de Fuji: https://build.avax.network/console/primary-network/faucet

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
