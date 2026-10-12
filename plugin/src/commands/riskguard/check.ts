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
import { reasonDescription, reasonName, riskBand } from "../../lib/reason.js";
import { readCheck, readPolicy, readTokenDecimals } from "../../lib/reads.js";
import type { PolicyView } from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";

const inputs = {
  protocol: {
    type: InputFieldType.Text,
    flag: "protocol",
    message: "Protocol/vault address to evaluate",
    required: true,
    prompt: false,
    index: 0,
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Amount to evaluate (token units, e.g. 100)",
    required: true,
    prompt: false,
    index: 1,
  },
} satisfies InputSchema;

type CheckResult = {
  chainId: number;
  user: string;
  protocol: string;
  amount: string;
  allowed: boolean;
  reasonCode: number;
  reason: string;
  reasonDescription: string;
  riskScore: number;
  band: "green" | "amber" | "red";
  policy: PolicyView | null;
};

export default class RiskguardCheckCommand extends PluginCommand<CheckResult> {
  static override description =
    "Dry-run the RiskGuard policy for an operation without sending any transaction.";

  static override examples = [
    "<%= config.bin %> riskguard check 0xVault... 100",
    "<%= config.bin %> riskguard check --protocol 0xVault... --amount 100 --json",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "riskguard:check";

  async execute(io: CommandIO): Promise<CheckResult> {
    const { protocol, amount } = await io.resolveInputs(inputs);
    const { chainId, riskGuard, token } = resolveContracts();
    const vault = resolveVaultAddress(protocol);
    const user = activeAddress(this.ctx);
    const decimals = await readTokenDecimals(this.ctx, chainId, token);
    const baseUnits = parseAmount(amount, decimals);

    const [check, policy] = await Promise.all([
      readCheck(this.ctx, chainId, riskGuard, user, vault, baseUnits),
      readPolicy(this.ctx, chainId, riskGuard, user),
    ]);

    return {
      chainId,
      user,
      protocol: vault,
      amount,
      allowed: check.allowed,
      reasonCode: check.reasonCode,
      reason: reasonName(check.reasonCode),
      reasonDescription: reasonDescription(check.reasonCode),
      riskScore: check.riskScore,
      band: riskBand(check.riskScore),
      policy: policy.active ? policy : null,
    };
  }
}
