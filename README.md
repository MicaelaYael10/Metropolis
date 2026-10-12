# RiskGuard - policy-gated DeFi for the MetaMask Agent Wallet

**MetaMask Agent Wallet bounty** - Target: **Monad Testnet (`10143`)**

RiskGuard is an on-chain risk gate for autonomous DeFi operations. An agent
proposes an operation; the `RiskGuard` contract decides, verifiably, whether it
matches the user's risk policy; the **MetaMask Agent Wallet** signs every
transaction. The agent cannot bypass the policy because the policy is not in the
agent's control - it lives on-chain.

The deliverable is `mm-plugin-riskguard`, an installable plugin for the Agent
Wallet CLI (`mm`), plus its [`skills/riskguard/SKILL.md`](skills/riskguard/SKILL.md).

## Bounty submission

**Trader-focused capabilities.** RiskGuard gives the Agent Wallet a *risk-gated
execution* superpower: an agent can supply/lend into DeFi vaults, rebalance away
from a risky protocol, and dollar-cost-average over several tranches, but every
operation is capped on-chain by a user-defined policy (max risk score, max
amount per operation, max exposure per protocol, max number of protocols). The
agent can propose; it cannot override the limits.

- **Agent instructions:** [`skills/riskguard/SKILL.md`](skills/riskguard/SKILL.md)
- **Setup guide:** [`docs/SETUP.md`](docs/SETUP.md)
- **Live demo:** Monad Testnet dashboard (Vercel URL TBD).
- **Demo video:** see the 5-minute script at the end of this README (video link TBD).

| Requirement | How RiskGuard meets it |
| --- | --- |
| Working, installable plugin | `mm plugins install "file:$PWD/plugin"`; `mm` block in `plugin/package.json` (schemaVersion, capabilities, targetChains) |
| All transactions via the Agent Wallet | `submitContractCall` in `plugin/src/lib/tx.ts` routes every write through `ctx.walletExecutor` |
| No bypass of signing / policy / MFA | signing, host policy and MFA are applied by the wallet per transaction; the risk policy is enforced by `RiskGuard.sol`, not the agent |
| No key or token handling | the plugin never reads or holds keys; reads use viem, writes use the executor |
| Auditable decisions | every operation -- approved **or blocked** -- is appended to `AgentLog.sol` |
| `skills/<name>/SKILL.md` | [`skills/riskguard/SKILL.md`](skills/riskguard/SKILL.md) |
| README + demo | this README + the 5-minute demo script below |
| Target chain | Monad Testnet (`10143`) |

This maps to the bounty's suggested areas: **#01** risk limits / outflow caps,
**#03** portfolio rebalancing, and **#04** strategy plugins (DCA).

## The problem

A person has idle stablecoins that could earn yield in DeFi, but:

1. They lack the technical skills to judge a protocol's risk.
2. The most visible signal deceives: a very high APY usually announces a
   problem, not an opportunity.
3. Risk is expensive and real. DeFi lending protocols have suffered billions in
   historical losses; incidents cluster around exactly the protocols that look
   the most attractive.

## The question it answers

> Which DeFi vault should the user's assets go into right now, and is it still
> safe over time?

RiskGuard is **not** a trading agent, does not predict prices, does not custody
funds, and does not give investment advice. It enforces a user-defined risk
policy, deterministically, on-chain.

## Why the Agent Wallet (and why a plugin)

| Requirement | How RiskGuard covers it |
| --- | --- |
| Agent must not hold or handle keys | Every state-changing call goes through `ctx.walletExecutor` in `plugin/src/lib/tx.ts`. The key never leaves the wallet; host policy, spending controls and MFA still apply per transaction. |
| Agent must not bypass the risk policy | The policy lives in `RiskGuard.sol`. `checkOperation` is a read; `commitOperation`/`recordRejection` are the only write paths and they apply the policy on-chain, not in a model the agent could edit. |
| Decisions must be auditable | Every operation - approved **or blocked** - is appended to `AgentLog.sol` with a rationale hash. |
| Human-readable, safe UX | Each tx carries an intent (`lending.approve`, `lending.supply`, `lending.withdraw`) so the wallet shows a clear summary for approval / MFA. |

## On-chain risk control (the core)

| Component | What it prevents |
| --- | --- |
| `RiskGuard.sol` | Operations that violate the user's policy never reach the vault |
| `ProtocolRegistry.sol` | The agent **cannot lie about risk**: scores are read from the contract |
| `AgentLog.sol` | A decision - approved or blocked - cannot go unrecorded |
| `MockVault.sol` / `MockERC20.sol` | Hermetic demo vaults for the Monad testbed (mUSD) |

A blocked operation is a **good** outcome: the plugin records a
`recordRejection` and the vulnerable asset transfer never fires (including the
withdraw in `rebalance` and the remaining tranches in `dca`).

## Architecture

```text
MetaMask Agent Wallet (mm)
   |  mm-plugin-riskguard (7 commands: protocols, check, policy,
   |     supply, rebalance, dca, log)
   |     -> risk guard view calls  (checkOperation, policyOf, ...)
   |     -> walletExecutor txs     (commitOperation, approve, deposit, ...)
   v
Monad Testnet (10143)
   RiskGuard -> ProtocolRegistry -> AgentLog
              -> MockVault (safe 18 / risky 82) + MockERC20 (mUSD)
```

The repo also ships a read-only web dashboard (`web/`) and the original
off-chain risk engine (`engine/`) from the earlier Avalanche build; both are
optional decoration for the demo, never a bypass of the on-chain gate.

## Repo layout

