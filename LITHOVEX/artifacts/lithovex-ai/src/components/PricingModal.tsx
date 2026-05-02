import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

const FREE_FEATURES = [
  "50+ open-source models",
  "Standard chat & code generation",
  "Community support",
];

const PRO_FEATURES = [
  "GPT-5.5, Claude Opus 4.7, o3 Pro",
  "Grok-4 Heavy, Gemini 2.5 Ultra, Kimi K2",
  "DeepSeek R2, Qwen 3 235B + every new drop",
  "LITHOVEX Co-work & Auto-Code loops",
  "File explorer, GitHub & priority speed",
];

export function PricingModal({ open, onClose }: PricingModalProps) {
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const proPrice = isYearly ? 400 : 40;
  const proPeriod = isYearly ? "/year" : "/month";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto
          rounded-2xl border border-white/10
          bg-[#0f0d18]/95 backdrop-blur-xl
          shadow-2xl shadow-black/50
        "
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="
            absolute right-3 top-3 z-10
            inline-flex h-9 w-9 items-center justify-center rounded-lg
            text-gray-500 hover:text-gray-200 hover:bg-white/6
            transition-colors
          "
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-white/6">
          <h2
            id="pricing-title"
            className="text-base font-semibold text-white"
          >
            Upgrade LITHOVEX
          </h2>
          <p className="mt-1 text-sm text-gray-400 leading-relaxed">
            Unlock premium models, unlimited history, and priority speed.
          </p>

          {/* Billing toggle */}
          <div className="mt-5 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-9 ${
                !isYearly
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-9 inline-flex items-center gap-1.5 ${
                isYearly
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Yearly
              <span className="text-[10px] font-semibold text-purple-300">
                Save $80
              </span>
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="px-6 sm:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Free */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Free</h3>
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                Current
              </span>
            </div>

            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-semibold text-white tracking-tight">
                $0
              </span>
              <span className="text-gray-500 ml-1.5 text-xs">/forever</span>
            </div>

            <ul className="mt-5 space-y-2.5 text-sm flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-gray-300">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-gray-500 flex-shrink-0" />
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            <button
              disabled
              className="
                mt-5 w-full py-2.5 rounded-xl text-sm font-medium
                bg-white/5 text-gray-500 border border-white/10
                cursor-default min-h-11
              "
            >
              Current plan
            </button>
          </div>

          {/* Pro */}
          <div className="rounded-xl border border-purple-500/30 bg-white/[0.02] p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Pro</h3>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Popular
              </span>
            </div>

            <div className="mt-4 flex items-baseline">
              <span className="text-3xl font-semibold text-white tracking-tight tabular-nums">
                ${proPrice}
              </span>
              <span className="text-gray-500 ml-1.5 text-xs">{proPeriod}</span>
            </div>
            {isYearly && (
              <p className="mt-1 text-[11px] text-emerald-500 font-semibold">
                Save $80/year vs monthly
              </p>
            )}

            <ul className="mt-5 space-y-2.5 text-sm flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-gray-200">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-purple-400 flex-shrink-0" />
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                window.open('mailto:upgrade@lithovex.ai?subject=Upgrade%20to%20Pro', '_blank');
              }}
              className="
                mt-5 w-full py-2.5 rounded-xl text-sm font-medium
                bg-purple-600 text-white hover:bg-purple-500
                transition-colors min-h-11
              "
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingModal;
