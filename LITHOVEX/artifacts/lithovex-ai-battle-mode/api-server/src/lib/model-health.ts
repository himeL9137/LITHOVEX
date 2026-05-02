// LITHOVEX-CORE — Model Health Tracker.
//
// Implements Section 3.4 of the master prompt. Per-model rolling state:
// status, success/fail counts, average latency, last error, cooldown.
// The smart router consults this to skip "down" models and prefer healthy
// flagships over degraded ones.

export type ModelStatus = "active" | "degraded" | "down";

const ROLLING_WINDOW = 20;
const SHORT_COOLDOWN_MS = 60_000; // 503/504 → 60s
const LONG_COOLDOWN_MS = 5 * 60_000; // 3 consecutive failures → 5 min
const DOWN_THRESHOLD = 3; // consecutive failures

interface ModelState {
  outcomes: Array<"ok" | "fail">; // most-recent-last, capped at ROLLING_WINDOW
  consecutiveFailures: number;
  totalLatencyMs: number;
  totalSuccesses: number;
  lastError: string | null;
  lastUsed: number | null;
  cooldownUntil: number | null;
  status: ModelStatus;
}

const modelStates = new Map<string, ModelState>();

function ensure(model: string): ModelState {
  let s = modelStates.get(model);
  if (!s) {
    s = {
      outcomes: [],
      consecutiveFailures: 0,
      totalLatencyMs: 0,
      totalSuccesses: 0,
      lastError: null,
      lastUsed: null,
      cooldownUntil: null,
      status: "active",
    };
    modelStates.set(model, s);
  }
  return s;
}

function maybeRecover(state: ModelState): void {
  if (state.cooldownUntil != null && Date.now() >= state.cooldownUntil) {
    state.cooldownUntil = null;
    if (state.status === "down") {
      // Coming out of long cooldown — reset to degraded so it gets another shot
      // but is still deprioritized vs. proven-active models.
      state.status = "degraded";
      state.consecutiveFailures = 0;
    } else if (state.status === "degraded") {
      // After a short cooldown with no further failures, mark active again.
      const last5 = state.outcomes.slice(-5);
      if (last5.every((o) => o === "ok") || last5.length === 0) {
        state.status = "active";
      }
    }
  }
}

function pushOutcome(state: ModelState, outcome: "ok" | "fail"): void {
  state.outcomes.push(outcome);
  if (state.outcomes.length > ROLLING_WINDOW) state.outcomes.shift();
}

export function recordModelSuccess(model: string, latencyMs: number): void {
  const s = ensure(model);
  pushOutcome(s, "ok");
  s.consecutiveFailures = 0;
  s.totalSuccesses += 1;
  s.totalLatencyMs += Math.max(0, latencyMs);
  s.lastUsed = Date.now();
  s.lastError = null;
  s.cooldownUntil = null;
  s.status = "active";
}

export function recordModelError(
  model: string,
  status: number | "network",
  message?: string,
): void {
  const s = ensure(model);
  pushOutcome(s, "fail");
  s.consecutiveFailures += 1;
  s.lastUsed = Date.now();
  if (message) s.lastError = `${status}: ${message.slice(0, 200)}`;

  if (status === 503 || status === 504) {
    s.status = "degraded";
    s.cooldownUntil = Date.now() + SHORT_COOLDOWN_MS;
  }
  if (s.consecutiveFailures >= DOWN_THRESHOLD) {
    s.status = "down";
    s.cooldownUntil = Date.now() + LONG_COOLDOWN_MS;
  } else if (s.status === "active") {
    s.status = "degraded";
  }
}

export function isModelDown(model: string): boolean {
  const s = modelStates.get(model);
  if (!s) return false;
  maybeRecover(s);
  return s.status === "down";
}

export function getModelStatus(model: string): ModelStatus {
  const s = modelStates.get(model);
  if (!s) return "active";
  maybeRecover(s);
  return s.status;
}

export interface ModelHealthSnapshot {
  model: string;
  status: ModelStatus;
  successRate: number; // 0..1, over rolling window
  avgLatencyMs: number;
  consecutiveFailures: number;
  lastError: string | null;
  lastUsed: number | null;
  cooldownRemainingMs: number | null;
  totalSuccesses: number;
}

export function getModelSnapshot(): ModelHealthSnapshot[] {
  const out: ModelHealthSnapshot[] = [];
  for (const [model, s] of modelStates.entries()) {
    maybeRecover(s);
    const total = s.outcomes.length;
    const successes = s.outcomes.filter((o) => o === "ok").length;
    out.push({
      model,
      status: s.status,
      successRate: total > 0 ? successes / total : 1,
      avgLatencyMs:
        s.totalSuccesses > 0 ? s.totalLatencyMs / s.totalSuccesses : 0,
      consecutiveFailures: s.consecutiveFailures,
      lastError: s.lastError,
      lastUsed: s.lastUsed,
      cooldownRemainingMs:
        s.cooldownUntil != null ? Math.max(0, s.cooldownUntil - Date.now()) : null,
      totalSuccesses: s.totalSuccesses,
    });
  }
  return out;
}
