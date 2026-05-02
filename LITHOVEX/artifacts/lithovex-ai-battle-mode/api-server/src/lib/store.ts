import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const DATA_FILE_CANDIDATES = [
  path.resolve(process.cwd(), "LITHOVEX/server/data/chats.json"),
  path.resolve(process.cwd(), "../../../server/data/chats.json"),
  path.resolve(process.cwd(), "server/data/chats.json"),
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
  // fallback: create local data folder beside cwd
  const fallbackDir = path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  return path.join(fallbackDir, "chats.json");
}

const DATA_FILE = pickDataFile();

let cache: ChatHistory[] | null = null;

function load(): ChatHistory[] {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cache = parsed as ChatHistory[];
        return cache;
      }
    }
  } catch {
    /* fall through to empty */
  }
  cache = [];
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    // Persistence failure should not crash the server
    console.error("[chat-store] failed to persist", err);
  }
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export const chatStore = {
  list(): ChatHistory[] {
    return load()
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get(id: string): ChatHistory | undefined {
    return load().find((c) => c.id === id);
  },

  create(input: { title?: string; messages?: ChatMessage[] }): ChatHistory {
    const chats = load();
    const now = nowIso();
    const chat: ChatHistory = {
      id: newId(),
      title: (input.title ?? "New Chat").slice(0, 200),
      messages: input.messages ?? [],
      createdAt: now,
      updatedAt: now,
    };
    chats.push(chat);
    persist();
    return chat;
  },

  update(
    id: string,
    patch: { title?: string | null; messages?: ChatMessage[] },
  ): ChatHistory | undefined {
    const chats = load();
    const idx = chats.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    const current = chats[idx];
    const next: ChatHistory = {
      ...current,
      title:
        patch.title !== undefined && patch.title !== null
          ? patch.title.slice(0, 200)
          : current.title,
      messages: patch.messages ?? current.messages,
      updatedAt: nowIso(),
    };
    chats[idx] = next;
    persist();
    return next;
  },

  remove(id: string): boolean {
    const chats = load();
    const idx = chats.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    chats.splice(idx, 1);
    persist();
    return true;
  },
};
