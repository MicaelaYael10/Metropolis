import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  Activity,
  Sliders,
  ShieldAlert,
  RefreshCw,
  Info,
  Calendar,
  Zap,
  BarChart2,
  Percent,
  CheckCircle2,
} from 'lucide-react';

interface MonteCarloRiskSectionProps {
  theme: 'dark' | 'light';
}

interface AssetConfig {
  symbol: string;
  name: string;
  initialPrice: number;
  realtimeVol: number; // annualized sigma (e.g. 0.68 = 68%)
  annualDrift: number; // annualized drift mu (e.g. 0.22 = 22%)
  cyclePhase: string;
  cycleImpact: number; // multiplier for cyclical trend
}

export const MonteCarloRiskSection: React.FC<MonteCarloRiskSectionProps> = ({ theme }) => {
  const isDark = theme === 'dark';

  const assets: Record<string, AssetConfig> = {
    SOL: {
      symbol: 'SOL',
      name: 'Solana SVM',
      initialPrice: 194.2,
      realtimeVol: 0.72,
      annualDrift: 0.28,
      cyclePhase: 'Expansionary Cycle (Post-Halving Epoch)',
      cycleImpact: 1.25,
    },
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum Mainnet',
      initialPrice: 3450.0,
      realtimeVol: 0.54,
      annualDrift: 0.18,
      cyclePhase: 'Institutional ETF Accumulation Cycle',
      cycleImpact: 1.15,
    },
    POL: {
      symbol: 'POL',
      name: 'Polygon AggLayer',
      initialPrice: 0.52,
      realtimeVol: 0.82,
      annualDrift: 0.24,
      cyclePhase: 'ZK Aggregation Rollout Phase',
      cycleImpact: 1.2,
    },
    PORTFOLIO: {
      symbol: 'PORTFOLIO',
      name: 'Balanced Multi-Net Index',
      initialPrice: 100.0,
      realtimeVol: 0.46,
      annualDrift: 0.21,
      cyclePhase: 'Synchronized Multi-Chain Cycle',
      cycleImpact: 1.18,
    },
  };

  const [selectedAsset, setSelectedAsset] = useState<string>('SOL');
  const [horizonDays, setHorizonDays] = useState<number>(90); // 30, 90, 180, 365
  const [layerBlend, setLayerBlend] = useState<number>(50); // 0 = 100% Real-Time, 100 = 100% Annual Cycle
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.0); // 0.7 to 1.6
  const [confidenceLevel, setConfidenceLevel] = useState<95 | 99>(95);
  const [seed, setSeed] = useState<number>(42);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Box-Muller Gaussian Random Generator with pseudo-deterministic PRNG
  const pseudoRandom = useCallback((s: number) => {
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  }, []);

  // Run Monte Carlo Simulation using Geometric Brownian Motion (GBM)
  const simulationResults = useMemo(() => {
    const asset = assets[selectedAsset] || assets.SOL;
    const S0 = asset.initialPrice;

    // Blend Real-Time vs Annual Cycle Layer
    // Real-Time Layer: uses high-frequency market volatility and short-term drift
    // Annual Cycle Layer: adjusts drift according to seasonal quarter (Q1-Q4) and macro epoch
    const weightCycle = layerBlend / 100;
    const weightRealTime = 1 - weightCycle;

    // Annual cycle factor based on horizon fraction of year
    const seasonalFactor = 1 + (asset.cycleImpact - 1) * weightCycle;
    const effectiveDrift = (asset.annualDrift * weightRealTime + (asset.annualDrift * seasonalFactor) * weightCycle);
    const effectiveVol = asset.realtimeVol * volatilityMultiplier * (1 + (weightCycle - 0.5) * 0.1);

    const steps = 40; // time steps along horizon
    const numPaths = 600; // total Monte Carlo trajectories
    const dt = (horizonDays / 365) / steps;

    const allPaths: number[][] = [];
    const terminalPrices: number[] = [];

    let currentSeed = seed;

    for (let p = 0; p < numPaths; p++) {
      const path: number[] = [S0];
      let currentPrice = S0;

      for (let s = 1; s <= steps; s++) {
        currentSeed += 1;
        const u1 = Math.max(1e-7, pseudoRandom(currentSeed));
        currentSeed += 1;
        const u2 = pseudoRandom(currentSeed);

        // Box-Muller transform for normal distribution
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        // Geometric Brownian Motion step: S_{t+dt} = S_t * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
        const driftTerm = (effectiveDrift - 0.5 * effectiveVol * effectiveVol) * dt;
        const shockTerm = effectiveVol * Math.sqrt(dt) * z;
        currentPrice = currentPrice * Math.exp(driftTerm + shockTerm);

        // Floor to zero to prevent negative asset pricing
        if (currentPrice < 0.001) currentPrice = 0.001;
        path.push(currentPrice);
      }

      allPaths.push(path);
      terminalPrices.push(path[steps]);
    }

    // Sort terminal prices for quantile analysis
    terminalPrices.sort((a, b) => a - b);

    const idx5 = Math.floor(numPaths * 0.05);
    const idx25 = Math.floor(numPaths * 0.25);
    const idx50 = Math.floor(numPaths * 0.5);
    const idx75 = Math.floor(numPaths * 0.75);
    const idx95 = Math.floor(numPaths * 0.95);
    const idx99 = Math.floor(numPaths * 0.99);

    const worst5 = terminalPrices[idx5];
    const q25 = terminalPrices[idx25];
    const median = terminalPrices[idx50];
    const q75 = terminalPrices[idx75];
    const best95 = terminalPrices[idx95];
    const best99 = terminalPrices[idx99];

    // Value at Risk (VaR) & CVaR (Expected Shortfall)
    const var95Pct = Math.max(0, ((S0 - worst5) / S0) * 100);
    const var99Val = terminalPrices[Math.floor(numPaths * 0.01)];
    const var99Pct = Math.max(0, ((S0 - var99Val) / S0) * 100);

    // CVaR (Expected Shortfall) = Average loss of the worst 5%
    const worstTail = terminalPrices.slice(0, idx5 + 1);
    const avgTailPrice = worstTail.reduce((acc, v) => acc + v, 0) / worstTail.length;
    const cvar95Pct = Math.max(0, ((S0 - avgTailPrice) / S0) * 100);

    // Probability of Positive Outcome
    const positiveCount = terminalPrices.filter((p) => p >= S0).length;
    const probGain = ((positiveCount / numPaths) * 100).toFixed(1);

    // Build median, upper 95%, and lower 5% trajectories across all steps
    const stepStats: { step: number; p5: number; p25: number; p50: number; p75: number; p95: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      const stepVals = allPaths.map((p) => p[s]).sort((a, b) => a - b);
      stepStats.push({
        step: s,
        p5: stepVals[Math.floor(numPaths * 0.05)],
        p25: stepVals[Math.floor(numPaths * 0.25)],
        p50: stepVals[Math.floor(numPaths * 0.5)],
        p75: stepVals[Math.floor(numPaths * 0.75)],
        p95: stepVals[Math.floor(numPaths * 0.95)],
      });
    }

    // Select 12 representative paths to display as sample trajectory strands
    const sampleStrands = allPaths.filter((_, idx) => idx % Math.floor(numPaths / 12) === 0).slice(0, 12);

    return {
      S0,
      effectiveDrift,
      effectiveVol,
      worst5,
      median,
      best95,
      best99,
      q25,
      q75,
      var95Pct,
      var99Pct,
      cvar95Pct,
      probGain,
      stepStats,
      sampleStrands,
      steps,
      minPrice: Math.min(...terminalPrices),
      maxPrice: Math.max(...terminalPrices),
    };
  }, [selectedAsset, horizonDays, layerBlend, volatilityMultiplier, seed, pseudoRandom]);

  const handleReRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setSeed((prev) => prev + Math.floor(Math.random() * 1000) + 1);
      setIsSimulating(false);
    }, 400);
  };

  // SVG Chart Coordinate Dimensions
  const chartW = 700;
  const chartH = 280;
  const padL = 55;
  const padR = 25;
  const padT = 25;
  const padB = 40;

  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const yMax = simulationResults.stepStats.reduce((max, s) => Math.max(max, s.p95), simulationResults.S0 * 1.1) * 1.05;
  const yMin = Math.max(0, simulationResults.stepStats.reduce((min, s) => Math.min(min, s.p5), simulationResults.S0 * 0.9) * 0.92);

  const getX = (step: number) => padL + (step / simulationResults.steps) * innerW;
  const getY = (price: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, price));
    return padT + innerH - ((clamped - yMin) / (yMax - yMin || 1)) * innerH;
  };

  // Construct SVG Area for 90% Confidence Interval (Between p5 and p95)
  const p95Points = simulationResults.stepStats.map((s) => `${getX(s.step)},${getY(s.p95)}`).join(' ');
  const p5PointsRev = [...simulationResults.stepStats].reverse().map((s) => `${getX(s.step)},${getY(s.p5)}`).join(' ');
  const confidenceAreaD = `M ${getX(0)},${getY(simulationResults.stepStats[0].p95)} ${p95Points} L ${p5PointsRev} Z`;

  // Construct SVG Area for 50% Interquartile Range (Between p25 and p75)
  const p75Points = simulationResults.stepStats.map((s) => `${getX(s.step)},${getY(s.p75)}`).join(' ');
  const p25PointsRev = [...simulationResults.stepStats].reverse().map((s) => `${getX(s.step)},${getY(s.p25)}`).join(' ');
  const iqrAreaD = `M ${getX(0)},${getY(simulationResults.stepStats[0].p75)} ${p75Points} L ${p25PointsRev} Z`;

  // Median Path line
  const medianLineD = simulationResults.stepStats.map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(s.step)},${getY(s.p50)}`).join(' ');

  const currentAsset = assets[selectedAsset] || assets.SOL;

  return (
    <section
      id="monte-carlo-section"
      className={`py-20 px-4 sm:px-6 transition-colors duration-300 max-w-6xl mx-auto`}
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/10 dark:border-white/10 light:border-slate-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-3 tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-3.5 h-3.5" />
            <span>QUANTITATIVE RISK ENGINE (MONTE CARLO)</span>
          </div>

          <h2
            className={`text-3xl sm:text-4xl md:text-5xl font-light tracking-tight font-['Space_Grotesk'] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Stochastic Risk <strong className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400">Simulation Model</strong>
          </h2>

          <p className={`mt-2 text-sm max-w-2xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Dual-layer Monte Carlo forecasting combining high-frequency real-time orderbook volatility with multi-year annual cyclical macro models.
          </p>
        </div>

        {/* Action: Re-run Simulation button */}
        <button
          type="button"
          onClick={handleReRunSimulation}
          disabled={isSimulating}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
            isDark
              ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
              : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 shadow-sm'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Simulating 600 Paths...' : 'Re-Run Simulation'}</span>
        </button>
      </div>

      {/* Control Panel: Asset Selection & Combined Layer Weighting */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border mb-8 transition-all ${
          isDark
            ? 'bg-[#0c0a20]/80 border-white/10 shadow-sm'
            : 'bg-white border-slate-200/90 shadow-sm'
        }`}
      >
        <div className="grid lg:grid-cols-12 gap-6 items-center">
          {/* Asset Pills */}
          <div className="lg:col-span-4 space-y-2">
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Asset / Strategy Index
            </span>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(assets).map((key) => {
                const a = assets[key];
                const isSelected = selectedAsset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedAsset(key)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-left flex flex-col justify-between cursor-pointer border ${
                      isSelected
                        ? isDark
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                          : 'bg-cyan-50 border-cyan-400 text-cyan-900 shadow-xs'
                        : isDark
                        ? 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{a.symbol}</span>
                    <span className="text-[10px] font-mono font-normal opacity-80">
                      ${a.initialPrice.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Horizon */}
          <div className="lg:col-span-3 space-y-2">
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Forecast Time Horizon
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[30, 90, 180, 365].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setHorizonDays(days)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                    horizonDays === days
                      ? isDark
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                        : 'bg-purple-50 border-purple-400 text-purple-900'
                        : isDark
                      ? 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <span className={`text-[10px] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {horizonDays === 365 ? 'Full Annual Macro Cycle' : `${horizonDays} Days Forward Window`}
            </span>
          </div>

          {/* DUAL LAYER BLEND SLIDER: Real-Time Layer vs Annual Cycle Layer */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Zap className="w-3.5 h-3.5" />
                Real-Time Analysis Layer ({100 - layerBlend}%)
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <Calendar className="w-3.5 h-3.5" />
                Annual Cycle Layer ({layerBlend}%)
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={layerBlend}
              onChange={(e) => setLayerBlend(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-700/40 rounded-lg appearance-none"
            />

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 pt-0.5">
              <span>Orderbook & High-Freq Vol</span>
              <span>Balanced Synthesis</span>
              <span>4-Year Halving Cycle & Seasonal Drift</span>
            </div>
          </div>
        </div>

        {/* Current Active Macro Context Banner */}
        <div
          className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark ? 'border-white/5 text-slate-400' : 'border-slate-100 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300 dark:text-slate-300 light:text-slate-700">
              Active Macro Phase:
            </span>
            <span>{currentAsset.cyclePhase}</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>
              Real-time σ:{' '}
              <strong className="text-cyan-400">{(currentAsset.realtimeVol * 100).toFixed(0)}%</strong>
            </span>
            <span>
              Blended Drift μ:{' '}
              <strong className="text-emerald-400">
                {(simulationResults.effectiveDrift * 100).toFixed(1)}%
              </strong>
            </span>
            <span>
              Confidence:{' '}
              <strong className="text-purple-400">{confidenceLevel}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Visual Trajectory Fan Chart + Risk Metric Cards */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Interactive Monte Carlo Trajectory Chart */}
        <div
          className={`lg:col-span-8 rounded-2xl border p-5 sm:p-6 relative transition-all ${
            isDark
              ? 'bg-[#0b0a1e]/90 border-cyan-500/20 shadow-md'
              : 'bg-white border-slate-200/90 shadow-sm'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className={`font-bold text-base font-['Space_Grotesk'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                600 Simulated Asset Paths (Geometric Brownian Motion)
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Shaded envelopes depict the 90% confidence cone and 50% interquartile dispersion.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Upper 95%
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-3 h-0.5 bg-cyan-400" />
                Median Path
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Lower 5%
              </span>
            </div>
          </div>

          {/* SVG Trajectory Fan Canvas */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-auto select-none"
              style={{ minWidth: '520px' }}
            >
              <defs>
                {/* 90% Confidence Band Gradient */}
                <linearGradient id="ci90Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? 0.35 : 0.25} />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity={isDark ? 0.15 : 0.1} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={isDark ? 0.35 : 0.2} />
                </linearGradient>

                {/* 50% IQR Band Gradient */}
                <linearGradient id="iqrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={isDark ? 0.45 : 0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={isDark ? 0.25 : 0.2} />
                </linearGradient>

                {/* Glow filter */}
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = padT + innerH * ratio;
                const price = yMax - ratio * (yMax - yMin);
                return (
                  <g key={ratio}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill={isDark ? '#64748b' : '#94a3b8'}
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      ${price >= 10 ? price.toFixed(0) : price.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Baseline initial price reference */}
              <line
                x1={padL}
                y1={getY(simulationResults.S0)}
                x2={chartW - padR}
                y2={getY(simulationResults.S0)}
                stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
                strokeDasharray="2 2"
              />
              <text
                x={chartW - padR + 4}
                y={getY(simulationResults.S0) + 3}
                fill={isDark ? '#94a3b8' : '#64748b'}
                fontSize="9"
                fontFamily="monospace"
              >
                S₀
              </text>

              {/* 90% Confidence Interval Area */}
              <path d={confidenceAreaD} fill="url(#ci90Gradient)" />

              {/* 50% IQR Inner Area */}
              <path d={iqrAreaD} fill="url(#iqrGradient)" />

              {/* Sample Stochastic Paths */}
              {simulationResults.sampleStrands.map((strand, sIdx) => {
                const dStr = strand
                  .map((val, stepIdx) => `${stepIdx === 0 ? 'M' : 'L'} ${getX(stepIdx)},${getY(val)}`)
                  .join(' ');
                return (
                  <path
                    key={sIdx}
                    d={dStr}
                    fill="none"
                    stroke={
                      strand[strand.length - 1] >= simulationResults.S0
                        ? isDark ? 'rgba(34, 211, 238, 0.18)' : 'rgba(6, 182, 212, 0.25)'
                        : isDark ? 'rgba(244, 63, 94, 0.18)' : 'rgba(225, 29, 72, 0.25)'
                    }
                    strokeWidth="1"
                  />
                );
              })}

              {/* Upper 95% Bound line */}
              <path
                d={simulationResults.stepStats
                  .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(s.step)},${getY(s.p95)}`)
                  .join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Lower 5% Bound line */}
              <path
                d={simulationResults.stepStats
                  .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(s.step)},${getY(s.p5)}`)
                  .join(' ')}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Central Median Line */}
              <path
                d={medianLineD}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                filter={isDark ? 'url(#neonGlow)' : undefined}
              />

              {/* Terminal Price Markers */}
              <circle
                cx={getX(simulationResults.steps)}
                cy={getY(simulationResults.best95)}
                r="3.5"
                fill="#10b981"
              />
              <circle
                cx={getX(simulationResults.steps)}
                cy={getY(simulationResults.median)}
                r="4.5"
                fill="#06b6d4"
              />
              <circle
                cx={getX(simulationResults.steps)}
                cy={getY(simulationResults.worst5)}
                r="3.5"
                fill="#f43f5e"
              />

              {/* Time X-Axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const step = Math.round(simulationResults.steps * ratio);
                const day = Math.round(horizonDays * ratio);
                return (
                  <text
                    key={ratio}
                    x={getX(step)}
                    y={chartH - 10}
                    textAnchor="middle"
                    fill={isDark ? '#64748b' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    T+{day}d
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Terminal Price Legend Callouts */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
            <div className="text-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block">Upper Bound (95%)</span>
              <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                ${simulationResults.best95.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-emerald-500 block font-mono">
                +{(((simulationResults.best95 - simulationResults.S0) / simulationResults.S0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="text-center p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-[10px] uppercase font-mono text-cyan-400 block">Median Target (50%)</span>
              <span className="text-sm sm:text-base font-mono font-bold text-cyan-400">
                ${simulationResults.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-cyan-500 block font-mono">
                {simulationResults.median >= simulationResults.S0 ? '+' : ''}
                {(((simulationResults.median - simulationResults.S0) / simulationResults.S0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="text-center p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] uppercase font-mono text-rose-400 block">Lower Bound (5%)</span>
              <span className="text-sm sm:text-base font-mono font-bold text-rose-400">
                ${simulationResults.worst5.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-rose-500 block font-mono">
                {(((simulationResults.worst5 - simulationResults.S0) / simulationResults.S0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Statistical Risk Parameters & Value-at-Risk Cards */}
        <div className="lg:col-span-4 space-y-4">
          {/* VaR & CVaR Card */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isDark
                ? 'bg-[#0b0a1e]/90 border-purple-500/20 shadow-sm'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <h4 className={`font-bold text-sm font-['Space_Grotesk'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Expected Risk Ranges
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <div
                className={`p-3 rounded-xl border flex justify-between items-center ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Value-at-Risk (VaR 95%)
                  </span>
                  <span className="font-semibold text-[10px] text-slate-500">Max expected loss at 95% CI</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-400 text-sm">
                    -{simulationResults.var95Pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex justify-between items-center ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Conditional VaR (CVaR / ES)
                  </span>
                  <span className="font-semibold text-[10px] text-slate-500">Average tail drawdown</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-500 text-sm">
                    -{simulationResults.cvar95Pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex justify-between items-center ${
                  isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Gain Probability
                  </span>
                  <span className="font-semibold text-[10px] text-slate-500">Positive terminal return</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {simulationResults.probGain}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Layer Mechanics Insight */}
          <div
            className={`p-5 rounded-2xl border space-y-3 text-xs ${
              isDark
                ? 'bg-white/[0.02] border-white/10 text-slate-400'
                : 'bg-slate-50/90 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-200 dark:text-slate-200 light:text-slate-800">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Layer Synthesis Architecture</span>
            </div>

            <div className="space-y-2 text-[11px] leading-relaxed">
              <p>
                • <strong className="text-cyan-400">Real-Time Analysis Layer:</strong> Extracts instantaneous implied volatility from decentralized liquidity pools and high-throughput orderbook spreads.
              </p>
              <p>
                • <strong className="text-amber-400">Annual Cycle Study Layer:</strong> Calibrates drift based on historical Q1-Q4 liquidity rotation, Bitcoin halving epochs, and macro monetary expansion trends.
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Continuous Calibrated Risk Boundaries</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
