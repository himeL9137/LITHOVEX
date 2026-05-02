// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Persona Manager Modal
// Phase 5: Two-pane UI for creating, editing, and activating system personas.
//
// Left pane  : scrollable list of personas + "+ New Persona" button.
// Right pane : form — Name, Description, Instructions + save/delete actions.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  UserCircle2,
  Check,
  Trash2,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import type { Persona } from "@/lib/types";
import type { UsePersonaManagerReturn } from "@/hooks/usePersonaManager";

// ─── Auto-resize textarea hook ────────────────────────────────────────────────

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

// ─── Persona list item ────────────────────────────────────────────────────────

interface PersonaListItemProps {
  persona: Persona;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
}

function PersonaListItem({ persona, isSelected, isActive, onClick }: PersonaListItemProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Select persona: ${persona.name}${isActive ? " (active)" : ""}`}
      className={`
        w-full text-left flex items-center gap-2 px-3 py-2.5 text-sm
        transition-all duration-150 outline-none rounded-r-xl
        border-l-2
        ${isSelected
          ? "bg-zinc-800 border-indigo-500 text-zinc-100"
          : "border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        }
      `}
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold truncate">{persona.name}</span>
          {persona.isDefault && (
            <span className="shrink-0 px-1 py-0 rounded bg-zinc-700/60 text-zinc-500 text-[9px] font-bold uppercase tracking-wide">
              built-in
            </span>
          )}
        </span>
        {persona.description && (
          <span className="block text-[11px] text-zinc-600 truncate mt-0.5 italic">
            {persona.description}
          </span>
        )}
      </span>
      {isActive ? (
        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 shrink-0 opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

// ─── Right-pane editor form ───────────────────────────────────────────────────

interface PersonaEditorProps {
  persona: Persona | null;
  isActive: boolean;
  onSave: (patch: Partial<Omit<Persona, "id">>) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  isNew: boolean;
}

function PersonaEditor({
  persona,
  isActive,
  onSave,
  onActivate,
  onDeactivate,
  onDelete,
  isNew,
}: PersonaEditorProps) {
  const [name, setName] = useState(persona?.name ?? "");
  const [description, setDescription] = useState(persona?.description ?? "");
  const [instructions, setInstructions] = useState(persona?.instructions ?? "");
  const [dirty, setDirty] = useState(isNew);

  const instructionsRef = useAutoResize(instructions);

  // Reset local form state when a different persona is selected
  const prevIdRef = useRef(persona?.id ?? null);
  if (prevIdRef.current !== (persona?.id ?? null)) {
    prevIdRef.current = persona?.id ?? null;
    setName(persona?.name ?? "");
    setDescription(persona?.description ?? "");
    setInstructions(persona?.instructions ?? "");
    setDirty(isNew);
  }

  const handleChange = <T extends string>(setter: (v: T) => void) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value as T);
      setDirty(true);
    };

  const handleSave = useCallback(() => {
    if (!name.trim() || !instructions.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), instructions: instructions.trim() });
    setDirty(false);
  }, [name, description, instructions, onSave]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const canSave = name.trim().length > 0 && instructions.trim().length > 0 && dirty;

  if (!persona && !isNew) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-xs">
          <UserCircle2 className="w-10 h-10 text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-500">
            Select a persona from the left, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Form header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            {isNew ? "New Persona" : name || persona?.name}
          </h3>
          {isActive && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wide">
              Active
            </span>
          )}
        </div>
        {/* Activate / deactivate toggle */}
        {!isNew && (
          <button
            onClick={isActive ? onDeactivate : onActivate}
            aria-pressed={isActive}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all duration-200
              ${isActive
                ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
                : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
              }
            `}
          >
            {isActive ? (
              <>
                <Check className="w-3.5 h-3.5" /> Active
              </>
            ) : (
              <>
                <UserCircle2 className="w-3.5 h-3.5" /> Set Active
              </>
            )}
          </button>
        )}
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={handleChange(setName)}
            placeholder="e.g. Code Expert"
            required
            aria-label="Persona name"
            className="
              w-full px-3 py-2.5 rounded-lg text-sm
              bg-zinc-900 border border-zinc-700/60 text-zinc-200 placeholder:text-zinc-600
              outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
              transition-all duration-150
            "
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            Description{" "}
            <span className="text-zinc-700 font-normal normal-case tracking-normal">
              — optional
            </span>
          </label>
          <input
            type="text"
            value={description}
            onChange={handleChange(setDescription)}
            placeholder="A short summary of what this persona does…"
            aria-label="Persona description"
            className="
              w-full px-3 py-2.5 rounded-lg text-sm italic
              bg-zinc-900 border border-zinc-700/60 text-zinc-400 placeholder:text-zinc-600
              outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
              transition-all duration-150
            "
          />
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            System Instructions <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={instructionsRef}
            value={instructions}
            onChange={handleChange(setInstructions)}
            placeholder="You are a helpful assistant that…&#10;&#10;Write any system-level instruction here. This will be injected as the first message with role: system for every model in the playground."
            required
            aria-label="System instructions"
            rows={8}
            className="
              w-full px-3 py-2.5 rounded-lg text-sm resize-none
              bg-zinc-900 border border-zinc-700/60 text-zinc-300 placeholder:text-zinc-600
              outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
              transition-all duration-150 min-h-[180px]
              scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent
              leading-relaxed
            "
          />
          {/* ⌘S hint */}
          <p className="text-[10px] text-zinc-700">
            Tip: Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[9px]">⌘S</kbd> to save quickly.
          </p>
        </div>

        {/* localStorage warning */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-amber-900/10 border border-amber-800/30">
          <ShieldAlert className="w-4 h-4 text-amber-500/70 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-600/80 leading-relaxed">
            Your custom personas are stored in your browser's local storage. Clearing site data will permanently remove them.
          </p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 px-5 py-3 border-t border-zinc-800/60 flex items-center justify-between gap-3">
        {/* Delete — only for non-default personas */}
        <div>
          {!isNew && !persona?.isDefault && (
            <button
              onClick={onDelete}
              aria-label="Delete this persona"
              className="
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold
                bg-red-950/30 border border-red-800/30 text-red-500
                hover:bg-red-900/40 hover:border-red-700/50 hover:text-red-400
                transition-all duration-150
              "
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          aria-label="Save persona"
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
            transition-all duration-150
            ${canSave
              ? "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            }
          `}
        >
          <Check className="w-3.5 h-3.5" />
          {isNew ? "Create Persona" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface PersonaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  manager: UsePersonaManagerReturn;
}

export function PersonaManagerModal({
  isOpen,
  onClose,
  manager,
}: PersonaManagerModalProps) {
  const { personas, activePersonaId, addPersona, updatePersona, deletePersona, setActivePersona } =
    manager;

  // Which persona is selected in the left pane (could be a not-yet-saved new one)
  const [selectedId, setSelectedId] = useState<string | null>(activePersonaId);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Sync selection when modal opens
  const prevOpen = useRef(false);
  if (!prevOpen.current && isOpen) {
    prevOpen.current = true;
    setSelectedId(activePersonaId ?? (personas[0]?.id ?? null));
    setIsCreatingNew(false);
  }
  if (prevOpen.current && !isOpen) {
    prevOpen.current = false;
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const selectedPersona = personas.find((p) => p.id === selectedId) ?? null;

  const handleNewPersona = useCallback(() => {
    setIsCreatingNew(true);
    setSelectedId(null);
  }, []);

  const handleSelectPersona = useCallback((id: string) => {
    setSelectedId(id);
    setIsCreatingNew(false);
  }, []);

  const handleSave = useCallback(
    (patch: Partial<Omit<Persona, "id">>) => {
      if (isCreatingNew) {
        const newPersona = addPersona({
          name: patch.name ?? "Unnamed Persona",
          description: patch.description ?? "",
          instructions: patch.instructions ?? "",
        });
        setIsCreatingNew(false);
        setSelectedId(newPersona.id);
      } else if (selectedId) {
        updatePersona(selectedId, patch);
      }
    },
    [isCreatingNew, selectedId, addPersona, updatePersona]
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    deletePersona(selectedId);
    const remaining = personas.filter((p) => p.id !== selectedId);
    setSelectedId(remaining[0]?.id ?? null);
    setIsCreatingNew(false);
  }, [selectedId, deletePersona, personas]);

  const handleActivate = useCallback(() => {
    if (selectedId) setActivePersona(selectedId);
  }, [selectedId, setActivePersona]);

  const handleDeactivate = useCallback(() => {
    setActivePersona(null);
  }, [setActivePersona]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal card */}
          <motion.div
            role="dialog"
            aria-label="Persona Manager"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="
              fixed inset-0 z-[401] flex items-center justify-center p-4 pointer-events-none
            "
          >
            <div
              className="
                w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl
                shadow-2xl shadow-black/60
                flex overflow-hidden pointer-events-auto
              "
              style={{ height: "min(620px, calc(100dvh - 48px))" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Left pane: persona list ──────────────────────────────── */}
              <div className="w-60 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-900/40">
                {/* Pane header */}
                <div className="flex items-center justify-between px-3 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-zinc-300">Personas</span>
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                      {personas.length}
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close persona manager"
                    className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Persona list */}
                <div className="flex-1 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {personas.map((p) => (
                    <PersonaListItem
                      key={p.id}
                      persona={p}
                      isSelected={!isCreatingNew && selectedId === p.id}
                      isActive={activePersonaId === p.id}
                      onClick={() => handleSelectPersona(p.id)}
                    />
                  ))}
                </div>

                {/* New persona button */}
                <div className="shrink-0 p-2 border-t border-zinc-800/60">
                  <button
                    onClick={handleNewPersona}
                    aria-label="Create a new persona"
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold
                      border border-dashed transition-all duration-200
                      ${isCreatingNew
                        ? "border-indigo-500 bg-indigo-600/10 text-indigo-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                      }
                    `}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Persona
                  </button>
                </div>
              </div>

              {/* ── Right pane: editor ───────────────────────────────────── */}
              <PersonaEditor
                key={isCreatingNew ? "__new__" : (selectedId ?? "__empty__")}
                persona={selectedPersona}
                isActive={selectedId === activePersonaId && !isCreatingNew}
                isNew={isCreatingNew}
                onSave={handleSave}
                onActivate={handleActivate}
                onDeactivate={handleDeactivate}
                onDelete={handleDelete}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
