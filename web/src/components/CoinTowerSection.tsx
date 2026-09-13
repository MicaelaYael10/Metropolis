import React, { useState } from 'react';
import { Layers, TrendingUp, ShieldCheck, ArrowRight, Lock, Sparkles, CheckCircle } from 'lucide-react';

interface CoinTowerSectionProps {
  theme: 'dark' | 'light';
  onOpenStakeModal: () => void;
  onOpenBridgeModal: () => void;
}

export const CoinTowerSection: React.FC<CoinTowerSectionProps> = ({
  theme,
  onOpenStakeModal,
  onOpenBridgeModal,
}) => {
  const [selectedStack, setSelectedStack] = useState<1 | 2 | 3>(2);
  const isDark = theme === 'dark';

  const stackDetails = {
    1: {
      title: 'Tier I: High-Velocity Liquidity',
      heightLabel: 'Short Stack (Daily Floating)',
      apy: '4.8% Variable APY',
      tvl: '$124.5M Locked',
      lockup: 'No Lockup (Instant Withdrawal)',
      desc: 'Powers sub-millisecond atomic swaps and cross-chain bridge rebalancing across Solana and Polygon.',
      benefit: 'Zero slippage fees & dynamic yield distribution',
    },
    2: {
      title: 'Tier II: Staked Anchor & Governance',
      heightLabel: 'Mid Stack + Upright Master Coin',
      apy: '8.6% Compounded APY',
      tvl: '$248.1M Locked',
      lockup: '7-Day Flexible Unbonding',
      desc: 'Secures cross-chain relay validator bonds and qualifies stakers for protocol revenue sharing.',
      benefit: 'Validator fee share & DAO voting power',
    },
    3: {
      title: 'Tier III: Deep Vaulted Treasury',
      heightLabel: 'Tall High-Capacity Tower',
      apy: '14.2% Fixed Staking APY',
      tvl: '$412.9M Locked',
      lockup: '30-Day Epoch Timelock',
      desc: 'Institutional-grade collateral reserve buffer guaranteeing 1:1 cross-chain liquidity redemption.',
      benefit: 'Maximum yield multiplier & insurance fund protection',
    },
  }[selectedStack];

  return (
    <section
      id="coin-tower-section"
      className={`relative py-24 px-4 sm:px-6 transition-colors duration-500 overflow-hidden ${
        isDark ? 'bg-[#070614]' : 'bg-[#f8fafc]'
      }`}
    >
      {/* Background ambient lighting glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-amber-500/10 via-cyan-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Minimalist Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono tracking-wide mb-4 bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Layers className="w-3.5 h-3.5" />
            <span>VAULTED RESERVES & LIQUIDITY TOWERS</span>
          </div>

          <h2
            className={`text-3xl sm:text-5xl font-light tracking-tight font-['Space_Grotesk'] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Proof of <strong className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500">Reserves & Yield Towers</strong>
          </h2>

          <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Multi-tiered capital stacks engineered for automated compounding, deep reserve backing, and institutional cross-chain liquidity.
          </p>
        </div>

        {/* 3D Coin Tower Seamless Display & Interactive Controller */}
        <div
          className={`relative rounded-3xl border p-6 sm:p-10 transition-all duration-500 ${
            isDark
              ? 'bg-[#0b0a1d]/80 border-cyan-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)]'
              : 'bg-white/90 border-slate-200/90 shadow-xl'
          }`}
        >
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left: 3D Coin Tower Image Artwork with Seamless Masked Blend */}
            <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
              <div className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden group">
                {/* Ambient backdrop glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/10 to-amber-500/20 rounded-2xl blur-xl" />

                {/* Coin Tower image with subtle responsive float & zoom */}
                <img
                  src="/coin-tower.jpg"
                  alt="3D Multi-Tier Crypto Coin Towers"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain relative z-10 transition-transform duration-700 group-hover:scale-105 filter drop-shadow-[0_15px_30px_rgba(245,158,11,0.25)]"
                />

                {/* Seamless Edge Blending Gradient Overlays */}
                <div
                  className={`absolute inset-0 z-20 pointer-events-none transition-colors duration-500 ${
                    isDark
                      ? 'bg-radial from-transparent via-transparent to-[#0b0a1d]'
                      : 'bg-radial from-transparent via-transparent to-white'
                  }`}
                />

                {/* Interactive stack selector pills floating over the towers */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                  <button
                    type="button"
                    onClick={() => setSelectedStack(1)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedStack === 1
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Short Stack
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStack(2)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedStack === 2
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Mid + Coin
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStack(3)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedStack === 3
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Tall Tower
                  </button>
                </div>
              </div>

              <div className="mt-3 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Synchronized with On-Chain Proof of Reserve (PoR) Oracle</span>
              </div>
            </div>

            {/* Right: Dynamic Tier Details & Staking Metrics */}
            <div className="lg:col-span-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{stackDetails.heightLabel}</span>
                </div>
                <h3
                  className={`text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {stackDetails.title}
                </h3>
                <p className={`mt-2 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {stackDetails.desc}
                </p>
              </div>

              {/* Real-time Staking Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[11px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Annual Yield
                  </span>
                  <div className="text-xl font-mono font-bold text-amber-400">
                    {stackDetails.apy}
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border ${
                    isDark
                      ? 'bg-white/[0.03] border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`text-[11px] block mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Active TVL
                  </span>
                  <div className={`text-xl font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {stackDetails.tvl}
                  </div>
                </div>
              </div>

              {/* Key Features */}
              <div
                className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Lockup Terms:</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {stackDetails.lockup}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Ecosystem Benefit:</span>
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {stackDetails.benefit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Audit Verification:</span>
                  <span className="font-mono text-cyan-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Zero-Defect Formal Audit
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onOpenStakeModal}
                  className="flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.35)] transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Deposit & Stake in Vault</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenBridgeModal}
                  className={`py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm border transition flex items-center gap-1.5 cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-white'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <span>Bridge Assets</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Minimalist Footnote continuation */}
        <div className="mt-12 pt-8 border-t border-white/10 dark:border-white/10 light:border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-mono">CyberFin Protocol v2.4</span>
            <span>•</span>
            <span>All vault smart contracts formally verified by CertiK & OpenZeppelin</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="hover:text-cyan-400 transition cursor-pointer">Terms</span>
            <span className="hover:text-cyan-400 transition cursor-pointer">Audits</span>
            <span className="hover:text-cyan-400 transition cursor-pointer">Bug Bounty ($1M)</span>
          </div>
        </div>
      </div>
    </section>
  );
};
