import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReconnect,
} from "wagmi";
import type { Connector } from "wagmi";
import { keccak256, toHex } from "viem";
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Database,
  Layers,
  Gauge,
  Eye,
  ChevronDown,
  Wallet,
  Server,
  Radio,
  LineChart,
  Sliders,
  Sparkles,
  Landmark,
  ExternalLink,
  LogOut,
} from "lucide-react";

import { Navbar } from "./components/Navbar";
import { WalletKitModal } from "./components/WalletKitModal";
import { ProfileDrawer } from "./components/ProfileDrawer";
import SplashScreen from "./components/SplashScreen";
import { StochasticRiskSection } from "./components/StochasticRiskSection";
import { WalletsSection } from "./components/WalletsSection";
import type { WalletState } from "./types";
import { SESSION_KEY } from "./wagmi";
import { riskGuardAbi, registryAbi, agentLogAbi, asTuple } from "./abi";
import { deploymentFor, REASON_CODES, BAND_NAMES, SUPPORTED_CHAIN_IDS } from "./config";
import { simulate, TIMEFRAMES } from "./mc";

const ThreeCanvas = lazy(() => import("./components/ThreeCanvas"));

/* ------------------------------------------------------------------ helpers */

function bandKey(score: number): "verde" | "ambar" | "rojo" {
  if (score < 30) return "verde";
  if (score <= 60) return "ambar";
  return "rojo";
}
function bandText(band: string): string {
  if (band === "verde") return "text-emerald-400";
  if (band === "ambar") return "text-amber-400";
  return "text-rose-400";
}
function bandChip(band: string): string {
  if (band === "verde") return "text-emerald-300 border-emerald-400/30 bg-emerald-500/100/10";
  if (band === "ambar") return "text-amber-300 border-amber-400/30 bg-amber-500/10";
  return "text-rose-300 border-rose-400/30 bg-rose-500/10";
}
const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "-");

interface SignalInfo {
  signal: string;
  label: string;
  source: string;
  weight: number;
  input: number | null;
  risk: number | null;
  points: number;
  available: boolean;
}
interface McRow {
  p5: number;
  p50: number;
  p95: number;
  breachProbability: number;
}
interface EngineProtocol {
  id: string;
  name: string;
  address: string;
  asOf: string;
  score: number;
  band: string;
  confidence: number;
  coverage: number;
  signals: SignalInfo[];
  reasons: string[];
  montecarlo: Record<string, McRow>;
}
interface EngineData {
  generatedAt: string;
  threshold: number;
  timeframes: string[];
  dataset: { snapshots: number; protocols: number; coverageAverage: number | null; onchainRows: number };
  protocols: EngineProtocol[];
}

const API_SOURCES = [
  { icon: Radio, name: "Avalanche Glacier", url: "https://glacier-api.avax.network", use: "Transacciones y transfers ERC20 historicos (senales on-chain).", role: "Datos de protocolo" },
  { icon: Database, name: "DefiLlama", url: "https://api.llama.fi", use: "TVL, auditorias e historial de incidentes (verdad terreno).", role: "Datos de mercado" },
  { icon: Server, name: "RPC C-Chain", url: "https://api.avax.network/ext/bc/C/rpc", use: "Lectura de contratos, bytecode (eth_getCode) y estado.", role: "Cadena" },
  { icon: ShieldCheck, name: "Sourcify", url: "https://sourcify.dev", use: "Verificacion de contratos (full match, sin API key).", role: "Auditoria" },
  { icon: Eye, name: "RouteScan / Snowtrace", url: "https://routescan.io", use: "Explorador de transacciones y verificacion alternativa.", role: "Explorador" },
  { icon: Wallet, name: "x402 (PayAI / thirdweb)", url: "https://facilitator.payai.network", use: "Pago de datos premium de riesgo con USDC (HTTP 402).", role: "Pagos" },
  { icon: Landmark, name: "Stereum", url: "https://stereum.tech", use: "API de pagos en Bolivia: Bs <-> USDC/USDT (fondeo).", role: "Rampa fiat" },
];

const SEGMENTS = [
  { id: "resumen", label: "Resumen", icon: Gauge, desc: "Politica, protocolos, control previo, motor off-chain y registro." },
  { id: "analisis", label: "Analisis y datos", icon: LineChart, desc: "Matriz de riesgo por lapso, estrategia por perfil y fuentes de datos." },
];

