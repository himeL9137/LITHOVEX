import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus, ArrowUp, X, FileText, Image, Film, Music, FileCode,
  File as FileIcon, Square, Files, Loader2, Archive, ChevronDown, Check,
  SlidersHorizontal, Search, Code2, ImagePlus,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProcessedFile } from "@/lib/smartRouter";
import { enrichAttachmentsWithClientDataUrls } from "@/lib/messageAttachments";
import { ProviderLogo as SettingsProviderLogo } from "@/components/SettingsPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface ChatInputModelOption {
  id: string;
  label: string;
  description?: string;
  category?: string;
  tier?: "fast" | "expert";
  badge?: string;
}

type UploadKind = "image" | "pdf" | "document" | "code" | "media" | "any";

const UPLOAD_OPTIONS: {
  kind: UploadKind;
  label: string;
  hint: string;
  accept: string;
  icon: typeof Image;
  color: string;
}[] = [
  { kind: "image",    label: "Images",        hint: "PNG, JPG, GIF, WEBP, SVG",        accept: "image/*",                                                                                                        icon: Image,    color: "text-purple-300" },
  { kind: "pdf",      label: "PDFs",          hint: "Portable Document Format",        accept: "application/pdf",                                                                                                icon: FileText, color: "text-red-300"    },
  { kind: "document", label: "Documents",     hint: "DOCX, XLSX, PPTX, TXT, MD, CSV",  accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.rtf,.odt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,text/csv", icon: FileText, color: "text-amber-300" },
  { kind: "code",     label: "Code",          hint: "JS, TS, PY, JSON, HTML, CSS…",    accept: ".js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.rb,.go,.rs,.java,.c,.h,.cpp,.hpp,.cs,.php,.swift,.kt,.scala,.sh,.bash,.zsh,.json,.yaml,.yml,.toml,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.dart,.vue,.svelte,text/*", icon: FileCode, color: "text-emerald-300" },
  { kind: "media",    label: "Audio / Video", hint: "MP3, WAV, MP4, MOV, WEBM",        accept: "audio/*,video/*",                                                                                                icon: Film,     color: "text-blue-300"   },
  { kind: "any",      label: "Any file",      hint: "Upload anything",                 accept: "*/*",                                                                                                            icon: Files,    color: "text-gray-300"   },
];

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChatInputProps {
  onSend: (msg: string, files?: ProcessedFile[]) => void;
  disabled?: boolean;
  compact?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  /** Called once the first time the user types a character — use to auto-hide the sidebar. */
  onTypingStart?: () => void;
  /** Optional inline model selector (renders inside the action bar) */
  model?: string;
  onModelChange?: (id: string) => void;
  models?: ChatInputModelOption[];
  featuredModelIds?: string[];
  onOpenAllModels?: () => void;
  /** Inline tool toggles next to the + button. Renders only when `showTools` is true. */
  showTools?: boolean;
  webSearchEnabled?: boolean;
  setWebSearchEnabled?: (v: boolean) => void;
  autoCodeMode?: boolean;
  setAutoCodeMode?: (v: boolean) => void;
  /**
   * Image-generation tool. When enabled, the homepage will route the next
   * send through the text-to-image endpoint instead of /api/chat/completions.
   * The owning page is responsible for auto-switching to an image-capable
   * model (FLUX / SDXL / SD 1.5) and toasting the user when it does.
   */
  imageGenEnabled?: boolean;
  setImageGenEnabled?: (v: boolean) => void;
}

interface PastedSnippet {
  id: string;
  content: string;
}

function fileTypeIcon(type: ProcessedFile["type"], className = "w-4 h-4") {
  if (type === "image")  return <Image    className={className} />;
  if (type === "pdf")    return <FileText className={className} />;
  if (type === "video")  return <Film     className={className} />;
  if (type === "audio")  return <Music    className={className} />;
  if (type === "text")   return <FileCode className={className} />;
  return <FileIcon className={className} />;
}

function formatBytes(bytes?: number) {
  if (!bytes && bytes !== 0) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/* ---------- File / Pasted preview cards ---------- */

function FileCard({ file, onRemove }: { file: ProcessedFile; onRemove: () => void }) {
  const isImage = file.type === "image" && file.dataUrl;
  return (
    <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-[#262626] hover:border-purple-500/40 transition-colors">
      {isImage ? (
        <>
          <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
        </>
      ) : (
        <div className="w-full h-full p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-white/5 rounded">
              {fileTypeIcon(file.type, "w-3.5 h-3.5 text-gray-300")}
            </div>
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider truncate">
              {(file.name.split(".").pop() || "FILE").slice(0, 5)}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-gray-100 truncate" title={file.name}>
              {file.name}
            </p>
            {typeof file.size === "number" && (
              <p className="text-[9px] text-gray-500">{formatBytes(file.size)}</p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove file"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

function PastedPreviewModal({
  content,
  onClose,
}: {
  content: PastedSnippet;
  onClose: () => void;
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const lines = content.content.split("\n").length;
  const chars = content.content.length;

  const handleCopy = () => {
    navigator.clipboard?.writeText(content.content).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pasted content preview"
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2 py-[3px] rounded-md border border-purple-400/30 bg-purple-500/10 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
              Pasted
            </span>
            <span className="text-[12px] text-gray-400 truncate">
              {lines.toLocaleString()} {lines === 1 ? "line" : "lines"} · {chars.toLocaleString()} chars
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopy}
              className="px-2.5 h-8 inline-flex items-center gap-1.5 rounded-lg text-[12px] font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Copy to clipboard"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="model-selector-scroll flex-1 overflow-auto">
          <pre className="p-5 m-0 text-[12.5px] leading-[1.55] text-gray-200 font-mono whitespace-pre-wrap break-words selection:bg-purple-500/30">
            {content.content}
          </pre>
        </div>
      </div>
    </div>
  );
}

function PastedCard({
  content,
  onRemove,
  onOpen,
}: {
  content: PastedSnippet;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const lines = content.content.split("\n").length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative group flex-shrink-0 w-28 h-24 rounded-xl overflow-hidden border border-white/10 bg-[#262626] hover:border-purple-500/40 hover:bg-[#2a2a2a] p-2.5 flex flex-col justify-between text-left transition-colors cursor-pointer"
      title="Click to view full pasted content"
    >
      <p className="text-[10px] text-gray-400 leading-tight font-mono break-words whitespace-pre-wrap line-clamp-4 select-none pointer-events-none">
        {content.content}
      </p>
      <div className="flex items-center justify-between gap-1 mt-1 pointer-events-none">
        <span className="inline-flex items-center px-1.5 py-[1px] rounded border border-white/10 bg-white/5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
          PASTED
        </span>
        <span className="text-[9px] text-gray-500 truncate">
          {lines.toLocaleString()} {lines === 1 ? "line" : "lines"}
        </span>
      </div>
      <span
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        role="button"
        tabIndex={-1}
        aria-label="Remove snippet"
        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <X className="w-2.5 h-2.5" />
      </span>
    </button>
  );
}

/* ---------- Provider Logo ----------
 * Uses the same real-favicon ProviderLogo as the Settings panel so model
 * logos in the picker match exactly what appears in Settings → Models.
 * The local renderer below is kept as a thin wrapper so all the existing
 * <ProviderLogo category={..} size={..} /> call sites stay untouched. */

function ProviderLogo({ category, size = 24 }: { category?: string; size?: number }) {
  return <SettingsProviderLogo category={category ?? ""} size={size} />;
}

// ─── Legacy hand-drawn marks kept below (no longer rendered) ──────────────
// Retained only to minimise the diff and keep this file's history readable.
// They are unreferenced and tree-shaken out of the production bundle.
function _LegacyProviderMark({ provider, size }: { provider: string; size: number }) {
  // Inner SVG sized to 70% of the badge for nice padding
  const s = Math.round(size * 0.7);
  switch (provider) {
    case "openai":
      // OpenAI six-petal mark
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.075.075 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v3l-2.597 1.5-2.607-1.5z"/>
        </svg>
      );
    case "anthropic":
      // Claude / Anthropic asterisk
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#181818" aria-hidden>
          <path d="M16.04 2H13.04l5.5 20H21.5L16.04 2zM7.96 2L2.5 22h2.97l1.12-4.18h5.71L13.42 22h2.97L10.93 2H7.96zm-.62 13.07L9.45 7.2l2.11 7.87H7.34z"/>
        </svg>
      );
    case "google":
      // Google "G"
      return (
        <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
      );
    case "xai":
      // xAI stylized X
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
          <path d="M3 3h3.5l11.5 18H14.5L3 3zm14.5 0H21l-6.2 9.7-1.95-3.05L17.5 3zM3 21l6.55-10.2 1.95 3.05L6.5 21H3z"/>
        </svg>
      );
    case "deepseek":
      // DeepSeek whale-ish
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#4D6BFE" aria-hidden>
          <path d="M21.5 7.2c-.3-.2-.7-.1-.9.2-.5.7-1.2 1.2-2 1.5-1.4-2.1-3.7-3.5-6.3-3.5-3.2 0-6 2-7.1 4.9-.8.2-1.6.6-2.2 1.2-.3.3-.3.7 0 1 .3.3.7.3 1 0 .4-.4.9-.7 1.5-.8 0 .3-.1.5-.1.8 0 4 3.2 7.2 7.2 7.2 3.2 0 6-2.1 6.9-5 .9-.3 1.7-.8 2.4-1.5.6-.6 1-1.4 1.2-2.2.6-.1 1.1-.4 1.5-.8.3-.3.3-.7 0-1zm-9.2 9c-2.6 0-4.7-1.9-5.1-4.4 1.1.5 2.4.8 3.7.8 2.2 0 4.2-.7 5.8-1.9-.4 3.1-2.7 5.5-4.4 5.5z"/>
        </svg>
      );
    case "qwen":
      // Qwen Q-like glyph
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c2 0 3.9-.6 5.5-1.6l3 3 1.4-1.4-3-3C20.4 17 22 14.7 22 12c0-5.5-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8c0 2-.7 3.8-1.9 5.2l-2.6-2.6L14 16l2.6 2.6c-1.3.9-2.9 1.4-4.6 1.4z"/>
        </svg>
      );
    case "meta":
      // Meta infinity ribbon
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="metaGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#0866FF"/>
              <stop offset="50%" stopColor="#A050F0"/>
              <stop offset="100%" stopColor="#FF4081"/>
            </linearGradient>
          </defs>
          <path fill="url(#metaGrad)" d="M8 9c-3.3 0-6 3.1-6 7s2.7 7 6 7c2 0 3.6-1.1 5-2.6.6-.7 1.2-1.5 1.8-2.4l1.8-2.7c.6-.9 1.2-1.7 1.8-2.4 1.1-1.2 2.3-2 3.6-2 2.2 0 4 2.2 4 5s-1.8 5-4 5c-1.3 0-2.5-.7-3.7-2 0 0 .9-1.2 1.7-2.5.9 1.1 1.5 1.5 2 1.5 1.1 0 2-1.3 2-3s-.9-3-2-3c-.7 0-1.4.4-2.2 1.3-.5.5-1 1.2-1.5 2l-1.8 2.7c-.6.9-1.2 1.7-1.8 2.4C12.7 21.8 10.6 23 8 23c-3.3 0-6-3.1-6-7s2.7-7 6-7c2.6 0 4.7 1.2 6.3 3 0 0-.9 1.2-1.7 2.5C11.5 13.4 10 12 8 12c-2.2 0-4 1.8-4 4s1.8 4 4 4c.7 0 1.4-.4 2.2-1.3-.8 1.3-1.7 2.5-1.7 2.5C7.4 22 7.7 22 8 22z"/>
        </svg>
      );
    case "moonshot":
      // Crescent moon for Kimi
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      );
    case "cohere":
      // Cohere C-orb
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FF7759" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill="#FFFFFF"/>
        </svg>
      );
    case "minimax":
      // MiniMax M
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden>
          <path d="M3 4h3l3 7 3-7h3v16h-3v-9l-3 7-3-7v9H3V4zm15 0h3v16h-3V4z"/>
        </svg>
      );
    case "zhipu":
      // GLM Z
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="#0EA5E9" aria-hidden>
          <path d="M5 4h14l-9 12h9v4H5l9-12H5z"/>
        </svg>
      );
    case "lithovex":
      // Real LITHOVEX brand logo (fills the badge)
      return (
        <img
          src="/lithovex-logo-transparent.png"
          alt="LITHOVEX"
          style={{ width: size, height: size, objectFit: "contain", display: "block" }}
          draggable={false}
        />
      );
    default: {
      // Fallback: provider initial
      const letter = (provider || "?").charAt(0).toUpperCase();
      return (
        <span style={{ fontSize: Math.round(size * 0.5), color: "#FFFFFF", fontWeight: 700, lineHeight: 1 }}>
          {letter}
        </span>
      );
    }
  }
}

