import {
  type CommandIO,
  CommandError,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { parseAmount, splitAmount } from "../../lib/amount.js";
import { resolveContracts, resolveVaultAddress } from "../../lib/chains.js";
import { runSupply, type SupplyOutcome } from "../../lib/ops.js";
import { readTokenDecimals, readTokenSymbol } from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";
import { abortableSleep } from "../../lib/tx.js";

const inputs = {
  vault: {
    type: InputFieldType.Text,
    flag: "vault",
    message: "Vault (protocol) address to supply",
    required: true,
    prompt: false,
    index: 0,
  },
  total: {
    type: InputFieldType.Text,
    flag: "total",
    message: "Total amount to split across tranches (token units)",
    required: true,
    prompt: false,
    index: 1,
  },
  tranches: {
    type: InputFieldType.Text,
    flag: "tranches",
    message: "Number of tranches (1..20)",
    required: false,
    prompt: false,
  },
  interval: {
    type: InputFieldType.Text,
    flag: "interval",
    message: "Seconds to wait between tranches (0..86400)",
    required: false,
    prompt: false,
  },
} satisfies InputSchema;

type DcaResult = {
  chainId: number;
  user: string;
  token: string;
  vault: string;
  total: string;
  status: "completed" | "halted";
  tranches: number;
  intervalSeconds: number;
  operations: SupplyOutcome[];
};

function parseInteger(raw: string, label: string, min: number, max: number): number {
  const value = raw.trim();
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

export default class RiskguardDcaCommand extends PluginCommand<DcaResult> {
  static override description =
    "Supply a total amount to a vault in equal tranches. Aborts before any risky tranche.";

  static override examples = [
    "<%= config.bin %> riskguard dca 0xVault... 300 --tranches 3 --interval 30",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);

  protected readonly pluginCommandId = "riskguard:dca";

  async execute(io: CommandIO): Promise<DcaResult> {
    const { vault, total, tranches, interval } = await io.resolveInputs(inputs);
    const contracts = resolveContracts();
    const { chainId, token } = contracts;
    const target = resolveVaultAddress(vault);
    const user = activeAddress(this.ctx);
    const [decimals, symbol] = await Promise.all([
      readTokenDecimals(this.ctx, chainId, token),
      readTokenSymbol(this.ctx, chainId, token),
    ]);

    const count = parseInteger(tranches ?? "3", "tranches", 1, 20);
    const intervalSeconds = parseInteger(interval ?? "0", "interval", 0, 86400);
    const baseTotal = parseAmount(total, decimals);
    if (baseTotal < BigInt(count)) {
      throw new CommandError(
        "INVALID_INPUT",
        `Amount is too small to split into ${count} tranches.`,
        "Increase --total or reduce --tranches.",
      );
    }

    const amounts = splitAmount(baseTotal, count);
    const operations: SupplyOutcome[] = [];
    let status: DcaResult["status"] = "completed";

    for (let i = 0; i < amounts.length; i += 1) {
      const outcome = await runSupply(
        this.ctx,
        io,
        this.pluginCommandId,
        { contracts, user, tokenSymbol: symbol, tokenDecimals: decimals },
        target,
        amounts[i],
      );
      operations.push(outcome);
      io.emit(`Tranche ${i + 1}/${count}: ${outcome.status}`);
      if (outcome.status === "blocked") {
        status = "halted";
        break;
      }
      if (intervalSeconds > 0 && i < amounts.length - 1) {
        await abortableSleep(intervalSeconds * 1000, io.signal);
      }
    }

    return {
      chainId,
      user,
      token,
      vault: target,
      total,
      status,
      tranches: operations.length,
      intervalSeconds,
      operations,
    };
  }
}
