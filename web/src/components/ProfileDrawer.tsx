import React from "react";
import { X, Copy, LogOut, ShieldCheck, ExternalLink, Activity, Layers } from "lucide-react";

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  address?: string;
  chainName: string;
  explorer: string;
  riskGuard: string;
  policy: readonly unknown[];
  exposure: bigint;
  logCount: number;
  lastLog: readonly unknown[];
  onDisconnect: () => void;
  theme: "dark" | "light";
}

const short = (a?: string) => (a ? `${a.slice(0, 8)}...${a.slice(-6)}` : "-");

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  open,
  onClose,
  address,
  chainName,
  explorer,
  riskGuard,
  policy,
  exposure,
  logCount,
  lastLog,
  onDisconnect,
  theme,
}) => {
  if (!open) return null;
  const isDark = theme === "dark";
  const wrap = `fixed top-0 right-0 h-full w-full max-w-sm z-50 backdrop-blur-2xl border-l shadow-2xl transition-transform ${
    isDark ? "bg-white/[0.06] border-white/15 text-white" : "bg-white/95 border-slate-200 text-slate-900"
  }`;
  const row = `flex items-center justify-between py-2.5 border-b ${isDark ? "border-white/10" : "border-slate-200"}`;

  const copy = () => address && navigator.clipboard?.writeText(address);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className={wrap}>
        <div className="p-5 flex items-center justify-between">
          <h3 className="text-base font-bold font-['Space_Grotesk'] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" /> Mi perfil
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white">
              {address ? address.slice(2, 4).toUpperCase() : "??"}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-sm truncate">{short(address)}</div>
              <div className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{chainName}</div>
            </div>
            <button onClick={copy} className="ml-auto p-2 rounded-lg hover:bg-white/10" title="Copiar direccion">
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5">
            <div className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Politica vigente</div>
            <div className="text-sm">
              riesgo max <b>{String(policy[0] ?? "-")}</b> - protocolos <b>{String(policy[1] ?? "-")}</b> - tope/protocolo{" "}
              <b>{String(policy[2] ?? "-")}</b> - tope/op <b>{String(policy[3] ?? "-")}</b>
            </div>
          </div>

          <div className="mt-4">
            <div className={row}>
              <span className={`text-xs flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Activity className="w-3.5 h-3.5" /> Exposicion comprometida
              </span>
              <span className="text-sm font-mono">{exposure.toString()}</span>
            </div>
            <div className={row}>
              <span className={`text-xs flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Layers className="w-3.5 h-3.5" /> Decisiones registradas
              </span>
              <span className="text-sm font-mono">{logCount}</span>
            </div>
            {lastLog[0] !== "0x0000000000000000000000000000000000000000" && (
              <div className="py-2.5 text-xs">
                Ultima:{" "}
                <b className={lastLog[5] ? "text-emerald-400" : "text-rose-400"}>{lastLog[5] ? "ejecutada" : "bloqueada"}</b>{" "}
                - riesgo {String(lastLog[3])} - motivo {String(lastLog[4])}
              </div>
            )}
          </div>

          <p className={`mt-5 text-[11px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Cada accion -politica, ejecuciones y bloqueos- queda registrada por el contrato en Avalanche. Ese
            historial es verificable por cualquiera en el explorador.
          </p>

          <a
            href={`${explorer}/address/${riskGuard}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 underline"
          >
            Ver el contrato en el explorador <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onDisconnect}
            className={`mt-6 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition-all ${
              isDark ? "bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20" : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
            }`}
          >
            <LogOut className="w-4 h-4" /> Desconectar
          </button>
        </div>
      </aside>
    </>
  );
};
