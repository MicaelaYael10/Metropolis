import { http, createConfig } from "wagmi";
import { avalanche, avalancheFuji, monadTestnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [monadTestnet, avalancheFuji, avalanche],
  connectors: [injected()],
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
