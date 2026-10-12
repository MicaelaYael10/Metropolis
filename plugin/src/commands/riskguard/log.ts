import {
  type CommandIO,
  CommandError,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { resolveContracts } from "../../lib/chains.js";
import { reasonDescription, reasonName, riskBand } from "../../lib/reason.js";
import { readLogEntriesOf, readLogEntry } from "../../lib/reads.js";
import { activeAddress } from "../../lib/state.js";

const inputs = {
  limit: {
    type: InputFieldType.Text,
    flag: "limit",
    message: "How many recent decisions to show (1..100)",
    required: false,
    prompt: false,
  },
} satisfies InputSchema;

type LogRow = {
  index: string;
  protocol: string;
  amount: string;
  riskScore: number;
  band: "green" | "amber" | "red";
  allowed: boolean;
  reasonCode: number;
  reason: string;
  reasonDescription: string;
  rationaleHash: string;
  timestamp: string;
};

type LogResult = {
  chainId: number;
  user: string;
  total: number;
  returned: number;
  allowed: number;
  blocked: number;
  entries: LogRow[];
};

export default class RiskguardLogCommand extends PluginCommand<LogResult> {
  static override description =
    "Show this wallet's on-chain RiskGuard decision log, including blocked operations.";

  static override examples = [
    "<%= config.bin %> riskguard log",
    "<%= config.bin %> riskguard log --limit 25 --json",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  static override flags = schemaToFlags(inputs);

  protected readonly pluginCommandId = "riskguard:log";

  async execute(_io: CommandIO): Promise<LogResult> {
    const { limit } = await _io.resolveInputs(inputs);
    const parsedLimit = Number(limit ?? "10");
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new CommandError(
        "INVALID_INPUT",
        "--limit must be an integer between 1 and 100.",
        "Pass --limit 10.",
      );
    }

    const { chainId, agentLog } = resolveContracts();
    const user = activeAddress(this.ctx);
    const ids = await readLogEntriesOf(this.ctx, chainId, agentLog, user);
    const selected = ids.slice(Math.max(0, ids.length - parsedLimit)).reverse();

    const entries: LogRow[] = [];
    let allowed = 0;
    let blocked = 0;
    for (const id of selected) {
      const e = await readLogEntry(this.ctx, chainId, agentLog, id);
      if (e.allowed) {
        allowed += 1;
      } else {
        blocked += 1;
      }
      entries.push({
        index: id.toString(),
        protocol: e.protocol,
        amount: e.amount.toString(),
        riskScore: e.riskScore,
        band: riskBand(e.riskScore),
        allowed: e.allowed,
        reasonCode: e.reasonCode,
        reason: reasonName(e.reasonCode),
        reasonDescription: reasonDescription(e.reasonCode),
        rationaleHash: e.rationaleHash,
        timestamp: new Date(Number(e.timestamp) * 1000).toISOString(),
      });
    }

    return {
      chainId,
      user,
      total: ids.length,
      returned: entries.length,
      allowed,
      blocked,
      entries,
    };
  }
}
