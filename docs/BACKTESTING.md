# Metodologia de backtesting

- **Fecha:** 2026-09-12
- **Estado:** Arnes implementado - **dataset real construido** (Avalanche, DefiLlama)
- **Resultado:** recall 32,14 % - precision 7,56 % - FPR 7,61 % (umbral 55) - **NO concluyente**

## Que se mide y por que no alcanza el "acertamos"

Un sistema de riesgo que bloquea todo acierta el 100 % de las fallas y arruina al usuario. Por eso
el backtest reporta **cuatro** metricas en tension:

| Metrica | Definicion | Que revela |
|---------|-----------|------------|
| **Recall** | Fallas bloqueadas / fallas totales | Cuanto riesgo evitamos |
| **Precision** | Fallas bloqueadas / bloqueos totales | Cuantos bloqueos eran necesarios |
| **Tasa de falsos positivos** | Sanos bloqueados / sanos totales | Cuanto dano colateral causamos |
| **Especificidad** | Sanos permitidos / sanos totales | Cuantas oportunidades no perdimos |

Y en terminos de dinero, que es lo que el usuario siente:

| Metrica | Definicion |
|---------|-----------|
| **Capital preservado** | Monto bloqueado que **despues si fallo** - la ganancia del sistema |
| **Capital perdido** | Monto permitido que **despues fallo** - el costo del sistema |

Reportar solo *recall* seria deshonesto. El informe imprime las cuatro.

## Como funciona el arnes

```text
dataset (snapshots historicos, con etiqueta real)
      |
      |--> scoring.js        puntua cada snapshot con las senales de ese momento
      |--> politica          aplica el umbral (score > maxRiskScore -> bloquea)
      `--> comparacion       contra la etiqueta `failedWithin90d` (lo que realmente paso)
                              |
                              `--> 4 metricas + capital preservado/perdido + cobertura
```

**Requisito clave:** el dataset debe traer la **etiqueta de resultado** (`failedWithin90d`). Sin
etiqueta no hay backtest, hay solo una lista de puntajes.

## Como correrlo

```powershell
pnpm run dataset:build     # descarga DefiLlama y escribe data/dataset-avalanche.json (real)
pnpm run backtest:real     # backtest sobre el dataset real + barrido de umbral
pnpm run backtest -- --dataset data/dataset-avalanche.json --threshold 45 --sweep
pnpm run backtest          # dataset SINTETICO (el informe lo advierte en pantalla)
```

El informe completo queda en `reports/backtest-<fecha>.json`, con la procedencia (`provenance`) y
la cobertura de senales (`coverage`) copiadas dentro para que las metricas sean trazables.

## Dataset real: que contiene

| Dato | Valor |
|------|-------|
| Snapshots | 1 474 |
| Protocolos | 38 (8 positivos, 30 negativos) |
| Positivos (fallaron <= 90 d) | 28 - 1,90 % del total |
| Ventana temporal | 60 meses |
| Fuente | DefiLlama `/protocols`, `/protocol/{slug}`, `/hacks` |
| Etiqueta | incidente real de `/hacks` en `(fecha, fecha + 90 d]` |

## Resultado real (umbral 55)

```text
Fallas bloqueadas      (bien)        9
Fallas permitidas      (mal)        19
Sanos bloqueados       (falso pos) 110
Sanos permitidos       (bien)     1336

recall             32,14 %      capital preservado   222 940 518
precision           7,56 %      capital perdido      377 817 743
tasa falsos pos.    7,61 %      en riesgo total  1 259 536 919 573
especificidad      92,39 %
```

### Curva de operacion

