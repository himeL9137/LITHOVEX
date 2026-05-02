// Generic per-provider API key registry.
//
// Mirrors the state-machine in hf-keys.ts but is parameterised by a provider
// id so we can hold OpenRouter and Gemini key pools alongside HuggingFace.
// Each provider is registered once at module-load time with its env-var prefix
// and the candidate file paths to read keys from.

import fs from "node:fs";
import path from "node:path";

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const DEGRADE_THRESHOLD = 3;

export type ProviderId = "blackbox" | "openrouter" | "gemini";

export type KeyStatus =
  | "active"
  | "rate_limited"
  | "cooling_down"
  | "expired"
  | "degraded";

export interface ResolvedKey {
  index: number;
  token: string;
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

interface KeyState {
  status: KeyStatus;
  errorCount: number;
  successCount: number;
  lastUsed: number | null;
  lastError: string | null;
  cooldownUntil: number | null;
}

interface ProviderConfig {
  envPrefix: string;
  fallbackEnv?: string;
  fileCandidates: string[];
  maxSlots: number;
  aliases: Record<number, string>;
}

interface ProviderRuntime {
  config: ProviderConfig;
  fileTokens: Record<string, string>;
  states: Map<number, KeyState>;
}

const providers = new Map<ProviderId, ProviderRuntime>();

function loadFromFile(candidates: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of candidates) {
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

export function registerProvider(id: ProviderId, config: ProviderConfig): void {
  const fileTokens = loadFromFile(config.fileCandidates);
  providers.set(id, { config, fileTokens, states: new Map() });
}

function getRuntime(id: ProviderId): ProviderRuntime | undefined {
  return providers.get(id);
}

function readKey(rt: ProviderRuntime, name: string): string | undefined {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const fromFile = rt.fileTokens[name];
  if (fromFile && fromFile.trim()) return fromFile.trim();
  return undefined;
}

function ensureState(rt: ProviderRuntime, index: number): KeyState {
  let s = rt.states.get(index);
  if (!s) {
    s = {
      status: "active",
      errorCount: 0,
      successCount: 0,
      lastUsed: null,
      lastError: null,
      cooldownUntil: null,
    };
    rt.states.set(index, s);
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

function loadAllRaw(rt: ProviderRuntime): ResolvedKey[] {
  const result: ResolvedKey[] = [];
  for (let i = 1; i <= rt.config.maxSlots; i++) {
    const token = readKey(rt, `${rt.config.envPrefix}${i}`);
    if (token) result.push({ index: i, token });
  }
  if (result.length === 0 && rt.config.fallbackEnv) {
    const fallback = readKey(rt, rt.config.fallbackEnv);
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

export function getProviderKeys(id: ProviderId): ResolvedKey[] {
  const rt = getRuntime(id);
  if (!rt) return [];
  const raw = loadAllRaw(rt);
  for (const k of raw) {
    maybeRecover(ensureState(rt, k.index));
  }
  const eligible = raw.filter((k) => rt.states.get(k.index)!.status !== "expired");
  eligible.sort((a, b) => {
    const sa = rt.states.get(a.index)!;
    const sb = rt.states.get(b.index)!;
    const r = STATUS_RANK[sa.status] - STATUS_RANK[sb.status];
    if (r !== 0) return r;
    return a.index - b.index;
  });
  return eligible.length > 0 ? eligible : raw;
}

export function recordProviderSuccess(id: ProviderId, index: number): void {
  const rt = getRuntime(id);
  if (!rt) return;
  const s = ensureState(rt, index);
  s.successCount += 1;
  s.errorCount = 0;
  s.lastUsed = Date.now();
  s.lastError = null;
  s.cooldownUntil = null;
  s.status = "active";
}

export function recordProviderError(
  id: ProviderId,
  index: number,
  kind: "expired" | "rate_limited" | "server" | "network",
  message?: string,
): void {
  const rt = getRuntime(id);
  if (!rt) return;
  const s = ensureState(rt, index);
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
  if (s.errorCount >= DEGRADE_THRESHOLD) {
    s.status = "degraded";
    s.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  }
}

export function getProviderSnapshot(id: ProviderId): KeySnapshot[] {
  const rt = getRuntime(id);
  if (!rt) return [];
  const raw = loadAllRaw(rt);
  const configuredIndexes = new Set(raw.map((k) => k.index));
  const out: KeySnapshot[] = [];
  for (let i = 1; i <= rt.config.maxSlots; i++) {
    const s = rt.states.get(i);
    if (s) maybeRecover(s);
    const cooldownRemainingMs =
      s?.cooldownUntil != null ? Math.max(0, s.cooldownUntil - Date.now()) : null;
    out.push({
      index: i,
      alias: rt.config.aliases[i] ?? `Slot${i}`,
      status: configuredIndexes.has(i) ? (s?.status ?? "active") : "expired",
      errorCount: s?.errorCount ?? 0,
      successCount: s?.successCount ?? 0,
      lastUsed: s?.lastUsed ?? null,
      lastError: s?.lastError ?? null,
      cooldownRemainingMs,
      configured: configuredIndexes.has(i),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider registrations — locations match LITHOVEX/server/ convention.
// ─────────────────────────────────────────────────────────────────────────────

const BLACKBOX_FILES = [
  path.resolve(process.cwd(), "LITHOVEX/server/blackbox_api_tokens.env"),
  path.resolve(process.cwd(), "../../../server/blackbox_api_tokens.env"),
  path.resolve(process.cwd(), "server/blackbox_api_tokens.env"),
];

const OPENROUTER_FILES = [
  path.resolve(process.cwd(), "LITHOVEX/server/openrouter_api_tokens.env"),
  path.resolve(process.cwd(), "../../../server/openrouter_api_tokens.env"),
  path.resolve(process.cwd(), "server/openrouter_api_tokens.env"),
];

const GEMINI_FILES = [
  path.resolve(process.cwd(), "LITHOVEX/server/gemini_api_tokens.env"),
  path.resolve(process.cwd(), "../../../server/gemini_api_tokens.env"),
  path.resolve(process.cwd(), "server/gemini_api_tokens.env"),
];

registerProvider("blackbox", {
  envPrefix: "BLACKBOX_API_KEY_",
  fallbackEnv: "BLACKBOX_API_KEY",
  fileCandidates: BLACKBOX_FILES,
  maxSlots: 8,
  aliases: {
    1: "BB-1", 2: "BB-2", 3: "BB-3", 4: "BB-4",
    5: "BB-5", 6: "BB-6", 7: "BB-7", 8: "BB-8",
  },
});

registerProvider("openrouter", {
  envPrefix: "OPENROUTER_API_KEY_",
  fallbackEnv: "OPENROUTER_API_KEY",
  fileCandidates: OPENROUTER_FILES,
  maxSlots: 12,
  aliases: {
    1: "OR-1", 2: "OR-2", 3: "OR-3", 4: "OR-4", 5: "OR-5", 6: "OR-6",
    7: "OR-7", 8: "OR-8", 9: "OR-9", 10: "OR-10", 11: "OR-11", 12: "OR-12",
  },
});

registerProvider("gemini", {
  envPrefix: "GEMINI_API_KEY_",
  fallbackEnv: "GEMINI_API_KEY",
  fileCandidates: GEMINI_FILES,
  maxSlots: 12,
  aliases: {
    1: "himeliqbal7",
    2: "himeliqbal704",
    3: "kazianowarul",
    4: "kazianowarulj",
    5: "kazianowarulj2",
    6: "himelhackerbd",
    7: "abh24578",
    8: "hasantasin",
    9: "kazihannan95",
    10: "kazihannan950",
    11: "Slot11",
    12: "Slot12",
  },
});
