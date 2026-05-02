// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Playground Composer
// Phase 6: Multi-model input area — auto-growing textarea, file attachments,
//          quick-action chips, Send ↔ Stop morph, keyboard bindings.
//
// NON-DESTRUCTIVE: Does not touch the legacy Home.tsx chat input.
// Interfaces with PlaygroundContext.appendTurnNode + initResponseShell.
// Phase 8 (streaming) will plug in after initResponseShell calls.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState,
  useRef,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
  type DragEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paperclip,
  SendHorizontal,
  Square,
  X,
  FileText,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { usePlaygroundState } from "@/context/PlaygroundContext";
import type { FileMeta, MessageTurnNode } from "@/lib/types";

// ─── Quick-action suggestion chips ───────────────────────────────────────────

const QUICK_CHIPS = [
  "Teach me a fun fact",
  "Convince me the earth is flat",
  "Write a haiku about recursion",
  "Debug this in 3 steps",
  "Explain like I'm five",
  "Give me a creative metaphor",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024; // 5 MB

/** Read a File as a base64 data URL (images only, capped at 5MB). */
function readFileAsDataUrl(file: File): Promise<string | undefined> {
  if (!IMAGE_MIME_TYPES.has(file.type) || file.size > MAX_PREVIEW_BYTES) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/** Convert browser File → FileMeta, loading a data URL for images. */
async function fileToMeta(file: File): Promise<FileMeta> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: uid(),
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    dataUrl,
  };
}

// ─── Attachment thumbnail ─────────────────────────────────────────────────────

interface AttachmentThumbProps {
  meta: FileMeta;
  onRemove: (id: string) => void;
}

function AttachmentThumb({ meta, onRemove }: AttachmentThumbProps) {
  const isImage = IMAGE_MIME_TYPES.has(meta.mimeType);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, x: -6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="relative group flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-800"
      title={`${meta.name} (${formatBytes(meta.sizeBytes)})`}
    >
      {isImage && meta.dataUrl ? (
        <img
          src={meta.dataUrl}
          alt={meta.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-1">
          <FileText className="w-5 h-5 text-zinc-500" />
          <span className="text-[9px] text-zinc-600 truncate w-full text-center leading-tight">
            {meta.name.split(".").pop()?.toUpperCase() ?? "FILE"}
          </span>
        </div>
      )}

      {/* Remove button — appears on hover */}
      <button
        onClick={() => onRemove(meta.id)}
        aria-label={`Remove ${meta.name}`}
        className="
          absolute top-0.5 right-0.5
          w-5 h-5 rounded-full
          bg-zinc-900/90 border border-zinc-700
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          z-10
        "
      >
        <X className="w-3 h-3 text-zinc-300" />
      </button>
    </motion.div>
  );
}

// ─── Quick-action chip ────────────────────────────────────────────────────────

interface QuickChipProps {
  label: string;
  onClick: () => void;
}

