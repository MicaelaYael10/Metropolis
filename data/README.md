# Datos

## `protocols.json`

Protocolos a registrar en `ProtocolRegistry`. Cada entrada:

```json
{ "name": "Aave v3 Avalanche", "address": "0x...", "category": 1 }
```

`category`: `0` Staking - `1` Lending - `2` Liquidity - `3` Other

> **No inventar direcciones.** El script de despliegue omite las entradas sin direccion valida.
> Completarlas desde la documentacion oficial de cada protocolo y registrar la fuente.

---

## `dataset-avalanche.json` - dataset REAL de backtesting

Generado por `scripts/build-dataset.js` a partir de la **API publica de DefiLlama**.
Ver `meta.sources` dentro del propio fichero: cada fuente lleva URL y fecha de consulta.

```powershell
pnpm run dataset:build
```

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `--months` | 60 | Meses hacia atras en los que se toman snapshots |
| `--min-tvl` | 500000 | TVL minimo para que un protocolo entre como **negativo** |
| `--min-tvl-snapshot` | 100000 | TVL minimo para emitir un snapshot |
| `--max-negatives` | 30 | Tope de protocolos sanos |
| `--force` | - | Ignora la cache de `data/cache/` |

### Como se construye la verdad terreno

La etiqueta **no se inventa**. Se deriva de los incidentes reales de DefiLlama:

1. Se toman los incidentes de `/hacks` con `Avalanche` entre sus cadenas.
2. Se descartan los que no son protocolos DeFi (`targetType` = `CEX` / `Wallet` / `Chain` / `Token`),
   porque RiskGuard custodia capital en protocolos, no en exchanges centralizados.
3. Para cada incidente se resuelve un *slug* de DefiLlama (`defillamaId` -> nombre -> slug derivado)
   y se descarga su serie historica de TVL. **Un protocolo hackeado que ya desaparecio del catalogo
   sigue siendo un caso positivo valido**: sin el habria sesgo de supervivencia.
4. Los **negativos** son protocolos vivos de Avalanche con TVL relevante y categoria de deposito.
5. `failedWithin90d = true` si hubo un incidente real en `(fecha, fecha + 90 dias]`.

Los casos descartados quedan registrados en `incidentsRejected` con el motivo, no se silencian.

### Esquema de cada snapshot

| Campo | Tipo | Real | Descripcion |
|-------|------|:----:|-------------|
| `snapshotId` | string | [ok] | Identificador unico |
| `protocolId` | string | [ok] | Slug de DefiLlama |
| `protocolName` | string | [ok] | Nombre |
| `protocolAddress` | string \| null | [ok] | Direccion del contrato |
| `category` | string \| null | [ok] | Categoria DefiLlama |
| `chain` | string | [ok] | `Avalanche` |
| `role` | string | [ok] | `positivo` (sufrio incidente) o `negativo` |
| `date` | string | [ok] | `AAAA-MM-DD` |
| `tvlChange30d` | number \| null | [ok] | Variacion relativa de TVL en 30 dias |
| `tvlDrawdown90d` | number \| null | [ok] | Maxima caida desde el pico en 90 dias (0..1) |
| `auditCount` | number \| null | [ok] | Auditorias declaradas |
| `incidentCount` | number | [ok] | Incidentes registrados **antes** de la fecha |
| `chainConcentration` | number \| null | ~ | Peso de la mayor cadena (composicion actual) |
| `ageDays` | number \| null | [ok] | Dias desde `listedAt` |
| `failedTxRate` | null | [x] | Requiere colector on-chain |
| `codeChangedDaysAgo` | null | [x] | Requiere bytecode/proxy on-chain |
| `adminTxCount30d` | null | [x] | Requiere indexer de eventos |
| `topDepositorShare` | null | [x] | Requiere indexer de depositos |
| `withdrawalSpikePct` | null | [x] | Requiere indexer de retiros |
| `amountAtRisk` | number | [ok] | **TVL real** del protocolo en esa fecha (USD) |
| `failedWithin90d` | boolean | [ok] | **Etiqueta** |
| `futureIncident` | object \| null | [ok] | Detalle del incidente que etiqueta la fila |

**Las senales marcadas [x] van en `null` y no se rellenan con estimaciones.** El motor las excluye y
reparte su peso entre las disponibles (`engine/scoring.js`), reportando la cobertura resultante.
Con este dataset la cobertura es del **45,2 %** del peso total del modelo.

### Integridad del dato

- El TVL de un protocolo muerto **no se arrastra hacia adelante**: si su serie se corta, no se
  generan snapshots (guardia de obsolescencia de 7 dias en `valueAt`).
- `data/cache/` guarda las respuestas de DefiLlama para que el dataset sea reproducible sin red.
  Esta en `.gitignore` porque es material derivado y regenerable.
- `dataset-avalanche.json` **si se versiona**: es la evidencia del backtest.

## `dataset-avalanche-onchain.json` - dataset enriquecido

Generado por `scripts/collect-onchain.js`, partiendo del dataset real y sumando las
**5 senales on-chain** con Glacier Data API + RPC de C-Chain (`engine/onchain.js`).

```powershell
pnpm run collect:onchain -- --months 18 --max-snapshots 3 --window 30d
```

| Parametro | Por defecto | Descripcion |
|-----------|-------------|-------------|
| `--months` | 18 | Antiguedad maxima de los snapshots a enriquecer |
| `--max-snapshots` | 3 | Snapshots por protocolo (los mas recientes) |
| `--protocols` | todas | Lista separada por comas |
| `--window` | `30d` | Lapso del analisis (`1h`, `24h`, `7d`, `30d`...) |
| `--out` | `data/dataset-avalanche-onchain.json` | Salida |
| `--force` | - | Ignora la cache de Glacier |

- Solo se procesan direcciones que existen como **contrato en C-Chain** (se verifica con
  `eth_getCode`); las direcciones de otras cadenas (`arbitrum:0x...`) se descartan y quedan
  registradas en `meta.onchain.skipped`.
- Cada fila enriquecida guarda `onchainEvidence` (rango de bloques, conteos) y, si aplica,
  `onchainNotes` con el motivo por el que una senal no se pudo medir.
- **No cubre el 100 % de la historia**: enriquecer 1.474 snapshots de 2021-2026 exige un
  indexer sostenido. Por defecto se enriquecen los snapshots recientes (evaluacion en vivo).
- El dataset enriquecido **se versiona** como evidencia; la cache (`data/cache/glacier/`)
  queda ignorada.

## Dataset sintetico

Sin `--dataset`, `pnpm run backtest` usa `engine/synthetic.js`, un generador reproducible por
semilla. El propio informe lo advierte en pantalla: **los resultados sinteticos no son evidencia de
desempeno real**.
