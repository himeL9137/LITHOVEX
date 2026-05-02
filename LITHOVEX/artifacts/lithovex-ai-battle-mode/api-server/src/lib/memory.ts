// LITHOVEX-CORE — Cross-session memory.
//
// Two persistent stores live behind this module:
//
//   1. **User profile** — long-term facts the user told the AI to remember
//      ("My name is Sam", "I prefer pnpm", "I'm building a Next.js app").
//      Profile entries are global to the user (single-user system today)
//      and injected into every chat as a system message.
//
//   2. **Per-chat summaries** — when a chat balloons past N turns, an
//      automatic rolling summary captures earlier context so we don't lose
//      it when older messages get trimmed from the upstream window.
//
// Both stores are JSON files next to the existing chats.json (same data
// directory selection logic as store.ts) so deployments that already mount
// LITHOVEX/server/data work without any extra config.

import fs from "node:fs";
import path from "node:path";

const DATA_FILE_CANDIDATES = [
  path.resolve(process.cwd(), "LITHOVEX/server/data/memory.json"),
  path.resolve(process.cwd(), "../../../server/data/memory.json"),
  path.resolve(process.cwd(), "server/data/memory.json"),
];

function pickDataFile(): string {
  for (const candidate of DATA_FILE_CANDIDATES) {
    const dir = path.dirname(candidate);
    try {
      if (fs.existsSync(dir)) return candidate;
    } catch {
      /* skip */
    }
  }
  const fallbackDir = path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  return path.join(fallbackDir, "memory.json");
}

const DATA_FILE = pickDataFile();

export interface ProfileFact {
  id: string;
  text: string;
  createdAt: string;
}

export interface ChatSummary {
  chatId: string;
  summary: string;
  upToMessageIndex: number; // exclusive
  updatedAt: string;
}

interface MemoryFile {
  profile: ProfileFact[];
  summaries: Record<string, ChatSummary>;
}

let cache: MemoryFile | null = null;

function load(): MemoryFile {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<MemoryFile>;
      cache = {
        profile: Array.isArray(parsed.profile) ? parsed.profile : [],
        summaries:
          parsed.summaries && typeof parsed.summaries === "object"
            ? parsed.summaries
            : {},
      };
      return cache;
    }
  } catch {
    /* fall through to empty */
  }
  cache = { profile: [], summaries: {} };
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.error("[memory] failed to persist", err);
  }
}

function newId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Profile facts ─────────────────────────────────────────────────────

export function listProfileFacts(): ProfileFact[] {
  return [...load().profile];
}

export function addProfileFact(text: string): ProfileFact | null {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const data = load();
  // Skip near-duplicates (case-insensitive whole-string match).
  const lower = trimmed.toLowerCase();
  if (data.profile.some((f) => f.text.trim().toLowerCase() === lower)) {
    return null;
  }
  const fact: ProfileFact = {
    id: newId(),
    text: trimmed.slice(0, 1000),
    createdAt: new Date().toISOString(),
  };
  data.profile.push(fact);
  persist();
  return fact;
}

export function removeProfileFact(id: string): boolean {
  const data = load();
  const idx = data.profile.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  data.profile.splice(idx, 1);
  persist();
  return true;
}

export function clearProfile(): void {
  const data = load();
  data.profile = [];
  persist();
}

// ─── Per-chat summaries ────────────────────────────────────────────────

export function getChatSummary(chatId: string): ChatSummary | null {
  if (!chatId) return null;
  return load().summaries[chatId] ?? null;
}

export function setChatSummary(
  chatId: string,
  summary: string,
  upToMessageIndex: number,
): ChatSummary {
  const data = load();
  const record: ChatSummary = {
    chatId,
    summary: summary.trim().slice(0, 4000),
    upToMessageIndex,
    updatedAt: new Date().toISOString(),
  };
  data.summaries[chatId] = record;
  persist();
  return record;
}

export function clearChatSummary(chatId: string): void {
  const data = load();
  if (data.summaries[chatId]) {
    delete data.summaries[chatId];
    persist();
  }
}

// ─── Helpers used by chat.ts on every request ──────────────────────────

// Build the single system message that injects profile facts + (optionally)
// a chat summary so the model has continuity across sessions. Returns null
// when neither store has anything useful.
export function buildMemorySystemMessage(
  chatId: string | undefined | null,
): { role: "system"; content: string } | null {
  const facts = listProfileFacts();
  const summary = chatId ? getChatSummary(chatId) : null;
  if (facts.length === 0 && !summary) return null;

  const parts: string[] = [
    "## LITHOVEX MEMORY (cross-session context)",
    "",
    "Use the information below to maintain continuity. Do NOT echo it back to the user verbatim — just use it to ground your answers and avoid asking for things you already know.",
  ];

  if (facts.length > 0) {
    parts.push("", "### Long-term facts the user wants you to remember:");
    for (const f of facts) {
      parts.push(`- ${f.text}`);
    }
  }

  if (summary) {
    parts.push(
      "",
      "### Summary of earlier turns in this conversation:",
      summary.summary,
    );
  }

  return { role: "system", content: parts.join("\n") };
}

// Heuristic: should we trigger a summary refresh for this chat right now?
// We summarize when the chat has more than `THRESHOLD` messages and either
// (a) no summary exists yet, or (b) at least `STEP` new messages have
// arrived since the last summary point.
const SUMMARY_THRESHOLD = 16; // start summarizing past this many messages
const SUMMARY_STEP = 8; // refresh every N new messages

export function shouldSummarize(
  chatId: string,
  totalMessages: number,
): boolean {
  if (!chatId) return false;
  if (totalMessages < SUMMARY_THRESHOLD) return false;
  const existing = getChatSummary(chatId);
  if (!existing) return true;
  return totalMessages - existing.upToMessageIndex >= SUMMARY_STEP;
}

// Pull a candidate sentence out of a user message that looks like it's
// asking the assistant to remember something. Returns null when the
// message doesn't look memory-bearing. Examples that match:
//   "Remember that I prefer pnpm"           → "I prefer pnpm"
//   "Please remember my name is Sam"        → "my name is Sam"
//   "Note: I'm using Next.js 15"            → "I'm using Next.js 15"
//   "FYI my deploy target is Vercel"        → "my deploy target is Vercel"
const MEMORY_INTENT_RX =
  /^\s*(?:please\s+)?(?:remember(?:\s+that)?|note(?:\s+that)?[:,]?|fyi[:,]?|for\s+the\s+record[,]?|don'?t\s+forget(?:\s+that)?|keep\s+in\s+mind(?:\s+that)?)\s+(.{3,})$/i;

export function extractMemoryIntent(userMessage: string): string | null {
  if (!userMessage) return null;
  const m = userMessage.trim().match(MEMORY_INTENT_RX);
  if (!m) return null;
  const captured = (m[1] ?? "").trim().replace(/[.!?]+$/, "");
  return captured.length >= 3 ? captured : null;
}
