export type NavTab = 'home' | 'bridge' | 'swap' | 'ecosystem' | 'analytics' | 'docs';

export interface CryptoToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  color: string;
  gradient: string;
  network: string;
  description: string;
  marketCap: string;
  volume24h: string;
}

export interface BridgeRoute {
  fromNetwork: string;
  toNetwork: string;
  token: string;
  amount: string;
  estimatedFee: string;
  estimatedTime: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string;
  balanceEth: number;
  balanceSol: number;
  balanceUsdc: number;
  network: string;
}