| Umbral | Recall | Precision | FPR | Especificidad | Bloqueos |
|-------:|-------:|----------:|----:|--------------:|---------:|
| 20 | 78,57 % | 2,11 % | 70,61 % | 29,39 % | 1 043 |
| 30 | 71,43 % | 3,00 % | 44,74 % | 55,26 % | 667 |
| 40 | 50,00 % | 4,08 % | 22,75 % | 77,25 % | 343 |
| 45 | 39,29 % | 4,44 % | 16,39 % | 83,61 % | 248 |
| **55** | **32,14 %** | **7,56 %** | **7,61 %** | **92,39 %** | **119** |
| 65 | 14,29 % | 10,00 % | 2,49 % | 97,51 % | 40 |
| 75 | 10,71 % | 25,00 % | 0,62 % | 99,38 % | 12 |

No existe un umbral bueno: la curva es plana en precision. **El modelo es debil con las senales
actuales.** Ese es el hallazgo, y es el motivo por el que el proyecto necesita el colector on-chain.

### Por que es debil: cobertura del 45,2 %

Solo estan disponibles las senales de DefiLlama. El modelo pesa 100 puntos, de los que:

| Senal | Cobertura en el dataset | Fuente |
|-------|------------------------:|--------|
| `tvlChange30d` | 99,6 % | DefiLlama |
| `tvlDrawdown90d` | 100 % | DefiLlama |
| `incidentCount` | 100 % | DefiLlama `/hacks` |
| `auditCount` | 94,9 % | DefiLlama |
| `chainConcentration` | 94,6 % | DefiLlama (aprox.) |
| `failedTxRate` | **0 %** | requiere RPC |
| `codeChangedDaysAgo` | **0 %** | requiere RPC |
| `adminTxCount30d` | **0 %** | requiere indexer |
| `topDepositorShare` | **0 %** | requiere indexer |
| `withdrawalSpikePct` | **0 %** | requiere indexer |

Las cinco senales ausentes son precisamente las que detectan el *estres* previo a un exploit
(retiros masivos, cambios de bytecode, actividad de la clave admin). Sin ellas, la mayoria de los
incidentes no deja rastro en los datos disponibles.

## Reglas de honestidad (aplicadas en el codigo)

1. **Una senal ausente no se rellena.** Se excluye y su peso se reparte entre las disponibles
   (`engine/scoring.js`). Rellenar con un valor neutro o pesimista *inventa* informacion.
2. **Se reporta la cobertura.** Si es < 60 % o hay < 10 positivos, el informe marca
   `dataQuality.conclusive = false` y lo explica. No se presentan metricas no concluyentes como
   resultados.
3. **La etiqueta es externa al modelo.** `failedWithin90d` sale de `/hacks`, no de las mismas
   senales que puntua el modelo.
4. **Nunca se presenta un resultado sintetico como real.** El CLI lo advierte en cada ejecucion.

## Limitaciones conocidas

| Limitacion | Efecto | Mitigacion |
|-----------|--------|-----------|
| Solo 8 protocolos positivos | Recall inestable | Se reporta `labels.failures` junto a la metrica |
| Ventana observable corta | Varios hackeos ocurrieron a los pocos dias de listarse el protocolo, sin snapshot previo | Se documenta; no se fuerza un positivo artificial |
| `chainConcentration` constante | Aproximacion con la composicion actual | Marcada con `~` en el esquema |
| Sin senales on-chain | Cobertura 45,2 % | Colector RPC pendiente (siguiente iteracion) |
| Sin control de `look-ahead` en `chainConcentration` | Fuga leve desde el presente | Documentada |

## Que falta para que el backtest sea concluyente

- [ ] **Colector on-chain** (`engine/onchain.js`): `failedTxRate` y `adminTxCount30d` via RPC de
      C-Chain; `topDepositorShare` y `withdrawalSpikePct` via indexer de eventos.
- [x] ~~Construir el dataset real~~ - hecho, `data/dataset-avalanche.json`.
- [ ] Ampliar la ventana a otras cadenas (Ethereum, BSC) para subir el numero de positivos.
- [ ] Congelar el umbral **antes** de correr el backtest definitivo y publicarlo con sus limites.
