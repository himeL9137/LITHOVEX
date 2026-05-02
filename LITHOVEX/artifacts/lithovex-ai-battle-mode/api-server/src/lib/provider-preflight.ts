// Pre-flight provider router for the /v1/chat/completions handler.
//
// Provider priority (per user preference, 2026-04, updated again):
//   1. BLACKBOX  — premium, first-priority provider. Always attempted first.
//      Cycles through a curated list of Blackbox flagship models
//      (Claude Opus 4.7/4.6, Sonnet 4.6, GPT-5.5, GPT-5.4, Grok 4.1, Kimi
//      K2.6, GLM 5, MiniMax M2.7, Blackbox E2E Encrypted) so the best
//      available Blackbox model wins.
//   2. GEMINI  — used when Blackbox is exhausted. Walks every Gemini key in
//      order; rotates on 401/403/429.
//   3. OPENROUTER  — attempted after Gemini is exhausted, regardless of task
//      complexity. Cycles through a curated list of premium OR models
//      (Claude, GPT-4o, Gemini-Pro, Llama-3.1 405B, DeepSeek R1) so the
//      best available backend wins.
//   4. HUGGINGFACE  — deepest fallback (handled by the caller in chat.ts).
//
// The user's selected persona system-prompt is already prepended in
// `finalMessages` by chat.ts via `resolvePersona`, so whichever underlying
// model actually answers will still "act like" the AI the user picked.
//
// For requests that use tools (web_search, etc.) we currently skip the
// pre-flight entirely — the HF path already implements the multi-turn
// tool-call loop.

import type { Response } from "express";
import {
  getProviderKeys,
  recordProviderError,
  recordProviderSuccess,
} from "./provider-keys";
import { resolveModelForProvider } from "./model-aliases";
import {
  callOpenRouterOnce,
  callOpenRouterStream,
  callGeminiOnce,
  callBlackboxOnce,
  callBlackboxStream,
  type UpstreamMessage,
} from "./provider-callers";
import { logger } from "./logger";
import type { TaskComplexity } from "./model-registry";

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter "big task" model rotation.
//
// When we escalate to OpenRouter we want the heaviest models available on the
// account, in a sensible quality order. The first one that answers wins. The
// user's selected persona is already enforced via system prompt, so the
// underlying model identity is invisible to the user.
// ─────────────────────────────────────────────────────────────────────────────
const OPENROUTER_BIG_TASK_MODELS: string[] = [
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.1-405b-instruct",
  "qwen/qwen-2.5-72b-instruct",
];

function buildOpenRouterModelOrder(persona: string): string[] {
  // Always lead with whatever the persona maps to so the persona's "natural"
  // model is tried first; then the curated heavy list (deduped).
  const lead = resolveModelForProvider("openrouter", persona);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (m: string | undefined | null) => {
    if (!m) return;
    const k = m.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };
  add(lead);
  for (const m of OPENROUTER_BIG_TASK_MODELS) add(m);
  return out;
}

export interface PreflightOpts {
  effectiveModel: string;
  /**
   * The model name the *user* requested (e.g. "lithovex-2.6-plus",
   * "openai/gpt-5.5-xhigh-codex"). This is what we echo back in the
   * response payload's `model` field so we never leak the underlying
   * provider/model that actually generated the answer.
   */
  requestedModel?: string;
  finalMessages: UpstreamMessage[];
  stream: boolean;
  useTools: boolean;
  /**
   * Task complexity from `analyzeTask`. Used to decide whether to escalate to
   * OpenRouter after Gemini exhausts. Anything other than "HIGH" or "EXTREME"
   * skips OpenRouter entirely and falls through to HuggingFace.
   */
  complexity?: TaskComplexity;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  res: Response;
  signal: AbortSignal;
  onProviderSwitch?: (info: { from: string; to: string; reason: string }) => void;
  onKeyRotate?: (info: {
    provider: string;
    fromKey: number;
    toKey: number;
    reason: string;
  }) => void;
  onModelSwitch?: (info: {
    provider: string;
    fromModel: string;
    toModel: string;
    reason: string;
  }) => void;
}

export interface PreflightResult {
  handled: boolean;
  finalProvider?: "openrouter" | "gemini" | "blackbox";
  finalModel?: string;
  finalKeyIndex?: number;
  text?: string;
  lastError?: string;
}

function classifyError(
  status: number | "network",
): "expired" | "rate_limited" | "server" | "network" {
  if (status === "network") return "network";
  if (status === 401 || status === 402 || status === 403) return "expired";
  if (status === 429) return "rate_limited";
  return "server";
}

