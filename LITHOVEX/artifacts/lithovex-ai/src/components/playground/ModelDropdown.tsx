// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Model Selector Dropdown
// Phase 3: Advanced searchable, categorized model picker
// ─────────────────────────────────────────────────────────────────────────────

import {
  useRef,
  useLayoutEffect,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, Zap, BrainCircuit, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/use-mobile";
import { HF_MODELS } from "@/components/SettingsPanel";
import type { ModelConfig } from "@/lib/types";

// ─── Badge extraction ─────────────────────────────────────────────────────────

/**
 * Extracts a compact badge string from a model label.
 * Priority: size (e.g. "7B", "235B"), then type tag (Vision, Code, Reasoning).
 */
function extractBadge(label: string): string | null {
  // Match size patterns like 7B, 8B, 70B, 235B, 1.5B
  const sizeMatch = label.match(/(\d+(?:\.\d+)?B)/i);
  if (sizeMatch) return sizeMatch[1].toUpperCase();

  // Type tags
  if (/vision|vl/i.test(label)) return "Vision";
  if (/coder|code/i.test(label)) return "Code";
  if (/thinking|reasoning|r1/i.test(label)) return "Reason";
  if (/moe/i.test(label)) return "MoE";

  return null;
}

// ─── Dropdown position type ───────────────────────────────────────────────────

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

// ─── Model list row ───────────────────────────────────────────────────────────

interface ModelRowProps {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "expert";
  isActive: boolean;
  onToggle: (id: string) => void;
}

function ModelRow({ id, label, description, tier, isActive, onToggle }: ModelRowProps) {
  const badge = extractBadge(label);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle(id);
      }
    },
    [id, onToggle]
  );

  return (
    <button
      role="option"
      aria-selected={isActive}
      onClick={() => onToggle(id)}
      onKeyDown={handleKeyDown}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 text-left
        transition-colors duration-150
        outline-none focus-visible:bg-zinc-700/50
        ${isActive
          ? "bg-indigo-600/10 hover:bg-indigo-600/15"
          : "hover:bg-zinc-700/40"
        }
      `}
    >
      {/* Tier icon */}
      <span className="flex-shrink-0 mt-0.5">
        {tier === "fast" ? (
          <Zap className="w-3.5 h-3.5 text-blue-400" />
        ) : (
          <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
        )}
      </span>

      {/* Name + description */}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-xs font-medium leading-tight truncate ${
              isActive ? "text-indigo-300" : "text-zinc-200"
            }`}
          >
            {label}
          </span>
          {badge && (
            <span
              className={`
                shrink-0 px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wide
                ${tier === "fast"
                  ? "bg-blue-900/40 text-blue-400"
                  : "bg-purple-900/40 text-purple-400"
                }
              `}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="block text-[11px] text-zinc-500 truncate mt-0.5">
          {description}
        </span>
      </span>

      {/* Active indicator */}
      <span className="flex-shrink-0 w-4">
        {isActive && <Check className="w-4 h-4 text-indigo-400" />}
      </span>
    </button>
  );
}

// ─── Main dropdown ────────────────────────────────────────────────────────────

interface ModelDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the trigger button for position calculation */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  activeModelIds: Set<string>;
  onToggleModel: (id: string) => void;
}

