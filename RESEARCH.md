# Documento de investigacion - RiskGuard

- **Fecha:** 2026-09-12
- **Objetivo:** justificar con criterio de investigacion que se construye, por que es innovador y
  contra que se compara.
- **Estado:** Borrador. Las afirmaciones marcadas **por verificar** todavia no se contrastaron con
  su fuente primaria.

## 1. Formulacion del problema

**Pregunta:** ?en que protocolo DeFi ya existente es seguro colocar los activos del usuario ahora,
y sigue siendo seguro con el tiempo?

**Por que es un problema y no una preferencia:**

1. **Asimetria de informacion.** Evaluar riesgo de protocolos exige revisar auditorias, historial
   de incidentes, actividad on-chain y gobernanza. Es trabajo especializado y continuo.
2. **Senal invertida.** El APY alto, que es lo mas visible, correlaciona con fragilidad, no con
   calidad. El usuario interpreta "mas rendimiento" como "mejor".
3. **Costo real y medible.** El documento del equipo cita >$2.100 M de perdidas historicas en
   protocolos de prestamos y $635 M en 28 incidentes en abril de 2026 (**por verificar** en
   DefiLlama).

**Lo que el proyecto NO es** (delimitacion explicita del documento del equipo): no es trading, no
predice precios, no es exchange, no custodia fondos, no da asesoria personalizada.

## 2. Estado del arte

### 2.1 Enfoque academico: riesgo por comportamiento on-chain

Existe precedente de estimar el riesgo de un protocolo **sin usar datos de precio**. El documento
del equipo cita un framework de 2025 (Parhizkari e Iannillo) con **ROC AUC 0.887** y **96,4 %** de
deteccion de ataques usando solo comportamiento transaccional en protocolos de prestamos.
**Por verificar** en la publicacion original.

**Implicacion de diseno:** el motor de RiskGuard puntua con senales de comportamiento
(transacciones fallidas, cambios de bytecode, concentracion de depositantes, retiros anomalos,
actividad de la clave de administracion, auditorias e incidentes). **No usa el APY ni el precio.**

### 2.2 Practica comercial: agentes con limites estaticos

Segun el documento del equipo, los productos actuales de billeteras con agentes -**MetaMask Agent
Wallet, Cobo, Fystack, Trust Wallet Agent Kit**- usan **limites de gasto estaticos fijados
manualmente**. **Por verificar** en la documentacion de cada producto.

**El hueco:** ningun producto comercial **ajusta esos limites automaticamente** segun el
comportamiento aprendido de la propia cuenta.

### 2.3 Disciplina de control previo

El *pre-trade risk control* es una funcion de seguridad independiente de la decision de inversion
y es **obligatoria en mercados regulados**: Regla **15c3-5 de la SEC** y **MiFID II** (citados en
el documento del equipo).

**Implicacion de diseno:** el control previo no se implementa como una validacion dentro del
agente, sino como un **contrato independiente** que el agente debe consultar y que **revierte** si
la operacion viola la politica.

## 3. Herramientas evaluadas

> Los buscadores de GitHub requieren autenticacion, que aun no esta configurada en este entorno.
> La siguiente lista son **candidatas conocidas, pendientes de verificacion formal** contra su
> repositorio. Al autenticar GitHub se puede correr la busqueda de codigo y completar esta tabla.

### 3.1 Cadenas de herramientas para Solidity

| Herramienta | Para que | Estado |
|-------------|----------|--------|
| **Foundry / Forge** (`foundry-rs/foundry`) | Toolchain en Rust: compilacion y pruebas escritas en Solidity, muy rapido | **ADOPTADA.** forge 1.6.0-nightly - **33 pruebas en Solidity, 0 fallos** |
| **forge-std** (`foundry-rs/forge-std`) | Libreria de pruebas (`vm`, asserts, `console2`) | **ADOPTADA** como submodulo de git en `lib/` |
| **Hardhat** (`NomicFoundation/hardhat`) | Toolchain en JS/TS: compilacion, pruebas, despliegue y verificacion | Evaluada y **descartada** por decision del equipo: se prefiere Foundry |
| **OpenZeppelin Contracts** | Base auditada de contratos reutilizables | Evaluada. **No usada aqui**: los tres contratos son autocontenidos a proposito, para no anadir dependencias |
| **Slither** (`crytic/slither`) | Analisis estatico de Solidity | Candidata para antes de la entrega |

### 3.2 Ecosistema Avalanche

