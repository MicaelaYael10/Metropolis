import React, { useState } from 'react';
import { Wallet, ShieldCheck, CheckCircle2, ArrowRight, ExternalLink, Cpu } from 'lucide-react';
import { WalletState } from '../types';

interface CompatibleWalletsSectionProps {
  theme: 'dark' | 'light';
  wallet: WalletState;
  onConnectWallet: (provider: string) => void;
  onOpenWalletModal: () => void;
}

interface WalletItem {
  name: string;
  category: 'Browser Extension' | 'Mobile App' | 'Hardware' | 'Smart Account';
  supportedChains: string[];
  securityNote: string;
  popular?: boolean;
  avatarBg: string;
}

export const CompatibleWalletsSection: React.FC<CompatibleWalletsSectionProps> = ({
  theme,
  wallet,
  onConnectWallet,
  onOpenWalletModal,
}) => {
  const [activeCategory, setActiveCategory] = useState<'All' | 'Browser Extension' | 'Mobile App' | 'Hardware'>('All');

  const wallets: WalletItem[] = [
    {
      name: 'Phantom',
      category: 'Browser Extension',
      supportedChains: ['Solana', 'Ethereum', 'Polygon', 'Bitcoin'],
      securityNote: 'Multi-Chain Standard & Ledger Connected',
      popular: true,
      avatarBg: 'bg-gradient-to-tr from-purple-600 to-indigo-500',
    },
    {
      name: 'MetaMask',
      category: 'Browser Extension',
      supportedChains: ['Ethereum', 'Polygon', 'Arbitrum', 'Base'],
      securityNote: 'Snaps & EVM Standard Protocol',
      popular: true,
      avatarBg: 'bg-gradient-to-tr from-amber-600 to-orange-500',
    },
    {
      name: 'Coinbase Wallet',
      category: 'Smart Account',
      supportedChains: ['Base', 'Ethereum', 'Solana', 'Optimism'],
      securityNote: 'Passkey MPC Key Management',
      avatarBg: 'bg-gradient-to-tr from-blue-600 to-cyan-500',
    },
    {
      name: 'Trust Wallet',
      category: 'Mobile App',
      supportedChains: ['Solana', 'EVM Chains', 'Cosmos', '100+'],
      securityNote: 'Audited Multi-Currency Vault',
      avatarBg: 'bg-gradient-to-tr from-cyan-600 to-teal-500',
    },
    {
      name: 'Rabby Wallet',
      category: 'Browser Extension',
      supportedChains: ['All 140+ EVM Networks'],
      securityNote: 'Pre-Sign Transaction Simulation',
      avatarBg: 'bg-gradient-to-tr from-blue-500 to-indigo-600',
    },
    {
      name: 'Ledger Cold Storage',
      category: 'Hardware',
      supportedChains: ['Air-Gapped Multi-Asset Support'],
      securityNote: 'CC EAL5+ Secure Element Hardware',
      popular: true,
      avatarBg: 'bg-gradient-to-tr from-slate-700 to-slate-900',
    },
    {
      name: 'WalletConnect v2',
      category: 'Mobile App',
      supportedChains: ['Universal QR Bridge (450+ Wallets)'],
      securityNote: 'Relay Protocol Cryptographic Sessions',
      avatarBg: 'bg-gradient-to-tr from-sky-500 to-blue-600',
    },
    {
      name: 'Rainbow Wallet',
      category: 'Mobile App',
      supportedChains: ['Ethereum', 'Polygon', 'Arbitrum', 'Base'],
      securityNote: 'DeFi Focused Clean Visuals',
      avatarBg: 'bg-gradient-to-tr from-rose-500 to-amber-500',
    },
  ];

  const filteredWallets = wallets.filter(
    (w) => activeCategory === 'All' || w.category === activeCategory
  );

  const isDark = theme === 'dark';

  return (
    <section
      id="compatible-wallets-section"
      className="py-16 px-4 sm:px-6 max-w-6xl mx-auto transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/10 dark:border-white/10 light:border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-3 tracking-wide bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CRYPTOGRAPHIC SECURITY</span>
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-light tracking-tight font-['Space_Grotesk'] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Compatible <strong className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">Wallets</strong>
          </h2>
          <p className={`mt-2 text-sm max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Seamless connectivity through browser extensions, native iOS/Android mobile clients, air-gapped hardware, and Passkey smart accounts.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Browser Extension', 'Mobile App', 'Hardware'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeCategory === cat
                  ? isDark
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'bg-purple-50 text-purple-700 border border-purple-300 shadow-sm'
                  : isDark
                  ? 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/10'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {filteredWallets.map((item) => {
          const isCurrentWallet = wallet.isConnected && wallet.address.length > 0;

          return (
            <div
              key={item.name}
              className={`group relative rounded-2xl p-4 transition-all duration-300 border flex flex-col justify-between ${
                isDark
                  ? 'bg-[#0c0a20]/70 hover:bg-[#120e2e]/80 border-white/[0.08] hover:border-purple-400/40 shadow-sm hover:shadow-[0_4px_25px_rgba(168,85,247,0.15)]'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-purple-400/60 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl ${item.avatarBg} flex items-center justify-center font-bold text-xs text-white shadow-md`}
                    >
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {item.name}
                      </h3>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {item.popular && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      Popular
                    </span>
                  )}
                </div>

                <div className={`space-y-1.5 text-xs my-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                  <div>
                    <span className={`text-[10px] font-mono uppercase tracking-wider block mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Supported Ecosystems
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {item.supportedChains.map((ch) => (
                        <span
                          key={ch}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isDark
                              ? 'bg-white/[0.05] text-slate-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.securityNote}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onConnectWallet(item.name);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.05] hover:bg-purple-600/30 text-white border border-white/10 hover:border-purple-400/50'
                      : 'bg-slate-100 hover:bg-purple-50 text-slate-800 hover:text-purple-700 border border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Connect with {item.name}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
