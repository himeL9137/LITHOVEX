// Per-provider model id resolution.
//
// Given the user's selected model (typically a HuggingFace id), return the
// equivalent id on a non-HF provider (OpenRouter, Gemini). When no exact
// equivalent exists, return a sensible high-quality default for that provider
// so the priority chain (OR → Gemini → HF) still has something to call.

import type { ProviderId } from "./provider-keys";

interface ModelAlias {
  openrouter?: string;
  gemini?: string;
  blackbox?: string;
}

// Direct id-to-id mappings (case-insensitive on the lookup key).
const DIRECT: Record<string, ModelAlias> = {
  // Llama family
  "meta-llama/llama-3-70b-instruct": {
    openrouter: "meta-llama/llama-3-70b-instruct",
  },
  "meta-llama/meta-llama-3-70b-instruct": {
    openrouter: "meta-llama/llama-3-70b-instruct",
  },
  "meta-llama/llama-3-8b-instruct": {
    openrouter: "meta-llama/llama-3.1-8b-instruct",
  },
  "meta-llama/meta-llama-3-8b-instruct": {
    openrouter: "meta-llama/llama-3.1-8b-instruct",
  },
  "meta-llama/llama-3.2-3b-instruct": {
    openrouter: "meta-llama/llama-3.2-3b-instruct",
  },

  // Qwen family
  "qwen/qwen2.5-72b-instruct": {
    openrouter: "qwen/qwen-2.5-72b-instruct",
  },
  "qwen/qwen2.5-coder-32b-instruct": {
    openrouter: "qwen/qwen-2.5-coder-32b-instruct",
  },
  "qwen/qwen3-8b": {
    openrouter: "qwen/qwen3-8b",
  },

  // DeepSeek
  "deepseek-ai/deepseek-r1": { openrouter: "deepseek/deepseek-r1" },
  "deepseek-ai/deepseek-v3": { openrouter: "deepseek/deepseek-chat" },

  // ─── LITHOVEX brand personas ──────────────────────────────────────────
  // 2.6 Plus and 2.5 Core are routed straight to Blackbox's Claude Opus 4.7
  // (the strongest model in the Blackbox catalog) so the LITHOVEX flagships
  // always answer with top-tier intelligence. The user only ever sees
  // "LITHOVEX" — the underlying provider stays hidden via the identity
  // intercept in chat.ts.
  "lithovex-2.6-plus": {
    blackbox: "blackboxai/anthropic/claude-opus-4.7",
    openrouter: "anthropic/claude-sonnet-4.6",
    gemini: "gemini-2.5-pro",
  },
  "lithovex-2.5-core": {
    blackbox: "blackboxai/anthropic/claude-opus-4.7",
    openrouter: "anthropic/claude-sonnet-4.6",
    gemini: "gemini-2.5-pro",
  },

  // Anthropic personas (LITHOVEX virtual ids).
  // Blackbox model ids verified against /v1/models for the active key.
  "anthropic/claude-opus-4.7": {
    openrouter: "anthropic/claude-sonnet-4.6",
    blackbox: "blackboxai/anthropic/claude-opus-4.7",
  },
  "anthropic/claude-opus-4.6": {
    openrouter: "anthropic/claude-sonnet-4.6",
    blackbox: "blackboxai/anthropic/claude-opus-4.6",
  },
  "anthropic/claude-sonnet-4.6": {
    openrouter: "anthropic/claude-sonnet-4.6",
    blackbox: "blackboxai/anthropic/claude-sonnet-4.6",
  },

  // OpenAI personas — Blackbox catalog tops out at GPT-5.3 Codex right now;
  // both 5.5 and 5.4 personas route to it (still a flagship tier).
  "openai/gpt-5.5-xhigh-codex": {
    openrouter: "openai/gpt-4o",
    blackbox: "blackboxai/openai/gpt-5.3-codex",
  },
  "openai/gpt-5.4-pro": {
    openrouter: "openai/gpt-4o",
    blackbox: "blackboxai/openai/gpt-5.3-codex",
  },
  "openai/o3": { openrouter: "openai/o1" },
  "openai/o3-reasoning": { openrouter: "openai/o1" },

  // Google personas — Blackbox exposes the gemini-3.1-pro-preview SKU.
  "google/gemini-3.1-pro": {
    openrouter: "google/gemini-2.5-pro",
    gemini: "gemini-2.5-pro",
    blackbox: "blackboxai/google/gemini-3.1-pro-preview",
  },

  // xAI personas — Blackbox catalog has grok-code-fast-1 (free tier).
  "xai/grok-4.1-fast-reasoning": {
    openrouter: "x-ai/grok-2-1212",
    blackbox: "blackboxai/x-ai/grok-code-fast-1:free",
  },

  // Moonshot Kimi personas
  "moonshot/kimi-k2.6-agentic": {
    openrouter: "moonshotai/kimi-k2",
    blackbox: "blackboxai/moonshotai/kimi-k2.6",
  },

  // DeepSeek personas — no native DeepSeek on Blackbox; route to GLM-5
  // which is the closest reasoning-grade open model in the catalog.
  "deepseek/deepseek-r1-thinking": {
    openrouter: "deepseek/deepseek-r1",
    blackbox: "blackboxai/z-ai/glm-5",
  },

  // Blackbox-exclusive personas
  "minimax/minimax-m2.7": {
    blackbox: "blackboxai/minimax/minimax-m2.7",
    openrouter: "openai/gpt-4o-mini",
  },
  "zhipuai/glm-5": {
    // Blackbox publishes GLM-5 under the z-ai vendor prefix.
    blackbox: "blackboxai/z-ai/glm-5",
    openrouter: "openai/gpt-4o-mini",
  },
  "blackbox/e2e-encrypted": {
    // Universal "Blackbox Pro" model is the catch-all chat completion model.
    blackbox: "blackboxai/blackbox-pro",
    openrouter: "openai/gpt-4o-mini",
  },
};

// Per-provider sensible defaults when the requested model has no alias.
// Blackbox's universal "always answers" chat model is `blackboxai/blackbox-pro`.
const DEFAULTS: Record<Exclude<ProviderId, never>, string> = {
  blackbox: "blackboxai/blackbox-pro",
  openrouter: "openai/gpt-4o-mini",
  gemini: "gemini-2.5-flash",
};

export function resolveModelForProvider(
  provider: ProviderId,
  requestedModel: string,
): string {
  const key = (requestedModel || "").trim().toLowerCase();
  const direct = DIRECT[key];
  if (direct) {
    const id = direct[provider];
    if (id) return id;
  }
  return DEFAULTS[provider];
}

// Used for provider-specific heuristics (e.g. is this a vision-capable model).
export function isVisionLikely(modelName: string): boolean {
  const m = (modelName || "").toLowerCase();
  return m.includes("vision") || m.includes("vl") || m.includes("pro") || m.includes("gpt-4o") || m.includes("opus");
}
