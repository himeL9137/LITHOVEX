// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Model Router
// Routes model requests to a primary provider with prioritized fallbacks,
// rotates API keys per provider, and applies exponential backoff on failures.
// ─────────────────────────────────────────────────────────────────────────────

export type Provider = "huggingface" | "openrouter" | "gemini";

export interface ModelRoute {
  /** Canonical model id used when calling the primary provider. */
  primaryModelId: string;
  /** Provider attempted first. */
  primary: Provider;
  /** Ordered list of providers to try if the primary fails. */
  fallbacks: Provider[];
  /**
   * Per-provider model id overrides for fallback providers. When a fallback
   * provider has a native version of this model, list its provider-specific
   * id here. If a fallback provider is missing from this map, the model is
   * NOT considered to exist natively on that provider and that fallback
   * will be skipped.
   */
  providerModelIds: Partial<Record<Provider, string>>;
}

export interface RouterResponse {
  text: string;
  provider: Provider;
  model: string;
  fallbackUsed: boolean;
}

export interface RouterOptions {
  /** User prompt / input text sent to the model. */
  prompt: string;
  /** Optional system prompt forwarded to providers that support it. */
  system?: string;
  /** Sampling temperature (default 0.7). */
  temperature?: number;
  /** Max tokens for the response (default 1024). */
  maxTokens?: number;
  /** Maximum retry attempts per provider/key combination (default 3). */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff (default 500). */
  baseDelayMs?: number;
  /** Optional AbortSignal for cancellation. */
  signal?: AbortSignal;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal model → provider mapping
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_ROUTES: Record<string, ModelRoute> = {
  "claude-4-7-opus": {
    primaryModelId: "anthropic/claude-opus-4.7",
    primary: "openrouter",
    fallbacks: ["gemini", "huggingface"],
    providerModelIds: {
      openrouter: "anthropic/claude-opus-4.7",
    },
  },
  "claude-4-6-sonnet": {
    primaryModelId: "anthropic/claude-sonnet-4.6",
    primary: "openrouter",
    fallbacks: ["gemini"],
    providerModelIds: {
      openrouter: "anthropic/claude-sonnet-4.6",
    },
  },
  "gpt-5-5-codex": {
    primaryModelId: "openai/gpt-5.5-xhigh-codex",
    primary: "openrouter",
    fallbacks: ["gemini"],
    providerModelIds: {
      openrouter: "openai/gpt-5.5-xhigh-codex",
    },
  },
  "gemini-3-1-pro": {
    primaryModelId: "gemini-3.1-pro",
    primary: "gemini",
    fallbacks: ["openrouter"],
    providerModelIds: {
      gemini: "gemini-3.1-pro",
      openrouter: "google/gemini-3.1-pro",
    },
  },
  "llama-3-70b": {
    primaryModelId: "meta-llama/Meta-Llama-3-70B-Instruct",
    primary: "huggingface",
    fallbacks: ["openrouter"],
    providerModelIds: {
      huggingface: "meta-llama/Meta-Llama-3-70B-Instruct",
      openrouter: "meta-llama/llama-3-70b-instruct",
    },
  },
  "qwen-2-5-72b": {
    primaryModelId: "Qwen/Qwen2.5-72B-Instruct",
    primary: "huggingface",
    fallbacks: ["openrouter"],
    providerModelIds: {
      huggingface: "Qwen/Qwen2.5-72B-Instruct",
      openrouter: "qwen/qwen-2.5-72b-instruct",
    },
  },
  "deepseek-r1": {
    primaryModelId: "deepseek-ai/DeepSeek-R1",
    primary: "huggingface",
    fallbacks: ["openrouter"],
    providerModelIds: {
      huggingface: "deepseek-ai/DeepSeek-R1",
      openrouter: "deepseek/deepseek-r1",
    },
  },
};

export function registerModelRoute(name: string, route: ModelRoute): void {
  MODEL_ROUTES[name] = route;
}

export function getModelRoute(name: string): ModelRoute | undefined {
  return MODEL_ROUTES[name];
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment variable loading + key rotation
// ─────────────────────────────────────────────────────────────────────────────

function readEnv(name: string): string {
  // Node / SSR
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return process.env[name] as string;
  }
  // Vite (import.meta.env). Wrapped in try/catch for non-Vite runtimes.
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string> });
    if (meta && meta.env && meta.env[name]) return meta.env[name];
    if (meta && meta.env && meta.env[`VITE_${name}`]) return meta.env[`VITE_${name}`];
  } catch {
    // ignore
  }
  return "";
}

