import { CommandError } from "@metamask/agent-wallet/plugin";
import type { Hex } from "viem";

/** Monad Testnet. Agent Wallet ships this chain preconfigured (mm chains list). */
export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

/** Public Monad Testnet RPC used for on-chain reads when the host proxy cannot serve the chain. */
export const MONAD_TESTNET_RPC_URL = "https://testnet-rpc.monad.xyz";

function envValue(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return undefined;
  return raw.trim();
}

/**
 * RPC endpoint used for read-only contract calls.
 *
 * Agent Wallet's `publicClient` routes every chain through MetaMask's
 * `infura-service` proxy, which rejects chains that are not relay-supported
 * (Monad Testnet 10143 returns `400 Invalid chainId`). When an explicit RPC is
 * available we bypass the proxy and talk to the chain directly; otherwise we
 * return `undefined` so callers fall back to `ctx.publicClient`.
 */
export function resolveRpcUrl(chainId: number): string | undefined {
  const explicit = envValue("RISKGUARD_RPC_URL");
  if (explicit !== undefined) return explicit;
  if (chainId === MONAD_TESTNET_CHAIN_ID) return MONAD_TESTNET_RPC_URL;
  return undefined;
}

export function resolveChainId(): number {
  const raw = envValue("RISKGUARD_CHAIN_ID");
  if (raw === undefined) return MONAD_TESTNET_CHAIN_ID;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CommandError(
      "INVALID_CONFIG",
      `RISKGUARD_CHAIN_ID must be a positive integer, got "${raw}".`,
      "Unset it to default to Monad Testnet (10143).",
    );
  }
  return parsed;
}

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Read a required contract address from the environment, failing loudly when unset. */
export function resolveAddress(envName: string): Hex {
  const raw = envValue(envName);
  if (raw === undefined) {
    throw new CommandError(
      "MISSING_CONTRACT_ADDRESS",
      `${envName} is not set.`,
      `Export ${envName}=0x... (the DeployMonad script prints the addresses).`,
    );
  }
  if (!HEX_ADDRESS.test(raw)) {
    throw new CommandError(
      "INVALID_CONTRACT_ADDRESS",
      `${envName} is not a valid EVM address: "${raw}".`,
      `Export ${envName}=0x... (40 hex characters).`,
    );
  }
  return raw as Hex;
}

/** Validate an explicit, required address argument. */
export function parseAddress(value: string | undefined, label: string): Hex {
  const candidate = value?.trim();
  if (candidate === undefined || candidate === "") {
    throw new CommandError(
      "MISSING_ADDRESS",
      `Missing ${label} address.`,
      `Pass a 0x-prefixed 20-byte address for ${label}.`,
    );
  }
  if (!HEX_ADDRESS.test(candidate)) {
    throw new CommandError(
      "INVALID_ADDRESS",
      `${label} is not a valid EVM address: "${candidate}".`,
      `Pass a 0x-prefixed 20-byte address for ${label}.`,
    );
  }
  return candidate as Hex;
}

/** Accepts an explicit address argument or falls back to RISKGUARD_VAULT_ADDRESS. */
export function resolveVaultAddress(explicit: string | undefined): Hex {
  const candidate = explicit?.trim() ? explicit.trim() : envValue("RISKGUARD_VAULT_ADDRESS");
  if (candidate === undefined) {
    throw new CommandError(
      "MISSING_VAULT",
      "No vault address supplied.",
      "Pass the vault as the first positional argument or set RISKGUARD_VAULT_ADDRESS.",
    );
  }
  if (!HEX_ADDRESS.test(candidate)) {
    throw new CommandError(
      "INVALID_VAULT",
      `Vault is not a valid EVM address: "${candidate}".`,
      "Pass a 0x-prefixed 20-byte address.",
    );
  }
  return candidate as Hex;
}

export type Contracts = {
  chainId: number;
  riskGuard: Hex;
  registry: Hex;
  agentLog: Hex;
  token: Hex;
};

export function resolveContracts(): Contracts {
  return {
    chainId: resolveChainId(),
    riskGuard: resolveAddress("RISKGUARD_GUARD_ADDRESS"),
    registry: resolveAddress("RISKGUARD_REGISTRY_ADDRESS"),
    agentLog: resolveAddress("RISKGUARD_AGENTLOG_ADDRESS"),
    token: resolveAddress("RISKGUARD_TOKEN_ADDRESS"),
  };
}
