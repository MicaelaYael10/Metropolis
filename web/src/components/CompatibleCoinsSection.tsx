import React, { useState } from 'react';
import { Search, Sparkles, Zap, Shield, ArrowUpRight, Check } from 'lucide-react';

interface CompatibleCoinsSectionProps {
  theme: 'dark' | 'light';
  onSelectCoin: (symbol: 'USDC' | 'SOL' | 'POLYGON') => void;
  onOpenSwap: () => void;
}

interface CoinInfo {
  symbol: string;
  name: string;
  network: string;
  type: 'L1' | 'L2' | 'Stablecoin' | 'Store of Value';
  finality: string;
  avgFee: string;
  status: 'Active' | 'Optimal';
  color: string;
  bgGlow: string;
  isInspectable?: boolean;
}

export const CompatibleCoinsSection: React.FC<CompatibleCoinsSectionProps> = ({
  theme,
  onSelectCoin,
  onOpenSwap,
}) => {
  const [filter, setFilter] = useState<'All' | 'L1' | 'L2' | 'Stablecoin'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const coins: CoinInfo[] = [
    {
      symbol: 'SOL',
      name: 'Solana',
      network: 'Solana SVM',
      type: 'L1',
      finality: '~400 ms',
      avgFee: '<$0.001',
      status: 'Optimal',
      color: 'text-cyan-400',
      bgGlow: 'from-emerald-400/20 via-cyan-500/20 to-purple-500/20',
      isInspectable: true,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      network: 'Cross-Chain Native',
      type: 'Stablecoin',
      finality: 'Instant',
      avgFee: '$0.00',
      status: 'Optimal',
      color: 'text-blue-400',
      bgGlow: 'from-blue-500/20 to-cyan-500/20',
      isInspectable: true,
    },
    {
      symbol: 'POL',
      name: 'Polygon',
      network: 'Polygon AggLayer',
      type: 'L2',
      finality: '~1.8 sec',
      avgFee: '<$0.005',
      status: 'Active',
      color: 'text-purple-400',
      bgGlow: 'from-purple-500/20 to-indigo-500/20',
      isInspectable: true,
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      network: 'Ethereum Mainnet',
      type: 'L1',
      finality: '~12 sec',
      avgFee: 'Dynamic',
      status: 'Active',
      color: 'text-indigo-400',
      bgGlow: 'from-indigo-500/20 to-blue-500/20',
    },
    {
      symbol: 'BTC',
      name: 'Bitcoin (WBTC/tBTC)',
      network: 'Omni-Chain Wrapped',
      type: 'Store of Value',
      finality: '~10 min',
      avgFee: 'Standard',
      status: 'Active',
      color: 'text-amber-400',
      bgGlow: 'from-amber-500/20 to-orange-500/20',
    },
    {
      symbol: 'BASE',
      name: 'Base',
      network: 'Coinbase OP Stack',
      type: 'L2',
      finality: '~1.5 sec',
      avgFee: '<$0.002',
      status: 'Optimal',
      color: 'text-blue-500',
      bgGlow: 'from-blue-600/20 to-sky-400/20',
    },
    {
      symbol: 'ARB',
      name: 'Arbitrum',
      network: 'Arbitrum One',
      type: 'L2',
      finality: '~1.2 sec',
      avgFee: '<$0.003',
      status: 'Active',
      color: 'text-sky-400',
      bgGlow: 'from-sky-500/20 to-cyan-500/20',
    },
    {
      symbol: 'AVAX',
      name: 'Avalanche',
      network: 'Avalanche C-Chain',
      type: 'L1',
      finality: '<1 sec',
      avgFee: '<$0.01',
      status: 'Active',
      color: 'text-red-400',
      bgGlow: 'from-red-500/20 to-rose-500/20',
    },
  ];

  const filteredCoins = coins.filter((coin) => {
    const matchesFilter = filter === 'All' || coin.type === filter;
    const matchesSearch =
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.network.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const isDark = theme === 'dark';

  return (
    <section
      id="compatible-coins-section"
      className="py-20 px-4 sm:px-6 max-w-6xl mx-auto transition-colors duration-300"
    >
      {/* Header with Minimalist Typography */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/10 dark:border-white/10 light:border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-3 tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MULTI-CHAIN LIQUIDITY</span>
          </div>
          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-light tracking-tight font-['Space_Grotesk'] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Compatible <strong className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500">Crypto Coins</strong>
          </h2>
          <p className={`mt-2 text-sm max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Native routing across high-velocity Layer 1s, zero-knowledge rollups, and fiat-backed assets with atomic cross-chain settlement.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'L1', 'L2', 'Stablecoin'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                filter === cat
                  ? isDark
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'bg-cyan-50 text-cyan-700 border border-cyan-300 shadow-sm'
                  : isDark
                  ? 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/10'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat === 'All' ? 'All Networks' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6 relative max-w-md">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by token name, ticker, or chain..."
          className={`w-full pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors focus:outline-none ${
            isDark
              ? 'bg-white/[0.03] border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/60 focus:bg-white/[0.06]'
              : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-600 shadow-xs'
          }`}
        />
      </div>

      {/* Coins Minimalist Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {filteredCoins.map((coin) => (
          <div
            key={coin.symbol}
            className={`group relative rounded-2xl p-4 transition-all duration-300 border flex flex-col justify-between ${
              isDark
                ? 'bg-[#0c0a20]/70 hover:bg-[#120e2e]/80 border-white/[0.08] hover:border-cyan-400/40 shadow-sm hover:shadow-[0_4px_25px_rgba(6,182,212,0.15)]'
                : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-cyan-400/60 shadow-xs hover:shadow-md'
            }`}
          >
            {/* Top row: Symbol and Type */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs font-mono shadow-inner ${
                      isDark
                        ? 'bg-white/[0.06] text-white border border-white/10'
                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                    }`}
                  >
                    {coin.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {coin.name}
                    </h3>
                    <span className={`text-[11px] font-mono ${coin.color}`}>
                      {coin.symbol}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    coin.status === 'Optimal'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}
                >
                  {coin.status}
                </span>
              </div>

              {/* Network and Performance stats */}
              <div className={`space-y-1 text-xs my-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Network</span>
                  <span className={`font-medium text-[11px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {coin.network}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Finality</span>
                  <span className="font-mono text-emerald-400 font-semibold text-[11px]">{coin.finality}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Estimated Fee</span>
                  <span className={`font-mono text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{coin.avgFee}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between gap-2">
              {coin.isInspectable && (
                <button
                  type="button"
                  onClick={() => onSelectCoin(coin.symbol as 'USDC' | 'SOL' | 'POLYGON')}
                  className={`text-[11px] font-medium transition cursor-pointer ${
                    isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'
                  }`}
                >
                  Inspect 3D Token
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSwap}
                className={`ml-auto flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.06] hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-400/30'
                    : 'bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-200 hover:border-cyan-300'
                }`}
              >
                <span>Swap</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
