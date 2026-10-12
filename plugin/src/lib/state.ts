import { CommandError } from "@metamask/agent-wallet/plugin";
import type { PluginCommandContext } from "@metamask/agent-wallet/plugin";
import type { Hex } from "viem";

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