// (ProviderLogo wrapper is defined above and re-uses the Settings panel's
// real-favicon renderer.)

/* ---------- Inline Model Selector ---------- */

interface ModelSelectorProps {
  models: ChatInputModelOption[];
  selectedModel: string;
  onSelect: (id: string) => void;
  featuredIds?: string[];
  onOpenAll?: () => void;
}

function ModelSelector({ models, selectedModel, onSelect, featuredIds: _featuredIds, onOpenAll }: ModelSelectorProps) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [maxHeight, setMaxHeight] = useState<number>(560);
  const [toast, setToast] = useState<{ label: string; visible: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const showModelToast = (label: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ label, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast(prev => prev ? { ...prev, visible: false } : null);
      toastTimer.current = setTimeout(() => setToast(null), 400);
    }, 2000);
  };

  useEffect(() => {
    if (isMobile) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    if (isOpen) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onEsc);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, isMobile]);

  // Reset search whenever the dropdown reopens so the user starts fresh.
  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  // Dynamically size the dropdown to fit between the top of the viewport and the trigger.
  useEffect(() => {
    if (!isOpen) return;
    const compute = () => {
      const btn = triggerRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      // Space above the trigger button, minus a small gap (mb-2 = 8px) and a top padding buffer.
      // Cap at 72vh so the dropdown stays comfortably scrollable on tall screens.
      const available = Math.max(280, rect.top - 16);
      const viewportCap = Math.floor(window.innerHeight * 0.72);
      setMaxHeight(Math.min(available, viewportCap));
    };
    compute();
    // Reset scroll to top so pinned LITHOVEX models are always visible first.
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
    window.addEventListener("resize", compute);
    // Note: do NOT listen to scroll events — the dropdown's own scroll
    // would re-fire compute() and cause re-layout while the user scrolls.
    return () => {
      window.removeEventListener("resize", compute);
    };
  }, [isOpen]);

  const current = models.find(m => m.id === selectedModel) || models[0];

  // Show ALL models in the dropdown so the user can scroll up/down through
  // every available option. LITHOVEX-category models are pinned at the very
  // top (regardless of any other ordering), then the rest preserve their
  // original order from the source list (which is already grouped by
  // category in HF_MODELS).
  const visible = useMemo(() => {
    const lithovexModels: ChatInputModelOption[] = [];
    const otherModels: ChatInputModelOption[] = [];
    const seen = new Set<string>();
    for (const m of models) {
      if (seen.has(m.id)) continue;
      if ((m.category ?? "").toLowerCase().includes("lithovex")) {
        lithovexModels.push(m);
      } else {
        otherModels.push(m);
      }
      seen.add(m.id);
    }
    return [...lithovexModels, ...otherModels];
  }, [models]);

  // Apply the live search filter. Matches against label, id, and category
  // so users can find by display name, HF id ("qwen3"), or provider ("Meta").
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((m) => {
      return (
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [visible, search]);

  if (!current) return null;

  const shortName = current.label
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/^[^/]+\//, "")
    .trim() || current.label;

  const renderOption = (m: ChatInputModelOption, opts: { large?: boolean } = {}) => {
    const selected = m.id === selectedModel;
    const badge = m.badge ?? (m.tier === "expert" ? "Expert" : m.tier === "fast" ? "Fast" : undefined);
    const large = opts.large;
    return (
      <button
        key={m.id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => { onSelect(m.id); setIsOpen(false); showModelToast(m.label); }}
        className={`w-full text-left rounded-xl flex items-start gap-2.5 transition-colors ${
          large ? "px-3 py-3 min-h-[56px]" : "px-2.5 py-2.5"
        } ${selected ? "bg-purple-500/10" : "hover:bg-white/5 active:bg-white/10"}`}
      >
        <ProviderLogo category={m.category} size={large ? 30 : 26} />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-semibold text-gray-100 truncate flex-1 min-w-0 ${large ? "text-base" : "text-[14px] sm:text-[13px]"}`}>
              {m.label}
            </span>
            {badge && (
              <span
                className={`shrink-0 px-1.5 py-[1px] rounded-full text-[10px] font-medium border ${
                  badge === "Expert"
                    ? "border-purple-400/30 text-purple-300 bg-purple-500/10"
                    : badge === "Fast"
                      ? "border-emerald-400/30 text-emerald-300 bg-emerald-500/10"
                      : "border-white/10 text-gray-400 bg-white/5"
                }`}
              >
                {badge}
              </span>
            )}
          </div>
          {m.description && (
            <span className={`text-gray-500 line-clamp-2 leading-snug ${large ? "text-[12px]" : "text-[11px]"}`}>
              {m.description}
            </span>
          )}
        </div>
        {selected && <Check className={`text-purple-400 mt-0.5 shrink-0 ${large ? "w-5 h-5" : "w-4 h-4"}`} />}
      </button>
    );
  };

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setIsOpen(o => !o)}
      title={current.label}
      className={`
        inline-flex items-center gap-1.5 h-8 pl-1.5 pr-2 rounded-xl
        text-[13px] sm:text-[12px] font-medium whitespace-nowrap select-none
        transition-colors duration-150 active:scale-[0.98]
        ${isOpen
          ? "bg-white/10 text-gray-100"
          : "text-gray-400 hover:text-gray-100 hover:bg-white/10"}
      `}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      <ProviderLogo category={current.category} size={22} />
      <span className="max-w-[140px] truncate">{shortName}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 opacity-70 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  );

  const searchInput = (large: boolean) => (
    <div className={`relative shrink-0 ${large ? "px-2 pb-2" : "px-1.5 pb-1.5"}`}>
      <Search
        className={`absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none ${
          large ? "left-5 w-4 h-4" : "left-4 w-3.5 h-3.5"
        }`}
      />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${visible.length} models`}
        autoFocus={!isMobile}
        className={`w-full bg-white/5 border border-white/10 rounded-xl text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-purple-400/40 focus:bg-white/8 transition-colors ${
          large ? "pl-11 pr-3 h-11 text-[14px]" : "pl-9 pr-2.5 h-9 text-[13px]"
        }`}
        style={large ? { fontSize: "16px" } : undefined}
      />
    </div>
  );

  const emptyState = (large: boolean) => (
    <div className={`text-center text-gray-500 ${large ? "py-10 text-sm" : "py-6 text-xs"}`}>
      No models match "{search}".
    </div>
  );

  // Shared toast pill (rendered fixed, escapes all overflow containers)
  const toastPill = toast && (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        zIndex: 99999,
        pointerEvents: "none",
        opacity: toast.visible ? 1 : 0,
        transform: toast.visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(6px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        borderRadius: 999,
        background: "rgba(20, 16, 32, 0.88)",
        border: "1px solid rgba(139, 92, 246, 0.28)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.08)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        whiteSpace: "nowrap",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "rgba(167,139,250,0.9)",
          boxShadow: "0 0 6px rgba(167,139,250,0.6)",
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(226,232,240,0.85)", letterSpacing: "0.01em" }}>
          You selected <strong style={{ color: "rgba(196,181,253,1)", fontWeight: 600 }}>{toast.label}</strong>
        </span>
      </div>
    </div>
  );

  // Mobile: full-width bottom Sheet
  if (isMobile) {
    return (
      <div className="relative">
        {toastPill}
        {triggerButton}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent
            side="bottom"
            className="h-[85dvh] p-0 bg-[#1a1a1a] border-white/10 flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <SheetHeader className="px-4 pt-4 pb-2 text-left shrink-0">
              <SheetTitle className="text-gray-100 text-base">Choose a model</SheetTitle>
              <SheetDescription className="sr-only">Select which AI model to use</SheetDescription>
            </SheetHeader>
            {searchInput(true)}
            <div
              ref={scrollRef}
              role="listbox"
              className="model-selector-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filtered.length === 0
                ? emptyState(true)
                : filtered.map(m => renderOption(m, { large: true }))}
            </div>
            {onOpenAll && (
              <div className="shrink-0 border-t border-white/5 px-2 py-2">
                <button
                  type="button"
                  onClick={() => { onOpenAll(); setIsOpen(false); }}
                  className="w-full text-left px-3 py-3 min-h-[56px] rounded-xl flex items-center justify-between hover:bg-white/5 active:bg-white/10 text-gray-100 transition-colors"
                >
                  <span className="text-base font-semibold">Open advanced model settings</span>
                  <ChevronDown className="w-5 h-5 -rotate-90 text-gray-400" />
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop: floating popover
  return (
    <div className="relative" ref={ref}>
      {toastPill}
      {triggerButton}

      {isOpen && (
        <div
          role="listbox"
          className="absolute bottom-full right-0 mb-2 w-[90vw] sm:w-[380px] max-w-[calc(100vw-2rem)] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 z-50 p-1.5 flex flex-col"
          style={{ maxHeight: `${maxHeight}px` }}
          // Stop wheel events from bubbling to the page so the page never
          // scrolls instead of the dropdown's inner list.
          onWheelCapture={(e) => { e.stopPropagation(); }}
        >
          {searchInput(false)}
          <div
            ref={scrollRef}
            className="model-selector-scroll flex-1 overflow-y-auto overscroll-contain pr-0.5"
            style={{ scrollBehavior: "auto", WebkitOverflowScrolling: "touch" }}
          >
            {filtered.length === 0 ? emptyState(false) : filtered.map(m => renderOption(m))}
          </div>

          {onOpenAll && (
            <>
              <div className="h-px bg-white/5 my-1 mx-2 shrink-0" />
              <button
                type="button"
                onClick={() => { onOpenAll(); setIsOpen(false); }}
                className="shrink-0 w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/5 text-gray-100 transition-colors"
              >
                <span className="text-[13px] font-semibold">Open advanced model settings</span>
                <ChevronDown className="w-4 h-4 -rotate-90 text-gray-400" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Main ChatInput ---------- */

export function ChatInput({
  onSend, disabled, compact, isStreaming, onStop,
  model, onModelChange, models, featuredModelIds, onOpenAllModels,
  showTools, webSearchEnabled, setWebSearchEnabled, autoCodeMode, setAutoCodeMode,
  imageGenEnabled, setImageGenEnabled, onTypingStart,
}: ChatInputProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [input, setInput]               = useState("");
  const hasNotifiedTyping = useRef(false);
  const [attachments, setAttachments]   = useState<ProcessedFile[]>([]);
  const [pasted, setPasted]             = useState<PastedSnippet[]>([]);
  const [previewPasted, setPreviewPasted] = useState<PastedSnippet | null>(null);
  const [isUploading, setIsUploading]   = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [toolsOpen, setToolsOpen]       = useState(false);
  const [accept, setAccept]             = useState<string>("*/*");
  const [isDragging, setIsDragging]     = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const toolsAvailable = !!(
    showTools && (setWebSearchEnabled || setAutoCodeMode || setImageGenEnabled)
  );
  const activeToolsCount =
    (webSearchEnabled ? 1 : 0) +
    (autoCodeMode ? 1 : 0) +
    (imageGenEnabled ? 1 : 0);

  useEffect(() => {
    if (!toolsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setToolsOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [toolsOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    if (isMobile) return; // Drawer manages its own outside-click / esc on mobile
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen, isMobile]);

  // Auto-resize textarea — cap at 40vh on mobile, 240px on desktop
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = isMobile
      ? Math.round(window.innerHeight * 0.4)
      : 240;
    el.style.height = Math.min(el.scrollHeight, cap) + "px";
  }, [input, isMobile]);

  const openPickerWith = (acceptValue: string) => {
    setAccept(acceptValue);
    setMenuOpen(false);
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const handleFiles = useCallback(async (fileList: FileList | File[] | null) => {
    if (!fileList || (fileList as FileList).length === 0) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      for (const f of Array.from(fileList as FileList)) form.append("files", f);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const json = await res.json();
      const uploaded: ProcessedFile[] = json.uploaded ?? [];
      // For video/audio/PDF the server returns no preview URL — read the
      // original File client-side to enable inline previews in chat history.
      const enriched = await enrichAttachmentsWithClientDataUrls(
        uploaded,
        Array.from(fileList as FileList),
      );
      setAttachments(prev => [...prev, ...enriched]);
      if (uploaded.length > 0) {
        const typeLabels: Record<ProcessedFile["type"], string> = {
          image: "image",
          pdf: "PDF",
          video: "video",
          audio: "audio",
          text: "code",
          binary: "file",
          folder: "folder",
        };
        const seen = new Set<string>();
        const labels: string[] = [];
        for (const u of uploaded) {
          const lbl = typeLabels[u.type] ?? "file";
          if (!seen.has(lbl)) { seen.add(lbl); labels.push(lbl); }
        }
        const noun = uploaded.length === 1 ? "file" : "files";
        toast({
          title: `${uploaded.length} ${noun} attached`,
          description: labels.join(", "),
        });
      }
    } catch (err) {
      console.error("Upload error:", err);
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({
        title: "Upload failed",
        description: msg.includes("abort") ? "Upload timed out after 60s" : msg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [toast]);

  const handleSubmit = () => {
    const hasContent = input.trim() || attachments.length > 0 || pasted.length > 0;
    if (!hasContent || disabled || isUploading) return;
    // Merge pasted snippets into the message body so they reach the AI
    const pastedBlock = pasted
      .map((p, i) => `--- Pasted ${i + 1} ---\n${p.content}`)
      .join("\n\n");
    const finalMessage = pastedBlock
      ? (input.trim() ? `${input.trim()}\n\n${pastedBlock}` : pastedBlock)
      : input.trim();
    onSend(finalMessage, attachments.length > 0 ? attachments : undefined);
    setInput("");
    setAttachments([]);
    setPasted([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // 1. Files / images via clipboard
    const items = Array.from(e.clipboardData.items);
    const fileItems = items.filter(it => it.kind === "file");
    if (fileItems.length > 0) {
      const dt = new DataTransfer();
      fileItems.forEach(it => {
        const blob = it.getAsFile();
        if (blob) {
          const name = blob.name && blob.name.length > 0
            ? blob.name
            : `paste-${Date.now()}.${(blob.type.split("/")[1] || "bin")}`;
          dt.items.add(new File([blob], name, { type: blob.type }));
        }
      });
      if (dt.files.length > 0) {
        e.preventDefault();
        await handleFiles(dt.files);
        return;
      }
    }
    // 2. Large text → snippet card
    const text = e.clipboardData.getData("text");
    if (text.length > 300) {
      e.preventDefault();
      setPasted(prev => [...prev, { id: Math.random().toString(36).slice(2, 11), content: text }]);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      dragCounter.current += 1;
      setIsDragging(true);
    }
  };
  const onDragLeave = () => {
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const hasContent = !!(input.trim() || attachments.length > 0 || pasted.length > 0);
  const canSend = hasContent && !disabled && !isUploading;

  return (
    <div
      className={`relative w-full ${compact ? "" : "max-w-3xl mx-auto"} focus-within:outline-none`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Outer rounded container */}
      <div
        className={`
          relative z-10 flex flex-col rounded-2xl cursor-text
          bg-[#1c1c1c] border border-white/10
          shadow-[0_0_15px_rgba(0,0,0,0.25)]
          hover:shadow-[0_0_20px_rgba(0,0,0,0.35)]
          focus-within:border-purple-500/50 focus-within:bg-[#1e1e1e]
          focus-within:shadow-[0_0_25px_rgba(124,58,237,0.15)]
          transition-all duration-200
        `}
      >
        <div className="flex flex-col px-3 pt-3 pb-2 gap-2">

          {/* 1. Cards row (files + pasted snippets) above the input */}
          {(attachments.length > 0 || pasted.length > 0 || isUploading) && (
            <div
              className="flex gap-1.5 sm:gap-2.5 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-white/10"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
            >
              {pasted.map(p => (
                <PastedCard
                  key={p.id}
                  content={p}
                  onRemove={() => setPasted(prev => prev.filter(x => x.id !== p.id))}
                  onOpen={() => setPreviewPasted(p)}
                />
              ))}
              {attachments.map((f, i) => (
                <FileCard
                  key={i}
                  file={f}
                  onRemove={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
              {isUploading && (
                <div className="flex-shrink-0 w-24 h-24 rounded-xl border border-white/10 bg-[#262626] flex flex-col items-center justify-center gap-1.5">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-[10px] text-gray-500">uploading…</span>
                </div>
              )}
            </div>
          )}

          {/* 2. Textarea */}
          <div className="relative">
            <div
              className="w-full overflow-y-auto break-words pl-1 max-h-[40vh] md:max-h-60 min-h-[44px] md:min-h-[2.5rem]"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (e.target.value.length > 0 && !hasNotifiedTyping.current) {
                    hasNotifiedTyping.current = true;
                    onTypingStart?.();
                  }
                  if (e.target.value.length === 0) {
                    hasNotifiedTyping.current = false;
                  }
                }}
                onFocus={() => onTypingStart?.()}
                onPaste={handlePaste}
                onKeyDown={e => {
                  // Enter-to-send only on desktop (mobile keyboards need Enter for new lines)
                  if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  attachments.length > 0 || pasted.length > 0
                    ? "Add a message or just send…"
                    : "Message LITHOVEX AI…"
                }
                rows={1}
                disabled={disabled}
            className="w-full bg-transparent border-0 outline-none text-gray-100 placeholder:text-gray-600 resize-none overflow-hidden block text-base md:text-[16px] leading-[1.5] p-3 md:px-1 md:py-1 focus:outline-none rounded-xl"
                style={{
                  minHeight: 44,
                  maxHeight: "40vh",
                  fontSize: isMobile ? 16 : undefined,
                  lineHeight: 1.5,
                }}
              />
            </div>
          </div>

          {/* 3. Action bar */}
          <div className="flex gap-2 w-full items-center">
            {/* Left: Plus (attach) */}
            <div ref={menuRef} className="relative flex-1 flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => !isUploading && setMenuOpen(o => !o)}
                disabled={disabled || isUploading}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="Attach a file"
                className={`
                  inline-flex items-center justify-center shrink-0
                  rounded-lg active:scale-95 transition-colors duration-150
                  focus:outline-none
                  h-11 w-11 md:h-8 md:w-8
                  ${isUploading
                    ? "text-purple-400 cursor-wait"
                    : menuOpen
                      ? "text-purple-300 bg-white/10"
                      : "text-gray-500 hover:text-gray-200 hover:bg-white/10"}
                `}
              >
                {isUploading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Plus className="w-5 h-5" />}
              </button>

              {/* Tools button — opens a popover with Web search & Code mode toggles */}
              {toolsAvailable && (
                <div ref={toolsRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setToolsOpen(o => !o)}
                    disabled={disabled}
                    aria-haspopup="menu"
                    aria-expanded={toolsOpen}
                    title="Tools"
                    className={`
                      inline-flex items-center gap-1.5 shrink-0 rounded-lg
                      active:scale-95 transition-colors duration-150 focus:outline-none
                      px-2 md:px-2.5 h-11 md:h-8 text-xs font-medium
                      ${toolsOpen || activeToolsCount > 0
                        ? "text-gray-100 bg-white/10"
                        : "text-gray-500 hover:text-gray-200 hover:bg-white/10"}
                    `}
                  >
                    <SlidersHorizontal className="w-4 h-4 md:w-3.5 md:h-3.5" />
                    <span className="hidden md:inline">Tools</span>
                    {activeToolsCount > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-purple-500/30 text-purple-200 text-[10px] font-semibold h-4 min-w-4 px-1">
                        {activeToolsCount}
                      </span>
                    )}
                  </button>

                  {toolsOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl shadow-black/50 backdrop-blur-sm overflow-hidden z-50"
                    >
                      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                        Tools
                      </div>
                      <div className="p-1.5 space-y-0.5">
                        {setWebSearchEnabled && (
                          <ToolToggleRow
                            id="ci-web"
                            label="Web search"
                            description="Search the live web"
                            icon={<Search className="w-4 h-4" />}
                            checked={!!webSearchEnabled}
                            onChange={setWebSearchEnabled}
                            activeColor="text-blue-400"
                          />
                        )}
                        {setAutoCodeMode && (
                          <ToolToggleRow
                            id="ci-code"
                            label="Code mode"
                            description="Auto-trigger code execution"
                            icon={<Code2 className="w-4 h-4" />}
                            checked={!!autoCodeMode}
                            onChange={setAutoCodeMode}
                            activeColor="text-emerald-400"
                          />
                        )}
                        {setImageGenEnabled && (
                          <ToolToggleRow
                            id="ci-imagegen"
                            label="Image Generation"
                            description="Turn your prompt into an image"
                            icon={<ImagePlus className="w-4 h-4" />}
                            checked={!!imageGenEnabled}
                            onChange={setImageGenEnabled}
                            activeColor="text-pink-400"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop: floating popover menu */}
              {menuOpen && !isMobile && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 mb-2 w-60 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl shadow-black/50 backdrop-blur-sm overflow-hidden z-50"
                >
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                    Upload
                  </div>
                  <ul className="py-1">
                    {UPLOAD_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <li key={opt.kind}>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => openPickerWith(opt.accept)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <Icon className={`w-4 h-4 shrink-0 ${opt.color}`} />
                            <span className="flex flex-col min-w-0">
                              <span className="text-sm text-gray-100 leading-tight">{opt.label}</span>
                              <span className="text-[11px] text-gray-500 truncate">{opt.hint}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Mobile: bottom Drawer with large touch targets */}
              {isMobile && (
                <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
                  <DrawerContent
                    className="bg-[#1a1a1a] border-white/10"
                    style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                  >
                    <DrawerHeader className="text-left">
                      <DrawerTitle className="text-gray-100 text-base">Upload</DrawerTitle>
                      <DrawerDescription className="sr-only">
                        Choose what kind of file to attach
                      </DrawerDescription>
                    </DrawerHeader>
                    <ul className="px-2 pb-3 space-y-1">
                      {UPLOAD_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        return (
                          <li key={opt.kind}>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => openPickerWith(opt.accept)}
                              className="w-full flex items-center gap-3 px-3 py-3 min-h-[56px] rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                            >
                              <Icon className={`w-5 h-5 shrink-0 ${opt.color}`} />
                              <span className="flex flex-col min-w-0 flex-1">
                                <span className="text-base text-gray-100 leading-tight">{opt.label}</span>
                                <span className="text-[12px] text-gray-500 truncate">{opt.hint}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </DrawerContent>
                </Drawer>
              )}
            </div>

            {/* Right: Model selector + Send / Stop */}
            <div className="flex flex-row items-center gap-1">
              {models && models.length > 0 && model && onModelChange && (
                <ModelSelector
                  models={models}
                  selectedModel={model}
                  onSelect={onModelChange}
                  featuredIds={featuredModelIds}
                  onOpenAll={onOpenAllModels}
                />
              )}
              {isStreaming && onStop ? (
                <button
                  onClick={onStop}
                  className="inline-flex items-center justify-center shrink-0 rounded-xl active:scale-95 transition-colors bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/30 h-11 w-11 md:h-8 md:w-8"
                  title="Stop generating"
                  type="button"
                  aria-label="Stop generating"
                >
                  <Square className="w-4 h-4 md:w-3.5 md:h-3.5" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={`
                    inline-flex items-center justify-center shrink-0 rounded-xl
                    active:scale-95 transition-colors
                    h-11 w-11 md:h-8 md:w-8
                    ${canSend
                      ? "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40"
                      : "bg-purple-600/25 text-white/50 cursor-not-allowed"}
                  `}
                  title={isMobile ? "Send" : "Send (Enter)"}
                  type="button"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-5 h-5 md:w-4 md:h-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 rounded-2xl border-2 border-dashed border-purple-500 bg-[#1c1c1c]/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <Archive className="w-10 h-10 text-purple-400 mb-2 animate-bounce" />
          <p className="text-purple-300 font-medium text-sm">Drop any file up to 50 MB</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {!compact && (
        <p className="text-[11px] text-gray-700 text-center mt-2">
          LITHOVEX AI can make mistakes. Consider checking important information.
        </p>
      )}

      {previewPasted && (
        <PastedPreviewModal content={previewPasted} onClose={() => setPreviewPasted(null)} />
      )}
    </div>
  );
}

/* ---------- Tools popover row ---------- */
function ToolToggleRow({
  id, label, description, icon, checked, onChange, activeColor,
}: {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  activeColor: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`
        w-full flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer
        transition-colors duration-150 min-h-11
        ${checked ? "bg-white/5" : "hover:bg-white/5"}
      `}
    >
      <span className={checked ? activeColor : "text-zinc-400"}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${checked ? "text-zinc-100" : "text-zinc-200"}`}>
          {label}
        </span>
        {description && (
          <span className="block text-[11px] text-zinc-500 truncate">{description}</span>
        )}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
