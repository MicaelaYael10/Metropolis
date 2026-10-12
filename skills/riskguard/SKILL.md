---
name: riskguard
description: >-
  Risk-policy-gated DeFi supply, rebalance and DCA on Monad Testnet via the
  MetaMask Agent Wallet. Use when the user asks to lend, supply, withdraw,
  rebalance, dollar-cost-average, or set a risk policy, and all transactions
  must go through the Agent Wallet.
---

# RiskGuard: policy-gated DeFi for the Agent Wallet

RiskGuard is an on-chain risk gate for DeFi operations. The agent proposes an
operation; the `RiskGuard` contract decides, verifiably, whether it matches the
user's policy; the MetaMask Agent Wallet signs every transaction. The agent can
never bypass the policy because the policy is not in the agent's control.

This skill is implemented as the `mm-plugin-riskguard` plugin. All commands are
`mm riskguard ...` inside the Agent Wallet CLI.

## When to use

- Supply / lend tokens to a vault.
- Withdraw from a vault (rebalancing away from a riskier protocol).
- Dollar-cost average into a vault over several tranches.
- Inspect protocol risk scores, the current policy, or the decision log.

Never use raw keys, `cast send`, or an RPC signing tool for these operations.
The plugin already routes every write through the Agent Wallet executor.

## Prerequisites

1. Agent Wallet installed with the plugin:

   ```bash
   mm config set experimentalPlugins true
   mm plugins install "file:$PWD/plugin"
   ```

2. Contract addresses exported (output of `forge script script/DeployMonad.s.sol --rpc-url monad_testnet --broadcast`):

   ```bash
   export RISKGUARD_GUARD_ADDRESS=0x...
   export RISKGUARD_REGISTRY_ADDRESS=0x...
   export RISKGUARD_AGENTLOG_ADDRESS=0x...
   export RISKGUARD_TOKEN_ADDRESS=0x...
   export RISKGUARD_VAULT_ADDRESS=0x...   # optional default vault
   ```

3. A policy must exist for the wallet. If `mm riskguard policy` reports
   `active: false`, call `mm riskguard policy --set --max-risk-score 40 --max-protocols 3 --max-per-protocol 500 --max-amount-per-op 100`.

## Recommended workflow

1. **Survey.** `mm riskguard protocols` lists registered protocols with
   `riskScore` (0-100) and a `green`/`amber`/`red` band.
2. **Dry-run.** Before proposing, `mm riskguard check <protocol> <amount>`
   returns the exact verdict (`allowed` or the `reasonCode` the contract will
   return). Surf the band to the user: red-band protocols need an explicit user
   decision to lower the policy cap; do not silently proceed.
3. **Set policy first.** If the user explicitly asks for a riskier protocol,
   the only supported path is `mm riskguard policy --set ...` (itself an Agent
   Wallet-signed tx) followed by re-running the operation.
4. **Act.**
   - `mm riskguard supply <vault> <amount>`
   - `mm riskguard rebalance <from> <to> <amount>`
   - `mm riskguard dca <vault> <total> --tranches N --interval S`
5. **Report.** `mm riskguard log` shows the on-chain trail, including blocked
   operations (a blocked op is a *good* outcome -- a loss was avoided). Give the
   user the rationale and tx explorer links from the command output.

## Invariants (do not break these)

- Every state-changing call goes through `ctx.walletExecutor` in
  `plugin/src/lib/tx.ts`. Never construct raw signing calls.
- `checkOperation` is a read; the plugin trusts its result. Do not add a
  "pre-check" client-side filter that could diverge from the on-chain verdict.
- If the policy blocks an operation, the plugin records it with
  `recordRejection`; do not retry the operation (or the withdraw/DCA tranches)
  after a block unless the policy itself changed.
- The policy is changed only via `mm riskguard policy --set`; never suggest
  editing env addresses or contracts to bypass the gate.

## Command reference

| Command | Reads | Writes | Description |
| --- | --- | --- | --- |
| `riskguard protocols` | r | -- | List protocols + risk scores |
| `riskguard check <protocol> <amount>` | r | -- | Policy verdict for one op |
| `riskguard policy [--set --max-risk-score N --max-protocols N --max-per-protocol X --max-amount-per-op Y]` | r | w | Read / write policy |
| `riskguard supply <vault> <amount>` | r | w | Policy-gated supply |
| `riskguard rebalance <from> <to> <amount>` | r | w | Withdraw + policy-gated supply |
| `riskguard dca <vault> <total> --tranches N [--interval S]` | r | w | Split supply, abort on risk |
| `riskguard log [--limit N]` | r | -- | Decision history |

See `plugin/README.md` for install, environment variables and the exact button
sequence.