function isFatal(status: number | "network"): boolean {
  return (
    typeof status === "number" &&
    (status === 400 || status === 404 || status === 422)
  );
}

function isBigTask(c: TaskComplexity | undefined): boolean {
  return c === "HIGH" || c === "EXTREME";
}

function setSseHeaders(res: Response): void {
  if (res.headersSent) return;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }
}

function streamTextAsSse(
  res: Response,
  model: string,
  content: string,
): void {
  setSseHeaders(res);
  const id = `chatcmpl-lvx-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const baseChunk = (
    delta: Record<string, unknown>,
    finishReason: string | null = null,
  ) => ({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
  res.write(
    `data: ${JSON.stringify(baseChunk({ role: "assistant", content: "" }))}\n\n`,
  );
  const CHUNK = 200;
  for (let i = 0; i < content.length; i += CHUNK) {
    res.write(
      `data: ${JSON.stringify(baseChunk({ content: content.slice(i, i + CHUNK) }))}\n\n`,
    );
  }
  res.write(`data: ${JSON.stringify(baseChunk({}, "stop"))}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function jsonOpenAiResponse(
  res: Response,
  model: string,
  content: string,
): void {
  res.json({
    id: `chatcmpl-lvx-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}

async function pipeOpenRouterStream(
  upstream: Response & { body?: any },
  res: Response,
): Promise<string> {
  setSseHeaders(res);
  if (!upstream.body) {
    res.write("data: [DONE]\n\n");
    res.end();
    return "";
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let collected = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.writableEnded) break;
      const chunk = decoder.decode(value, { stream: true });
      collected += chunk;
      res.write(chunk);
    }
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
  return collected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blackbox.ai — premium first-priority provider.
//
// Walks a curated list of Blackbox flagship models against every Blackbox key
// (outer loop = model, inner loop = key). The first model+key that answers
// wins; we always lead with whatever the user's selected persona maps to so
// the persona's natural Blackbox model is tried first. The universal default
// `blackboxai` is appended last as a safety net so an unknown persona id
// still gets a real answer.
// ─────────────────────────────────────────────────────────────────────────────
// Verified against `GET https://api.blackbox.ai/v1/models` for the active key.
const BLACKBOX_PREMIUM_MODELS: string[] = [
  "blackboxai/anthropic/claude-opus-4.7",
  "blackboxai/anthropic/claude-opus-4.6",
  "blackboxai/anthropic/claude-sonnet-4.6",
  "blackboxai/openai/gpt-5.3-codex",
  "blackboxai/google/gemini-3.1-pro-preview",
  "blackboxai/x-ai/grok-code-fast-1:free",
  "blackboxai/moonshotai/kimi-k2.6",
  "blackboxai/z-ai/glm-5",
  "blackboxai/minimax/minimax-m2.7",
  "blackboxai/blackbox-pro",
];

function buildBlackboxModelOrder(persona: string): string[] {
  const lead = resolveModelForProvider("blackbox", persona);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (m: string | undefined | null) => {
    if (!m) return;
    const k = m.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };
  // Only lead with the resolved id if it's a real persona-specific Blackbox
  // model — never lead with the generic "blackboxai/blackbox-pro" catch-all,
  // since that would answer everything on the first try and we'd never
  // exercise the curated premium list. The catch-all is appended at the end
  // of the BLACKBOX_PREMIUM_MODELS array as the safety net.
  if (lead && lead !== "blackboxai/blackbox-pro" && lead !== "blackboxai") {
    add(lead);
  }
  for (const m of BLACKBOX_PREMIUM_MODELS) add(m);
  return out;
}

async function tryBlackbox(opts: PreflightOpts): Promise<PreflightResult> {
  const keys = getProviderKeys("blackbox");
  if (keys.length === 0) {
    return { handled: false, lastError: "blackbox: no keys configured" };
  }

  const models = buildBlackboxModelOrder(opts.effectiveModel);
  let lastError = "";
  let activeModel = models[0]!;
  let activeKeyIndex: number | null = null;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi]!;
    if (mi > 0) {
      opts.onModelSwitch?.({
        provider: "blackbox",
        fromModel: activeModel,
        toModel: model,
        reason: lastError,
      });
      activeModel = model;
    }

    for (const key of keys) {
      if (opts.signal.aborted) {
        return { handled: false, lastError: "aborted" };
      }
      if (activeKeyIndex !== null && activeKeyIndex !== key.index) {
        opts.onKeyRotate?.({
          provider: "blackbox",
          fromKey: activeKeyIndex,
          toKey: key.index,
          reason: lastError,
        });
      }
      activeKeyIndex = key.index;

      if (opts.stream) {
        const r = await callBlackboxStream({
          model,
          token: key.token,
          messages: opts.finalMessages,
          temperature: opts.temperature,
          top_p: opts.top_p,
          max_tokens: opts.max_tokens,
          signal: opts.signal,
        });
        if (!r.ok) {
          lastError = `blackbox model=${model} key=#${key.index} → ${r.status}: ${r.message}`;
          logger.warn(
            { provider: "blackbox", model, keyIndex: key.index, status: r.status },
            "blackbox stream failed",
          );
          recordProviderError(
            "blackbox",
            key.index,
            classifyError(r.status),
            r.message,
          );
          if (isFatal(r.status)) break;
          continue;
        }
        await pipeOpenRouterStream(r.response as any, opts.res);
        recordProviderSuccess("blackbox", key.index);
        return {
          handled: true,
          finalProvider: "blackbox",
          finalModel: model,
          finalKeyIndex: key.index,
        };
      }

      const r = await callBlackboxOnce({
        model,
        token: key.token,
        messages: opts.finalMessages,
        temperature: opts.temperature,
        top_p: opts.top_p,
        max_tokens: opts.max_tokens,
        signal: opts.signal,
      });
      if (!r.ok) {
        lastError = `blackbox model=${model} key=#${key.index} → ${r.status}: ${r.message}`;
        logger.warn(
          { provider: "blackbox", model, keyIndex: key.index, status: r.status },
          "blackbox call failed",
        );
        recordProviderError(
          "blackbox",
          key.index,
          classifyError(r.status),
          r.message,
        );
        if (isFatal(r.status)) break;
        continue;
      }
      const text = String(r.message.content ?? "");
      recordProviderSuccess("blackbox", key.index);
      logger.info(
        { provider: "blackbox", model, keyIndex: key.index, chars: text.length },
        "blackbox answered",
      );
      jsonOpenAiResponse(opts.res, opts.requestedModel ?? opts.effectiveModel, text);
      return {
        handled: true,
        finalProvider: "blackbox",
        finalModel: model,
        finalKeyIndex: key.index,
        text,
      };
    }
  }

  return { handled: false, lastError };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini pass — rotate every key until one succeeds or all are exhausted.
// ─────────────────────────────────────────────────────────────────────────────
async function tryGemini(opts: PreflightOpts): Promise<PreflightResult> {
  const modelId = resolveModelForProvider("gemini", opts.effectiveModel);
  const keys = getProviderKeys("gemini");
  if (keys.length === 0) {
    return { handled: false, lastError: "gemini: no keys configured" };
  }

  let activeKeyIndex: number | null = null;
  let lastError = "";

  for (const key of keys) {
    if (opts.signal.aborted) {
      return { handled: false, lastError: "aborted" };
    }

    if (activeKeyIndex !== null && activeKeyIndex !== key.index) {
      opts.onKeyRotate?.({
        provider: "gemini",
        fromKey: activeKeyIndex,
        toKey: key.index,
        reason: lastError,
      });
    }
    activeKeyIndex = key.index;

    const r = await callGeminiOnce({
      model: modelId,
      token: key.token,
      messages: opts.finalMessages,
      temperature: opts.temperature,
      top_p: opts.top_p,
      max_tokens: opts.max_tokens,
      signal: opts.signal,
    });

    if (!r.ok) {
      lastError = `gemini key=#${key.index} → ${r.status}: ${r.message}`;
      logger.warn(
        { provider: "gemini", keyIndex: key.index, status: r.status },
        "gemini key failed",
      );
      recordProviderError(
        "gemini",
        key.index,
        classifyError(r.status),
        r.message,
      );
      // Bad request / unsupported model → no point trying more keys.
      if (isFatal(r.status)) break;
      continue;
    }

    const text = String(r.message.content ?? "");
    recordProviderSuccess("gemini", key.index);
    if (opts.stream) {
      streamTextAsSse(opts.res, opts.requestedModel ?? opts.effectiveModel, text);
    } else {
      jsonOpenAiResponse(opts.res, opts.requestedModel ?? opts.effectiveModel, text);
    }
    return {
      handled: true,
      finalProvider: "gemini",
      finalModel: modelId,
      finalKeyIndex: key.index,
      text,
    };
  }

  return { handled: false, lastError };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter pass — only invoked for big tasks. Walks the curated heavy-model
// list AND the OR key pool: outer loop = model, inner loop = key, so a single
// good model on a single good key wins. A fatal status (model not found etc.)
// abandons that model and moves to the next; all other failures rotate keys.
// ─────────────────────────────────────────────────────────────────────────────
async function tryOpenRouterBigTask(
  opts: PreflightOpts,
): Promise<PreflightResult> {
  const keys = getProviderKeys("openrouter");
  if (keys.length === 0) {
    return { handled: false, lastError: "openrouter: no keys configured" };
  }

  const models = buildOpenRouterModelOrder(opts.effectiveModel);
  let lastError = "";
  let activeModel = models[0]!;
  let activeKeyIndex: number | null = null;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi]!;
    if (mi > 0) {
      opts.onModelSwitch?.({
        provider: "openrouter",
        fromModel: activeModel,
        toModel: model,
        reason: lastError,
      });
      activeModel = model;
    }

    for (const key of keys) {
      if (opts.signal.aborted) {
        return { handled: false, lastError: "aborted" };
      }

      if (activeKeyIndex !== null && activeKeyIndex !== key.index) {
        opts.onKeyRotate?.({
          provider: "openrouter",
          fromKey: activeKeyIndex,
          toKey: key.index,
          reason: lastError,
        });
      }
      activeKeyIndex = key.index;

      if (opts.stream) {
        const r = await callOpenRouterStream({
          model,
          token: key.token,
          messages: opts.finalMessages,
          temperature: opts.temperature,
          top_p: opts.top_p,
          max_tokens: opts.max_tokens,
          signal: opts.signal,
        });
        if (!r.ok) {
          lastError = `openrouter model=${model} key=#${key.index} → ${r.status}: ${r.message}`;
          logger.warn(
            { provider: "openrouter", model, keyIndex: key.index, status: r.status },
            "openrouter stream failed",
          );
          recordProviderError(
            "openrouter",
            key.index,
            classifyError(r.status),
            r.message,
          );
          if (isFatal(r.status)) break; // bad model id — switch model
          continue; // try next key for this model
        }
        await pipeOpenRouterStream(r.response as any, opts.res);
        recordProviderSuccess("openrouter", key.index);
        return {
          handled: true,
          finalProvider: "openrouter",
          finalModel: model,
          finalKeyIndex: key.index,
        };
      }

      const r = await callOpenRouterOnce({
        model,
        token: key.token,
        messages: opts.finalMessages,
        temperature: opts.temperature,
        top_p: opts.top_p,
        max_tokens: opts.max_tokens,
        signal: opts.signal,
      });
      if (!r.ok) {
        lastError = `openrouter model=${model} key=#${key.index} → ${r.status}: ${r.message}`;
        logger.warn(
          { provider: "openrouter", model, keyIndex: key.index, status: r.status },
          "openrouter call failed",
        );
        recordProviderError(
          "openrouter",
          key.index,
          classifyError(r.status),
          r.message,
        );
        if (isFatal(r.status)) break;
        continue;
      }
      const text = String(r.message.content ?? "");
      recordProviderSuccess("openrouter", key.index);
      jsonOpenAiResponse(opts.res, opts.requestedModel ?? opts.effectiveModel, text);
      return {
        handled: true,
        finalProvider: "openrouter",
        finalModel: model,
        finalKeyIndex: key.index,
        text,
      };
    }
  }

  return { handled: false, lastError };
}

export async function runProviderPreflight(
  opts: PreflightOpts,
): Promise<PreflightResult> {
  // Tool-using requests stay on HF — see file header.
  if (opts.useTools) return { handled: false };

  // 1. Blackbox.ai — premium first-priority provider. Always attempted first.
  const blackbox = await tryBlackbox(opts);
  if (blackbox.handled) return blackbox;

  // 2. Gemini — used when Blackbox is exhausted, regardless of task size.
  opts.onProviderSwitch?.({
    from: "blackbox",
    to: "gemini",
    reason: blackbox.lastError || "blackbox exhausted",
  });
  const gemini = await tryGemini(opts);
  if (gemini.handled) return gemini;

  // 3. OpenRouter — always attempted after Gemini is exhausted, regardless
  //    of task complexity (per user preference).
  opts.onProviderSwitch?.({
    from: "gemini",
    to: "openrouter",
    reason: gemini.lastError || "gemini exhausted",
  });
  const or = await tryOpenRouterBigTask(opts);
  if (or.handled) return or;
  if (or.lastError) {
    logger.warn(
      { lastError: or.lastError },
      "Blackbox + Gemini + OR preflight failed; falling back to HF",
    );
  }

  // 4. Blackbox + Gemini + OpenRouter all exhausted → fall through to HF.
  return {
    handled: false,
    lastError: or.lastError ?? gemini.lastError ?? blackbox.lastError,
  };
}
