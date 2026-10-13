import { http, createConfig } from "wagmi";
import { avalanche, avalancheFuji, monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [monadTestnet, avalancheFuji, avalanche],
  connectors: [
    // Deterministic MetaMask fallback: targets MetaMask's own provider instead of
    // racing on window.ethereum, and stays available even if EIP-6963 discovery
    // misses MetaMask during store hydration. Also helps reconnect() restore the
    // MetaMask session. Hidden from the modal (it has no icon) but still usable.
    injected({ target: "metaMask" }),
    // Last-resort generic provider (any injected wallet). Shown only when no
    // EIP-6963 wallet with a logo is detected, so older wallets still work.
    injected(),
  ],
  transports: {
    [monadTestnet.id]: http(),
    [avalancheFuji.id]: http(),
    [avalanche.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

/** Marca de sesion persistida por la app (no por el conector). */
export const SESSION_KEY = "riskguard.session";
