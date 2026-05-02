import fs from "node:fs";
import path from "node:path";

const KEY_FILE_CANDIDATES = [
  path.resolve(process.cwd(), "LITHOVEX/server/huggingface_api_tokens.env"),
  path.resolve(process.cwd(), "../../../server/huggingface_api_tokens.env"),
  path.resolve(process.cwd(), "server/huggingface_api_tokens.env"),
];

const TOKEN_KEY_PREFIX = "HUGGINGFACE_API_KEY_";
const FALLBACK_KEY = "HUGGINGFACE_API_KEY";

const TOKEN_ALIASES: Record<number, string> = {
  1: "Alpha",
  2: "Beta",
  3: "Gamma",
  4: "Delta",
  5: "Epsilon",
  6: "Zeta",
  7: "Eta",
  8: "Theta",
  9: "Iota",
};

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const DEGRADE_THRESHOLD = 3;

function loadFromFile(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of KEY_FILE_CANDIDATES) {
    try {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && val) out[key] = val;
      }
      break;
    } catch {
      /* try next */
    }
  }
  return out;
}

const fileTokens = loadFromFile();

function readKey(name: string): string | undefined {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const fromFile = fileTokens[name];
  if (fromFile && fromFile.trim()) return fromFile.trim();
  return undefined;
}

export interface ResolvedKey {
  index: number;
  token: string;
}

export type KeyStatus =
  | "active"
  | "rate_limited"
  | "cooling_down"
  | "expired"
  | "degraded";

interface KeyState {
  status: KeyStatus;
  errorCount: number;
  successCount: number;
  lastUsed: number | null;
  lastError: string | null;
  cooldownUntil: number | null;
}

const keyStates = new Map<number, KeyState>();

function ensureState(index: number): KeyState {
  let s = keyStates.get(index);
  if (!s) {
    s = {
      status: "active",
      errorCount: 0,
      successCount: 0,
      lastUsed: null,
      lastError: null,
      cooldownUntil: null,
    };
    keyStates.set(index, s);
  }
  return s;
}

function maybeRecover(state: KeyState): void {
  if (state.status === "rate_limited" || state.status === "cooling_down") {
    if (state.cooldownUntil != null && Date.now() >= state.cooldownUntil) {
      state.status = state.errorCount >= DEGRADE_THRESHOLD ? "degraded" : "active";
      state.cooldownUntil = null;
    }
  }
}

export function recordKeySuccess(index: number): void {
  const s = ensureState(index);
  s.successCount += 1;
  s.errorCount = 0;
  s.lastUsed = Date.now();
  s.lastError = null;
  s.cooldownUntil = null;
  s.status = "active";
}

export function recordKeyError(
  index: number,
  kind: "expired" | "rate_limited" | "server" | "network",
  message?: string,
): void {
  const s = ensureState(index);
  s.errorCount += 1;
  s.lastUsed = Date.now();
  if (message) s.lastError = message.slice(0, 200);

  if (kind === "expired") {
    s.status = "expired";
    s.cooldownUntil = null;
    return;
  }
  if (kind === "rate_limited") {
    s.status = "rate_limited";
    s.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    return;
  }
  // server/network: short cooldown if it's piling up, otherwise just bump errorCount
  if (s.errorCount >= DEGRADE_THRESHOLD) {
    s.status = "degraded";
    s.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }
}

// Backward-compatible shims used by existing call sites.
export function markKeyDead(index: number): void {
  recordKeyError(index, "expired", "marked dead");
}
export function markKeyHealthy(index: number): void {
  recordKeySuccess(index);
}
export function isKeyDead(index: number): boolean {
  const s = keyStates.get(index);
  if (!s) return false;
  maybeRecover(s);
  return s.status === "expired";
}

function loadAllRaw(maxSlots = 11): ResolvedKey[] {
  const result: ResolvedKey[] = [];
  for (let i = 1; i <= maxSlots; i++) {
    const token = readKey(`${TOKEN_KEY_PREFIX}${i}`);
    if (token) result.push({ index: i, token });
  }
  if (result.length === 0) {
    const fallback = readKey(FALLBACK_KEY);
    if (fallback) result.push({ index: 1, token: fallback });
  }
  return result;
}

const STATUS_RANK: Record<KeyStatus, number> = {
  active: 0,
  cooling_down: 1,
  rate_limited: 2,
  degraded: 3,
  expired: 4,
};

// Returns all configured keys, with expired/dead keys filtered out and the
// remainder sorted by health (active first, degraded last). Cooldown timers
// are checked here so keys auto-recover without an explicit tick.
export function getAllKeys(maxSlots = 11): ResolvedKey[] {
  const raw = loadAllRaw(maxSlots);
  for (const k of raw) {
    const s = ensureState(k.index);
    maybeRecover(s);
  }
  const eligible = raw.filter((k) => keyStates.get(k.index)!.status !== "expired");
  eligible.sort((a, b) => {
    const sa = keyStates.get(a.index)!;
    const sb = keyStates.get(b.index)!;
    const r = STATUS_RANK[sa.status] - STATUS_RANK[sb.status];
    if (r !== 0) return r;
    return a.index - b.index;
  });
  // If all keys are expired, surface them anyway so the caller sees a real
  // upstream error instead of "no keys configured".
  return eligible.length > 0 ? eligible : raw;
}

export function getKeyByIndex(index: number): ResolvedKey | undefined {
  const all = getAllKeys();
  if (all.length === 0) return undefined;
  const exact = all.find((k) => k.index === index);
  if (exact) return exact;
  return all[0];
}

export function maskKey(token: string): string {
  if (token.length <= 10) return "***";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export interface KeySnapshot {
  index: number;
  alias: string;
  status: KeyStatus;
  errorCount: number;
  successCount: number;
  lastUsed: number | null;
  lastError: string | null;
  cooldownRemainingMs: number | null;
  configured: boolean;
}

export function getKeySnapshot(maxSlots = 11): KeySnapshot[] {
  const raw = loadAllRaw(maxSlots);
  const configuredIndexes = new Set(raw.map((k) => k.index));
  const snapshots: KeySnapshot[] = [];
  for (let i = 1; i <= maxSlots; i++) {
    const s = keyStates.get(i);
    if (s) maybeRecover(s);
    const cooldownRemainingMs =
      s?.cooldownUntil != null ? Math.max(0, s.cooldownUntil - Date.now()) : null;
    snapshots.push({
      index: i,
      alias: TOKEN_ALIASES[i] ?? `Slot${i}`,
      status: configuredIndexes.has(i) ? (s?.status ?? "active") : "expired",
      errorCount: s?.errorCount ?? 0,
      successCount: s?.successCount ?? 0,
      lastUsed: s?.lastUsed ?? null,
      lastError: s?.lastError ?? null,
      cooldownRemainingMs,
      configured: configuredIndexes.has(i),
    });
  }
  return snapshots;
}