export function ModelDropdown({
  isOpen,
  onClose,
  triggerRef,
  activeModelIds,
  onToggleModel,
}: ModelDropdownProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const isMobile = useIsMobile();

  // ── Window boundary awareness (desktop only) ──────────────────────────────
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || isMobile) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const DROPDOWN_HEIGHT = 440;
    const DROPDOWN_WIDTH = 360;
    const MARGIN = 8;

    const spaceBelow = window.innerHeight - trigger.bottom - MARGIN;
    const spaceRight = window.innerWidth - trigger.left - MARGIN;

    const pos: DropdownPosition = {};

    // Vertical: prefer below, flip above if not enough space
    if (spaceBelow >= DROPDOWN_HEIGHT) {
      pos.top = trigger.bottom + MARGIN;
    } else {
      pos.bottom = window.innerHeight - trigger.top + MARGIN;
    }

    // Horizontal: prefer align-left of trigger, shift left if clipping
    if (spaceRight >= DROPDOWN_WIDTH) {
      pos.left = trigger.left;
    } else {
      pos.right = MARGIN;
    }

    setPosition(pos);
  }, [isOpen, triggerRef]);

  // ── Auto-focus search on open ──────────────────────────────────────────────
  useLayoutEffect(() => {
    if (isOpen) {
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, triggerRef]);

  // ── Keyboard: Escape closes ────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!isOpen) return;
    function handler(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Filter + group models ──────────────────────────────────────────────────
  const q = debouncedQuery.toLowerCase();
  const filtered = HF_MODELS.filter((m) => {
    if (!q) return true;
    return (
      m.label.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    );
  });

  const categories = [...new Set(filtered.map((m) => m.category))];

  const activeCount = activeModelIds.size;

  const mobileStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    maxHeight: "85dvh",
    zIndex: 200,
    paddingBottom: "env(safe-area-inset-bottom)",
  };

  const desktopStyle: React.CSSProperties = {
    position: "fixed",
    width: 360,
    maxHeight: 440,
    zIndex: 200,
    ...position,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {isMobile && (
            <motion.div
              key="model-dropdown-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              aria-hidden="true"
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                zIndex: 199,
              }}
            />
          )}
          <motion.div
            ref={dropdownRef}
            role="listbox"
            aria-label="Select models for playground"
            aria-multiselectable="true"
            initial={
              isMobile
                ? { opacity: 0, y: "100%" }
                : { opacity: 0, y: -10, scale: 0.97 }
            }
            animate={
              isMobile
                ? { opacity: 1, y: 0 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isMobile
                ? { opacity: 0, y: "100%" }
                : { opacity: 0, y: -10, scale: 0.97 }
            }
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={isMobile ? mobileStyle : desktopStyle}
            className={
              isMobile
                ? "flex flex-col overflow-hidden bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-700/60 rounded-t-2xl shadow-2xl shadow-black/70"
                : "flex flex-col overflow-hidden bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/60 rounded-2xl shadow-2xl shadow-black/70"
            }
          >
            {isMobile && (
              <div className="flex justify-center pt-2 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>
            )}
          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 shrink-0 border-b border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-300">Add Models</span>
              {activeCount > 0 && (
                <span className="px-1.5 py-0 rounded-full bg-indigo-600/30 text-indigo-300 text-[10px] font-bold">
                  {activeCount} active
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close model selector"
              className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Search input ───────────────────────────────────────────────── */}
          <div className="px-3 py-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models…"
                aria-label="Search models"
                className="
                  w-full pl-8 pr-3 py-2
                  bg-zinc-800/70 border border-zinc-700/50 rounded-lg
                  text-xs text-zinc-200 placeholder:text-zinc-600
                  outline-none ring-0
                  focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                  transition-all duration-150
                "
              />
            </div>
          </div>

          {/* ── Model list ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ minHeight: 0 }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-xs text-zinc-500">No models match "{debouncedQuery}"</p>
              </div>
            ) : (
              categories.map((cat) => {
                const catModels = filtered.filter((m) => m.category === cat);
                return (
                  <div key={cat}>
                    {/* Category divider */}
                    <div className="flex items-center gap-2 px-3 pt-2 pb-1 sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
                      <div className="h-px flex-1 bg-zinc-800" />
                      <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest shrink-0">
                        {cat}
                      </span>
                      <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    {catModels.map((m) => (
                      <ModelRow
                        key={m.id}
                        id={m.id}
                        label={m.label}
                        description={m.description}
                        tier={m.tier}
                        isActive={activeModelIds.has(m.id)}
                        onToggle={onToggleModel}
                      />
                    ))}
                  </div>
                );
              })
            )}
            {/* Bottom padding */}
            <div className="h-2" />
          </div>

          {/* ── Footer hint ────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-zinc-800/60 px-4 py-2 flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600">
              {filtered.length} model{filtered.length !== 1 ? "s" : ""} · click to add or remove
            </span>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
