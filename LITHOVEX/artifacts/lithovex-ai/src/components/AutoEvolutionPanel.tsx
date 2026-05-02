import { useEffect, useRef } from "react";
import { Cpu, CircleStop, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface EvolutionCycle {
  cycle: number;
  task: string;
  reasoning: string;
  status: "pending" | "running" | "done" | "complete";
}

interface AutoEvolutionPanelProps {
  isActive: boolean;
  onStop: () => void;
  cycles: EvolutionCycle[];
  currentCycle: number;
  isProcessing: boolean;
}

export function AutoEvolutionPanel({
  isActive,
  onStop,
  cycles,
  currentCycle,
  isProcessing,
}: AutoEvolutionPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [cycles]);

  if (!isActive) return null;

  const lastCompleted = cycles.find((c) => c.status === "complete");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-20">
      <div
        className="pointer-events-auto w-full max-w-2xl mx-4 rounded-xl border border-[#f5b800]/30 bg-[#0a1428]/95 backdrop-blur-sm shadow-2xl shadow-[#f5b800]/10 overflow-hidden"
        style={{
          animation: isActive ? "pulse-border 2s ease-in-out infinite" : "none",
        }}
      >
        <style>{`
          @keyframes pulse-border {
            0%, 100% { border-color: rgba(245,184,0,0.3); box-shadow: 0 0 20px rgba(245,184,0,0.1); }
            50% { border-color: rgba(245,184,0,0.7); box-shadow: 0 0 40px rgba(245,184,0,0.25); }
          }
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="flex items-center justify-between px-4 py-2 border-b border-[#f5b800]/20 bg-[#f5b800]/5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Cpu className="h-4 w-4 text-[#f5b800]" />
              {isProcessing && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#f5b800] animate-pulse" />
              )}
            </div>
            <span className="text-sm font-bold text-[#f5b800] tracking-wider uppercase">
              Auto Decision Mode
            </span>
            <span className="text-xs text-gray-500 font-mono">
              Cycle {currentCycle}
            </span>
            {isProcessing && (
              <span className="flex items-center gap-1 text-xs text-[#f5b800]/70">
                <Loader2 className="h-3 w-3 animate-spin" />
                Evolving...
              </span>
            )}
            {lastCompleted && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Project complete
              </span>
            )}
          </div>
          <Button
            onClick={onStop}
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <CircleStop className="h-3.5 w-3.5 mr-1" />
            Stop
          </Button>
        </div>

        <div ref={listRef} className="w-full max-h-[50dvh] md:max-h-32 overflow-y-auto px-4 py-2 space-y-1.5">
          {cycles.length === 0 && (
            <div className="text-xs text-gray-500 italic py-1">
              Analyzing project and generating first improvement task...
            </div>
          )}
          {cycles.map((c) => (
            <div key={c.cycle} className="flex items-start gap-2">
              <span className="text-xs text-gray-600 font-mono w-14 shrink-0 pt-0.5">
                #{c.cycle}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {c.status === "running" && (
                    <RefreshCw className="h-3 w-3 text-[#f5b800] shrink-0" style={{ animation: "spin-slow 1.5s linear infinite" }} />
                  )}
                  {c.status === "done" && (
                    <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                  )}
                  {c.status === "complete" && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  )}
                  {c.status === "pending" && (
                    <Loader2 className="h-3 w-3 text-gray-500 shrink-0 animate-spin" />
                  )}
                  <span
                    className={`text-xs truncate ${
                      c.status === "running"
                        ? "text-[#f5b800]"
                        : c.status === "done" || c.status === "complete"
                        ? "text-gray-400"
                        : "text-gray-500"
                    }`}
                  >
                    {c.task.split("\n")[0]}
                  </span>
                </div>
                {c.reasoning && c.status === "running" && (
                  <p className="text-xs text-gray-600 mt-0.5 pl-4 truncate">{c.reasoning}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
