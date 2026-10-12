# Setup: run RiskGuard from scratch

This guide walks a single operator through a full local setup of
`mm-plugin-riskguard` on **Windows** or **macOS/Linux**, using their **own**
deployment on **Monad Testnet (`10143`)**.

By the end you will have:

- the plugin installed in the MetaMask Agent Wallet CLI (`mm`), and
- a working `mm riskguard ...` flow (survey -> policy -> check -> supply -> log).

> The plugin signs nothing itself. Every state-changing call is routed through
> the Agent Wallet (`ctx.walletExecutor`); the wallet applies host policy and
> MFA. The risk policy itself lives on-chain in `RiskGuard.sol`.

---

## 1. Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | **22.18 or later** | the `mm` CLI requires Node 22.18+ |
| pnpm | 11+ | package manager (see `.npmrc`) |
| Foundry (`forge`, `cast`, `anvil`) | recent stable | compile/test/deploy Solidity |
| MetaMask Agent Wallet CLI (`mm`) | **>= 6.2.0** (7.x recommended) | plugin host |
| MetaMask Agent Wallet **Early Access** | - | required by `mm login` |
| Git | any | clone + submodule |

You also need **testnet MON** for gas on Monad (see step 5).

---

## 2. Install the tools

### Windows (PowerShell)

```powershell
# Node.js 22.18+: install from https://nodejs.org (LTS), then:
npm install -g pnpm

# Foundry (installs forge, cast, anvil):
irm https://foundry.paradigm.xyz | iex
foundryup

# MetaMask Agent Wallet CLI:
npm install -g @metamask/agent-wallet@latest

# Verify:
node -v ; pnpm -v ; forge --version ; mm doctor
```

### macOS / Linux (bash)

```bash
# Node.js 22.18+: use nvm/fnm or your installer, then:
npm install -g pnpm

# Foundry:
curl -L https://foundry.paradigm.xyz | bash
foundryup

# MetaMask Agent Wallet CLI:
npm install -g @metamask/agent-wallet@latest

# Verify:
node -v ; pnpm -v ; forge --version ; mm doctor
```

If `forge`/`cast`/`anvil` are not found after `foundryup`, open a new shell so
the updated `PATH` applies.

---

## 3. Clone the repository

The Solidity tests use `lib/forge-std`, which is a git submodule, so clone
recursively:

```bash
git clone --recurse-submodules https://github.com/MicaelaYael10/Metropolis.git
cd Metropolis
```

Use the branch that contains the plugin. Until it is merged into `main`, that
is `testing`:

```bash
git checkout testing
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

---

## 4. Set up the MetaMask Agent Wallet

```bash
mm login                            # Google/email link, or MetaMask Mobile QR
mm init --wallet server-wallet --mode guard
mm wallet address                   # <-- record this: it is your AGENT_ADDRESS
```

Then enable the plugin system (beta, off by default) and allow local
(unverified) plugin installs:

```bash
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
```

Notes:

- `mm login` needs an **Early Access** invite. Without it you cannot proceed.
- The server wallet keeps its key server-side (TEE); it is never exported. You
  do **not** generate this key yourself.
- `mm wallet address` is the address the plugin will act as. It must hold MON
  for gas and mUSD for the demo (steps 5-7).

---

## 5. Create a deploy key and get testnet MON

`forge script` needs a raw private key, which the Agent Wallet does not expose.
Create a dedicated deploy key:

```bash
cast wallet new        # prints Address + Private key -- keep the key secret
```

Now fund **two** addresses with testnet MON from the faucet
(<https://faucet.monad.xyz/>; alternatives: QuickNode, Alchemy, Chainlink):

1. the **deployer** address from `cast wallet new`, and
2. your **`mm wallet address`** (gas for the plugin's transactions).

Verify the balances:

```bash
cast balance <address> --rpc-url https://testnet-rpc.monad.xyz
```

---

## 6. Create `.env`

```bash
cp .env.example .env
```

Fill in at least:

```dotenv
PRIVATE_KEY=<deploy key from step 5>       # NEVER commit or share this
AGENT_ADDRESS=<your mm wallet address>     # receives 1000 mUSD on deploy
TARGET_NETWORK=monad
MONAD_TESTNET_RPC=https://testnet-rpc.monad.xyz
```

Leave the `RISKGUARD_*` values empty; the deploy in step 8 prints them.

Security: `.env` is gitignored. Never share it, and never paste
`PRIVATE_KEY`/`MNEMONIC` anywhere public.

---

## 7. Build and install the plugin

The plugin's `dist/` is **not** committed, so build it first:

```bash
pnpm run plugin:install     # install plugin dependencies
pnpm run plugin:build       # tsc + oclif manifest -> plugin/dist
mm plugins install "file:$PWD/plugin" --accept-permissions
mm plugins                  # confirm mm-plugin-riskguard is listed
```

On the consent screen, the plugin requests `wallet-read` and `wallet-submit`.
Transactions still route through Agent Wallet policy and MFA.

---

## 8. Deploy the contracts on Monad Testnet

```bash
pnpm run deploy:monad
```

This deploys `AgentLog`, `ProtocolRegistry`, `RiskGuard`, `mUSD` and two vaults
(safe = 18, risky = 82), mints **1000 mUSD** to `AGENT_ADDRESS`, and prints
ready-to-paste exports. Copy them into your `.env`:

```dotenv
RISKGUARD_GUARD_ADDRESS=0x...
RISKGUARD_REGISTRY_ADDRESS=0x...
RISKGUARD_AGENTLOG_ADDRESS=0x...
RISKGUARD_TOKEN_ADDRESS=0x...
RISKGUARD_VAULT_ADDRESS=0x...     # default (safe) vault
```

`RISKGUARD_VAULT_ADDRESS` (the safe vault) is optional: it is the default when
you omit the first argument. The risky vault address is printed on the
`RiskyVault:` line for the "blocked" demo.

---

## 9. Export the plugin variables in your shell

The plugin reads `process.env`; `.env` is **not** loaded automatically. Export
the addresses in the same terminal you run `mm` from.

### Windows (PowerShell)

```powershell
$env:RISKGUARD_GUARD_ADDRESS    = "0x..."
$env:RISKGUARD_REGISTRY_ADDRESS = "0x..."
$env:RISKGUARD_AGENTLOG_ADDRESS = "0x..."
$env:RISKGUARD_TOKEN_ADDRESS    = "0x..."
$env:RISKGUARD_VAULT_ADDRESS    = "0x..."   # safe vault
$env:RISKGUARD_CHAIN_ID         = "10143"
$env:RISKGUARD_RPC_URL          = "https://testnet-rpc.monad.xyz"
```

### macOS / Linux (bash)

```bash
export RISKGUARD_GUARD_ADDRESS=0x...
export RISKGUARD_REGISTRY_ADDRESS=0x...
export RISKGUARD_AGENTLOG_ADDRESS=0x...
export RISKGUARD_TOKEN_ADDRESS=0x...
export RISKGUARD_VAULT_ADDRESS=0x...        # safe vault
export RISKGUARD_CHAIN_ID=10143
export RISKGUARD_RPC_URL=https://testnet-rpc.monad.xyz
```

> `RISKGUARD_RPC_URL` makes read-only calls go straight to the Monad RPC. The
> Agent Wallet `publicClient` proxy rejects some non-relay-supported chains
> (`400 Invalid chainId`); the explicit RPC avoids that. This affects **reads
> only** -- writes always go through the Agent Wallet executor.

---

## 10. Run the flow

```bash
mm riskguard protocols                       # safe 18 (green), risky 82 (red)

