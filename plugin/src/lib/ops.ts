import type { CommandIO, PluginCommandContext } from "@metamask/agent-wallet/plugin";
import type { Hex } from "viem";
import { keccak256, toHex } from "viem";
import { erc20Abi, mockVaultAbi, riskGuardAbi } from "./abi.js";
import type { Contracts } from "./chains.js";
import { formatAmount } from "./amount.js";
import { reasonDescription, reasonName } from "./reason.js";
import { readAllowance, readCheck } from "./reads.js";
import { submitContractCall, type TxOutcome } from "./tx.js";

export type SupplyOutcome = {
  status: "supplied" | "blocked";
  vault: Hex;
  amount: string;
  amountBaseUnits: string;
  riskScore: number;
  reasonCode: number;
  reason: string;
  reasonDescription: string;
  rationale: string;
  rationaleHash: Hex;
  txs: {
    rejection?: TxOutcome;
    commit?: TxOutcome;
    approval?: TxOutcome;
    deposit?: TxOutcome;
  };
};

export type SupplyContext = {
  contracts: Contracts;
  user: Hex;
  tokenSymbol: string;
  tokenDecimals: number;
};

/**
 * The RiskGuard supply primitive, shared by `supply`, `rebalance` and `dca`:
 *
 *  1. Read the on-chain policy verdict (the agent cannot lie about risk).
 *  2. If blocked, record the avoided loss with `recordRejection`.
 *  3. If allowed, commit the operation, ensure the ERC-20 allowance, deposit.
 *
 * Every state-changing step goes through the Agent Wallet executor, so policy
 * and MFA still apply; the plugin only decides *whether* to propose.
 */
export async function runSupply(
  ctx: PluginCommandContext,
  io: CommandIO,
  source: string,
  sc: SupplyContext,
  vault: Hex,
  amount: bigint,
): Promise<SupplyOutcome> {
  const { contracts, user, tokenDecimals } = sc;
  const human = formatAmount(amount, tokenDecimals);
  const check = await readCheck(ctx, contracts.chainId, contracts.riskGuard, user, vault, amount);

  if (!check.allowed) {
    const rationale = `blocked supply of ${human} ${sc.tokenSymbol} to ${vault} (risk=${check.riskScore}, reason=${reasonName(check.reasonCode)})`;
    const rationaleHash = keccak256(toHex(rationale));
    io.emit(`RiskGuard BLOCKED: ${reasonDescription(check.reasonCode)}`);
    const rejection = await submitContractCall(
      ctx,
      io,
      source,
      contracts.chainId,
      {
        to: contracts.riskGuard,
        abi: riskGuardAbi,
        functionName: "recordRejection",
        args: [user, vault, amount, rationaleHash],
      },
      {
        waitForReceipt: true,
        intent: {
          summary: `Record blocked operation (${human} ${sc.tokenSymbol})`,
          action: "call",
          details: { protocol: vault, reason: reasonName(check.reasonCode) },
        },
      },
    );
    return {
      status: "blocked",
      vault,
      amount: human,
      amountBaseUnits: amount.toString(),
      riskScore: check.riskScore,
      reasonCode: check.reasonCode,
      reason: reasonName(check.reasonCode),
      reasonDescription: reasonDescription(check.reasonCode),
      rationale,
      rationaleHash,
      txs: { rejection },
    };
  }

  const rationale = `approved supply of ${human} ${sc.tokenSymbol} to ${vault} (risk=${check.riskScore})`;
  const rationaleHash = keccak256(toHex(rationale));

  const commit = await submitContractCall(
    ctx,
    io,
    source,
    contracts.chainId,
    {
      to: contracts.riskGuard,
      abi: riskGuardAbi,
      functionName: "commitOperation",
      args: [user, vault, amount, rationaleHash],
    },
    {
      waitForReceipt: true,
      intent: {
        summary: `Commit operation under risk policy (${human} ${sc.tokenSymbol})`,
        action: "call",
        details: { protocol: vault, riskScore: String(check.riskScore) },
      },
    },
  );

  let approval: TxOutcome | undefined;
  const allowance = await readAllowance(ctx, contracts.chainId, contracts.token, user, vault);
  if (allowance < amount) {
    io.emit(`Approving ${human} ${sc.tokenSymbol} for vault ${vault}...`);
    approval = await submitContractCall(
      ctx,
      io,
      source,
      contracts.chainId,
      {
        to: contracts.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [vault, amount],
      },
      {
        waitForReceipt: true,
        intent: {
          summary: `Approve ${human} ${sc.tokenSymbol}`,
          action: "lending.approve",
          details: { spender: vault },
        },
      },
    );
  }

  const deposit = await submitContractCall(
    ctx,
    io,
    source,
    contracts.chainId,
    {
      to: vault,
      abi: mockVaultAbi,
      functionName: "deposit",
      args: [amount],
    },
    {
      waitForReceipt: true,
      intent: {
        summary: `Supply ${human} ${sc.tokenSymbol} to vault`,
        action: "lending.supply",
        details: { vault, riskScore: String(check.riskScore) },
      },
    },
  );

  return {
    status: "supplied",
    vault,
    amount: human,
    amountBaseUnits: amount.toString(),
    riskScore: check.riskScore,
    reasonCode: check.reasonCode,
    reason: reasonName(check.reasonCode),
    reasonDescription: reasonDescription(check.reasonCode),
    rationale,
    rationaleHash,
    txs: { commit, approval, deposit },
  };
}
