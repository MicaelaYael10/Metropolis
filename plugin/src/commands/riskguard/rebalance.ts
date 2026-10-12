import {
  type CommandIO,
  CommandError,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import type { Hex } from "viem";
import { computeSharesForAssets, formatAmount, parseAmount } from "../../lib/amount.js";
import { mockVaultAbi } from "../../lib/abi.js";
import { parseAddress, resolveContracts } from "../../lib/chains.js";
import { runSupply, type SupplyOutcome } from "../../lib/ops.js";
import {
  readCheck,
  readTokenDecimals,
  readTokenSymbol,
  readVaultShares,
  readVaultTotals,
} from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";
import { submitContractCall, type TxOutcome } from "../../lib/tx.js";

const inputs = {
  from: {
    type: InputFieldType.Text,
    flag: "from",
    message: "Vault to withdraw from",
    required: true,
    prompt: false,
    index: 0,
  },
  to: {
    type: InputFieldType.Text,
    flag: "to",
    message: "Vault to supply into",
    required: true,
    prompt: false,
    index: 1,
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Asset amount to move (token units)",
    required: true,
    prompt: false,
    index: 2,
  },
} satisfies InputSchema;

type RebalanceResult = {
  chainId: number;
  user: string;
  token: string;
  status: "rebalanced" | "blocked";
  from: string;
  to: string;
  amount: string;
  shares: string;
  withdrawTx?: TxOutcome;
  supply: SupplyOutcome;
};

export default class RiskguardRebalanceCommand extends PluginCommand<RebalanceResult> {
  static override description =
    "Withdraw from one vault and supply into another, gated by the RiskGuard policy for the destination.";

  static override examples = [
    "<%= config.bin %> riskguard rebalance 0xFrom... 0xTo... 50",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "riskguard:rebalance";

  async execute(io: CommandIO): Promise<RebalanceResult> {
    const { from, to, amount } = await io.resolveInputs(inputs);
    const contracts = resolveContracts();
    const { chainId, token } = contracts;
    const fromVault = parseAddress(from, "from vault");
    const toVault = parseAddress(to, "to vault");
    const user = activeAddress(this.ctx);
    const [decimals, symbol] = await Promise.all([
      readTokenDecimals(this.ctx, chainId, token),
      readTokenSymbol(this.ctx, chainId, token),
    ]);
    const baseAmount = parseAmount(amount, decimals);

    const check = await readCheck(this.ctx, chainId, contracts.riskGuard, user, toVault, baseAmount);
    if (!check.allowed) {
      const outcome = await runSupply(
        this.ctx,
        io,
        this.pluginCommandId,
        { contracts, user, tokenSymbol: symbol, tokenDecimals: decimals },
        toVault,
        baseAmount,
      );
      return {
        chainId,
        user,
        token,
        status: "blocked",
        from: fromVault,
        to: toVault,
        amount,
        shares: "0",
        supply: outcome,
      };
    }

    const [{ totalAssets, totalShares }, held] = await Promise.all([
      readVaultTotals(this.ctx, chainId, fromVault),
      readVaultShares(this.ctx, chainId, fromVault, user),
    ]);
    const shares = computeSharesForAssets(baseAmount, totalAssets, totalShares);
    if (shares === 0n) {
      throw new CommandError(
        "INVALID_AMOUNT",
        "Computed withdrawal shares are zero.",
        "Increase the amount or check the source vault state.",
      );
    }
    if (held < shares) {
      throw new CommandError(
        "INSUFFICIENT_SHARES",
        `You hold ${formatAmount(held, decimals)} shares in the source vault, need ${formatAmount(shares, decimals)}.`,
        "Lower the amount to fit your position.",
      );
    }

    const withdrawTx = await submitContractCall(
      this.ctx,
      io,
      this.pluginCommandId,
      chainId,
      {
        to: fromVault,
        abi: mockVaultAbi,
        functionName: "withdraw",
        args: [shares],
      },
      {
        waitForReceipt: true,
        intent: {
          summary: `Withdraw ${amount} ${symbol} from vault`,
          action: "lending.withdraw",
          details: { vault: fromVault },
        },
      },
    );

    const supply = await runSupply(
      this.ctx,
      io,
      this.pluginCommandId,
      { contracts, user, tokenSymbol: symbol, tokenDecimals: decimals },
      toVault,
      baseAmount,
    );

    return {
      chainId,
      user,
      token,
      status: "rebalanced",
      from: fromVault,
      to: toVault,
      amount,
      shares: formatAmount(shares, decimals),
      withdrawTx,
      supply,
    };
  }
}
