import {
  type CommandIO,
  CommandError,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { parseAmount, formatAmount } from "../../lib/amount.js";
import { resolveContracts } from "../../lib/chains.js";
import { riskGuardAbi } from "../../lib/abi.js";
import {
  readCommittedCount,
  readExposure,
  readPolicy,
  readProtocolsUsed,
  readTokenDecimals,
  readTokenSymbol,
} from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";
import { submitContractCall } from "../../lib/tx.js";

const inputs = {
  set: {
    type: InputFieldType.Boolean,
    flag: "set",
    message: "Write a new risk policy on-chain",
    required: false,
    default: false,
  },
  maxRiskScore: {
    type: InputFieldType.Text,
    flag: "max-risk-score",
    message: "Maximum protocol risk score (0..100)",
    required: false,
    prompt: false,
  },
  maxProtocols: {
    type: InputFieldType.Text,
    flag: "max-protocols",
    message: "Maximum distinct protocols (1..50)",
    required: false,
    prompt: false,
  },
  maxPerProtocol: {
    type: InputFieldType.Text,
    flag: "max-per-protocol",
    message: "Exposure cap per protocol (token units)",
    required: false,
    prompt: false,
  },
  maxAmountPerOp: {
    type: InputFieldType.Text,
    flag: "max-amount-per-op",
    message: "Maximum amount per operation (token units)",
    required: false,
    prompt: false,
  },
} satisfies InputSchema;

type PolicyResult = {
  chainId: number;
  user: string;
  status: "read" | "written";
  policy: {
    active: boolean;
    maxRiskScore: number;
    maxProtocols: number;
    maxPerProtocol: string;
    maxAmountPerOp: string;
  } | null;
  exposure?: string;
  committedCount?: string;
  protocolsUsed?: string[];
  tx?: { hash: string; status: string; explorerUrl: string };
};

function parseInteger(raw: string | undefined, label: string, min: number, max: number): number {
  const value = raw?.trim();
  if (value === undefined || value === "") {
    throw new CommandError(
      "MISSING_INPUT",
      `Missing --${label}.`,
      `Provide --${label} between ${min} and ${max}.`,
    );
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new CommandError(
      "INVALID_INPUT",
      `--${label} must be an integer between ${min} and ${max}.`,
      `Provide --${label} between ${min} and ${max}.`,
    );
  }
  return parsed;
}

export default class RiskguardPolicyCommand extends PluginCommand<PolicyResult> {
  static override description =
    "Read the caller's RiskGuard policy, or write a new one with --set.";

  static override examples = [
    "<%= config.bin %> riskguard policy",
    "<%= config.bin %> riskguard policy --set --max-risk-score 40 --max-protocols 3 --max-per-protocol 500 --max-amount-per-op 100",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);

  protected readonly pluginCommandId = "riskguard:policy";

  async execute(io: CommandIO): Promise<PolicyResult> {
    const flags = await io.resolveInputs(inputs);
    const { chainId, riskGuard, token } = resolveContracts();
    const user = activeAddress(this.ctx);
    const decimals = await readTokenDecimals(this.ctx, chainId, token);
    const symbol = await readTokenSymbol(this.ctx, chainId, token);

    if (flags.set) {
      const maxRiskScore = parseInteger(flags.maxRiskScore, "max-risk-score", 0, 100);
      const maxProtocols = parseInteger(flags.maxProtocols, "max-protocols", 1, 50);
      const maxPerProtocol = parseAmount(flags.maxPerProtocol, decimals, "max-per-protocol");
      const maxAmountPerOp = parseAmount(flags.maxAmountPerOp, decimals, "max-amount-per-op");

      const tx = await submitContractCall(
        this.ctx,
        io,
        this.pluginCommandId,
        chainId,
        {
          to: riskGuard,
          abi: riskGuardAbi,
          functionName: "setPolicy",
          args: [maxRiskScore, maxProtocols, maxPerProtocol, maxAmountPerOp],
        },
        {
          waitForReceipt: true,
          intent: {
            summary: `Set RiskGuard policy (risk<=${maxRiskScore}, ops<=${flags.maxAmountPerOp} ${symbol})`,
            action: "call",
          },
        },
      );

      return {
        chainId,
        user,
        status: "written",
        policy: {
          active: true,
          maxRiskScore,
          maxProtocols,
          maxPerProtocol: formatAmount(maxPerProtocol, decimals),
          maxAmountPerOp: formatAmount(maxAmountPerOp, decimals),
        },
        tx,
      };
    }

    const [policy, exposure, committedCount, protocolsUsed] = await Promise.all([
      readPolicy(this.ctx, chainId, riskGuard, user),
      readExposure(this.ctx, chainId, riskGuard, user),
      readCommittedCount(this.ctx, chainId, riskGuard, user),
      readProtocolsUsed(this.ctx, chainId, riskGuard, user),
    ]);

    return {
      chainId,
      user,
      status: "read",
      policy: policy.active
        ? {
            active: true,
            maxRiskScore: policy.maxRiskScore,
            maxProtocols: policy.maxProtocols,
            maxPerProtocol: formatAmount(policy.maxPerProtocol, decimals),
            maxAmountPerOp: formatAmount(policy.maxAmountPerOp, decimals),
          }
        : null,
      exposure: formatAmount(exposure, decimals),
      committedCount: committedCount.toString(),
      protocolsUsed,
    };
  }
}