# Set a policy for YOUR wallet (safe band):
mm riskguard policy --set --max-risk-score 40 --max-protocols 3 --max-per-protocol 500 --max-amount-per-op 100

mm riskguard check <safe-vault> 100          # allowed
mm riskguard check <risky-vault> 100         # blocked (reason 4)

mm riskguard supply <safe-vault> 100         # approve + commitOperation + deposit
mm riskguard supply <risky-vault> 100        # blocked -> recordRejection (no transfer)

mm riskguard log                             # both decisions, on-chain
```

Optional:

```bash
mm riskguard rebalance <risky-vault> <safe-vault> 50
mm riskguard dca <safe-vault> 300 --tranches 3 --interval 30
```

A **blocked** operation is the intended outcome: the vulnerable transfer never
fires and the rejection is recorded in `AgentLog.sol`.

---

## 11. Run the tests

```bash
forge test -vv            # 39 Solidity tests
pnpm run plugin:test      # builds, then 15 node:test tests
pnpm run test:engine      # 52 off-chain engine tests
pnpm run ascii            # ASCII lint
pnpm run test:e2e         # local Anvil E2E (Windows only, see below)
```

`test:e2e` spins up Anvil, deploys `script/Deploy.s.sol`, and walks the full
cycle without network or funds. Its cleanup uses `taskkill`, so it is
**Windows-only** as written.

---

## 12. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `RISKGUARD_GUARD_ADDRESS is not set.` | The plugin reads `process.env`; `.env` is not auto-loaded. Export the variables in the current shell (step 9). |
| `400 Invalid chainId` / reads fail | The Agent Wallet proxy does not relay Monad `10143`. Set `RISKGUARD_RPC_URL` (step 9). |
| `PLUGIN_UNVERIFIED_SOURCE` on install | Enable `mm config set experimentalAllowUnverifiedInstalls true`. |
| `mm riskguard` command missing | The plugin is not installed/built. Run `pnpm run plugin:build` then `mm plugins install "file:$PWD/plugin"`. |
| `mm` won't start | Node is too old. `mm` needs Node **22.18+**. |
| `test:e2e` fails on macOS/Linux | It uses `taskkill` (Windows). Not critical; use `forge test`/`plugin:test`. |
| `supply` reverts to vault | The policy blocked it earlier; check `mm riskguard log` and adjust the policy with `policy --set` (itself an Agent Wallet-signed tx). |

---

## Notes

- Everything is on-chain on **Monad Testnet (10143)**; MON and mUSD have no
  real value.
- The plugin never touches keys, and the risk policy cannot be edited by the
  agent: it is enforced by `RiskGuard.sol`.
- `.env` and `broadcast/` are local-only (gitignored) and must never be shared.
