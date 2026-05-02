import { useEffect, useRef, useState } from "react";
import { Brain, Zap } from "lucide-react";
import { useLithovexStatus } from "../hooks/useLithovexStatus";

// Public-facing status chip.
// Deliberately reveals NOTHING about the underlying token pool, model count,
// or which HuggingFace model is actually serving the request. Users see only
// a single LITHOVEX brand state: online / degraded / offline.
export function LithovexStatusChip() {
  const { data, isLoading, isError } = useLithovexStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const failover = data?.failover ?? (isError ? "down" : "armed");
  const dotCls =
    failover === "armed" ? "bg-emerald-400" :
    failover === "degraded" ? "bg-amber-400" : "bg-red-500";
  const ringCls =
    failover === "armed" ? "ring-emerald-400/30" :
    failover === "degraded" ? "ring-amber-400/30" : "ring-red-500/30";
  const stateLabel =
    isLoading ? "starting" :
    isError ? "offline" :
    failover === "armed" ? "online" :
    failover === "degraded" ? "degraded" : "offline";
  const repo = data?.repo;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-gray-300 hover:text-white hover:bg-white/6 transition-colors ring-1 ${ringCls}`}
        title="LITHOVEX status"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${dotCls} opacity-60 animate-ping`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotCls}`} />
        </span>
        <Brain className="w-3 h-3 text-purple-300" />
        <span>LITHOVEX</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[260px] rounded-xl border border-white/10 bg-[#0e0e0e] shadow-2xl p-3 z-50">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-300" />
            <div className="text-sm font-semibold text-gray-100">LITHOVEX</div>
            <div className={`ml-auto text-[11px] ${
              failover === "armed" ? "text-emerald-400" :
              failover === "degraded" ? "text-amber-400" : "text-red-400"
            }`}>
              {stateLabel}
            </div>
          </div>
          <div className="text-[11px] text-gray-400 leading-relaxed">
            {failover === "armed" && "All systems nominal. Failover armed and ready."}
            {failover === "degraded" && "Operating with reduced capacity. Auto-recovery in progress."}
            {failover === "down" && "Service temporarily unavailable. Retrying in the background."}
          </div>
          <div className="mt-3 pt-2 border-t border-white/8 text-[11px] space-y-1">
            <Row label="Reasoning engine" value={<Zap className="w-3 h-3 text-amber-300 inline" />} valueText="Active" />
            <Row label="Repo" valueText={repo?.connected ? (repo.login ?? "Connected") : "Not connected"} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueText }: { label: string; value?: React.ReactNode; valueText: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 flex items-center gap-1">
        {value}
        {valueText}
      </span>
    </div>
  );
}
