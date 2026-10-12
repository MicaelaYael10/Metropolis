import { CommandError } from "@metamask/agent-wallet/plugin";
import type { PluginCommandContext } from "@metamask/agent-wallet/plugin";
import type { Hex } from "viem";
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_RPC_URL } from "./chains.js";

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

type WalletLike = { address: string; name?: string; id?: string };

function refField(ref: unknown, key: "address" | "name" | "id"): string | undefined {
  if (ref && typeof ref === "object" && key in ref) {
    const value = (ref as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * Resolve the wallet the user is acting as. Prefers the explicitly selected
 * wallet, then the first BYOK/remote wallet. Never touches the mnemonic.
 */
export function activeAddress(ctx: PluginCommandContext): Hex {
  const state = ctx.walletStateManager.read();
  const wallets: WalletLike[] = [...state.byokWallets, ...state.remoteWallets].map((w) => ({
    address: w.address,
    name: w.name,
    id: "id" in w ? String((w as { id: unknown }).id) : undefined,
  }));

  const ref = state.selectedWallet?.ref;
  const byAddress = refField(ref, "address");
  const byName = refField(ref, "name");
  const byId = refField(ref, "id");

  const match =
    (byAddress && wallets.find((w) => w.address.toLowerCase() === byAddress.toLowerCase())) ||
    (byName && wallets.find((w) => w.name === byName)) ||
    (byId && wallets.find((w) => w.id === byId)) ||
    wallets[0];

  if (!match || !HEX_ADDRESS.test(match.address)) {
    throw new CommandError(
      "NO_WALLET",
      "No usable EVM wallet found in Agent Wallet state.",
      "Create or select a wallet first: mm wallet create / mm wallet select.",
    );
  }
  return match.address as Hex;
}

type CustomChainLike = { chainId?: number | string };

/**
 * Guard every write before it reaches the executor.
 *
 * The Agent Wallet gateway only estimates gas for relay-supported chains. Monad
 * Testnet (10143) is in the CLI registry but not relay-supported, so the CLI
 * needs a `customEvmChains` entry with an explicit `rpcTarget` to estimate gas
 * locally. Without it, `walletExecutor` fails late with a cryptic
 * `Invalid chainId` gas-estimation error. Fail early with a fix instead.
 */
export function assertChainEstimable(ctx: PluginCommandContext, chainId: number): void {
  if (chainId !== MONAD_TESTNET_CHAIN_ID) return;

  const state = ctx.walletStateManager.read() as { customEvmChains?: CustomChainLike[] };
  const chains = state.customEvmChains ?? [];
  const registered = chains.some((chain) => Number(chain.chainId) === chainId);
  if (registered) return;

  throw new CommandError(
    "CHAIN_NOT_REGISTERED",
    `Monad Testnet (${chainId}) is not registered as a custom chain, so Agent Wallet cannot estimate gas for this transaction.`,
    `Add a customEvmChains entry for chainId ${chainId} with rpcTarget ${MONAD_TESTNET_RPC_URL} to ~/.metamask/wallets.json (see docs/SETUP.md, step 4).`,
  );
}