function parseKeys(raw: string): string[] {
  return raw
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

const ENV_VAR_BY_PROVIDER: Record<Provider, string> = {
  huggingface: "HUGGINGFACE_KEYS",
  gemini: "GEMINI_KEYS",
  openrouter: "OPENROUTER_KEYS",
};

class KeyRing {
  private keys: string[];
  private index = 0;

  constructor(keys: string[]) {
    this.keys = keys;
  }

  get size(): number {
    return this.keys.length;
  }

  current(): string | undefined {
    return this.keys[this.index];
  }

  /** Advance to the next key (wraps around). Returns the new current key. */
  rotate(): string | undefined {
    if (this.keys.length === 0) return undefined;
    this.index = (this.index + 1) % this.keys.length;
    return this.current();
  }
}

const keyRings: Partial<Record<Provider, KeyRing>> = {};

function getKeyRing(provider: Provider): KeyRing {
  let ring = keyRings[provider];
  if (!ring) {
    ring = new KeyRing(parseKeys(readEnv(ENV_VAR_BY_PROVIDER[provider])));
    keyRings[provider] = ring;
  }
  return ring;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors + backoff
// ─────────────────────────────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: Provider,
    public readonly retryable: boolean,
    public readonly rateLimited: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function isRateLimited(status: number): boolean {
  return status === 429;
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffDelay(attempt: number, baseMs: number): number {
  const exp = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(exp + jitter, 30_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider call adapters
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderCall {
  (modelId: string, apiKey: string, opts: Required<Pick<RouterOptions, "prompt" | "temperature" | "maxTokens">> & { system?: string; signal?: AbortSignal }): Promise<string>;
}

async function readError(res: Response, provider: Provider): Promise<ProviderError> {
  let body = "";
  try { body = await res.text(); } catch { /* ignore */ }
  return new ProviderError(
    `${provider} ${res.status}: ${body.slice(0, 300)}`,
    res.status,
    provider,
    isRetryable(res.status),
    isRateLimited(res.status),
  );
}

const callHuggingface: ProviderCall = async (modelId, apiKey, opts) => {
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: opts.system ? `${opts.system}\n\n${opts.prompt}` : opts.prompt,
      parameters: {
        temperature: opts.temperature,
        max_new_tokens: opts.maxTokens,
        return_full_text: false,
      },
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res, "huggingface");
  const data: unknown = await res.json();
  if (Array.isArray(data) && data[0] && typeof (data[0] as { generated_text?: string }).generated_text === "string") {
    return (data[0] as { generated_text: string }).generated_text;
  }
  if (data && typeof (data as { generated_text?: string }).generated_text === "string") {
    return (data as { generated_text: string }).generated_text;
  }
  return JSON.stringify(data);
};

const callOpenRouter: ProviderCall = async (modelId, apiKey, opts) => {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res, "openrouter");
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
};

const callGemini: ProviderCall = async (modelId, apiKey, opts) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (opts.system) contents.push({ role: "user", parts: [{ text: opts.system }] });
  contents.push({ role: "user", parts: [{ text: opts.prompt }] });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
      },
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw await readError(res, "gemini");
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map(p => p.text ?? "").join("");
};

const PROVIDER_CALLERS: Record<Provider, ProviderCall> = {
  huggingface: callHuggingface,
  openrouter: callOpenRouter,
  gemini: callGemini,
};

// ─────────────────────────────────────────────────────────────────────────────
// Core: try a single provider with retries + key rotation
// ─────────────────────────────────────────────────────────────────────────────

async function tryProvider(
  provider: Provider,
  modelId: string,
  opts: Required<Pick<RouterOptions, "prompt" | "temperature" | "maxTokens" | "maxRetries" | "baseDelayMs">> & { system?: string; signal?: AbortSignal },
): Promise<string> {
  const ring = getKeyRing(provider);
  if (ring.size === 0) {
    throw new ProviderError(`No API keys configured for ${provider} (set ${ENV_VAR_BY_PROVIDER[provider]})`, 401, provider, false, false);
  }

  const caller = PROVIDER_CALLERS[provider];
  let lastErr: unknown;

  // Allow up to one full rotation through the ring on rate-limit errors,
  // plus exponential backoff retries on transient failures.
  const maxAttempts = Math.max(opts.maxRetries, ring.size);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = ring.current();
    if (!key) break;
    try {
      return await caller(modelId, key, opts);
    } catch (err) {
      lastErr = err;
      const provErr = err instanceof ProviderError ? err : null;

      if (provErr?.rateLimited) {
        // Rotate to the next key on 429 and retry without backoff first.
        ring.rotate();
        continue;
      }

      if (provErr && !provErr.retryable) {
        throw provErr; // 4xx auth / bad request — fail fast for this provider.
      }

      if (attempt < maxAttempts - 1) {
        await sleep(backoffDelay(attempt, opts.baseDelayMs), opts.signal);
        continue;
      }
      throw err;
    }
  }

  throw lastErr ?? new ProviderError(`Exhausted retries for ${provider}`, 0, provider, false, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function routeModel(modelName: string, opts: RouterOptions): Promise<RouterResponse> {
  const route = getModelRoute(modelName);
  if (!route) {
    throw new Error(`Unknown model: "${modelName}". Register it via registerModelRoute() or add it to MODEL_ROUTES.`);
  }

  const resolved = {
    prompt: opts.prompt,
    system: opts.system,
    temperature: opts.temperature ?? 0.7,
    maxTokens: opts.maxTokens ?? 1024,
    maxRetries: opts.maxRetries ?? 3,
    baseDelayMs: opts.baseDelayMs ?? 500,
    signal: opts.signal,
  };

  // Build the ordered list of [provider, modelId] candidates.
  const candidates: Array<{ provider: Provider; modelId: string; isFallback: boolean }> = [];
  candidates.push({ provider: route.primary, modelId: route.primaryModelId, isFallback: false });
  for (const fb of route.fallbacks) {
    const fbModelId = route.providerModelIds[fb];
    if (!fbModelId) continue; // model does NOT exist natively on this fallback — skip
    candidates.push({ provider: fb, modelId: fbModelId, isFallback: true });
  }

  const errors: string[] = [];
  for (const cand of candidates) {
    try {
      const text = await tryProvider(cand.provider, cand.modelId, resolved);
      return {
        text,
        provider: cand.provider,
        model: cand.modelId,
        fallbackUsed: cand.isFallback,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${cand.provider}] ${msg}`);
      if (opts.signal?.aborted) throw err;
      // continue to next fallback
    }
  }

  throw new Error(`All providers failed for model "${modelName}":\n${errors.join("\n")}`);
}

// Lower-level building blocks exposed for higher-level orchestrators
// (e.g. src/lib/query-model.ts) that need finer control than routeModel.
export {
  PROVIDER_CALLERS as providerCallers,
  getKeyRing,
  ENV_VAR_BY_PROVIDER,
};

export const __internals = {
  parseKeys,
  backoffDelay,
  isRetryable,
  isRateLimited,
  KeyRing,
};
