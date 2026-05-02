import { useState } from "react";
import {
  FileText,
  FileCode2,
  FileArchive,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Image as ImageIcon,
  FileVideo,
  FileAudio,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ProcessedFile } from "@/lib/smartRouter";

interface MessageAttachmentsProps {
  attachments: ProcessedFile[];
  /** Right-aligned for user bubbles, left for assistant. Defaults to right. */
  align?: "left" | "right";
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const CODE_EXT_LANG: Record<string, string> = {
  ".js": "javascript", ".jsx": "jsx", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "tsx",
  ".py": "python", ".rb": "ruby", ".go": "go", ".rs": "rust",
  ".java": "java", ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp",
  ".cs": "csharp", ".swift": "swift", ".kt": "kotlin", ".scala": "scala",
  ".php": "php", ".pl": "perl", ".lua": "lua", ".dart": "dart",
  ".r": "r", ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".html": "html", ".htm": "html",
  ".css": "css", ".scss": "scss", ".sass": "sass", ".less": "less",
  ".json": "json", ".jsonc": "json",
  ".yaml": "yaml", ".yml": "yaml",
  ".xml": "xml", ".svg": "xml", ".sql": "sql",
  ".vue": "html", ".svelte": "html",
  ".md": "markdown", ".markdown": "markdown",
  ".toml": "toml", ".ini": "ini", ".env": "bash",
  ".csv": "csv", ".tsv": "csv", ".log": "log", ".txt": "text",
};

function languageFor(ext: string): string {
  return CODE_EXT_LANG[ext.toLowerCase()] ?? "text";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

function isArchive(ext: string): boolean {
  return [".zip", ".tar", ".gz", ".tgz", ".rar", ".7z"].includes(ext.toLowerCase());
}

function isSpreadsheet(ext: string): boolean {
  return [".xlsx", ".xls", ".ods", ".csv", ".tsv"].includes(ext.toLowerCase());
}

function genericIcon(ext: string) {
  if (isArchive(ext)) return <FileArchive className="w-5 h-5 text-amber-400" />;
  if (isSpreadsheet(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  return <FileIcon className="w-5 h-5 text-zinc-400" />;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-type tiles
// ──────────────────────────────────────────────────────────────────────────

function ImageTile({ att }: { att: ProcessedFile }) {
  if (!att.dataUrl) {
    return <BinaryTile att={att} icon={<ImageIcon className="w-5 h-5 text-violet-300" />} />;
  }
  return (
    <a
      href={att.dataUrl}
      download={att.name}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-[320px] rounded-xl overflow-hidden border border-white/10 bg-zinc-900 hover:border-violet-500/60 transition-colors"
      title={`${att.name} — click to open`}
    >
      <img
        src={att.dataUrl}
        alt={att.name}
        className="block w-full h-auto max-h-80 object-contain bg-zinc-950"
        loading="lazy"
      />
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-zinc-400">
        <span className="truncate">{att.name}</span>
        <span className="shrink-0 tabular-nums">{att.size_human ?? formatBytes(att.size)}</span>
      </div>
    </a>
  );
}

function VideoTile({ att }: { att: ProcessedFile }) {
  if (!att.dataUrl) {
    return <BinaryTile att={att} icon={<FileVideo className="w-5 h-5 text-rose-400" />} />;
  }
  return (
    <div className="max-w-[360px] rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
      <video
        src={att.dataUrl}
        controls
        preload="metadata"
        className="block w-full h-auto max-h-72 bg-black"
      />
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-zinc-400">
        <span className="truncate">{att.name}</span>
        <a
          href={att.dataUrl}
          download={att.name}
          className="shrink-0 inline-flex items-center gap-1 hover:text-violet-300"
          aria-label={`Download ${att.name}`}
        >
          <Download className="w-3 h-3" /> {att.size_human ?? formatBytes(att.size)}
        </a>
      </div>
    </div>
  );
}

function AudioTile({ att }: { att: ProcessedFile }) {
  return (
    <div className="max-w-[360px] rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <FileAudio className="w-4 h-4 text-sky-400 shrink-0" />
        <span className="text-[12px] text-zinc-200 truncate flex-1" title={att.name}>
          {att.name}
        </span>
        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
          {att.size_human ?? formatBytes(att.size)}
        </span>
      </div>
      {att.dataUrl ? (
        <audio src={att.dataUrl} controls preload="metadata" className="w-full" />
      ) : (
        <div className="text-[11px] text-zinc-500 italic">
          Audio preview unavailable (file too large to inline).
        </div>
      )}
      {att.dataUrl && (
        <div className="mt-1.5 text-right">
          <a
            href={att.dataUrl}
            download={att.name}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-sky-300"
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </div>
      )}
    </div>
  );
}

function PdfTile({ att }: { att: ProcessedFile }) {
  const [open, setOpen] = useState(false);
  const hasUrl = !!att.dataUrl;
  return (
    <div className="max-w-[420px] rounded-xl border border-white/10 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
        aria-expanded={open}
      >
        <FileText className="w-5 h-5 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-zinc-200 truncate" title={att.name}>
            {att.name}
          </div>
          <div className="text-[10px] text-zinc-500">
            PDF
            {att.pages ? ` · ${att.pages} page${att.pages === 1 ? "" : "s"}` : ""}
            {" · "}
            {att.size_human ?? formatBytes(att.size)}
          </div>
        </div>
        {hasUrl ? (
          open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />
        ) : null}
      </button>
      {open && hasUrl && (
        <iframe
          src={att.dataUrl}
          title={att.name}
          className="w-full h-[420px] border-0 bg-white"
        />
      )}
      {!hasUrl && att.content && (
        <div className="px-3 pb-3">
          <div className="text-[10px] text-zinc-500 mb-1">Extracted text preview</div>
          <pre className="text-[11px] text-zinc-300 bg-black/40 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {att.content}
            {att.truncated ? "\n\n[…truncated]" : ""}
          </pre>
        </div>
      )}
      {hasUrl && (
        <div className="px-3 pb-2 text-right">
          <a
            href={att.dataUrl}
            download={att.name}
            className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300"
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </div>
      )}
    </div>
  );
}

function TextTile({ att }: { att: ProcessedFile }) {
  const [open, setOpen] = useState(false);
  const lang = languageFor(att.ext);
  const hasContent = !!att.content;
  return (
    <div className="max-w-[520px] rounded-xl border border-white/10 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => hasContent && setOpen((o) => !o)}
        disabled={!hasContent}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left disabled:cursor-default"
        aria-expanded={open}
      >
        <FileCode2 className="w-5 h-5 text-violet-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-zinc-200 truncate" title={att.name}>
            {att.name}
          </div>
          <div className="text-[10px] text-zinc-500">
            {lang}
            {att.lines ? ` · ${att.lines} line${att.lines === 1 ? "" : "s"}` : ""}
            {" · "}
            {att.size_human ?? formatBytes(att.size)}
            {att.truncated ? " · truncated" : ""}
          </div>
        </div>
        {hasContent ? (
          open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />
        ) : null}
      </button>
      {open && hasContent && (
        <div className="border-t border-white/10 max-h-80 overflow-auto bg-[#1e1e1e]">
          <SyntaxHighlighter
            language={lang}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: "0.75rem",
              fontSize: "11.5px",
              background: "transparent",
            }}
            wrapLongLines
          >
            {att.content + (att.truncated ? "\n\n// […truncated]" : "")}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

function BinaryTile({ att, icon }: { att: ProcessedFile; icon?: React.ReactNode }) {
  return (
    <div className="max-w-[320px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 bg-zinc-900">
      <div className="shrink-0">{icon ?? genericIcon(att.ext)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-zinc-200 truncate" title={att.name}>
          {att.name}
        </div>
        <div className="text-[10px] text-zinc-500">
          {(att.ext || "file").replace(/^\./, "").toUpperCase() || "FILE"}
          {" · "}
          {att.size_human ?? formatBytes(att.size)}
        </div>
      </div>
      {att.dataUrl ? (
        <a
          href={att.dataUrl}
          download={att.name}
          className="shrink-0 p-1.5 rounded-md text-zinc-500 hover:text-violet-300 hover:bg-white/5"
          aria-label={`Download ${att.name}`}
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function FolderTile({ att }: { att: ProcessedFile }) {
  return (
    <div className="max-w-[320px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-white/10 bg-zinc-900">
      <FileArchive className="w-5 h-5 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-zinc-200 truncate" title={att.name}>
          {att.name}
        </div>
        <div className="text-[10px] text-zinc-500">
          Folder
          {att.fileCount ? ` · ${att.fileCount} file${att.fileCount === 1 ? "" : "s"}` : ""}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────

export function MessageAttachments({ attachments, align = "right" }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {attachments.map((att, idx) => {
        const key = `${att.name}-${idx}`;
        switch (att.type) {
          case "image":
            return <ImageTile key={key} att={att} />;
          case "video":
            return <VideoTile key={key} att={att} />;
          case "audio":
            return <AudioTile key={key} att={att} />;
          case "pdf":
            return <PdfTile key={key} att={att} />;
          case "text":
            return <TextTile key={key} att={att} />;
          case "folder":
            return <FolderTile key={key} att={att} />;
          case "binary":
          default:
            return <BinaryTile key={key} att={att} />;
        }
      })}
    </div>
  );
}
