import path from "node:path";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { indexDocument } from "../lib/rag";

export interface ProcessedFile {
  name: string;
  size: number;
  ext: string;
  type: "image" | "pdf" | "text" | "video" | "audio" | "binary";
  content?: string;
  dataUrl?: string;
  pages?: number;
  lines?: number;
  truncated?: boolean;
  size_human: string;
  b64?: string;
  /** Set when the file's text was indexed into the RAG knowledge base. */
  ragDocId?: string;
}

const MAX_TEXT_CHARS = 8000;
const MAX_PDF_CHARS = 8000;

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".jsonc",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".yaml",
  ".yml",
  ".sh",
  ".bash",
  ".zsh",
  ".env",
  ".xml",
  ".svg",
  ".txt",
  ".log",
  ".ini",
  ".toml",
  ".conf",
  ".sql",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cc",
  ".php",
  ".pl",
  ".lua",
  ".r",
  ".dart",
  ".vue",
  ".svelte",
]);

function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function getExt(filename: string): string {
  return path.extname(filename || "").toLowerCase();
}

function isTextLike(mimetype: string, ext: string): boolean {
  if (mimetype && mimetype.startsWith("text/")) return true;
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (
    mimetype === "application/json" ||
    mimetype === "application/xml" ||
    mimetype === "application/javascript" ||
    mimetype === "application/typescript" ||
    mimetype === "application/x-yaml" ||
    mimetype === "application/x-sh"
  ) {
    return true;
  }
  return false;
}

async function processFile(
  file: Express.Multer.File,
): Promise<ProcessedFile> {
  const name = file.originalname;
  const size = file.size;
  const ext = getExt(name);
  const mimetype = file.mimetype || "";
  const buffer = file.buffer;
  const size_human = humanSize(size);

  if (mimetype.startsWith("image/")) {
    const b64 = buffer.toString("base64");
    return {
      name,
      size,
      ext,
      type: "image",
      b64,
      dataUrl: `data:${mimetype};base64,${b64}`,
      size_human,
    };
  }

  if (mimetype === "application/pdf" || ext === ".pdf") {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse =
        (pdfParseModule as { default?: unknown }).default ??
        (pdfParseModule as unknown);
      const result = await (pdfParse as (data: Buffer) => Promise<{
        text: string;
        numpages: number;
      }>)(buffer);
      const text = result.text ?? "";
      const truncated = text.length > MAX_PDF_CHARS;
      const content = truncated ? text.slice(0, MAX_PDF_CHARS) : text;
      return {
        name,
        size,
        ext,
        type: "pdf",
        content,
        pages: result.numpages,
        truncated,
        size_human,
      };
    } catch {
      return {
        name,
        size,
        ext,
        type: "pdf",
        content: "",
        pages: 0,
        truncated: false,
        size_human,
      };
    }
  }

  if (isTextLike(mimetype, ext)) {
    const fullText = buffer.toString("utf8");
    const truncated = fullText.length > MAX_TEXT_CHARS;
    const content = truncated ? fullText.slice(0, MAX_TEXT_CHARS) : fullText;
    const lines = fullText.split(/\r\n|\r|\n/).length;
    return {
      name,
      size,
      ext,
      type: "text",
      content,
      lines,
      truncated,
      size_human,
    };
  }

  if (mimetype.startsWith("video/")) {
    return { name, size, ext, type: "video", size_human };
  }

  if (mimetype.startsWith("audio/")) {
    return { name, size, ext, type: "audio", size_human };
  }

  return { name, size, ext, type: "binary", size_human };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 20,
  },
});

const router: IRouter = Router();

router.post("/", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const processed = await Promise.all(files.map((f) => processFile(f)));

    // Index any text-bearing file into the knowledge base (RAG) so the
    // assistant can pull excerpts on later turns. We index the FULL text
    // recovered from disk, not the (truncated) preview that goes into the
    // chat window. Failure to index never blocks the upload response.
    const uploaded = processed.map((p, i) => {
      if (p.type !== "text" && p.type !== "pdf") return p;
      const original = files[i];
      let fullText: string | undefined;
      if (p.type === "text" && original) {
        try {
          fullText = original.buffer.toString("utf8");
        } catch {
          fullText = p.content;
        }
      } else {
        // For PDFs, the parsed text is already on `p.content`.
        fullText = p.content;
      }
      if (!fullText || !fullText.trim()) return p;
      try {
        const doc = indexDocument({
          name: p.name,
          text: fullText,
          source: "upload",
        });
        return { ...p, ragDocId: doc.id };
      } catch {
        return p;
      }
    });

    res.json({ uploaded });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: message });
  }
});

export default router;
