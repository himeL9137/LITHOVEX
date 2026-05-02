// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Model Selector Manager
// Phase 3 + Phase 4: Orchestrates active model pills, "Add Model" dropdown,
// and per-model settings modal.
//
// Clicking the pill body → opens ModelSettingsModal for that model.
// Clicking the ✕ icon  → removes the model immediately (no modal).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X as XIcon, Layers, Settings2 } from "lucide-react";
import { usePlaygroundState } from "@/context/PlaygroundContext";
import { ModelDropdown } from "./ModelDropdown";
import { ModelSettingsModal } from "./ModelSettingsModal";
import { HF_MODELS } from "@/components/SettingsPanel";
import type { ModelConfig } from "@/lib/types";

// ─── Default parameters for a newly-added model ───────────────────────────────

const DEFAULT_MODEL_PARAMS: ModelConfig["parameters"] = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
};

// ─── Active model pill ────────────────────────────────────────────────────────

interface ModelPillProps {
  config: ModelConfig;
  isSettingsOpen: boolean;
  pillRef: React.RefObject<HTMLDivElement | null>;
  onPillClick: (id: string) => void;
  onRemove: (id: string) => void;
}

function ModelPill({ config, isSettingsOpen, pillRef, onPillClick, onRemove }: ModelPillProps) {
  const meta = HF_MODELS.find((m) => m.id === config.id);
  const displayName = meta?.label ?? config.name.split("/").pop() ?? config.name;

  return (
    <motion.div
      ref={pillRef as React.RefObject<HTMLDivElement>}
      layout
      initial={{ opacity: 0, scale: 0.85, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`
        group flex items-center gap-1 pl-2 pr-1 py-1.5
        rounded-full border text-xs font-medium
        select-none
        transition-all duration-150
        ${isSettingsOpen ? "ring-1" : ""}
      `}
      style={{
        borderColor: `${config.colorTheme}${isSettingsOpen ? "80" : "40"}`,
        backgroundColor: `${config.colorTheme}${isSettingsOpen ? "20" : "12"}`,
        color: config.colorTheme,
      }}
      title={`${config.id} — click to configure`}
    >
      {/* Clickable pill body → opens settings */}
      <button
        onClick={() => onPillClick(config.id)}
        aria-label={`Configure ${displayName}`}
        aria-haspopup="dialog"
        aria-expanded={isSettingsOpen}
        className="flex items-center gap-1.5 cursor-pointer outline-none"
      >
        {/* Color dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.colorTheme }}
        />
        <span className="max-w-[110px] truncate">{displayName}</span>
        {/* Settings gear — fades in on hover / when open */}
        <Settings2
          className={`
            w-3 h-3 flex-shrink-0 transition-opacity duration-150
            ${isSettingsOpen ? "opacity-100" : "opacity-0 group-hover:opacity-60"}
          `}
        />
      </button>

      {/* Remove ✕ — always accessible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(config.id);
        }}
        aria-label={`Remove ${displayName}`}
        className="
          p-0.5 rounded-full
          opacity-40 group-hover:opacity-100
          hover:bg-white/10
          transition-all duration-150 flex-shrink-0
        "
      >
        <XIcon className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ─── Add Model trigger button ─────────────────────────────────────────────────

interface AddModelButtonProps {
  onClick: () => void;
  btnRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
}

function AddModelButton({ onClick, btnRef, isOpen }: AddModelButtonProps) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      aria-label="Add a model to the playground"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border border-dashed transition-all duration-200
        ${isOpen
          ? "border-indigo-500 bg-indigo-600/10 text-indigo-300"
          : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
        }
      `}
    >
      <Plus className="w-3.5 h-3.5" />
      Add Model
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ModelSelectorManagerProps {
  className?: string;
}

export function ModelSelectorManager({ className = "" }: ModelSelectorManagerProps) {
  const { environment, addModel, removeModel } = usePlaygroundState();
  const { activeModels } = environment;

  // ── Add-model dropdown state ───────────────────────────────────────────────
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // ── Per-model settings modal state ────────────────────────────────────────
  const [openSettingsModelId, setOpenSettingsModelId] = useState<string | null>(null);
  // We keep one ref per pill — stored in a map keyed by modelId
  const pillRefMap = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());

  function getPillRef(id: string): React.RefObject<HTMLDivElement | null> {
    if (!pillRefMap.current.has(id)) {
      pillRefMap.current.set(id, { current: null });
    }
    return pillRefMap.current.get(id)!;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const activeModelIds = new Set(activeModels.map((m) => m.id));

  const handleToggleModel = useCallback(
    (modelId: string) => {
      if (activeModelIds.has(modelId)) {
        removeModel(modelId);
        if (openSettingsModelId === modelId) setOpenSettingsModelId(null);
      } else {
        const meta = HF_MODELS.find((m) => m.id === modelId);
        const newConfig: ModelConfig = {
          id: modelId,
          name: meta?.label ?? modelId.split("/").pop() ?? modelId,
          parameters: { ...DEFAULT_MODEL_PARAMS },
          colorTheme: "",
        };
        addModel(newConfig);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeModelIds, addModel, removeModel, openSettingsModelId]
  );

  const handleRemove = useCallback(
    (modelId: string) => {
      removeModel(modelId);
      if (openSettingsModelId === modelId) setOpenSettingsModelId(null);
      pillRefMap.current.delete(modelId);
    },
    [removeModel, openSettingsModelId]
  );

  const handlePillClick = useCallback((modelId: string) => {
    setOpenSettingsModelId((prev) => (prev === modelId ? null : modelId));
    setDropdownOpen(false);
  }, []);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen((o) => !o);
    setOpenSettingsModelId(null);
  }, []);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);
  const closeSettings = useCallback(() => setOpenSettingsModelId(null), []);

  // ── Active config for open settings modal ─────────────────────────────────
  const settingsConfig = activeModels.find((m) => m.id === openSettingsModelId) ?? null;

  return (
    <div
      className={`flex items-center gap-2 flex-wrap ${className}`}
      role="region"
      aria-label="Active models"
    >
      {/* Empty state hint */}
      {activeModels.length === 0 && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Layers className="w-3.5 h-3.5" />
          <span>No models selected — add one to begin</span>
        </div>
      )}

      {/* Active model pills */}
      <AnimatePresence mode="popLayout">
        {activeModels.map((cfg) => {
          const ref = getPillRef(cfg.id);
          return (
            <ModelPill
              key={cfg.id}
              config={cfg}
              isSettingsOpen={openSettingsModelId === cfg.id}
              pillRef={ref}
              onPillClick={handlePillClick}
              onRemove={handleRemove}
            />
          );
        })}
      </AnimatePresence>

      {/* Add Model trigger */}
      <AddModelButton
        btnRef={addBtnRef}
        onClick={toggleDropdown}
        isOpen={dropdownOpen}
      />

      {/* Limit warning */}
      {activeModels.length >= 6 && (
        <span className="text-[10px] text-amber-500/70 ml-1">
          Max 6 models recommended for performance
        </span>
      )}

      {/* Add-model dropdown */}
      <ModelDropdown
        isOpen={dropdownOpen}
        onClose={closeDropdown}
        triggerRef={addBtnRef}
        activeModelIds={activeModelIds}
        onToggleModel={handleToggleModel}
      />

      {/* Per-model settings modal — rendered for whichever pill is active */}
      {settingsConfig && (
        <ModelSettingsModal
          key={settingsConfig.id}
          isOpen={true}
          onClose={closeSettings}
          config={settingsConfig}
          triggerRef={getPillRef(settingsConfig.id) as React.RefObject<HTMLElement | null>}
        />
      )}
    </div>
  );
}
