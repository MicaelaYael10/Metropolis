import React from "react";
import { Wallet, Smartphone, Monitor, Link2, ShieldCheck, ArrowRight } from "lucide-react";

interface WalletsSectionProps {
  onConnect: () => void;
  isConnected: boolean;
  address?: string;
}

const WALLETS = [
  { name: "Core Wallet", type: "Extension / Movil", icon: ShieldCheck, note: "Billetera oficial de Avalanche" },
  { name: "MetaMask", type: "Extension / Movil", icon: Wallet, note: "EVM compatible" },
  { name: "Rabby", type: "Extension", icon: Monitor, note: "Multi-cadena" },
  { name: "Coinbase Wallet", type: "Extension / Movil", icon: Smartphone, note: "EVM compatible" },
  { name: "WalletConnect", type: "Conexion QR", icon: Link2, note: "Cualquier billetera movil" },
];

/** Billeteras compatibles en filas de ancho completo (un solo bloque, sin tarjetas sueltas). */
export const WalletsSection: React.FC<WalletsSectionProps> = ({ onConnect, isConnected, address }) => {
  return (
    <section className="py-16 px-4 sm:px-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1 h-4 bg-cyan-600" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Sesion y billeteras</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Billeteras compatibles</h2>
        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
          RiskGuard no custodia fondos: la billetera firma y el contrato decide. Al conectar se abre tu
          sesion y las operaciones quedan registradas on-chain.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white/80 backdrop-blur-xl overflow-hidden shadow-[0_6px_24px_rgba(15,33,45,0.06)]">
        <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1.6fr_auto] gap-4 px-5 py-3 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
          <span>Billetera</span>
          <span>Tipo</span>
          <span>Nota</span>
          <span />
        </div>
        {WALLETS.map((w, i) => (
          <div
            key={w.name}
            className={`grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.6fr_auto] gap-3 sm:gap-4 items-center px-5 py-4 ${
              i !== WALLETS.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-cyan-700">
                <w.icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-slate-900">{w.name}</span>
            </div>
            <span className="text-xs text-slate-500">{w.type}</span>
            <span className="text-xs text-slate-500">{w.note}</span>
            <button
              onClick={onConnect}
              className="justify-self-start sm:justify-self-end px-4 py-2 rounded-md text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:border-cyan-600 hover:text-cyan-700 transition-colors inline-flex items-center gap-1.5"
            >
              {isConnected ? "Sesion activa" : "Conectar"} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
        {isConnected && address && (
          <div className="px-5 py-3 border-t border-slate-200 bg-cyan-50/60 text-[11px] font-mono text-cyan-800">
            Sesion: {address.slice(0, 10)}...{address.slice(-8)}
          </div>
        )}
      </div>
    </section>
  );
};

export default WalletsSection;
