import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { parseAmount } from "../../lib/amount.js";
import { resolveContracts, resolveVaultAddress } from "../../lib/chains.js";
import { runSupply, type SupplyOutcome } from "../../lib/ops.js";
import { readTokenDecimals, readTokenSymbol } from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";

const inputs = {
  vault: {
    type: InputFieldType.Text,
    flag: "vault",
    message: "Vault (protocol) address to supply",
    required: true,
    prompt: false,
    index: 0,
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Amount to supply (token units, e.g. 100)",
    required: true,
    prompt: false,
    index: 1,
  },
} satisfies InputSchema;

type SupplyResult = SupplyOutcome & {
  chainId: number;
  user: string;
  token: string;
};

export default class RiskguardSupplyCommand extends PluginCommand<SupplyResult> {
  static override description =
    "Supply tokens to a vault only if it passes the on-chain RiskGuard policy, otherwise log the rejection.";

  static override examples = [
    "<%= config.bin %> riskguard supply 0xVault... 100",
    "<%= config.bin %> riskguard supply --vault 0xVault... --amount 100 --json",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "riskguard:supply";

  async execute(io: CommandIO): Promise<SupplyResult> {
    const { vault, amount } = await io.resolveInputs(inputs);
    const contracts = resolveContracts();
    const { chainId, token } = contracts;
    const target = resolveVaultAddress(vault);
    const user = activeAddress(this.ctx);
    const [decimals, symbol] = await Promise.all([
      readTokenDecimals(this.ctx, chainId, token),
      readTokenSymbol(this.ctx, chainId, token),
    ]);
    const baseUnits = parseAmount(amount, decimals);

    const outcome = await runSupply(
      this.ctx,
      io,
      this.pluginCommandId,
      { contracts, user, tokenSymbol: symbol, tokenDecimals: decimals },
      target,
      baseUnits,
    );

    return { chainId, user, token, ...outcome };
  }
}
