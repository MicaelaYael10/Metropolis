# Policy model

A policy is a per-user struct in `RiskGuard.sol`. The agent sets it via
`mm riskguard policy --set ...`; the tx is signed by the Agent Wallet.

## Fields

| Field | Type | Meaning | CLI flag |
| --- | --- | --- | --- |
| `maxRiskScore` | uint8 (0-100) | Highest allowed protocol risk score | `--max-risk-score` |
| `maxProtocols` | uint8 (1-50) | Max distinct protocols in use | `--max-protocols` |
| `maxPerProtocol` | uint256 | Exposure cap per protocol (token base units) | `--max-per-protocol` |
| `maxAmountPerOp` | uint256 | Max amount in a single operation | `--max-amount-per-op` |

Verification happens in this order inside `checkOperation`; the first failing
check decides the reason code (mirrored in `plugin/src/lib/reason.ts`):

| code | name | check |
| --- | --- | --- |
| 0 | OK | passed everything |
| 1 | NO_POLICY | no active policy for user |
| 2 | NOT_REGISTERED | protocol not in registry |
| 3 | NOT_ACTIVE | protocol registered but inactive |
| 4 | SCORE_TOO_HIGH | riskScore > maxRiskScore |
| 5 | PROTOCOL_CAP | exposure + amount > maxPerProtocol |
| 6 | TOO_MANY_PROTOCOLS | would exceed maxProtocols |
| 7 | AMOUNT_TOO_HIGH | amount > maxAmountPerOp |
| 8 | ZERO_AMOUNT | amount == 0 |

## Bands (client display only)

`green` < 30, `amber` 30-60, `red` > 60 -- matches `ProtocolRegistry.band`.

## Exposure lifecycle

`commitOperation` adds `amount` to `exposure` and bumps `committedCount`;
withdrawals (via `withdrawOperation`, not shown here) release exposure. A blocked
operation is appended to `AgentLog` via `recordRejection` but never touches the
vault.