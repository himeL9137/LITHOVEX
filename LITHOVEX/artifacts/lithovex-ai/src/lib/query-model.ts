// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — queryModel orchestrator
// High-level entry point that routes a user message to the selected model,
// tries primary then fallbacks (each with a 15s timeout and key rotation),
// injects a style prompt when running on a fallback provider, and returns
// either a normalized success response or a graceful error.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getModelRoute,
  ProviderError,
  providerCallers,
  getKeyRing,
  ENV_VAR_BY_PROVIDER,
  type Provider,
} from "./model-router";
import { generateStylePrompt } from "./style-prompts";

const PROVIDER_TIMEOUT_MS = 15_000;

export interface QueryContext {
  /** Optional system prompt to prepend (combined with the style prompt on fallbacks). */
  system?: string;
  /** Sampling temperature (default 0.7). */
  temperature?: number;
  /** Max output tokens (default 1024). */
  maxTokens?: number;
  /** Optional conversation history; if provided it is folded into the prompt. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface QueryModelArgs {
  userMessage: string;
  selectedModel: string;
  context?: QueryContext;
}

export interface AttemptLog {
  provider: Provider;
  model: string;
  isFallback: boolean;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface QueryModelSuccess {
  ok: true;
  text: string;
  provider: Provider;
  model: string;
  fallbackUsed: boolean;
  attempts: AttemptLog[];
}

export interface QueryModelFailure {
  ok: false;
  error: string;
  suggestion: string;
  attempts: AttemptLog[];
}

export type QueryModelResult = QueryModelSuccess | QueryModelFailure;

// ─────────────────────────────────────────────────────────────────────────────
// Fallback event logging
// ─────────────────────────────────────────────────────────────────────────────

export interface FallbackEvent {
  selectedModel: string;
  provider: Provider;
  modelId: string;
  isFallback: boolean;
  /** "primary-failed" | "fallback-failed" | "fallback-succeeded" */
  kind: "primary-failed" | "fallback-failed" | "fallback-succeeded";
  reason: string;
  timestamp: number;
}

export type FallbackLogger = (event: FallbackEvent) => void;

let fallbackLogger: FallbackLogger = (event) => {
  // Default sink — visible in browser/server console for monitoring.
  // eslint-disable-next-line no-console
  console.warn("[queryModel] fallback event", event);
};

export function setFallbackLogger(fn: FallbackLogger): void {
  fallbackLogger = fn;
}

