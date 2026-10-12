export type Address = `0x${string}`;

export interface Deployment {
  riskGuard: Address;
  registry: Address;
  agentLog: Address;
  explorer: string;
  name: string;
}

/** Despliegues conocidos. El target de la demo es Monad Testnet (plugin mm). */
export const DEPLOYMENTS: Record<number, Deployment> = {
  10143: {
    name: "Monad Testnet",
    riskGuard: (import.meta.env.VITE_RISKGUARD_MONAD ?? "0x0000000000000000000000000000000000000000") as Address,
    registry: (import.meta.env.VITE_REGISTRY_MONAD ?? "0x0000000000000000000000000000000000000000") as Address,
    agentLog: (import.meta.env.VITE_AGENTLOG_MONAD ?? "0x0000000000000000000000000000000000000000") as Address,
    explorer: "https://testnet.monadexplorer.com",
  },
  43113: {
    name: "Avalanche Fuji (testnet, legacy)",
    riskGuard: "0xF3Cf73E668F33FB83476aD689170Eb9E0F2bf197",
    registry: "0xdefff21917B5Efbf6BAf85B597686B2DaB8dD135",
    agentLog: "0x26c59009A3b771aBCb6A14227E17763aA6b0Da36",
    explorer: "https://testnet.snowtrace.io",
  },
  43114: {
    name: "Avalanche C-Chain (mainnet)",
    riskGuard: (import.meta.env.VITE_RISKGUARD_MAINNET ?? "0x0000000000000000000000000000000000000000") as Address,
    registry: (import.meta.env.VITE_REGISTRY_MAINNET ?? "0x0000000000000000000000000000000000000000") as Address,
    agentLog: (import.meta.env.VITE_AGENTLOG_MAINNET ?? "0x0000000000000000000000000000000000000000") as Address,
    explorer: "https://snowtrace.io",
  },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(DEPLOYMENTS).map(Number);

export function deploymentFor(chainId?: number): Deployment {
  return (chainId && DEPLOYMENTS[chainId]) || DEPLOYMENTS[10143];
}

/** Codigos de motivo de RiskGuard.sol. */
export const REASON_CODES: Record<number, string> = {
  0: "Dentro de politica",
  1: "Sin politica definida",
  2: "Protocolo no registrado",
  3: "Protocolo inactivo",
  4: "Puntaje de riesgo demasiado alto",
  5: "Tope por protocolo alcanzado",
  6: "Demasiados protocolos distintos",
  7: "Monto por operacion demasiado alto",
  8: "Monto cero",
};

export const CATEGORIES = ["Staking", "Lending", "Liquidity", "Other"];
export const BAND_NAMES = ["verde", "ambar", "rojo"];

export function short(addr?: string): string {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
