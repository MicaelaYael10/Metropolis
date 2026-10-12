# mm-plugin-riskguard

RiskGuard as a plugin for the **MetaMask Agent Wallet** (`mm`). It lets an
autonomous agent (or a human) run DeFi supply / rebalance / DCA operations that
are **gated on-chain by RiskGuard** -- the contracts decide whether an operation
passes the wallet's risk policy. The plugin never touches keys: every state-changing
transaction is signed by the Agent Wallet and subject to host policy, MFA, and
spending controls.

Target network: **Monad Testnet (10143)**.

## Why a plugin

- **No key handling.** `submitContractCall` routes every tx through
  `ctx.walletExecutor`; the private key stays in the Agent Wallet.
- **No policy bypass.** The policy lives in `RiskGuard.sol` (on-chain), so an
  adversarial agent cannot edit or skip it.
- **Verifiable decisions.** Every operation (and every blocked operation) is
  appended to `AgentLog.sol` with a rationale hash derived from the human-readable
  rationale.

## Install

The plugin is beta on the Agent Wallet CLI. Build it first (`dist/` is not
committed), then install from the directory:

```bash
pnpm install
pnpm run build
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true   # local file: plugin
mm plugins install "file:$PWD/plugin" --accept-permissions
```

Full end-to-end setup (tool install, Agent Wallet login, deploy, faucet,
troubleshooting): [`../docs/SETUP.md`](../docs/SETUP.md).

## Configure

Point the plugin at the deployed contracts (the `DeployMonad` script prints these
addresses):

```bash
export RISKGUARD_GUARD_ADDRESS=0x...
export RISKGUARD_REGISTRY_ADDRESS=0x...
export RISKGUARD_AGENTLOG_ADDRESS=0x...
export RISKGUARD_TOKEN_ADDRESS=0x...
export RISKGUARD_VAULT_ADDRESS=0x...     # optional default vault
export RISKGUARD_CHAIN_ID=10143          # optional, defaults to Monad Testnet
export RISKGUARD_RPC_URL=https://testnet-rpc.monad.xyz   # read-only calls
```

## Commands

| Command | Read-only | Writes | Purpose |
| --- | --- | --- | --- |
| `mm riskguard protocols` | yes | -- | List registered protocols and risk scores |
| `mm riskguard check <protocol> <amount>` | yes | -- | Dry-run the policy verdict |
| `mm riskguard policy` | yes | -- | Read policy / exposure / committed ops |
| `mm riskguard policy --set ...` | | yes | Write a new policy on-chain |
| `mm riskguard supply <vault> <amount>` | | yes | Supply if allowed, else log rejection |
| `mm riskguard rebalance <from> <to> <amount>` | | yes | Withdraw then supply, policy-gated |
| `mm riskguard dca <vault> <total> --tranches 5` | | yes | Equal tranches, abort on any risky one |
| `mm riskguard log` | yes | -- | Recent decisions, including blocked ones |

All commands accept `--json` for machine-readable output. Pass the extra `--json`
flag to any of the above if the Agent Wallet CLI does not already forward it.

### Example flow

```bash
mm riskguard check 0xSafeVault... 100        # "allowed"
mm riskguard supply 0xSafeVault... 100       # approve + commitOperation + deposit
mm riskguard supply 0xRiskyVault... 100      # blocked -> recordRejection, no tx to vault
mm riskguard log                             # both decisions are visible on-chain
```

## How the on-chain gate works

`runSupply` (shared by `supply`, `rebalance`, `dca`) performs, in order:

1. `RiskGuard.checkOperation(user, protocol, amount)` -- a **view** call, so the
   verdict cannot be forged by the agent.
2. If **blocked**: `recordRejection(...)` is committed to `AgentLog`, and the
   operation stops (including the withdraw in `rebalance`, and the remaining
   tranches in `dca`).
3. If **allowed**: `commitOperation(...)` reserves the amount against the policy
   caps, then the token allowance is ensured, then the vault deposit is submitted.

Each write is a separate Agent Wallet transaction with a human-readable intent
(`lending.approve`, `lending.supply`, `lending.withdraw`), so the wallet shows a
clear summary for MFA / policy approval.

## Security notes

- `riskGuard:check` and `riskGuard:protocols` are read-only and never submit.
- `riskGuard:policy --set` is the only way to change the active policy, and it is
  itself an Agent Wallet-signed transaction.
- Read the addresses the plugin resolves at runtime in
  `plugin/src/lib/chains.ts`; set them only from trusted env sources.

## Development

```bash
pnpm install            # in plugin/
pnpm run type-check
pnpm run test           # builds, then runs node:test suites under dist/test
pnpm run build          # tsc + oclif manifest (writes oclif.manifest.json)
```

The `mm` block in `package.json` declares schema version, capabilities and
target chains; the generated `oclif.manifest.json` is committed.