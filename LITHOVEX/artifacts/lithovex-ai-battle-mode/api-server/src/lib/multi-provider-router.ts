// Multi-provider failover router.
//
// Iterates providers in strict priority order:
//   OpenRouter → Gemini → HuggingFace
//
// For each provider it walks the provider's key pool, calling the supplied
// `attempt` callback with the resolved model id and key. On any successful
// response we return immediately. On per-key failures we record state and
// rotate keys; on per-provider exhaustion we fall through to the next
// provider. HuggingFace remains the deepest fallback and uses the existing
// `runWithFailover` for full model-fallback-chain support.

import { runWithFailover, type AttemptOutcome } from "./smart-router";
import type { ResolvedKey } from "./hf-keys";
import {
  getProviderKeys,
  recordProviderError,
  recordProviderSuccess,
} from "./provider-keys";
import { resolveModelForProvider } from "./model-aliases";
import { logger } from "./logger";

export type ProviderId = "openrouter" | "gemini" | "huggingface";

// Per user preference (2026-04): Gemini handles every request first; OR is
// reserved for big tasks once Gemini is exhausted; HF is the deepest fallback.
export const PROVIDER_PRIORITY: ProviderId[] = [
  "gemini",
  "openrouter",
  "huggingface",
];

export interface ProviderAttemptCtx {
  provider: ProviderId;
  /** Provider-specific model id (translated from the original request). */
  modelId: string;
  /** Original requested model id (before translation). */
  originalModel: string;
  key: ResolvedKey;
}

export interface MultiProviderContext {
  primaryModel: string;
  /** HuggingFace key index preference (back-compat with hf_key_index). */
  preferredKeyIndex?: number;
  /** Skip these providers entirely. e.g. ["gemini"] when tools are enabled. */
  excludeProviders?: ProviderId[];
  attempt: (ctx: ProviderAttemptCtx) => Promise<AttemptOutcome>;
  onKeyRotate?: (info: {
    provider: ProviderId;
    fromKey: number;
    toKey: number;
    reason: string;
  }) => void;
  onProviderSwitch?: (info: {
    fromProvider: ProviderId;
    toProvider: ProviderId;
    reason: string;
  }) => void;
  onModelSwitch?: (info: {
    fromModel: string;
    toModel: string;
    reason: string;
  }) => void;
}

export interface MultiProviderResult {
  ok: boolean;
  data?: unknown;
  finalProvider?: ProviderId;
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

function isFatalForProvider(status: number | "network"): boolean {
  // Model-not-found / bad-request style — switching keys won't help.
  return (
    typeof status === "number" &&
    (status === 400 || status === 404 || status === 422)
  );
}

async function tryNonHfProvider(
  provider: Exclude<ProviderId, "huggingface">,
  ctx: MultiProviderContext,
): Promise<{ result: MultiProviderResult; attempts: number }> {
  const modelId = resolveModelForProvider(provider, ctx.primaryModel);
  const keys = getProviderKeys(provider);
  let attempts = 0;
  let lastError = "";

  if (keys.length === 0) {
    return {
      attempts,
      result: {
        ok: false,
        attempts,
        lastError: `${provider}: no keys configured`,
      },
    };
  }

  let activeKeyIndex: number | null = null;
  for (const key of keys) {
    attempts += 1;
    if (activeKeyIndex !== null && activeKeyIndex !== key.index) {
      ctx.onKeyRotate?.({
        provider,
        fromKey: activeKeyIndex,
        toKey: key.index,
        reason: lastError,
      });
    }
    activeKeyIndex = key.index;

    let outcome: AttemptOutcome;
    try {
      outcome = await ctx.attempt({
        provider,
        modelId,
        originalModel: ctx.primaryModel,
        key,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      outcome = { ok: false, status: "network", message };
    }

    if (outcome.ok) {
      recordProviderSuccess(provider, key.index);
      return {
        attempts,
        result: {
          ok: true,
          data: outcome.data,
          finalProvider: provider,
          finalModel: modelId,
          finalKeyIndex: key.index,
          attempts,
        },
      };
    }

    lastError = `${provider} key=#${key.index} → ${outcome.status}: ${outcome.message.slice(0, 200)}`;
    logger.warn(
      { provider, keyIndex: key.index, status: outcome.status },
      "multi-provider attempt failed",
    );
    recordProviderError(provider, key.index, classifyKeyError(outcome.status), outcome.message);

    if (isFatalForProvider(outcome.status)) {
      // Bad model id / unsupported request shape — no point trying more keys.
      break;
    }
  }

  return {
    attempts,
    result: { ok: false, attempts, lastError },
  };
}

export async function runMultiProviderFailover(
  ctx: MultiProviderContext,
): Promise<MultiProviderResult> {
  const excluded = new Set(ctx.excludeProviders ?? []);
  let totalAttempts = 0;
  let lastError = "";
  let lastProvider: ProviderId | null = null;

  // Gemini first, then OpenRouter (matches PROVIDER_PRIORITY).
  for (const provider of ["gemini", "openrouter"] as const) {
    if (excluded.has(provider)) continue;
    if (lastProvider !== null && lastProvider !== provider) {
      ctx.onProviderSwitch?.({
        fromProvider: lastProvider,
        toProvider: provider,
        reason: lastError,
      });
    }
    lastProvider = provider;

    const { attempts, result } = await tryNonHfProvider(provider, ctx);
    totalAttempts += attempts;
    if (result.ok) {
      return { ...result, attempts: totalAttempts };
    }
    if (result.lastError) lastError = result.lastError;
  }

  // HuggingFace — deepest fallback. Re-uses the existing rich router.
  if (!excluded.has("huggingface")) {
    if (lastProvider !== null && lastProvider !== "huggingface") {
      ctx.onProviderSwitch?.({
        fromProvider: lastProvider,
        toProvider: "huggingface",
        reason: lastError,
      });
    }
    const hfResult = await runWithFailover({
      primaryModel: ctx.primaryModel,
      preferredKeyIndex: ctx.preferredKeyIndex,
      onKeyRotate: (info) =>
        ctx.onKeyRotate?.({
          provider: "huggingface",
          fromKey: info.fromKey,
          toKey: info.toKey,
          reason: info.reason,
        }),
      onModelSwitch: ctx.onModelSwitch,
      attempt: ({ model, key }) =>
        ctx.attempt({
          provider: "huggingface",
          modelId: model,
          originalModel: ctx.primaryModel,
          key,
        }),
    });
    totalAttempts += hfResult.attempts;
    if (hfResult.ok) {
      return {
        ok: true,
        data: hfResult.data,
        finalProvider: "huggingface",
        finalModel: hfResult.finalModel,
        finalKeyIndex: hfResult.finalKeyIndex,
        attempts: totalAttempts,
      };
    }
    if (hfResult.lastError) lastError = hfResult.lastError;
  }

  return { ok: false, attempts: totalAttempts, lastError };
}