function QuickChip({ label, onClick }: QuickChipProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="
        flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
        bg-zinc-800/60 border border-zinc-700/50 text-zinc-400
        hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600
        transition-colors duration-150
        whitespace-nowrap
      "
    >
      {label}
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PlaygroundComposerProps {
  /** True when any model is currently streaming a response. */
  isGenerating: boolean;
  /** Callback to abort all in-progress streams. */
  onStopGenerating: () => void;
  /** Fired after the turn node is appended — parent kicks off streaming. */
  onTurnSubmitted?: (info: {
    conversationId: string;
    turnId: string;
    userText: string;
  }) => void;
}

export function PlaygroundComposer({
  isGenerating,
  onStopGenerating,
  onTurnSubmitted,
}: PlaygroundComposerProps) {
  const {
    environment,
    activeConversationId,
    createConversation,
    appendTurnNode,
  } = usePlaygroundState();

  const { activeModels } = environment;

  // ── Local state ───────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<FileMeta[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-resize textarea ──────────────────────────────────────────────────

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      autoResize();
    },
    [autoResize]
  );

  // ── File handling ─────────────────────────────────────────────────────────

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files).slice(0, 8); // cap at 8 attachments total
    const metas = await Promise.all(incoming.map(fileToMeta));
    setAttachments((prev) => {
      const combined = [...prev, ...metas];
      return combined.slice(0, 8);
    });
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
        e.target.value = ""; // allow re-selecting the same file
      }
    },
    [processFiles]
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files?.length) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  // ── Chip fill ─────────────────────────────────────────────────────────────

  const handleChipClick = useCallback(
    (label: string) => {
      setText(label);
      requestAnimationFrame(() => {
        autoResize();
        textareaRef.current?.focus();
      });
    },
    [autoResize]
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  const canSubmit =
    !isGenerating && (text.trim().length > 0 || attachments.length > 0);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;

    // ── 1. Ensure there's an active conversation ──────────────────────────
    let convId = activeConversationId;
    if (!convId) {
      const firstWords = text.trim().split(/\s+/).slice(0, 6).join(" ");
      const conv = createConversation(firstWords || "Playground session");
      convId = conv.id;
    }

    // ── 2. Build the turn node ────────────────────────────────────────────
    const turnId = uid();
    const node: MessageTurnNode = {
      turnId,
      userMessage: {
        id: uid(),
        content: text.trim(),
        attachments: attachments.length > 0 ? [...attachments] : undefined,
        timestamp: Date.now(),
      },
      aiResponses: {},
    };

    // ── 3. Append the turn to the conversation ────────────────────────────
    appendTurnNode(convId, node);

    // ── 4. Notify parent so it can kick off streaming ────────────────────
    const submittedText = text.trim();
    onTurnSubmitted?.({ conversationId: convId, turnId, userText: submittedText });

    // ── 5. Clear composer immediately for rapid follow-up typing ──────────
    setText("");
    setAttachments([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    });
  }, [
    canSubmit,
    text,
    attachments,
    activeConversationId,
    createConversation,
    appendTurnNode,
    onTurnSubmitted,
  ]);

  // ── Keyboard bindings ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      // Shift+Enter → natural newline (default textarea behaviour)
    },
    [handleSubmit]
  );

  // ── Derived helpers ───────────────────────────────────────────────────────

  const noModels = activeModels.length === 0;
  const placeholder = noModels
    ? "Add at least one model above to start chatting…"
    : `Message ${activeModels.length > 1 ? `${activeModels.length} models` : activeModels[0]?.name.split("/").pop() ?? "model"}… (Enter to send, Shift+Enter for new line)`;

  return (
    <div
      className="shrink-0 border-t border-zinc-800/60"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Quick-action chips ──────────────────────────────────────────── */}
      <div className="
        flex items-center gap-2 px-4 pt-3 pb-1
        overflow-x-auto scrollbar-thin
      ">
        {QUICK_CHIPS.map((chip) => (
          <QuickChip
            key={chip}
            label={chip}
            onClick={() => handleChipClick(chip)}
          />
        ))}
      </div>

      {/* ── Composer box ────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 pt-2">
        <div
          className={`
            relative rounded-2xl border transition-all duration-200
            bg-zinc-900/80 backdrop-blur-xl
            ${isDragOver
              ? "border-indigo-500 ring-1 ring-indigo-500/40 bg-indigo-950/20"
              : "border-zinc-700/60 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/30"
            }
          `}
        >
          {/* Drag-over overlay label */}
          <AnimatePresence>
            {isDragOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rounded-2xl flex items-center justify-center z-20 bg-indigo-950/60 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-indigo-300 text-sm font-semibold">
                  <Paperclip className="w-4 h-4" />
                  Drop files to attach
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Attachment thumbnails strip ────────────────────────────── */}
          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-2 flex-wrap px-4 pt-3 pb-0"
              >
                <AnimatePresence mode="popLayout">
                  {attachments.map((a) => (
                    <AttachmentThumb
                      key={a.id}
                      meta={a}
                      onRemove={handleRemoveAttachment}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input row ──────────────────────────────────────────────── */}
          <div className="flex items-end gap-2 px-3 py-2.5">
            {/* Paperclip / attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              disabled={noModels}
              className={`
                flex-shrink-0 mb-0.5 p-2 rounded-xl
                transition-colors duration-150
                ${noModels
                  ? "text-zinc-700 cursor-not-allowed"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
                }
              `}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,text/*,.md,.csv,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.rs,.go"
              onChange={handleFileInputChange}
              className="hidden"
              aria-hidden="true"
            />

            {/* Auto-growing textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={noModels}
              rows={1}
              aria-label="Message input"
              aria-multiline="true"
              className="
                flex-1 min-w-0 resize-none bg-transparent
                text-sm text-zinc-200 placeholder:text-zinc-600
                outline-none ring-0 border-none
                leading-relaxed py-1
                scrollbar-thin
                disabled:cursor-not-allowed disabled:opacity-40
              "
              style={{ maxHeight: 200, overflowY: "auto" }}
            />

            {/* Send / Stop button */}
            <div className="flex-shrink-0 mb-0.5">
              {isGenerating ? (
                <motion.button
                  key="stop"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={onStopGenerating}
                  aria-label="Stop generating"
                  className="
                    w-9 h-9 rounded-xl
                    bg-red-600/20 border border-red-600/40 text-red-400
                    hover:bg-red-600/30 hover:text-red-300
                    flex items-center justify-center
                    transition-colors duration-150
                  "
                >
                  <Square className="w-4 h-4 fill-current" />
                </motion.button>
              ) : (
                <motion.button
                  key="send"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  aria-label="Send message"
                  className={`
                    w-9 h-9 rounded-xl flex items-center justify-center
                    transition-all duration-150
                    ${canSubmit
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95"
                      : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    }
                  `}
                >
                  <SendHorizontal className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>

          {/* ── Footer hints ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 pb-2.5 gap-2">
            <div className="flex items-center gap-3">
              {noModels ? (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600/80">
                  <AlertCircle className="w-3 h-3" />
                  Add a model above to enable sending
                </div>
              ) : (
                <span className="text-[10px] text-zinc-700">
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[9px]">Enter</kbd>
                  {" "}to send · {" "}
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[9px]">⇧ Enter</kbd>
                  {" "}for new line
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {attachments.length > 0 && (
                <span className="text-[10px] text-zinc-600">
                  {attachments.length} file{attachments.length !== 1 ? "s" : ""} attached
                </span>
              )}
              {text.length > 100 && (
                <span className="text-[10px] text-zinc-700 tabular-nums">
                  {text.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