/* --------------------------------------------------------------------- app */

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const connectors = useConnectors();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { reconnect } = useReconnect();
  const { switchChain } = useSwitchChain();
  const deploy = deploymentFor(chainId);

  const theme = "dark" as const;
  const isDark = true;
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<"landing" | "app">("landing");

  const [walletKitOpen, setWalletKitOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [form, setForm] = useState({ maxRiskScore: "55", maxProtocols: "5", maxPerProtocol: "1000", maxAmountPerOp: "500" });
  const [selected, setSelected] = useState<string>("");
  const [amount, setAmount] = useState("100");
  const [evalTarget, setEvalTarget] = useState<{ protocol: `0x${string}`; amount: bigint } | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [strategy, setStrategy] = useState(45);
  const [matrixHorizon, setMatrixHorizon] = useState("30d");
  const [segment, setSegment] = useState("resumen");

  // Stereum (fondeo Bs <-> stablecoin): el frontend llama al proxy server-side.
  const STEREUM_API = (import.meta.env.VITE_STEREUM_API as string) || "http://localhost:8788";
  const [stereum, setStereum] = useState<{ configured?: boolean; ready?: boolean; stereumStatus?: number; message?: string; hint?: string } | null>(null);
  const [stereumForm, setStereumForm] = useState({ amount: "100.00", currency: "BOB", description: "Fondeo RiskGuard" });
  const [stereumOut, setStereumOut] = useState<string>("");
  const checkStereum = () => {
    fetch(`${STEREUM_API}/health`)
      .then((r) => r.json())
      .then(setStereum)
      .catch(() => setStereum({ configured: false, message: "proxy no disponible" }));
  };
  useEffect(() => {
    checkStereum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sendStereum = async () => {
    try {
      const r = await fetch(`${STEREUM_API}/api/stereum/transfers/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(stereumForm),
      });
      const j = await r.json();
      setStereumOut(`${r.status} - ${typeof j === "object" ? j.message || j.error || JSON.stringify(j) : j}`);
    } catch (e) {
      setStereumOut(`Error: ${(e as Error).message}`);
    }
  };

  const goToSegment = (id: string) => {
    setView("app");
    setSegment(id);
    setTimeout(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const walletState: WalletState = {
    isConnected,
    address: address ?? "0x0000000000000000000000000000000000000000",
    balanceEth: 0,
    balanceSol: 0,
    balanceUsdc: 0,
    network: deploy.name,
  };

  // Los bloques se EXPLICAN en la landing; para usarlos hace falta la sesion (billetera).
  const openBlock = (id: string) => {
    if (isConnected) goToSegment(id);
    else setWalletKitOpen(true);
  };

  /* --------------------------------------------------------------- lecturas */

  const policyQ = useReadContract({
    address: deploy.riskGuard,
    abi: riskGuardAbi,
    functionName: "policyOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const policy = asTuple(policyQ.data);

  const listQ = useReadContract({ address: deploy.registry, abi: registryAbi, functionName: "list" });
  const protocolAddresses = (listQ.data as `0x${string}`[] | undefined) ?? [];

  const protocolsQ = useReadContracts({
    contracts: protocolAddresses.map((p) => ({
      address: deploy.registry,
      abi: registryAbi,
      functionName: "getProtocol" as const,
      args: [p] as const,
    })),
    query: { enabled: protocolAddresses.length > 0 },
  });

  const protocols = useMemo(
    () =>
      protocolAddresses.map((addr, i) => {
        const t = asTuple(protocolsQ.data?.[i]?.result);
        return {
          address: addr,
          name: (t[0] as string) || "(sin nombre)",
          riskScore: Number(t[2] ?? 100),
          active: Boolean(t[6]),
        };
      }),
    [protocolAddresses, protocolsQ.data],
  );

  const checkQ = useReadContract({
    address: deploy.riskGuard,
    abi: riskGuardAbi,
    functionName: "checkOperation",
    args: address && evalTarget ? [address, evalTarget.protocol, evalTarget.amount] : undefined,
    query: { enabled: !!(address && evalTarget) },
  });
  const check = asTuple(checkQ.data);
  const allowed = Boolean(check[0]);
  const reasonCode = Number(check[1] ?? 0);
  const checkedScore = Number(check[2] ?? 0);

  const logCountQ = useReadContract({ address: deploy.agentLog, abi: agentLogAbi, functionName: "count" });
  const lastLogQ = useReadContract({
    address: deploy.agentLog,
    abi: agentLogAbi,
    functionName: "lastEntryOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const lastLog = asTuple(lastLogQ.data);
  const logCount = logCountQ.data !== undefined ? Number(logCountQ.data as bigint) : 0;

  const exposureQ = useReadContract({
    address: deploy.riskGuard,
    abi: riskGuardAbi,
    functionName: "exposure",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const exposure = (exposureQ.data as bigint | undefined) ?? 0n;

  /* --------------------------------------------- motor off-chain (datos) */

  const [engine, setEngine] = useState<EngineData | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/latest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setEngine)
      .catch(() => setEngine(null));
  }, []);

  const engineProtocol = useMemo(() => {
    if (!engine || !selected) return null;
    const sel = selected.toLowerCase();
    return engine.protocols.find((p) => p.address.toLowerCase() === sel) || null;
  }, [engine, selected]);

  /* ------------------------------------------------------------- escrituras */

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash ?? hash });

  useEffect(() => {
    if (hash) setTxHash(hash);
  }, [hash]);

  // Restaurar sesion solo si el usuario NO la cerro explicitamente.
  useEffect(() => {
    if (localStorage.getItem(SESSION_KEY)) reconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transiciones de sesion: al conectar se registra; al cerrar se limpia y vuelve a la landing.
  const prevConnected = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevConnected.current === null) {
      prevConnected.current = isConnected;
      return;
    }
    if (prevConnected.current === isConnected) return;
    prevConnected.current = isConnected;
    if (isConnected) {
      localStorage.setItem(SESSION_KEY, address ?? "1");
      setWalletKitOpen(false);
      setView("app");
      setSegment("resumen");
      setTimeout(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" }), 400);
    } else {
      localStorage.removeItem(SESSION_KEY);
      setView("landing");
      setProfileOpen(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isSuccess) {
      policyQ.refetch();
      listQ.refetch();
      protocolsQ.refetch();
      logCountQ.refetch();
      lastLogQ.refetch();
      exposureQ.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  function setPolicy() {
    if (!address) return;
    writeContract({
      address: deploy.riskGuard,
      abi: riskGuardAbi,
      functionName: "setPolicy",
      args: [Number(form.maxRiskScore), Number(form.maxProtocols), BigInt(form.maxPerProtocol), BigInt(form.maxAmountPerOp)],
    });
  }
  function evaluate() {
    if (!selected || !amount) return;
    setEvalTarget({ protocol: selected as `0x${string}`, amount: BigInt(amount) });
  }
  const rationale = () => keccak256(toHex(`riskguard:${address}:${selected}:${amount}:${Date.now()}`));
  function commit() {
    if (!address || !evalTarget) return;
    writeContract({ address: deploy.riskGuard, abi: riskGuardAbi, functionName: "commitOperation", args: [address, evalTarget.protocol, evalTarget.amount, rationale()] });
  }
  function reject() {
    if (!address || !evalTarget) return;
    writeContract({ address: deploy.riskGuard, abi: riskGuardAbi, functionName: "recordRejection", args: [address, evalTarget.protocol, evalTarget.amount, rationale()] });
  }
  function connectWallet(c: Connector) {
    connect({ connector: c });
  }

  const wrongChain = isConnected && !SUPPORTED_CHAIN_IDS.includes(chainId);

  /* ------------------------------------------- estrategia y matriz (datos) */

  const thresholdFromStrategy = Math.round(25 + (strategy / 100) * 55); // 25..80
  const strategyRows = useMemo(() => {
    if (!engine) return [];
    return engine.protocols
      .filter((p) => protocolAddresses.some((a) => a.toLowerCase() === p.address.toLowerCase()))
      .map((p) => {
        const mc = simulate({ score: p.score, confidence: p.confidence, threshold: thresholdFromStrategy, horizon: "30d", paths: 400 });
        return { ...p, mc30: mc, permite: p.score <= thresholdFromStrategy };
      });
  }, [engine, protocolAddresses, thresholdFromStrategy]);

  /* ------------------------------------------------------------------ estilos */

  const glass = `rounded-md border backdrop-blur-xl transition-colors ${
    isDark ? "bg-[#0b1017]/85 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.55)]" : "bg-white/[0.06] border-white/10 shadow-[0_6px_24px_rgba(15,33,45,0.06)]"
  }`;
  const input = `w-full rounded-md px-3 py-2 text-sm outline-none backdrop-blur-md transition-colors ${
    isDark ? "bg-black/30 border border-white/10 text-white focus:border-cyan-400/60" : "bg-white/[0.06] border border-white/15 text-white focus:border-cyan-600"
  }`;
  const label = `block text-[11px] uppercase tracking-wider font-medium mb-1.5 ${isDark ? "text-slate-400" : "text-slate-400"}`;
  const chip = (c: string) => `inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold border rounded-sm ${c}`;

  if (!booted) return <SplashScreen onDone={() => setBooted(true)} />;

  return (
    <div className="relative min-h-screen font-['Plus_Jakarta_Sans',system-ui,sans-serif] bg-[#04060a] text-slate-100">
      <Suspense fallback={null}>
        <ThreeCanvas theme={theme} />
      </Suspense>

      <Navbar
        theme={theme}
        onLogoClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        isConnected={isConnected}
        address={address}
        chainName={deploy.name}
        onOpenWalletKit={() => setWalletKitOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onEnterApp={() => openBlock("resumen")}
        inApp={view === "app"}
      />

      <WalletKitModal
        open={walletKitOpen}
        onClose={() => setWalletKitOpen(false)}
        connectors={connectors}
        onConnect={connectWallet}
        isPending={isConnecting}
        theme={theme}
      />
      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        address={address}
        chainName={deploy.name}
        explorer={deploy.explorer}
        riskGuard={deploy.riskGuard}
        policy={policy}
        exposure={exposure}
        logCount={logCount}
        lastLog={lastLog}
        onDisconnect={() => {
          disconnect();
          setProfileOpen(false);
        }}
        theme={theme}
      />

      <main className="relative z-10 pt-24 pb-24">
        {view === "landing" && (
          <>
        {/* HERO */}
        <section className="relative overflow-hidden min-h-[86vh] flex flex-col justify-center items-center text-center px-4 sm:px-6">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[460px] rounded-full bg-[#6f86ff]/10 blur-3xl" />
            <div className="absolute left-1/2 top-2/3 -translate-x-1/2 w-[520px] h-[320px] rounded-full bg-cyan-500/100/5 blur-3xl" />
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight text-white">
            Risk
            <span className="bg-gradient-to-r from-cyan-600 via-[#4f6bff] to-purple-500 bg-clip-text text-transparent">Guard</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg md:text-xl max-w-2xl text-slate-400">
            Agente de gestion de riesgo para rendimiento pasivo en DeFi. En que protocolo ya existente es
            seguro colocar tus activos ahora: <b>el agente propone, el contrato de Avalanche dispone</b>.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {isConnected ? (
              <button onClick={() => goToSegment("resumen")} className="px-6 py-3.5 rounded-md font-bold text-sm bg-gradient-to-r from-cyan-600 to-[#4f6bff] text-white shadow-md transform hover:-translate-y-0.5 transition-all flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Entrar a la plataforma
              </button>
            ) : (
              <button onClick={() => setWalletKitOpen(true)} className="px-6 py-3.5 rounded-md font-bold text-sm bg-gradient-to-r from-cyan-600 to-[#4f6bff] text-white shadow-md transform hover:-translate-y-0.5 transition-all flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Conectar billetera
              </button>
            )}
            <button onClick={() => openBlock("analisis")} className="px-6 py-3.5 rounded-md font-bold text-sm backdrop-blur-xl border bg-white/[0.06] border-white/15 text-slate-100 transform hover:-translate-y-0.5 transition-all flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-300" /> Ver fuentes de datos
            </button>
          </div>

          {/* Metricas clave (estilo panel de datos) */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
            {[
              { v: String(protocols.length || 5), l: "protocolos en registro" },
              { v: String(engine?.dataset.snapshots ?? 1474), l: "snapshots del dataset" },
              { v: String(engine?.dataset.onchainRows ?? 18), l: "con senales on-chain" },
              { v: "3", l: "contratos verificados" },
            ].map((k) => (
              <div key={k.l} className={`p-4 ${glass} text-left`}>
                <div className="text-2xl font-extrabold font-['Space_Grotesk'] text-white">{k.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{k.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1 h-4 bg-cyan-600" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">Como funciona</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { kind: "logo", title: "Avalanche C-Chain", text: "Red donde viven los contratos y el registro." },
              { icon: ShieldCheck, title: "RiskGuard", text: "Verifica la politica y revierte la operacion que la viole." },
              { icon: Database, title: "ProtocolRegistry", text: "El puntaje se lee on-chain: el agente no puede mentir." },
              { icon: Layers, title: "AgentLog", text: "Registra cada decision, aprobada o bloqueada." },
            ].map((f: { kind?: string; icon?: any; title: string; text: string }) => (
              <div key={f.title} className={`p-4 ${glass} flex flex-col`}>
                <div className="w-9 h-9 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center mb-3 overflow-hidden">
                  {f.kind === "logo" ? (
                    <img src="/assets/coins/avax.png" alt="Avalanche" className="w-6 h-6 object-contain" />
                  ) : f.icon ? (
                    <f.icon className="w-4 h-4 text-cyan-300" />
                  ) : null}
                </div>
                <h3 className="text-sm font-bold font-['Space_Grotesk'] text-white">{f.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LA PLATAFORMA - bloques de explicacion (requieren sesion) */}
        <section className="py-8 max-w-none">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#4f6bff]/10 border border-[#4f6bff]/30 text-[#4f6bff] text-xs font-mono mb-4">
              <Gauge className="w-3.5 h-3.5" /> LA PLATAFORMA
            </div>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white">
              Dos niveles,{" "}
              <b className="font-extrabold bg-gradient-to-r from-cyan-600 to-[#4f6bff] bg-clip-text text-transparent">una sesion</b>
            </h2>
            <p className="mt-3 text-sm max-w-2xl mx-auto text-slate-400">
              Nivel 1 para operar con control; nivel 2 para analizar y ver las fuentes. Para usarlos necesitas
              vincular tu billetera: tu sesion habilita las operaciones y queda registrada on-chain.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {SEGMENTS.map((s) => (
              <button key={s.id} onClick={() => openBlock(s.id)} className={`p-5 ${glass} text-left hover:-translate-y-0.5 transition-transform`}>
                <div className="w-10 h-10 rounded-md bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-300 mb-3">
                  <s.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold font-['Space_Grotesk'] text-white">{s.label}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
                  {isConnected ? "Abrir" : "Requiere billetera"} <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* RIESGO ESTOCASTICO POR BLOQUES */}
        <StochasticRiskSection threshold={55} />

        {/* BILLETERAS (filas de ancho completo) */}
        <WalletsSection onConnect={() => setWalletKitOpen(true)} isConnected={isConnected} address={address} />

          </>
        )}

        {view === "app" && !isConnected && (
          <section className="py-24 px-4 max-w-xl mx-auto text-center">
            <div className={`p-8 ${glass}`}>
              <Wallet className="w-8 h-8 mx-auto text-cyan-300" />
              <h2 className="mt-4 text-xl font-bold text-white">Vincula tu billetera para iniciar sesion</h2>
              <p className="mt-2 text-sm text-slate-400">
                El Panel, la matriz de Riesgo, la Estrategia y los Datos se habilitan con tu sesion.
                Cada accion queda registrada en el contrato en Avalanche.
              </p>
              <button
                onClick={() => setWalletKitOpen(true)}
                className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-[#4f6bff]"
              >
                Conectar billetera
              </button>
            </div>
          </section>
        )}

        {view === "app" && isConnected && (
          <>
        {/* SIDEBOARD + CONTENIDO */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid lg:grid-cols-[264px_minmax(0,1fr)] gap-6 items-start">
          <aside className="lg:sticky lg:top-24 z-30">
            <div className={`p-4 ${glass}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-cyan-500 to-[#6f86ff] grid place-items-center text-sm font-bold text-white">
                  {address ? address.slice(2, 4).toUpperCase() : "??"}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-200 truncate">
                    {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "-"}
                  </div>
                  <div className="text-[10px] text-slate-400">{deploy.name}</div>
                </div>
              </div>

              <nav className="mt-4 space-y-1">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => goToSegment(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                      segment === s.id
                        ? "bg-gradient-to-r from-cyan-600 to-[#6f86ff] text-white"
                        : "text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <s.icon className="w-4 h-4" /> {s.label}
                  </button>
                ))}
              </nav>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
                <button
                  onClick={() => setProfileOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-slate-300 hover:bg-white/[0.06]"
                >
                  <Wallet className="w-3.5 h-3.5" /> Ver perfil
                </button>
                <button
                  onClick={() => disconnect()}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar sesion
                </button>
                <div className="px-3 pt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Contratos verificados
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div id="workspace" className="scroll-mt-32" />

        {/* DASHBOARD */}
        <section id="dashboard" className={`py-8 max-w-none scroll-mt-24 ${segment !== "resumen" ? "hidden" : ""}`}>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1 h-4 bg-cyan-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Panel de control</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Dashboard de riesgo</h2>
          </div>

          {/* KPIs del dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {[
              { v: isConnected && policyQ.data !== undefined ? `<= ${String(policy[0])}` : "-", l: "riesgo maximo" },
              { v: String(protocols.length), l: "protocolos" },
              { v: String(exposure), l: "exposicion" },
              { v: String(logCount), l: "decisiones" },
            ].map((k) => (
              <div key={k.l} className={`p-4 ${glass}`}>
                <div className="text-2xl font-extrabold font-['Space_Grotesk'] text-white">{k.v}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{k.l}</div>
              </div>
            ))}
          </div>

          {wrongChain && (
            <div className={`mb-6 p-4 rounded-2xl border flex flex-wrap items-center gap-3 ${isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200"}`}>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm">Cambia a la red de los contratos:</span>
              {SUPPORTED_CHAIN_IDS.map((id) => (
                <button key={id} onClick={() => switchChain({ chainId: id as 43113 | 43114 })} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  {deploymentFor(id).name}
                </button>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-5">
            <div className={`p-6 ${glass}`}>
              <h3 className={`text-sm font-bold font-['Space_Grotesk'] mb-1 flex items-center gap-2 ${isDark ? "text-white" : "text-white"}`}>
                <ShieldCheck className="w-4 h-4 text-cyan-400" /> Mi politica <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>setPolicy</span>
              </h3>
              {isConnected && policyQ.data !== undefined ? (
                <p className={`text-xs mb-4 font-mono ${isDark ? "text-cyan-300" : "text-cyan-300"}`}>
                  Actual: riesgo max {String(policy[0])} - protocolos {String(policy[1])} - tope/protocolo {String(policy[2])} - tope/op {String(policy[3])} - {policy[4] ? "activa" : "inactiva"}
                </p>
              ) : (
                <p className={`text-xs mb-4 ${isDark ? "text-slate-400" : "text-slate-400"}`}>Conecta la billetera para ver y definir tu politica.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><span className={label}>Riesgo maximo</span><input className={input} value={form.maxRiskScore} onChange={(e) => setForm({ ...form, maxRiskScore: e.target.value })} /></div>
                <div><span className={label}>Protocolos</span><input className={input} value={form.maxProtocols} onChange={(e) => setForm({ ...form, maxProtocols: e.target.value })} /></div>
                <div><span className={label}>Tope por protocolo</span><input className={input} value={form.maxPerProtocol} onChange={(e) => setForm({ ...form, maxPerProtocol: e.target.value })} /></div>
                <div><span className={label}>Tope por operacion</span><input className={input} value={form.maxAmountPerOp} onChange={(e) => setForm({ ...form, maxAmountPerOp: e.target.value })} /></div>
              </div>
              <button onClick={setPolicy} disabled={!isConnected || isPending} className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 to-purple-600 text-white disabled:opacity-40">
                {isPending ? "Firmando..." : "Fijar politica"}
              </button>
            </div>

            <div className={`p-6 ${glass}`}>
              <h3 className={`text-sm font-bold font-['Space_Grotesk'] mb-4 flex items-center gap-2 ${isDark ? "text-white" : "text-white"}`}>
                <Database className="w-4 h-4 text-purple-400" /> Protocolos registrados <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>ProtocolRegistry.list</span>
              </h3>
              {protocols.length === 0 ? (
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-400"}`}>Aun no hay protocolos registrados.</p>
              ) : (
                <div className="space-y-2">
                  {protocols.map((p) => {
                    const band = bandKey(p.riskScore);
                    return (
                      <button key={p.address} onClick={() => setSelected(p.address)} className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all ${selected === p.address ? (isDark ? "border-cyan-400/60 bg-cyan-500/100/10" : "border-cyan-400 bg-cyan-500/10") : isDark ? "border-white/10 hover:border-cyan-400/40" : "border-white/10 hover:border-cyan-400"}`}>
                        <span>
                          <span className={`block text-sm font-semibold ${isDark ? "text-white" : "text-white"}`}>{p.name}</span>
                          <span className={`block text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>{short(p.address)} - {p.active ? "activo" : "inactivo"}</span>
                        </span>
                        <span className={`shrink-0 ${chip(bandChip(band))}`}>{p.riskScore} {BAND_NAMES[band === "verde" ? 0 : band === "ambar" ? 1 : 2]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Evaluar */}
          <div className={`p-6 mt-5 ${glass}`}>
            <h3 className={`text-sm font-bold font-['Space_Grotesk'] mb-4 flex items-center gap-2 ${isDark ? "text-white" : "text-white"}`}>
              <Gauge className="w-4 h-4 text-cyan-400" /> Evaluar y ejecutar <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>checkOperation / commitOperation</span>
            </h3>
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <span className={label}>Protocolo</span>
                <select className={input} value={selected} onChange={(e) => setSelected(e.target.value)}>
                  <option value="">Selecciona un protocolo...</option>
                  {protocols.map((p) => (<option key={p.address} value={p.address}>{p.name} - riesgo {p.riskScore}</option>))}
                </select>
                <span className={`${label} mt-3`}>Monto (unidades)</span>
                <input className={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button onClick={evaluate} disabled={!isConnected || !selected} className={`mt-4 px-5 py-2.5 rounded-xl text-sm font-bold border disabled:opacity-40 transition-all ${isDark ? "bg-white/[0.06] border-cyan-400/40 text-white hover:bg-white/[0.12]" : "bg-white/[0.06] border-cyan-400 text-slate-100 hover:bg-cyan-500/10"}`}>
                  Evaluar (control previo)
                </button>
              </div>
              <div>
                {evalTarget && checkQ.data !== undefined ? (
                  <div className={`h-full rounded-2xl border p-5 backdrop-blur-xl ${allowed ? "bg-emerald-500/100/10 border-emerald-500/40" : "bg-rose-500/10 border-rose-500/40"}`}>
                    <div className={`flex items-center gap-2 font-bold ${allowed ? "text-emerald-400" : "text-rose-400"}`}>
                      {allowed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      {allowed ? "PERMITIDA por la politica" : "BLOQUEADA por el contrato"}
                    </div>
                    <p className={`mt-2 text-sm ${isDark ? "text-slate-300" : "text-slate-200"}`}>Motivo: {reasonCode} - {REASON_CODES[reasonCode] ?? "desconocido"}</p>
                    <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-200"}`}>Puntaje leido on-chain: <b>{checkedScore}</b> ({bandKey(checkedScore)})</p>
                    <p className={`mt-2 text-[11px] ${isDark ? "text-slate-400" : "text-slate-400"}`}>El puntaje NO lo aporta el agente: se lee de ProtocolRegistry.</p>
                    <button onClick={allowed ? commit : reject} disabled={isPending} className={`mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white ${allowed ? "bg-emerald-600 hover:bg-emerald-500/100" : "bg-rose-600 hover:bg-rose-500"}`}>
                      {allowed ? "Ejecutar asignacion (commitOperation)" : "Registrar perdida evitada (recordRejection)"}
                    </button>
                  </div>
                ) : (
                  <div className={`h-full rounded-2xl border border-dashed flex items-center justify-center text-sm p-6 ${isDark ? "border-white/10 text-slate-400" : "border-white/15 text-slate-400"}`}>
                    Selecciona un protocolo y pulsa "Evaluar".
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Motor off-chain */}
          <div className={`p-6 mt-5 ${glass}`}>
            <h3 className={`text-sm font-bold font-['Space_Grotesk'] mb-4 flex items-center gap-2 ${isDark ? "text-white" : "text-white"}`}>
              <Activity className="w-4 h-4 text-purple-400" /> Motor de riesgo off-chain <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>scoring + montecarlo</span>
            </h3>
            {!engineProtocol ? (
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-400"}`}>Selecciona un protocolo para ver sus senales, cobertura y simulacion por lapso.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-6 mb-4">
                  {[
                    { v: String(engineProtocol.score), l: `riesgo 0-100 (${engineProtocol.band})`, c: bandText(engineProtocol.band) },
                    { v: `${engineProtocol.coverage}%`, l: "cobertura de senales" },
                    { v: String(engineProtocol.confidence), l: "confianza" },
                    { v: engineProtocol.asOf, l: "fecha del dato" },
                  ].map((k) => (
                    <div key={k.l}>
                      <div className={`text-2xl font-extrabold font-['Space_Grotesk'] ${k.c ?? (isDark ? "text-white" : "text-white")}`}>{k.v}</div>
                      <div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>{k.l}</div>
                    </div>
                  ))}
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className={isDark ? "text-slate-400" : "text-slate-400"}><th className="text-left py-2">Senal</th><th className="text-left py-2">Fuente</th><th className="text-right py-2">Valor</th><th className="text-right py-2">Pts</th></tr></thead>
                      <tbody>
                        {engineProtocol.signals.map((s) => (
                          <tr key={s.signal} className={`border-t ${isDark ? "border-white/10" : "border-white/10"} ${s.available ? "" : "opacity-50"}`}>
                            <td className="py-1.5">{s.label}</td>
                            <td className={`py-1.5 font-mono ${s.source === "onchain" ? "text-cyan-400" : "text-purple-400"}`}>{s.source}</td>
                            <td className="py-1.5 text-right font-mono">{s.available ? String(s.input) : "sin dato"}</td>
                            <td className="py-1.5 text-right font-mono">{s.available ? s.points : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-x-auto">
                    <div className={`text-[11px] uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-400"}`}>Monte Carlo por lapso (umbral {engine?.threshold ?? 55})</div>
                    <table className="w-full text-xs">
                      <thead><tr className={isDark ? "text-slate-400" : "text-slate-400"}><th className="text-left py-2">Lapso</th><th className="text-right py-2">p5</th><th className="text-right py-2">p50</th><th className="text-right py-2">p95</th><th className="text-right py-2">P(brecha)</th></tr></thead>
                      <tbody>
                        {(engine?.timeframes ?? []).map((tf) => {
                          const m = engineProtocol.montecarlo[tf];
                          return (
                            <tr key={tf} className={`border-t ${isDark ? "border-white/10" : "border-white/10"}`}>
                              <td className="py-1.5 font-mono">{tf}</td>
                              <td className="py-1.5 text-right font-mono">{m?.p5 ?? "-"}</td>
                              <td className="py-1.5 text-right font-mono">{m?.p50 ?? "-"}</td>
                              <td className="py-1.5 text-right font-mono">{m?.p95 ?? "-"}</td>
                              <td className="py-1.5 text-right font-mono">{((Number(m?.breachProbability) || 0) * 100).toFixed(2)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {engineProtocol.reasons.length > 0 && (
                      <p className={`mt-3 text-[11px] ${isDark ? "text-slate-400" : "text-slate-400"}`}>Motivos: {engineProtocol.reasons.join("; ")}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Log */}
          <div className={`p-6 mt-5 ${glass}`}>
            <h3 className={`text-sm font-bold font-['Space_Grotesk'] mb-4 flex items-center gap-2 ${isDark ? "text-white" : "text-white"}`}>
              <Layers className="w-4 h-4 text-cyan-400" /> Registro de decisiones <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-400"}`}>AgentLog</span>
            </h3>
            <div className="flex flex-wrap gap-8">
              <div><div className="text-2xl font-extrabold font-['Space_Grotesk']">{logCount}</div><div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>entradas totales</div></div>
              {isConnected && lastLogQ.data !== undefined && lastLog[0] !== "0x0000000000000000000000000000000000000000" && (
                <div>
                  <div className={`text-2xl font-extrabold font-['Space_Grotesk'] ${lastLog[5] ? "text-emerald-400" : "text-rose-400"}`}>{lastLog[5] ? "ejecutada" : "bloqueada"}</div>
                  <div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>ultima: protocolo {short(String(lastLog[1]))} - riesgo {String(lastLog[3])} - motivo {String(lastLog[4])}</div>
                </div>
              )}
            </div>
            {(error || isConfirming || isSuccess) && (
              <p className={`mt-4 text-xs ${error ? "text-rose-400" : isDark ? "text-slate-400" : "text-slate-400"}`}>
                {error ? `Error: ${error.message.split("\n")[0]}` : isConfirming ? "Confirmando transaccion..." : "Transaccion confirmada."}
                {txHash && (<>{" "}<a className="text-cyan-400 underline font-mono" href={`${deploy.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">ver en el explorador</a></>)}
              </p>
            )}
          </div>
        </section>

        {/* MATRIZ DE DATOS */}
        <section id="matriz" className={`py-8 max-w-none scroll-mt-24 ${segment !== "analisis" ? "hidden" : ""}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/100/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-4"><LineChart className="w-3.5 h-3.5" /> MATRIZ DE RIESGO</div>
            <h2 className={`text-3xl sm:text-4xl font-light tracking-tight ${isDark ? "text-slate-100" : "text-white"}`}>
              Variabilidad y prediccion <b className="font-extrabold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">por lapso</b>
            </h2>
            <p className={`mt-3 text-sm max-w-2xl mx-auto ${isDark ? "text-slate-400" : "text-slate-400"}`}>
              Cada celda es el rango p95-p5 del puntaje simulado (variabilidad): cuanto mas ancho, mas incierta
              la prediccion del riesgo del protocolo en ese lapso.
            </p>
          </div>
          {engine && (
            <div className={`p-4 sm:p-6 overflow-x-auto ${glass}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-400"}`}>Horizonte principal:</span>
                {["7d", "30d", "90d"].map((h) => (
                  <button key={h} onClick={() => setMatrixHorizon(h)} className={`px-3 py-1 rounded-lg text-xs font-semibold border ${matrixHorizon === h ? "bg-cyan-500/100/20 border-cyan-400/50 text-cyan-300" : isDark ? "border-white/10 text-slate-400" : "border-white/10 text-slate-400"}`}>{h}</button>
                ))}
              </div>
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className={isDark ? "text-slate-400" : "text-slate-400"}>
                    <th className="text-left py-2">Protocolo</th>
                    <th className="text-right py-2">Score</th>
                    {["1h", "24h", "7d", "30d", "90d"].map((tf) => (<th key={tf} className="text-right py-2">{tf}</th>))}
                    <th className="text-right py-2">P(brecha {matrixHorizon})</th>
                  </tr>
                </thead>
                <tbody>
                  {engine.protocols
                    .filter((p) => protocolAddresses.some((a) => a.toLowerCase() === p.address.toLowerCase()))
                    .map((p) => {
                      const main = p.montecarlo[matrixHorizon];
                      return (
                        <tr key={p.id} className={`border-t ${isDark ? "border-white/10" : "border-white/10"}`}>
                          <td className="py-2">{p.name}</td>
                          <td className={`py-2 text-right font-mono ${bandText(p.band)}`}>{p.score}</td>
                          {["1h", "24h", "7d", "30d", "90d"].map((tf) => {
                            const m = p.montecarlo[tf];
                            const spread = m ? m.p95 - m.p5 : null;
                            return <td key={tf} className="py-2 text-right font-mono">{spread === null ? "-" : spread.toFixed(1)}</td>;
                          })}
                          <td className="py-2 text-right font-mono">{main ? `${(main.breachProbability * 100).toFixed(1)}%` : "-"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ESTRATEGIA */}
        <section id="estrategia" className={`py-8 max-w-none scroll-mt-24 ${segment !== "analisis" ? "hidden" : ""}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-mono mb-4"><Sliders className="w-3.5 h-3.5" /> ESTRATEGIA</div>
            <h2 className={`text-3xl sm:text-4xl font-light tracking-tight ${isDark ? "text-slate-100" : "text-white"}`}>
              Prediccion segun el <b className="font-extrabold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">perfil de riesgo</b>
            </h2>
            <p className={`mt-3 text-sm max-w-2xl mx-auto ${isDark ? "text-slate-400" : "text-slate-400"}`}>
              Mueve la tolerancia y mira como cambia la recomendacion: que protocolos quedan habilitados y la
              probabilidad de brecha a 30 dias segun su comportamiento.
            </p>
          </div>

          <div className={`p-6 ${glass}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Conservador</span>
              <span className="text-sm font-mono">Tolerancia {strategy}% - umbral {thresholdFromStrategy}</span>
              <span className="text-xs font-semibold">Agresivo</span>
            </div>
            <input type="range" min={0} max={100} value={strategy} onChange={(e) => setStrategy(Number(e.target.value))} className="w-full accent-cyan-500" />

            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <div className={`p-4 rounded-2xl border ${isDark ? "border-white/10" : "border-white/10"}`}>
                <div className="text-2xl font-extrabold font-['Space_Grotesk']">{strategyRows.filter((r) => r.permite).length}</div>
                <div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>protocolos habilitados</div>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? "border-white/10" : "border-white/10"}`}>
                <div className="text-2xl font-extrabold font-['Space_Grotesk']">{strategyRows.filter((r) => !r.permite).length}</div>
                <div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>bloqueados por politica</div>
              </div>
              <div className={`p-4 rounded-2xl border ${isDark ? "border-white/10" : "border-white/10"}`}>
                <div className="text-2xl font-extrabold font-['Space_Grotesk']">
                  {strategyRows.length ? `${((strategyRows.reduce((a, r) => a + r.mc30.breachProbability, 0) / strategyRows.length) * 100).toFixed(1)}%` : "-"}
                </div>
                <div className={`text-[11px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>brecha media 30d</div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className={isDark ? "text-slate-400" : "text-slate-400"}>
                    <th className="text-left py-2">Protocolo</th>
                    <th className="text-right py-2">Score</th>
                    <th className="text-right py-2">p50 30d</th>
                    <th className="text-right py-2">p95 30d</th>
                    <th className="text-right py-2">P(brecha 30d)</th>
                    <th className="text-right py-2">Recomendacion</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyRows.map((r) => (
                    <tr key={r.id} className={`border-t ${isDark ? "border-white/10" : "border-white/10"}`}>
                      <td className="py-2">{r.name}</td>
                      <td className={`py-2 text-right font-mono ${bandText(r.band)}`}>{r.score}</td>
                      <td className="py-2 text-right font-mono">{r.mc30.p50}</td>
                      <td className="py-2 text-right font-mono">{r.mc30.p95}</td>
                      <td className="py-2 text-right font-mono">{(r.mc30.breachProbability * 100).toFixed(1)}%</td>
                      <td className="py-2 text-right">
                        <span className={chip(r.permite ? bandChip("verde") : bandChip("rojo"))}>{r.permite ? "asignar" : "evitar"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* APIS */}
        <section id="apis" className={`py-8 max-w-none scroll-mt-24 ${segment !== "analisis" ? "hidden" : ""}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/100/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-4"><Radio className="w-3.5 h-3.5" /> FUENTES Y SEGUIMIENTO</div>
            <h2 className={`text-3xl sm:text-4xl font-light tracking-tight ${isDark ? "text-slate-100" : "text-white"}`}>
              De donde salen los <b className="font-extrabold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">datos</b>
            </h2>
            <p className={`mt-3 text-sm max-w-2xl mx-auto ${isDark ? "text-slate-400" : "text-slate-400"}`}>
              Cada senal del modelo tiene una fuente verificable. Estas son las APIs y servicios que alimentan
              el puntaje, el backtesting y el control previo.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {API_SOURCES.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className={`p-5 ${glass} hover:-translate-y-0.5 transition-transform block`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/100/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400"><s.icon className="w-4 h-4" /></div>
                  <div>
                    <div className={`text-sm font-bold font-['Space_Grotesk'] ${isDark ? "text-white" : "text-white"}`}>{s.name}</div>
                    <div className={`text-[10px] uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>{s.role}</div>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-400"}`}>{s.use}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-400">Abrir <ExternalLink className="w-3 h-3" /></span>
              </a>
            ))}
          </div>
        </section>

        {/* STEREUM / FONDEO */}
        <section id="fondeo" className={`py-8 max-w-none scroll-mt-24 ${segment !== "analisis" ? "hidden" : ""}`}>
          <div className={`p-6 sm:p-8 ${glass}`}>
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-['Space_Grotesk'] text-white">Fondeo: Bs a USDC/USDT</h3>
                  <p className="text-xs text-slate-400">Rampa fiat (Stereum) para fondear la billetera antes de asignar.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={chip(stereum?.ready ? bandChip("verde") : stereum?.configured ? bandChip("ambar") : bandChip("rojo"))}>
                  {stereum?.ready ? "API operativa" : stereum?.configured ? "falta habilitar cuenta" : "proxy no disponible"}
                </span>
                <button onClick={checkStereum} className="px-3 py-2 rounded-md text-xs font-bold border border-white/15 bg-white/[0.06] text-slate-200 hover:border-cyan-600">
                  Revisar
                </button>
                <a href="https://console.stereum.tech" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-md text-sm font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white flex items-center gap-2">
                  Console <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {stereum?.message ? `Stereum: ${stereum.message}` : "Consultando a Stereum..."}
              {stereum?.hint ? ` ${stereum.hint}` : ""}
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              <div>
                <span className={label}>Monto</span>
                <input className={input} value={stereumForm.amount} onChange={(e) => setStereumForm({ ...stereumForm, amount: e.target.value })} />
              </div>
              <div>
                <span className={label}>Moneda</span>
                <input className={input} value={stereumForm.currency} onChange={(e) => setStereumForm({ ...stereumForm, currency: e.target.value })} />
              </div>
              <div>
                <span className={label}>Descripcion</span>
                <input className={input} value={stereumForm.description} onChange={(e) => setStereumForm({ ...stereumForm, description: e.target.value })} />
              </div>
            </div>
            <button onClick={sendStereum} className="mt-4 px-5 py-2.5 rounded-md text-sm font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
              Enviar transferencia firmada
            </button>
            {stereumOut && <p className="mt-3 text-xs font-mono text-slate-400">{stereumOut}</p>}

            <p className="mt-4 text-[11px] text-slate-400">
              Las credenciales viven solo en el proxy server-side (`.env`), nunca en el navegador. Endpoint:
              `POST /api/v1/transfers/send` con firma HMAC-SHA256 (`x-api-key`, `x-signature`, `x-timestamp`).
            </p>
          </div>
        </section>

          </div>
        </div>
          </>
        )}

        {/* FOOTER */}
        <footer className="mt-10 border-t border-white/10 bg-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3 text-left">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-bold font-['Space_Grotesk'] text-white">RiskGuard</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Agente de gestion de riesgo para rendimiento pasivo en DeFi sobre Avalanche. No custodial:
                la billetera firma y el contrato decide.
              </p>
              <p className="mt-2 text-[10px] text-slate-400">
                Uso experimental en testnet. No constituye asesoria financiera.
              </p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Contratos ({deploy.name})</div>
              <ul className="space-y-1 text-[11px] font-mono text-slate-400">
                <li>RiskGuard <span className="text-slate-400">{short(deploy.riskGuard)}</span></li>
                <li>ProtocolRegistry <span className="text-slate-400">{short(deploy.registry)}</span></li>
                <li>AgentLog <span className="text-slate-400">{short(deploy.agentLog)}</span></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Verificacion y enlaces</div>
              <ul className="space-y-1.5 text-[11px]">
                <li>
                  <a className="text-cyan-300 hover:underline" href={`https://repo.sourcify.dev/contracts/full_match/43113/${deploy.riskGuard}/`} target="_blank" rel="noreferrer">
                    Verificados en Sourcify (full match)
                  </a>
                </li>
                <li>
                  <a className="text-cyan-300 hover:underline" href={`${deploy.explorer}/address/${deploy.riskGuard}`} target="_blank" rel="noreferrer">
                    Explorador de transacciones
                  </a>
                </li>
                <li>
                  <a className="text-cyan-300 hover:underline" href="https://gitlab.com/0xronaldo/agentavaxt1" target="_blank" rel="noreferrer">
                    Codigo fuente
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