| Recurso | Para que | Estado |
|---------|----------|--------|
| **Avalanche MCP Server** (`build.avax.network/api/mcp`) | Herramientas oficiales de docs, RPC, ACPs y GitHub para agentes de IA | Documentado y disponible; **integracion prevista** para dar contexto autoritativo al agente |
| **Avalanche CLI / Coreth / Subnet-EVM** (`ava-labs`) | Despliegue y ejecucion de L1s | No requerido para este alcance |
| **Data API (Glacier)** | Lectura de datos on-chain de C-Chain | Candidata para alimentar senales |
| **Snowtrace API** | Historial de transacciones y contratos | Candidata para senales |
| **Faucet de Fuji** | AVAX de prueba | Verificado: `build.avax.network/console/primary-network/faucet` |

### 3.3 Pagos entre agentes

| Recurso | Para que | Estado |
|---------|----------|--------|
| **x402** (`coinbase/x402`) | Estandar de pagos maquina-a-maquina; donado a la **Linux Foundation** en abril de 2026 (fuente: prensa especializada, **por verificar**) | **Opcional**: permitiria pagar datos premium de riesgo |

### 3.4 Datos

| Fuente | Para que | Estado |
|--------|----------|--------|
| **DefiLlama API** (`api.llama.fi`) | TVL, rendimientos e historial de incidentes | Fuente principal propuesta para el dataset real |
| **RPC de C-Chain** | Senales crudas de comportamiento | Acceso libre |

## 4. Criterios de innovacion

Se declaran explicitamente para poder defenderlos ante el jurado:

| # | Criterio | Como se cumple | Que lo respalda |
|---|----------|----------------|-----------------|
| **I1** | **Control previo ejecutable, no declarativo** | `RiskGuard` revierte la operacion que viola la politica | Precedente regulatorio (15c3-5, MiFID II) |
| **I2** | **El agente no puede mentir sobre el riesgo** | El puntaje se lee del `ProtocolRegistry` on-chain; `commitOperation` **no acepta un puntaje como parametro** | Diseno propio, verificable en el ABI |
| **I3** | **Se registra la perdida evitada** | `recordRejection` guarda on-chain los intentos bloqueados | Nadie mide lo que se evito; nosotros si |
| **I4** | **Riesgo por comportamiento, no por precio** | Scoring con senales on-chain; el APY nunca es una entrada | Framework academico citado |
| **I5** | **Umbrales que se auto-ajustan con garantias** | Ajuste **asimetrico**: endurecer es automatico, relajar exige confirmacion del usuario, con piso y techo duros | Responde al riesgo que el propio documento senala |
| **I6** | **Decisiones auditables y reproducibles** | Modelo transparente de pesos declarados + Monte Carlo con semilla | Requisito de un producto de riesgo |

## 5. Preguntas de investigacion abiertas

1. **?Que senales tienen poder predictivo real** sobre fallas de protocolos en Avalanche?
   -> El backtest con datos reales lo responde; hoy solo hay un dataset sintetico.
2. **?Cual es la relacion entre recall y falsos positivos** que resulta tolerable para un usuario?
   -> Requiere medir la molestia de un bloqueo incorrecto.
3. **?Como se evita que el ajuste automatico derive en relajacion** de la seguridad?
   -> Propuesta: ajuste asimetrico con piso duro; falta evaluarla empiricamente.
4. **?Se puede generalizar el puntaje entre cadenas** sin reentrenar?
   -> Abierto; afecta la escalabilidad del producto.

## 6. Metodologia de validacion

1. **Pruebas unitarias** del motor y de los contratos (incluidas en el repositorio).
2. **Backtesting** con 4 metricas: *recall*, *precision*, *tasa de falsos positivos* y
   **capital preservado vs. capital perdido**. Ver [`../docs/BACKTESTING.md`](../docs/BACKTESTING.md).
3. **Declaracion honesta de limites:** los resultados sobre datos sinteticos no son evidencia de
   desempeno real.

## 7. Referencias

| Referencia | Tipo | Estado |
|------------|------|--------|
| Documento de problematica del equipo (`problematica_agente_def-AVAX.docx`) | Documento provisto | Extraido a texto |
| Bases del bounty de Avalanche | Documento provisto | Extraido a texto |
| Framework 2025 (Parhizkari e Iannillo), ROC AUC 0.887 | Cita del documento | **Por verificar** |
| DefiLlama (perdidas >$2.100 M; $635 M en abril 2026) | Cita del documento | **Por verificar** |
| Regla 15c3-5 de la SEC - MiFID II | Cita del documento | Por verificar texto normativo |
| Documentacion de Avalanche y de Unlock | Web oficial | Consultado el 2026-09-11 |