```text
|--- plugin/                        # mm-plugin-riskguard (the deliverable)
|   |--- src/lib/                   # chains, abi, reads, tx (walletExecutor), ops
|   |--- src/commands/riskguard/    # the 7 `mm riskguard ...` commands
|   |--- src/test/                  # node:test suites (viem-only)
|   `--- package.json               # mm block: schema, capabilities, chains
|--- skills/riskguard/              # SKILL.md + references (required by bounty)
|--- contracts/                     # RiskGuard, ProtocolRegistry, AgentLog,
|   |                               # MockVault, MockERC20 (Foundry)
|--- test/                          # Solidity tests (39)
|--- script/DeployMonad.s.sol       # Monad Testnet deploy + demo seeding
|--- engine/                        # CSBC scoring + Monte Carlo (pure JS)
|--- data/                          # datasets (Avalanche + Monad demo profiles)
|--- web/                           # policy dashboard (Vite + wagmi/viem)
|--- docs/                          # SETUP.md (from-scratch guide) + BACKTESTING.md
|--- x402/                          # ARCHIVED: paid-risk experiment (x402 SDK v2)
`--- lib/forge-std/                 # git submodule
```

## Quickstart

> For a complete walk-through (tool install, Agent Wallet login, key, faucet,
> troubleshooting), see [`docs/SETUP.md`](docs/SETUP.md).

### 1. Deploy the contracts on Monad Testnet

```sh
cp .env.example .env        # set PRIVATE_KEY, and AGENT_ADDRESS to fund mUSD
pnpm run deploy:monad       # forge script: deploys + seeds risk scores
```

The script prints ready-to-paste exports using the exact env names the plugin
reads (`RISKGUARD_GUARD_ADDRESS`, `RISKGUARD_REGISTRY_ADDRESS`,
`RISKGUARD_AGENTLOG_ADDRESS`, `RISKGUARD_TOKEN_ADDRESS`,
`RISKGUARD_VAULT_ADDRESS`).

### 2. Install the plugin in the Agent Wallet

```sh
pnpm run plugin:install     # plugin dependencies
pnpm run plugin:build       # dist/ is not committed, so build first
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true   # local file: plugin
mm plugins install "file:$PWD/plugin" --accept-permissions
# then export the RISKGUARD_* variables printed by DeployMonad
```

### 3. Drive the demo

```sh
mm riskguard protocols                          # safe 18 (green), risky 82 (red)
mm riskguard check <safe-vault> 100             # allowed
mm riskguard supply <safe-vault> 100            # approve + commitOperation + deposit
mm riskguard supply <risky-vault> 100           # blocked -> recordRejection
mm riskguard log                                # both decisions on-chain
mm riskguard rebalance <risky-vault> <safe-vault> 50
mm riskguard dca <safe-vault> 300 --tranches 3 --interval 30
mm riskguard policy --set --max-risk-score 40 --max-protocols 3 \
  --max-per-protocol 500 --max-amount-per-op 100
```

Full details: `plugin/README.md` and `skills/riskguard/SKILL.md`.

## Security model

- **No key handling.** `submitContractCall` routes every tx through the Agent
  Wallet executor; signing happens inside the wallet.
- **No policy bypass.** `checkOperation` is a view call; the plugin trusts its
  on-chain verdict and there is no client-side "pre-filter" that could diverge
  from it.
- **No silent retries.** After a block, `supply`/`rebalance`/`dca` stop. The
  only way to proceed with a riskier protocol is `riskguard policy --set`
  (itself an Agent Wallet-signed transaction).
- **Read-only commands** (`protocols`, `check`, `policy`, `log`) never submit.

## Testing

| Suite | Command | Result |
| --- | --- | --- |
| Solidity (foundry) | `forge test -vv` | 39/39 |
| Plugin lib (node:test) | `pnpm run plugin:test` | 15/15 |
| Risk engine | `pnpm run test:engine` | 52/52 |
| Local E2E (Anvil) | `pnpm run test:e2e` | Windows-only |
| ASCII lint | `pnpm run ascii` | clean |

### Running locally (contributors)

```sh
git clone --recurse-submodules https://github.com/MicaelaYael10/Metropolis.git
cd Metropolis
pnpm run plugin:install && pnpm run plugin:build   # dist/ is not versioned
```

- **No secrets in the repo.** `.env` and `broadcast/` are gitignored. Copy
  `.env.example` to `.env` and fill in your own values; never share
  `PRIVATE_KEY`.
- The plugin reads contract addresses from the `RISKGUARD_*` environment
  variables (see `docs/SETUP.md`, step 9). `.env` is **not** auto-loaded.
- `test:e2e` uses `taskkill` for cleanup, so it is Windows-only as written.

## Notes and honest limits

- The Monad demo uses **hermetic mock vaults**: the interesting logic is the
  policy gate itself, not the vaults.
- The risk engine's backtest on real Avalanche data is **not conclusive**
  (recall 32% at 45% signal coverage); it is kept for context, see
  `docs/BACKTESTING.md`.
- `x402/` is archived: the delivered flow pays nothing extra and routes
  everything through the Agent Wallet. See `x402/README.md`.
- The web app (`web/`) is the user-facing dashboard: it reads the on-chain
  state and can set the policy and commit/reject operations with a connected
  wallet. Agent-driven operations go through the plugin.

## Demo script (5 minutes)

| Time | What to show |
| --- | --- |
| 0:00-0:40 | The problem: idle capital + the high-APY trap |
| 0:40-1:30 | `mm riskguard protocols` and `check` for the safe vault |
| 1:30-2:20 | `mm riskguard supply` to the safe vault - note the Agent Wallet approval and MFA |
| 2:20-3:10 | `mm riskguard supply` to the risky vault - **blocked**, rejection logged on-chain |
| 3:10-4:00 | `mm riskguard log` shows both decisions; open the explorer links |
| 4:00-5:00 | `dca` (check policy applied per tranche) and `policy --set` as the user-facing control |
