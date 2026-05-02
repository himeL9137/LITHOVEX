// LITHOVEX-CORE — Smart Router with Zero-Disruption Failover.
//
// Implements Sections 2.2 (token failover), 3.3 (model fallback chain),
// and 13 (emergency protocols). The single entry point `runWithFailover`
// loops through (model × token) combinations until one succeeds, recording
// outcomes to both registries and emitting `key_switch` / `model_switch`
// events the client SSE stream can surface.

import { logger } from "./logger";
import {
  getAllKeys,
  getKeyByIndex,
  recordKeyError,
  recordKeySuccess,
  type ResolvedKey,
} from "./hf-keys";
import { getFallbackChain, EMERGENCY_MODEL } from "./model-registry";
import {
  isModelDown,
  recordModelError,
  recordModelSuccess,
} from "./model-health";

export type AttemptOutcome =
  | { ok: true; data: unknown; model: string; keyIndex: number; latencyMs: number }
  | { ok: false; status: number | "network"; message: string };

export interface FailoverContext {
  /** The model the caller wanted to use. Drives the fallback chain. */
  primaryModel: string;
  /** Optional preferred token slot (1-9). */
  preferredKeyIndex?: number;
  /** Per-attempt request callback. Resolves to AttemptOutcome. */
  attempt: (params: {
    model: string;
    key: ResolvedKey;
  }) => Promise<AttemptOutcome>;
  /** Fired when the active token rotates (silent — same model). */
  onKeyRotate?: (info: {
    fromKey: number;
    toKey: number;
    reason: string;
    model: string;
  }) => void;
  /** Fired when the model itself switches. */
  onModelSwitch?: (info: {
    fromModel: string;
    toModel: string;
    reason: string;
  }) => void;
}

export interface FailoverResult {
  ok: boolean;
  data?: unknown;
  finalModel?: string;
  finalKeyIndex?: number;
  attempts: number;
  lastError?: string;
}

function classifyKeyError(
  status: number | "network",
): "expired" | "rate_limited" | "server" | "network" {
  if (status === "network") return "network";
  if (status === 401 || status === 402 || status === 403) return "expired";
  if (status === 429) return "rate_limited";
  return "server";
}

// Build the model attempt order: fallback chain minus models currently
// marked "down". Always end with the EMERGENCY_MODEL as a last resort.
function buildModelOrder(primaryModel: string): string[] {
  const chain = getFallbackChain(primaryModel);
  const eligible = chain.filter((m) => !isModelDown(m));
  if (eligible.length === 0) return [EMERGENCY_MODEL];
  if (!eligible.includes(EMERGENCY_MODEL)) eligible.push(EMERGENCY_MODEL);
  return eligible;
}

// Order keys: caller's preferred slot first, then the rest in health order.
function buildKeyOrder(preferredIndex?: number): ResolvedKey[] {
  const all = getAllKeys();
  if (all.length === 0) return [];
  if (preferredIndex == null) return all;
  const preferred = getKeyByIndex(preferredIndex);
  if (!preferred) return all;
  const rest = all.filter((k) => k.index !== preferred.index);
  return [preferred, ...rest];
}

export async function runWithFailover(
  ctx: FailoverContext,
): Promise<FailoverResult> {
  const models = buildModelOrder(ctx.primaryModel);
  if (models.length === 0) {
    return { ok: false, attempts: 0, lastError: "No models available." };
  }

  let attempts = 0;
  let lastError = "No attempts were made.";
  let activeModel = models[0]!;
  let activeKeyIndex: number | undefined;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi]!;
    if (mi > 0) {
      ctx.onModelSwitch?.({
        fromModel: activeModel,
        toModel: model,
        reason: lastError,
      });
      activeModel = model;
    }

    const keys = buildKeyOrder(ctx.preferredKeyIndex);
    if (keys.length === 0) {
      lastError = "No HuggingFace API keys configured.";
      break;
    }

    let modelAllKeysFailed = true;

    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki]!;
      attempts += 1;

      if (
        activeKeyIndex != null &&
        activeKeyIndex !== key.index &&
        mi === 0 // only emit key_switch within the same model
      ) {
        ctx.onKeyRotate?.({
          fromKey: activeKeyIndex,
          toKey: key.index,
          reason: lastError,
          model,
        });
      }
      activeKeyIndex = key.index;

      const startedAt = Date.now();
      let outcome: AttemptOutcome;
      try {
        outcome = await ctx.attempt({ model, key });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcome = { ok: false, status: "network", message };
      }

      if (outcome.ok) {
        const latency = outcome.latencyMs ?? Date.now() - startedAt;
        recordKeySuccess(key.index);
        recordModelSuccess(model, latency);
        return {
          ok: true,
          data: outcome.data,
          finalModel: model,
          finalKeyIndex: key.index,
          attempts,
        };
      }

      // Failure path
      lastError = `model=${model} key=#${key.index} → ${outcome.status}: ${outcome.message.slice(0, 200)}`;
      logger.warn(
        { model, keyIndex: key.index, status: outcome.status },
        "router attempt failed",
      );

      const kind = classifyKeyError(outcome.status);
      recordKeyError(key.index, kind, outcome.message);

      if (outcome.status === 503 || outcome.status === 504) {
        // Model unavailable — stop trying more keys, switch model.
        recordModelError(model, outcome.status, outcome.message);
        modelAllKeysFailed = false;
        break;
      }
      // Model-level 4xx errors (bad model id, model not enabled on the
      // account, model not supported by the provider, payload too large for
      // this model). The token is fine — switching keys won't help. Mark the
      // model down and move on to the next model immediately.
      if (
        typeof outcome.status === "number" &&
        (outcome.status === 400 || outcome.status === 404 || outcome.status === 422) &&
        /\b(not enabled|not supported|does not exist|not found|model_not|invalid_request|unknown model)\b/i.test(
          outcome.message,
        )
      ) {
        recordModelError(model, outcome.status, outcome.message);
        modelAllKeysFailed = false;
        break;
      }
      if (outcome.status === "network") {
        // Network blip — try next key, but also count against the model.
        recordModelError(model, "network", outcome.message);
      }
      // 401/402/403/429/5xx: try the next key for this same model.
    }

    if (modelAllKeysFailed) {
      // Every key failed for this model with non-503 errors — model is
      // probably fine but keys are exhausted/expired. Record a soft model
      // failure and try the next model.
      recordModelError(activeModel, "network", "all keys exhausted for model");
    }
  }

  return { ok: false, attempts, lastError };
}
