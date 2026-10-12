import { http, createConfig } from "wagmi";
import { avalanche, avalancheFuji, monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [monadTestnet, avalancheFuji, avalanche],
  connectors: [
    // Explicit targets act as deterministic fallbacks: they locate the wallet's
    // own provider instead of racing on window.ethereum, and stay available even
    // if EIP-6963 discovery misses the wallet during store hydration.
    injected({ target: "metaMask" }),
    injected({ target: "coinbaseWallet" }),
    injected({ target: { id: "io.rabby", name: "Rabby", provider: "isRabby" } }),
    // Last-resort generic provider (any injected wallet). Kept for older wallets
    // that do not announce via EIP-6963.
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
