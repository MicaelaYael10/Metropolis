import React from "react";
import type { Connector } from "wagmi";
import { Wallet, X, ShieldCheck, ExternalLink } from "lucide-react";

interface WalletKitModalProps {
  open: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  onConnect: (connector: Connector) => void;
  pendingUid?: string;
  error?: string | null;
  theme: "dark" | "light";
}

export const WalletKitModal: React.FC<WalletKitModalProps> = ({ open, onClose, connectors, onConnect, pendingUid, error, theme }) => {
  if (!open) return null;
  const isDark = theme === "dark";

  // Collapse duplicate rows (explicit fallback + EIP-6963 discovered share a name).
  // Explicit connectors are registered first and discovered ones appended after,
  // so keeping the last entry per name prefers the discovered, wallet-announced
  // provider while still falling back to the explicit target when discovery missed.
  const byName = new Map<string, Connector>();
  for (const c of connectors) byName.set(c.name, c);
  const list = [...byName.values()];

  // Show only wallets that carry a real logo (EIP-6963 discovered). If none has
  // one, fall back to the full list so the generic provider stays reachable.
  const logoed = list.filter((c) => Boolean((c as unknown as { icon?: string }).icon));
  const visible = logoed.length > 0 ? logoed : list;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl ${
          isDark ? "bg-white/[0.06] border-white/15 text-white" : "bg-white/90 border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold font-['Space_Grotesk'] flex items-center gap-2">
            <Wallet className="w-5 h-5 text-cyan-400" /> Conectar billetera
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className={`text-xs mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Billeteras detectadas en este navegador (EIP-6963). Si no aparece la tuya, instala su extension.
        </p>

        {visible.length === 0 ? (
          <div className={`rounded-2xl border border-dashed p-5 text-sm ${isDark ? "border-white/15 text-slate-400" : "border-slate-300 text-slate-500"}`}>
            No se detecto ninguna billetera. Instala Core Wallet o MetaMask y recarga la pagina.
            <a href="https://core.app" target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-cyan-400 underline">
              Descargar Core Wallet <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((c) => {
              const icon = (c as unknown as { icon?: string }).icon;
              const cid = (c as unknown as { id?: string }).id;
              const isThisPending = pendingUid === c.uid;
              return (
              <button
                key={c.uid}
                disabled={isThisPending}
                onClick={() => onConnect(c)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  isThisPending ? "opacity-60" : ""
                } ${
                  isDark ? "border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.05]" : "border-slate-200 hover:border-cyan-400 hover:bg-slate-50"
                }`}
              >
                {icon ? (
                  <img src={icon} alt={c.name} className="w-8 h-8 rounded-lg" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className={`block text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {cid ?? "inyectada"}
                  </span>
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  isThisPending
                    ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                    : "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                }`}>
                  {isThisPending ? "conectando..." : "disponible"}
                </span>
              </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        <p className={`mt-4 text-[11px] flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          RiskGuard no custodia fondos: la billetera firma, el contrato decide.
        </p>
      </div>
    </div>
  );
};
