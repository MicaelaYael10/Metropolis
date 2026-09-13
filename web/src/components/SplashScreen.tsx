import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

interface SplashScreenProps {
  onDone: () => void;
}

/** Pantalla de carga: logo centrado con animacion (~3.4 s) antes de la landing. */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onDone }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 3400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 300);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#04060a] overflow-hidden">
      {/* halos */}
      <div className="absolute w-[420px] h-[420px] rounded-full bg-cyan-500/100/15 blur-3xl animate-pulse" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-[#4f6bff]/10 blur-3xl animate-pulse" />

      <div className="relative flex flex-col items-center">
        {/* anillos */}
        <div className="absolute w-44 h-44 rounded-full border border-cyan-500/40 animate-ping" />
        <div className="absolute w-56 h-56 rounded-full border border-[#4f6bff]/25" style={{ animation: "rg-pulse 2.2s ease-in-out infinite" }} />

        <div className="relative w-28 h-28 rounded-3xl bg-white/[0.06] border border-cyan-500/30 p-2 shadow-[0_10px_40px_rgba(31,116,136,0.25)] backdrop-blur-xl">
          <img src="/mark.png" alt="RiskGuard" className="w-full h-full object-contain rounded-2xl" />
        </div>

        <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-['Space_Grotesk']">
          Risk<span className="bg-gradient-to-r from-cyan-600 via-[#4f6bff] to-purple-500 bg-clip-text text-transparent">Guard</span>
        </h1>
        <p className="mt-2 text-xs font-mono text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
          Inicializando agente de riesgo en Avalanche...
        </p>

        {/* barra de progreso */}
        <div className="mt-6 w-64 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-600 via-[#4f6bff] to-purple-500 transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="mt-2 text-[11px] font-mono text-slate-400">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
};

export default SplashScreen;
