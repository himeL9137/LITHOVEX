import type { ProcessedFile } from "@/lib/smartRouter";

const MARKER_OPEN = "<!--LITHOVEX_ATTACH:";
const MARKER_CLOSE = "-->";
const MARKER_RE = /\u200B?<!--LITHOVEX_ATTACH:([A-Za-z0-9+/=]+)-->\u200B?/g;

type StoredAttachment = Pick<
  ProcessedFile,
  | "name"
  | "size"
  | "ext"
  | "type"
  | "content"
  | "dataUrl"
  | "pages"
  | "lines"
  | "truncated"
  | "size_human"
>;

function utf8ToBase64(input: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  return Buffer.from(input, "utf8").toString("base64");
}

function base64ToUtf8(input: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(input, "base64").toString("utf8");
}

function slimAttachment(att: ProcessedFile): StoredAttachment {
  return {
    name: att.name,
    size: att.size,
    ext: att.ext,
    type: att.type,
    content: att.content,
    dataUrl: att.dataUrl,
    pages: att.pages,
    lines: att.lines,
    truncated: att.truncated,
    size_human: att.size_human,
  };
}

export function encodeAttachmentMarker(attachments: ProcessedFile[]): string {
  if (!attachments || attachments.length === 0) return "";
  const slim = attachments.map(slimAttachment);
  const json = JSON.stringify(slim);
  const b64 = utf8ToBase64(json);
  return `\u200B${MARKER_OPEN}${b64}${MARKER_CLOSE}\u200B`;
}

export interface ParsedMessageContent {
  text: string;
  attachments: ProcessedFile[];
}

/**
 * Splits a stored message into its visible text and any attachments encoded
 * via {@link encodeAttachmentMarker}. Stripping is defensive — if the marker
 * is malformed, the marker substring is removed and attachments default to [].
 */
export function parseMessageContent(raw: string): ParsedMessageContent {
  if (!raw || typeof raw !== "string" || !raw.includes(MARKER_OPEN)) {
    return { text: raw ?? "", attachments: [] };
  }
  const attachments: ProcessedFile[] = [];
  const cleaned = raw.replace(MARKER_RE, (_match, b64: string) => {
    try {
      const json = base64ToUtf8(b64);
      const parsed = JSON.parse(json) as StoredAttachment[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object" && typeof item.name === "string") {
            attachments.push(item as ProcessedFile);
          }
        }
      }
    } catch {
      // ignore malformed marker — just strip it
    }
    return "";
  });
  return { text: cleaned.replace(/\s+$/g, ""), attachments };
}

/**
 * Strip just the marker (no parsing). Useful for fallback paths that only
 * need to display text — e.g., the copy-button text source.
 */
export function stripAttachmentMarker(raw: string): string {
  if (!raw || typeof raw !== "string") return raw ?? "";
  return raw.replace(MARKER_RE, "").replace(/\s+$/g, "");
}

const PREVIEWABLE_FOR_DATAURL = new Set<ProcessedFile["type"]>([
  "video",
  "audio",
  "pdf",
]);

const MAX_CLIENT_DATAURL_BYTES = 10 * 1024 * 1024; // 10 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * After the server returns processed metadata, enrich video/audio/PDF entries
 * with a base64 data URL read client-side from the original `File`. Images
 * already include `dataUrl` from the server. Falls through silently for files
 * over {@link MAX_CLIENT_DATAURL_BYTES} so we don't bloat chat history.
 */
export async function enrichAttachmentsWithClientDataUrls(
  uploaded: ProcessedFile[],
  originals: File[],
): Promise<ProcessedFile[]> {
  if (!uploaded.length || !originals.length) return uploaded;
  const byName = new Map<string, File>();
  for (const f of originals) {
    if (!byName.has(f.name)) byName.set(f.name, f);
  }
  return Promise.all(
    uploaded.map(async (att) => {
      if (att.dataUrl) return att;
      if (!PREVIEWABLE_FOR_DATAURL.has(att.type)) return att;
      const orig = byName.get(att.name);
      if (!orig || orig.size > MAX_CLIENT_DATAURL_BYTES) return att;
      try {
        const dataUrl = await readFileAsDataUrl(orig);
        return { ...att, dataUrl };
      } catch {
        return att;
      }
    }),
  );
}
