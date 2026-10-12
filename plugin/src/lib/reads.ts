import type { PluginCommandContext } from "@metamask/agent-wallet/plugin";
import { createPublicClient, http, type Hex, type PublicClient } from "viem";
import {
  agentLogAbi,
  erc20Abi,
  mockVaultAbi,
  protocolRegistryAbi,
  riskGuardAbi,
} from "./abi.js";
import { resolveRpcUrl } from "./chains.js";

/**
 * The viem client used for read-only calls.
 *
 * Prefers a direct RPC (see `resolveRpcUrl`) because Agent Wallet's
 * `publicClient` proxy rejects non-relay-supported chains such as Monad
 * Testnet 10143. Falls back to the host client when no explicit RPC exists.
 */
function clientFor(ctx: PluginCommandContext, chainId: number): PublicClient {
  const rpcUrl = resolveRpcUrl(chainId);
  if (rpcUrl === undefined) return ctx.publicClient(chainId);
  return createPublicClient({ transport: http(rpcUrl) });
}

export type ProtocolView = {
  name: string;
  category: number;
  riskScore: number;
  confidence: number;
  updatedAt: bigint;
  evidenceHash: Hex;
  active: boolean;
  registered: boolean;
};

export type PolicyView = {
  maxRiskScore: number;
  maxProtocols: number;
  maxPerProtocol: bigint;
  maxAmountPerOp: bigint;
  active: boolean;
};

export type CheckView = {
  allowed: boolean;
  reasonCode: number;
  riskScore: number;
};

export type LogEntryView = {
  user: Hex;
  protocol: Hex;
  amount: bigint;
  riskScore: number;
  reasonCode: number;
  allowed: boolean;
  rationaleHash: Hex;
  timestamp: bigint;
};

export async function readProtocol(
  ctx: PluginCommandContext,
  chainId: number,
  registry: Hex,
  target: Hex,
): Promise<ProtocolView> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: registry,
    abi: protocolRegistryAbi,
    functionName: "getProtocol",
    args: [target],
  });
  return result as ProtocolView;
}

export async function readProtocolList(
  ctx: PluginCommandContext,
  chainId: number,
  registry: Hex,
): Promise<Hex[]> {
  const client = clientFor(ctx, chainId);
  const list = await client.readContract({
    address: registry,
    abi: protocolRegistryAbi,
    functionName: "list",
    args: [],
  });
  return list as readonly Hex[] as Hex[];
}

export async function readPolicy(
  ctx: PluginCommandContext,
  chainId: number,
  guard: Hex,
  user: Hex,
): Promise<PolicyView> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: guard,
    abi: riskGuardAbi,
    functionName: "policyOf",
    args: [user],
  });
  return result as PolicyView;
}

export async function readCheck(
  ctx: PluginCommandContext,
  chainId: number,
  guard: Hex,
  user: Hex,
  protocol: Hex,
  amount: bigint,
): Promise<CheckView> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: guard,
    abi: riskGuardAbi,
    functionName: "checkOperation",
    args: [user, protocol, amount],
  });
  const [allowed, reasonCode, riskScore] = result as unknown as [boolean, number, number];
  return { allowed, reasonCode, riskScore };
}

export async function readExposure(
  ctx: PluginCommandContext,
  chainId: number,
  guard: Hex,
  user: Hex,
): Promise<bigint> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: guard,
    abi: riskGuardAbi,
    functionName: "exposure",
    args: [user],
  });
  return result as bigint;
}

export async function readCommittedCount(
  ctx: PluginCommandContext,
  chainId: number,
  guard: Hex,
  user: Hex,
): Promise<bigint> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: guard,
    abi: riskGuardAbi,
    functionName: "committedCount",
    args: [user],
  });
  return result as bigint;
}

export async function readProtocolsUsed(
  ctx: PluginCommandContext,
  chainId: number,
  guard: Hex,
  user: Hex,
): Promise<Hex[]> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: guard,
    abi: riskGuardAbi,
    functionName: "protocolsUsedBy",
    args: [user],
  });
  return result as readonly Hex[] as Hex[];
}

export async function readTokenDecimals(
  ctx: PluginCommandContext,
  chainId: number,
  token: Hex,
): Promise<number> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals",
    args: [],
  });
  return Number(result as number);
}

export async function readTokenSymbol(
  ctx: PluginCommandContext,
  chainId: number,
  token: Hex,
): Promise<string> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "symbol",
    args: [],
  });
  return result as string;
}

export async function readAllowance(
  ctx: PluginCommandContext,
  chainId: number,
  token: Hex,
  owner: Hex,
  spender: Hex,
): Promise<bigint> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  return result as bigint;
}

export async function readVaultShares(
  ctx: PluginCommandContext,
  chainId: number,
  vault: Hex,
  user: Hex,
): Promise<bigint> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: vault,
    abi: mockVaultAbi,
    functionName: "sharesOf",
    args: [user],
  });
  return result as bigint;
}

export async function readVaultTotals(
  ctx: PluginCommandContext,
  chainId: number,
  vault: Hex,
): Promise<{ totalAssets: bigint; totalShares: bigint }> {
  const client = clientFor(ctx, chainId);
  const [totalAssets, totalShares] = await Promise.all([
    client.readContract({
      address: vault,
      abi: mockVaultAbi,
      functionName: "totalAssets",
      args: [],
    }),
    client.readContract({
      address: vault,
      abi: mockVaultAbi,
      functionName: "totalShares",
      args: [],
    }),
  ]);
  return { totalAssets: totalAssets as bigint, totalShares: totalShares as bigint };
}

export async function readVaultName(
  ctx: PluginCommandContext,
  chainId: number,
  vault: Hex,
): Promise<string> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: vault,
    abi: mockVaultAbi,
    functionName: "name",
    args: [],
  });
  return result as string;
}

export async function readLogEntry(
  ctx: PluginCommandContext,
  chainId: number,
  agentLog: Hex,
  index: bigint,
): Promise<LogEntryView> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: agentLog,
    abi: agentLogAbi,
    functionName: "entry",
    args: [index],
  });
  return result as LogEntryView;
}

export async function readLogCount(
  ctx: PluginCommandContext,
  chainId: number,
  agentLog: Hex,
): Promise<bigint> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: agentLog,
    abi: agentLogAbi,
    functionName: "count",
    args: [],
  });
  return result as bigint;
}

export async function readLogEntriesOf(
  ctx: PluginCommandContext,
  chainId: number,
  agentLog: Hex,
  user: Hex,
): Promise<bigint[]> {
  const client = clientFor(ctx, chainId);
  const result = await client.readContract({
    address: agentLog,
    abi: agentLogAbi,
    functionName: "entriesOf",
    args: [user],
  });
  return result as readonly bigint[] as bigint[];
}