function logFallback(event: Omit<FallbackEvent, "timestamp">): void {
  try {
    fallbackLogger({ ...event, timestamp: Date.now() });
  } catch {
    // never let logging break the request path
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single provider attempt with 15s timeout + key rotation
// ─────────────────────────────────────────────────────────────────────────────

async function callProviderOnce(
  provider: Provider,
  modelId: string,
  prompt: string,
  system: string | undefined,
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const ring = getKeyRing(provider);
  if (ring.size === 0) {
    throw new ProviderError(
      `No API keys configured for ${provider} (set ${ENV_VAR_BY_PROVIDER[provider]})`,
      401,
      provider,
      false,
      false,
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let lastErr: unknown;
    // Try each key in the ring at most once. On 429 → rotate. On non-retryable
    // 4xx → fail fast so the caller can move to the next provider.
    for (let i = 0; i < ring.size; i++) {
      if (ctrl.signal.aborted) {
        throw new Error(`Provider ${provider} timed out after ${timeoutMs}ms`);
      }
      const key = ring.current();
      if (!key) break;

      try {
        return await providerCallers[provider](modelId, key, {
          prompt,
          system,
          temperature,
          maxTokens,
          signal: ctrl.signal,
        });
      } catch (err) {
        lastErr = err;

        if (ctrl.signal.aborted) {
          throw new Error(`Provider ${provider} timed out after ${timeoutMs}ms`);
        }

        if (err instanceof ProviderError) {
          if (err.rateLimited) {
            ring.rotate(); // try next key on 429
            continue;
          }
          if (!err.retryable) {
            throw err; // auth / bad request — bail to next provider
          }
        }

        // Network or 5xx — try the next key if any remain, otherwise bubble up.
        if (i < ring.size - 1) {
          ring.rotate();
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error(`All keys exhausted for ${provider}`);
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt assembly
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(userMessage: string, history?: QueryContext["history"]): string {
  if (!history || history.length === 0) return userMessage;
  const turns = history.map(h => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`);
  turns.push(`User: ${userMessage}`);
  return turns.join("\n");
}

function buildSystem(baseSystem: string | undefined, isFallback: boolean, selectedModel: string): string | undefined {
  if (!isFallback) return baseSystem;
  const stylePrompt = generateStylePrompt(selectedModel);
  return baseSystem ? `${stylePrompt}\n\n${baseSystem}` : stylePrompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function queryModel(args: QueryModelArgs): Promise<QueryModelResult> {
  const { userMessage, selectedModel, context = {} } = args;
  const attempts: AttemptLog[] = [];

  const route = getModelRoute(selectedModel);
  if (!route) {
    return {
      ok: false,
      error: `Unknown model "${selectedModel}".`,
      suggestion: "Pick a model from the registered list, or register a route for it before calling queryModel().",
      attempts,
    };
  }

  // Build the ordered candidate list: primary first, then fallbacks that
  // have a native model id mapping.
  const candidates: Array<{ provider: Provider; modelId: string; isFallback: boolean }> = [
    { provider: route.primary, modelId: route.primaryModelId, isFallback: false },
  ];
  for (const fb of route.fallbacks) {
    const id = route.providerModelIds[fb];
    if (!id) continue;
    candidates.push({ provider: fb, modelId: id, isFallback: true });
  }

  const temperature = context.temperature ?? 0.7;
  const maxTokens = context.maxTokens ?? 1024;
  const prompt = buildPrompt(userMessage, context.history);

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const system = buildSystem(context.system, cand.isFallback, selectedModel);
    const start = Date.now();

    try {
      const text = await callProviderOnce(
        cand.provider,
        cand.modelId,
        prompt,
        system,
        temperature,
        maxTokens,
        PROVIDER_TIMEOUT_MS,
      );

      attempts.push({
        provider: cand.provider,
        model: cand.modelId,
        isFallback: cand.isFallback,
        success: true,
        durationMs: Date.now() - start,
      });

      if (cand.isFallback) {
        logFallback({
          selectedModel,
          provider: cand.provider,
          modelId: cand.modelId,
          isFallback: true,
          kind: "fallback-succeeded",
          reason: `Primary "${route.primary}" failed; succeeded on fallback "${cand.provider}".`,
        });
      }

      return {
        ok: true,
        text,
        provider: cand.provider,
        model: cand.modelId,
        fallbackUsed: cand.isFallback,
        attempts,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      attempts.push({
        provider: cand.provider,
        model: cand.modelId,
        isFallback: cand.isFallback,
        success: false,
        durationMs: Date.now() - start,
        error: msg,
      });

      // eslint-disable-next-line no-console
      console.error(`[queryModel] "${selectedModel}" via ${cand.provider} failed: ${msg}`);

      logFallback({
        selectedModel,
        provider: cand.provider,
        modelId: cand.modelId,
        isFallback: cand.isFallback,
        kind: cand.isFallback ? "fallback-failed" : "primary-failed",
        reason: msg,
      });
      // continue to next candidate
    }
  }

  return {
    ok: false,
    error: `All providers failed for model "${selectedModel}".`,
    suggestion:
      "Please retry in a moment. If this keeps happening, try a different model, verify your API keys, or check provider status pages.",
    attempts,
  };
}

export const __queryInternals = {
  callProviderOnce,
  buildPrompt,
  buildSystem,
  PROVIDER_TIMEOUT_MS,
};
