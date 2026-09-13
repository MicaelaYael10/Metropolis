import React from "react";

interface RiskGuardLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  animated?: boolean;
  className?: string;
}

const SIZES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
  xl: "w-20 h-20",
};

export const RiskGuardLogo: React.FC<RiskGuardLogoProps> = ({
  size = "md",
  showText = true,
  animated = true,
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative group">
        {animated && (
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition duration-500 animate-pulse" />
        )}
        <div
          className={`relative ${SIZES[size]} rounded-2xl bg-white/80 border border-cyan-500/40 p-1 flex items-center justify-center overflow-hidden shadow-[0_6px_20px_rgba(31,116,136,0.25)] group-hover:border-cyan-500 transition-colors`}
        >
          <img src="/mark.png" alt="RiskGuard" className="w-full h-full object-contain rounded-xl" />
        </div>
      </div>

      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-slate-900 font-['Space_Grotesk'] text-lg md:text-xl">
              Risk<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-[#4f6bff]">Guard</span>
            </span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 tracking-wider">
              DeFi
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider -mt-0.5">
            RIESGO ON-CHAIN
          </span>
        </div>
      )}
    </div>
  );
};
