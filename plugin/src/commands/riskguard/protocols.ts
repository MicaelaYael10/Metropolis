import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { resolveContracts } from "../../lib/chains.js";
import { categoryName, riskBand } from "../../lib/reason.js";
import { readProtocol, readProtocolList } from "../../lib/reads.js";

type ProtocolRow = {
  address: string;
  name: string;
  category: string;
  riskScore: number;
  confidence: number;
  band: "green" | "amber" | "red";
  active: boolean;
};

type ProtocolsResult = {
  chainId: number;
  registry: string;
  count: number;
  protocols: ProtocolRow[];
};

export default class RiskguardProtocolsCommand extends PluginCommand<ProtocolsResult> {
  static override description =
    "List DeFi protocols registered on-chain with their RiskGuard risk scores.";

  static override examples = [
    "<%= config.bin %> riskguard protocols",
    "<%= config.bin %> riskguard protocols --json",
  ];

  static override requiresAuth = true;
  static override requiresInit = true;

  protected readonly pluginCommandId = "riskguard:protocols";

  async execute(_io: CommandIO): Promise<ProtocolsResult> {
    const { chainId, registry } = resolveContracts();
    const addresses = await readProtocolList(this.ctx, chainId, registry);

    const protocols: ProtocolRow[] = [];
    for (const address of addresses) {
      const p = await readProtocol(this.ctx, chainId, registry, address);
      protocols.push({
        address,
        name: p.name,
        category: categoryName(p.category),
        riskScore: p.riskScore,
        confidence: p.confidence,
        band: riskBand(p.riskScore),
        active: p.active,
      });
    }

    return { chainId, registry, count: protocols.length, protocols };
  }
}
