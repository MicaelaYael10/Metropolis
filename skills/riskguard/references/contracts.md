# Contracts

All contracts target Monad Testnet (10143). Deployment script: `script/DeployMonad.s.sol`.

| Contract | File | Role |
| --- | --- | --- |
| RiskGuard | `contracts/RiskGuard.sol` | On-chain policy gate; the only writer of AgentLog |
| ProtocolRegistry | `contracts/ProtocolRegistry.sol` | Registered protocols with risk scores |
| AgentLog | `contracts/AgentLog.sol` | Append-only decision log (allowed + blocked) |
| MockVault | `contracts/MockVault.sol` | Hermetic single-asset vault (ERC-4626-lite) |
| MockERC20 | `contracts/MockERC20.sol` | `mUSD` demo token with public mint |

## RiskGuard entry points used by the plugin

- `checkOperation(user, protocol, amount) -> (allowed, reasonCode, riskScore)` -- read-only verdict.
- `commitOperation(user, protocol, amount, rationaleHash)` -- reserve amount against caps.
- `recordRejection(user, protocol, amount, rationaleHash)` -- append a blocked decision.
- `policyOf(user)` / `exposure(user)` / `committedCount(user)` / `protocolsUsedBy(user)` -- policy state.
- `setPolicy(maxRiskScore, maxProtocols, maxPerProtocol, maxAmountPerOp)` -- write policy (Agent Wallet-signed).

## ProtocolRegistry entry points

- `getProtocol(addr)` / `list()` -- protocol struct + full list.
- `band(uint256 id)` mirrors the plugin client-side `riskBand`: 0 green (<30), 1 amber (30-60), 2 red (>60).

## AgentLog entry points

- `record(...)` -- writer-only (RiskGuard or owner).
- `entry(index)`, `entriesOf(user)`, `count()` -- read-only.

The viem ABIs are defined once in `plugin/src/lib/abi.ts` (`as const`) so reads use
literal function names and never need ABI re-declaration.