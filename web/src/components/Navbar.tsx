import React from "react";
import { RiskGuardLogo } from "./RiskGuardLogo";
import { Wallet, PlugZap, ChevronDown, Gauge } from "lucide-react";

interface NavbarProps {
  theme: "dark" | "light";
  onLogoClick: () => void;
  isConnected: boolean;
  address?: string;
  chainName: string;
  onOpenWalletKit: () => void;
  onOpenProfile: () => void;
  onEnterApp: () => void;
  inApp: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  onLogoClick,
  isConnected,
  address,
  chainName,
  onOpenWalletKit,
  onOpenProfile,
  onEnterApp,
  inApp,
}) => {
  const isDark = theme === "dark";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 backdrop-blur-xl transition-colors duration-300 px-4 sm:px-8 py-3 ${
        isDark ? "bg-[#04090b]/80 border-b border-cyan-500/20" : "bg-white/[0.06] border-b border-white/10/80 shadow-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <button type="button" onClick={onLogoClick} className="cursor-pointer hover:opacity-95 transition-opacity">
          <RiskGuardLogo size="md" showText={true} />
        </button>

        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-mono border border-white/10 bg-white/[0.04] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500/100" />
            {chainName}
          </span>
          <span className="text-slate-300">|</span>
          <span>Contratos verificados</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!inApp && (
            <button
              type="button"
              onClick={onEnterApp}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 border cursor-pointer ${
                isDark
                  ? "bg-white/[0.06] hover:bg-white/[0.12] text-white border-white/15"
                  : "bg-white/[0.06] hover:bg-white/[0.08] text-slate-100 border-white/15"
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>Plataforma</span>
            </button>
          )}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
              isDark ? "bg-cyan-950/60 border border-cyan-500/30 text-cyan-300" : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
            }`}
          >
            <PlugZap className="w-3.5 h-3.5 text-cyan-500" />
            <span>{isConnected ? chainName : "Sin billetera"}</span>
          </div>

          {isConnected && address ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 border ${
                isDark
                  ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white"
                  : "bg-white/[0.06] hover:bg-white/[0.04] border-white/15 text-slate-100"
              }`}
              title="Abrir perfil"
            >
              <span className="w-5 h-5 rounded-md bg-gradient-to-br from-cyan-500 to-purple-600 text-[9px] font-bold text-white grid place-items-center">
                {address.slice(2, 4).toUpperCase()}
              </span>
              <span className="font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenWalletKit}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(44,147,168,0.35)] active:scale-95 cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Conectar billetera</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
