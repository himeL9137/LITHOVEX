// LITHOVEX-CORE — The 206 Model Brain.
//
// Implements Section 3 of the master prompt: tier classification, smart
// routing by task analysis, and a per-model fallback chain. Every entry in
// the tier tables below is a real model identifier accepted by the
// HuggingFace Inference Providers Router (https://router.huggingface.co/v1).
//
// The constant MODEL_COUNT is computed dynamically so that adding a model
// to any tier (or via addDynamicModel from a discovery worker) keeps the
// banner count honest. The +2 covers the two LITHOVEX brand personas
// (2.5 Core, 2.6 Plus) that don't have backing IDs in the tables.

export type ModelTier =
  | "FLAGSHIP"
  | "BALANCED"
  | "FAST"
  | "SPECIALIST_CODE"
  | "SPECIALIST_MATH"
  | "SPECIALIST_VISION";

export type TaskComplexity = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export type TaskType =
  | "coding"
  | "debugging"
  | "explanation"
  | "architecture"
  | "review"
  | "quick_edit"
  | "math"
  | "vision"
  | "general";

export interface ModelEntry {
  id: string;
  tier: ModelTier;
}

// Tier 1 — Flagship (high-quality, complex multi-step work).
const FLAGSHIP: string[] = [
  "Qwen/Qwen2.5-72B-Instruct",
  "Qwen/Qwen3-235B-A22B-Instruct-2507",
  "Qwen/Qwen3-235B-A22B-Thinking-2507",
  "Qwen/Qwen3-32B",
  "meta-llama/Llama-3.3-70B-Instruct",
  "meta-llama/Meta-Llama-3.1-70B-Instruct",
  "meta-llama/Meta-Llama-3.1-405B-Instruct",
  "deepseek-ai/DeepSeek-R1",
  "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-V3-0324",
  "mistralai/Mixtral-8x22B-Instruct-v0.1",
  "mistralai/Mistral-Large-Instruct-2411",
  "google/gemma-3-27b-it",
  "google/gemma-2-27b-it",
  "Qwen/QwQ-32B",
  "Qwen/QwQ-32B-Preview",
  "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
  "NousResearch/Hermes-3-Llama-3.1-70B",
  "CohereForAI/c4ai-command-r-plus-08-2024",
  "01-ai/Yi-1.5-34B-Chat",
];

// Tier 2 — Balanced (default for general work).
const BALANCED: string[] = [
  "Qwen/Qwen2.5-Coder-32B-Instruct",
  "Qwen/Qwen2.5-32B-Instruct",
  "Qwen/Qwen2.5-14B-Instruct",
  "Qwen/Qwen3-14B",
  "Qwen/Qwen3-30B-A3B",
  "mistralai/Mistral-7B-Instruct-v0.3",
  "mistralai/Mistral-Nemo-Instruct-2407",
  "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Meta-Llama-3-8B-Instruct",
  "meta-llama/Llama-3.2-11B-Vision-Instruct",
  "meta-llama/Llama-3.2-3B-Instruct",
  "Qwen/Qwen3-8B",
  "Qwen/Qwen2.5-7B-Instruct",
  "google/gemma-2-9b-it",
  "google/gemma-3-12b-it",
  "google/gemma-3-4b-it",
  "microsoft/Phi-3.5-mini-instruct",
  "microsoft/Phi-3-medium-4k-instruct",
  "microsoft/phi-4",
  "NousResearch/Hermes-3-Llama-3.1-8B",
  "CohereForAI/c4ai-command-r-08-2024",
  "01-ai/Yi-1.5-9B-Chat",
  "tiiuae/falcon-11B",
  "HuggingFaceH4/zephyr-7b-beta",
  "teknium/OpenHermes-2.5-Mistral-7B",
];

// Tier 3 — Fast (quick edits, autocomplete, status checks).
const FAST: string[] = [
  "meta-llama/Llama-3.2-1B-Instruct",
  "meta-llama/Llama-3.2-3B-Instruct",
  "Qwen/Qwen2.5-1.5B-Instruct",
  "Qwen/Qwen2.5-3B-Instruct",
  "Qwen/Qwen2.5-0.5B-Instruct",
  "microsoft/Phi-3-mini-4k-instruct",
  "microsoft/Phi-3.5-mini-instruct",
  "google/gemma-3-1b-it",
  "google/gemma-2-2b-it",
  "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  "HuggingFaceTB/SmolLM2-360M-Instruct",
  "stabilityai/stablelm-2-1_6b-chat",
];

// Tier 4 — Specialists.
const SPECIALIST_CODE: string[] = [
  "Qwen/Qwen2.5-Coder-32B-Instruct",
  "Qwen/Qwen2.5-Coder-14B-Instruct",
  "Qwen/Qwen2.5-Coder-7B-Instruct",
  "Qwen/Qwen2.5-Coder-3B-Instruct",
  "Qwen/Qwen2.5-Coder-1.5B-Instruct",
  "deepseek-ai/deepseek-coder-33b-instruct",
  "deepseek-ai/deepseek-coder-6.7b-instruct",
  "deepseek-ai/DeepSeek-Coder-V2-Instruct",
  "deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct",
  "bigcode/starcoder2-15b-instruct-v0.1",
  "bigcode/starcoder2-15b",
  "bigcode/starcoder2-7b",
  "bigcode/starcoder2-3b",
  "codellama/CodeLlama-34b-Instruct-hf",
  "codellama/CodeLlama-13b-Instruct-hf",
  "codellama/CodeLlama-7b-Instruct-hf",
  "WizardLMTeam/WizardCoder-Python-34B-V1.0",
  "ise-uiuc/Magicoder-S-DS-6.7B",
  "meetkai/functionary-medium-v3.1",
  "Phind/Phind-CodeLlama-34B-v2",
];

const SPECIALIST_MATH: string[] = [
  "deepseek-ai/DeepSeek-R1",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-14B",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
  "deepseek-ai/DeepSeek-R1-Distill-Llama-8B",
  "deepseek-ai/deepseek-math-7b-instruct",
  "Qwen/Qwen2.5-Math-72B-Instruct",
  "Qwen/Qwen2.5-Math-7B-Instruct",
  "Qwen/Qwen2.5-Math-1.5B-Instruct",
  "Qwen/QwQ-32B",
  "AI-MO/NuminaMath-7B-TIR",
  "microsoft/rho-math-7b-v0.1",
];

const SPECIALIST_VISION: string[] = [
  "Qwen/Qwen2.5-VL-72B-Instruct",
  "Qwen/Qwen2.5-VL-32B-Instruct",
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "Qwen/Qwen2.5-VL-3B-Instruct",
  "meta-llama/Llama-3.2-90B-Vision-Instruct",
  "meta-llama/Llama-3.2-11B-Vision-Instruct",
  "google/gemma-3-27b-it",
  "google/gemma-3-12b-it",
  "google/paligemma2-10b-mix-448",
  "HuggingFaceM4/idefics3-8b-llama3",
  "OpenGVLab/InternVL2_5-78B",
  "OpenGVLab/InternVL2_5-26B",
  "llava-hf/llava-onevision-qwen2-7b-ov-hf",
  "mistralai/Pixtral-12B-2409",
];

const TIER_TABLE: Record<ModelTier, string[]> = {
  FLAGSHIP,
  BALANCED,
  FAST,
  SPECIALIST_CODE,
  SPECIALIST_MATH,
  SPECIALIST_VISION,
};

// ─── Build the canonical ALL_MODELS list with strict ID anchoring ───────
// First-seen tier wins. This guarantees that every model ID appears at most
// once in the routing table even when the same model is listed under two
// tiers (for example, a coder model that is also a balanced default).
function buildCanonicalModels(): {
  models: ModelEntry[];
  index: Map<string, ModelEntry>;
} {
  const index = new Map<string, ModelEntry>();
  const models: ModelEntry[] = [];
  const tierOrder: ModelTier[] = [
    "FLAGSHIP",
    "SPECIALIST_CODE",
    "SPECIALIST_MATH",
    "SPECIALIST_VISION",
    "BALANCED",
    "FAST",
  ];
  for (const tier of tierOrder) {
    for (const id of TIER_TABLE[tier]) {
      const trimmed = id.trim();
      if (!trimmed) continue;
      if (index.has(trimmed)) continue;
      const entry: ModelEntry = { id: trimmed, tier };
      index.set(trimmed, entry);
      models.push(entry);
    }
  }
  return { models, index };
}

const { models: ALL_MODELS, index: MODEL_INDEX } = buildCanonicalModels();

// MODEL_COUNT is dynamic. It exposes "real" backing models + every
// LITHOVEX-branded and premium persona the user actually picks from
// the model menu. The +N is just every persona ID the frontend exposes
// that doesn't have a directly-routable HF Router model.
export const LITHOVEX_PERSONA_COUNT = 2;
export const PREMIUM_PERSONA_COUNT = 13;
export const MODEL_COUNT =
  ALL_MODELS.length + LITHOVEX_PERSONA_COUNT + PREMIUM_PERSONA_COUNT;

export const EMERGENCY_MODEL = "mistralai/Mistral-7B-Instruct-v0.3";

export const DEFAULT_MODEL =
  process.env["DEFAULT_MODEL"]?.trim() || "lithovex-2.5-core";

// ─── LITHOVEX BRANDED PERSONAS ──────────────────────────────────────────
// Public IDs the UI exposes. They are not real HuggingFace models — they are
// meta-routers that, on every request, pick the best underlying model for
// the task. The user never sees the substitution.
export const LITHOVEX_ALIASES = {
  CORE: "lithovex-2.5-core",
  PLUS: "lithovex-2.6-plus",
} as const;

export type LithovexAliasId =
  (typeof LITHOVEX_ALIASES)[keyof typeof LITHOVEX_ALIASES];

export function isLithovexAlias(modelId: string): modelId is LithovexAliasId {
  return modelId === LITHOVEX_ALIASES.CORE || modelId === LITHOVEX_ALIASES.PLUS;
}

export function getTier(modelId: string): ModelTier | null {
  return MODEL_INDEX.get(modelId)?.tier ?? null;
}

export function listKnownModels(): ModelEntry[] {
  return [...ALL_MODELS];
}

export function hasModel(modelId: string): boolean {
  return MODEL_INDEX.has(modelId);
}

// Public mutation API — used by the optional dynamic discovery worker that
// pulls extra HF Router-served IDs at runtime. The function is the single
// chokepoint for new model IDs, so deduplication and tier assignment stay
// consistent. Returns true if the model was actually added (i.e. wasn't
// already known).
export function addDynamicModel(id: string, tier: ModelTier): boolean {
  const trimmed = (id || "").trim();
  if (!trimmed) return false;
  if (MODEL_INDEX.has(trimmed)) return false;
  const entry: ModelEntry = { id: trimmed, tier };
  MODEL_INDEX.set(trimmed, entry);
  ALL_MODELS.push(entry);
  if (!TIER_TABLE[tier].includes(trimmed)) {
    TIER_TABLE[tier].push(trimmed);
  }
  return true;
}

// Build the routing fallback chain for a primary model. Order:
//   1. The primary itself
//   2. Other models in the same tier
//   3. The next-best tier (FLAGSHIP→BALANCED, BALANCED→FAST, etc.)
//   4. EMERGENCY_MODEL
// Duplicates are removed while preserving first-seen order.
export function getFallbackChain(primaryModel: string): string[] {
  const tier = getTier(primaryModel) ?? "BALANCED";
  const sameTier = TIER_TABLE[tier].filter((m) => m !== primaryModel);

  const NEXT_TIER: Record<ModelTier, ModelTier | null> = {
    FLAGSHIP: "BALANCED",
    BALANCED: "FAST",
    FAST: "BALANCED",
    SPECIALIST_CODE: "BALANCED",
    SPECIALIST_MATH: "FLAGSHIP",
    SPECIALIST_VISION: "BALANCED",
  };

  const next = NEXT_TIER[tier];
  const nextTierModels = next ? TIER_TABLE[next] : [];

  const chain = [primaryModel, ...sameTier, ...nextTierModels, EMERGENCY_MODEL];
  const seen = new Set<string>();
  return chain.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
}

export interface TaskAnalysis {
  complexity: TaskComplexity;
  taskType: TaskType;
}

// Lightweight heuristic — looks at length, code-fence presence, and a few
// keyword cues. Cheap, deterministic, no network. Good enough to pick a tier.
export function analyzeTask(prompt: string): TaskAnalysis {
  const text = (prompt || "").trim();
  const lower = text.toLowerCase();
  const len = text.length;
  const hasCodeFence = /```/.test(text);
  const lineCount = text.split("\n").length;

  let taskType: TaskType = "general";
  if (/\b(refactor|architecture|design|migrate|restructure|monorepo)\b/.test(lower)) {
    taskType = "architecture";
  } else if (/\b(bug|error|stack ?trace|exception|crash|fails?|broken|fix)\b/.test(lower)) {
    taskType = "debugging";
  } else if (/\b(review|audit|critique|analyze)\b/.test(lower)) {
    taskType = "review";
  } else if (/\b(explain|how does|what is|why|describe)\b/.test(lower)) {
    taskType = "explanation";
  } else if (/\b(image|photo|picture|screenshot|diagram)\b/.test(lower)) {
    taskType = "vision";
  } else if (/\b(math|equation|integral|derivative|theorem|proof)\b/.test(lower)) {
    taskType = "math";
  } else if (
    /\b(rename|tweak|small (?:edit|change)|one[- ]liner|quick)\b/.test(lower) &&
    len < 200
  ) {
    taskType = "quick_edit";
  } else if (hasCodeFence || /\b(write|implement|build|create|add|generate)\b/.test(lower)) {
    taskType = "coding";
  }

  let complexity: TaskComplexity;
  if (taskType === "architecture" || lineCount > 40 || len > 2000) {
    complexity = "EXTREME";
  } else if (
    taskType === "debugging" ||
    taskType === "coding" ||
    lineCount > 10 ||
    len > 500
  ) {
    complexity = "HIGH";
  } else if (taskType === "explanation" || taskType === "review" || len > 100) {
    complexity = "MEDIUM";
  } else {
    complexity = "LOW";
  }

  return { complexity, taskType };
}

// Section 3.2 routing: pick a primary model based on the task analysis.
export function pickModelForTask(analysis: TaskAnalysis): string {
  const { taskType, complexity } = analysis;

  if (taskType === "vision") return SPECIALIST_VISION[0]!;
  if (taskType === "math") return SPECIALIST_MATH[0]!;
  if (taskType === "coding" || taskType === "debugging") {
    if (complexity === "LOW") return FAST[0]!;
    if (complexity === "EXTREME") return FLAGSHIP[0]!;
    return SPECIALIST_CODE[0]!;
  }

  switch (complexity) {
    case "EXTREME":
      return FLAGSHIP[0]!;
    case "HIGH":
      return FLAGSHIP[1] ?? FLAGSHIP[0]!;
    case "MEDIUM":
      return BALANCED[0]!;
    case "LOW":
      return FAST[0]!;
  }
}

// ─── PER-PERSONA ROUTING MAPS (from the master spec) ───────────────────
// Each persona has an explicit task → primary-model map that overrides the
// generic pickModelForTask(). The smart router then expands the primary
// into a full fallback chain via getFallbackChain().

const CORE_ROUTING_MAP: Record<TaskType, string> = {
  // Code generation, refactors, frontend/UI, API design, DB → Coder-32B.
  coding: "Qwen/Qwen2.5-Coder-32B-Instruct",
  // Debugging & root-cause analysis → Llama-3.3-70B (best at finding patterns).
  debugging: "meta-llama/Llama-3.3-70B-Instruct",
  // Architecture & system design → Llama-3.3-70B.
  architecture: "meta-llama/Llama-3.3-70B-Instruct",
  // Code review / security review → Llama-3.3-70B.
  review: "meta-llama/Llama-3.3-70B-Instruct",
  // Documentation & explanations → Llama-3.3-70B (clearest writer).
  explanation: "meta-llama/Llama-3.3-70B-Instruct",
  // Quick edits & one-liners → Mistral-7B (fast & accurate).
  quick_edit: "mistralai/Mistral-7B-Instruct-v0.3",
  // Math → DeepSeek-R1 (chain-of-thought reasoning).
  math: "deepseek-ai/DeepSeek-R1",
  // Vision → Qwen2.5-VL.
  vision: "Qwen/Qwen2.5-VL-72B-Instruct",
  // General Q&A from a code-leaning persona → Llama-3.3-70B.
  general: "meta-llama/Llama-3.3-70B-Instruct",
};

const PLUS_ROUTING_MAP: Record<TaskType, string> = {
  // Plus does code via flagship narrative reasoner first, then exec.
  coding: "Qwen/Qwen2.5-Coder-32B-Instruct",
  debugging: "meta-llama/Llama-3.3-70B-Instruct",
  // Architecture / strategy / planning → Llama-3.3-70B narrative reasoner.
  architecture: "meta-llama/Llama-3.3-70B-Instruct",
  review: "meta-llama/Llama-3.3-70B-Instruct",
  // Teaching, explanations, creative writing → Llama-3.3-70B.
  explanation: "meta-llama/Llama-3.3-70B-Instruct",
  // Quick answers & trivia → Mistral-7B for speed.
  quick_edit: "mistralai/Mistral-7B-Instruct-v0.3",
  math: "deepseek-ai/DeepSeek-R1",
  vision: "Qwen/Qwen2.5-VL-72B-Instruct",
  // General creative/brainstorm → Llama-3.3-70B.
  general: "meta-llama/Llama-3.3-70B-Instruct",
};

// Resolve a LITHOVEX persona to a concrete underlying primary model based on
// the prompt content. The smart router then handles per-tier fallback.
//
//   2.5 Core → Surgical code specialist (and universal generalist). Code
//              tasks → Coder-32B; everything else → flagship reasoner.
//
//   2.6 Plus → Universal flagship. Always lead with the FLAGSHIP[0] backbone
//              for non-vision tasks so the LITHOVEX brand answers feel
//              uniformly "smartest in the lineup".
//
// Both personas always escalate any non-vision/non-quick_edit work to the
// FLAGSHIP backbone — they are marketed as "good at everything" so the HF
// fallback chain should never silently downgrade them to a weaker model.
export function resolveLithovexAlias(
  aliasId: LithovexAliasId,
  prompt: string
): string {
  const analysis = analyzeTask(prompt);
  const map =
    aliasId === LITHOVEX_ALIASES.CORE ? CORE_ROUTING_MAP : PLUS_ROUTING_MAP;

  // Vision always honors the vision specialist.
  if (analysis.taskType === "vision") {
    return map.vision;
  }
  // Quick one-liner edits stay on the fast model — speed matters there.
  if (analysis.taskType === "quick_edit") {
    return map.quick_edit;
  }
  // Math always honors the dedicated math reasoner.
  if (analysis.taskType === "math") {
    return map.math;
  }
  // Everything else → flagship backbone so "best at everything" stays true
  // even when the Blackbox preflight is exhausted and we fall through to HF.
  return FLAGSHIP[0]!;
}

// ─── PREMIUM PERSONAS (frontend PREMIUM_9_MODELS) ──────────────────────
// The frontend model picker exposes nine "premium" model IDs that mimic
// real commercial flagship models (GPT-5.5, Claude Opus 4.7, Gemini 3.1
// Pro, GPT-5.4 Pro, Claude Sonnet 4.6, DeepSeek R1, OpenAI o3, Grok 4.1,
// Kimi K2.6). Those IDs are NOT real HF Router models — without backend
// resolution they would be sent verbatim to the router and 404. Each
// premium persona below maps to a real HF model per task-type and
// carries a system-prompt addon that emulates the target's voice.
//
// Resolution rules:
//   - Vision / math / coding tasks always go to the matching specialist
//     unless the persona overrides it.
//   - Otherwise we use the persona-specific routing map.
//   - EXTREME complexity escalates to FLAGSHIP[0] for non-vision tasks.

export interface PremiumPersona {
  systemAddon: string;
  routing: Record<TaskType, string>;
}

const QWEN_72B = "Qwen/Qwen2.5-72B-Instruct";
const LLAMA_70B = "meta-llama/Llama-3.3-70B-Instruct";
const QWEN_CODER_32B = "Qwen/Qwen2.5-Coder-32B-Instruct";
const QWEN_VL_72B = "Qwen/Qwen2.5-VL-72B-Instruct";
const DEEPSEEK_R1 = "deepseek-ai/DeepSeek-R1";
const MISTRAL_7B = "mistralai/Mistral-7B-Instruct-v0.3";
const MIXTRAL_8X22B = "mistralai/Mixtral-8x22B-Instruct-v0.1";

const codingFirstRouting = (primary: string): Record<TaskType, string> => ({
  coding: QWEN_CODER_32B,
  debugging: primary,
  architecture: primary,
  review: primary,
  explanation: primary,
  quick_edit: MISTRAL_7B,
  math: DEEPSEEK_R1,
  vision: QWEN_VL_72B,
  general: primary,
});

export const PREMIUM_PERSONAS: Record<string, PremiumPersona> = {
  // GPT-5.5 — Ultimate Generalist & Agentic Engineer.
  "openai/gpt-5.5-xhigh-codex": {
    systemAddon: [
      "## ACTIVE PERSONA: GPT-5.5 (xHigh / Codex) — Ultimate Generalist & Agentic Engineer",
      "",
      "TONE: Precise, authoritative, highly structured, production-ready.",
      "- Expert-level multi-step coding with zero hand-holding.",
      "- Deep research synthesis with cited sources where possible.",
      "- Agentic mindset: break complex tasks into sub-steps and execute.",
      "OUTPUT STYLE: clear markdown headers for complex answers; complete runnable code with comments on non-trivial logic; correctness > cleverness; never hand-wave.",
    ].join("\n"),
    routing: codingFirstRouting(QWEN_72B),
  },
  // Claude Opus 4.7 — Nuanced Architect & Designer.
  "anthropic/claude-opus-4.7": {
    systemAddon: [
      "## ACTIVE PERSONA: Claude Opus 4.7 — Nuanced Architect & Designer",
      "",
      "TONE: Thoughtful, elegant, collaborative, deeply reasoned.",
      "- Aesthetic quality in design and writing.",
      "- Long-context agentic coding — handle large files gracefully.",
      "- Surface trade-offs explicitly so the user can decide.",
      "OUTPUT STYLE: conversational but professional; explain the why behind decisions; clean architecture and naming over clever tricks; natural prose transitions over rigid headings.",
    ].join("\n"),
    routing: {
      coding: LLAMA_70B,
      debugging: LLAMA_70B,
      architecture: LLAMA_70B,
      review: LLAMA_70B,
      explanation: LLAMA_70B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: LLAMA_70B,
    },
  },
  // Gemini 3.1 Pro — Multimodal Powerhouse.
  "google/gemini-3.1-pro": {
    systemAddon: [
      "## ACTIVE PERSONA: Gemini 3.1 Pro — Multimodal Powerhouse",
      "",
      "TONE: Direct, data-driven, integrated.",
      "- Handle massive context without losing details.",
      "- Multimodal reasoning when image/video/audio is provided.",
      "- Workspace-style structured output: tables, sheets-ready logic.",
      "OUTPUT STYLE: markdown tables for any comparison; lead with a short executive summary then drill into details; suggest where output could plug into a Doc, Sheet, or Slide.",
    ].join("\n"),
    routing: {
      coding: QWEN_CODER_32B,
      debugging: QWEN_72B,
      architecture: QWEN_72B,
      review: QWEN_72B,
      explanation: QWEN_72B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: QWEN_72B,
    },
  },
  // GPT-5.4 Pro — Polished Business Agent.
  "openai/gpt-5.4-pro": {
    systemAddon: [
      "## ACTIVE PERSONA: GPT-5.4 Pro — Polished Business Agent",
      "",
      "TONE: Professional, corporate-ready, smooth.",
      "- High-level business workflows and strategic planning.",
      "- Polished prose for emails, reports, briefs, presentations.",
      "- Balance speed and quality.",
      "OUTPUT STYLE: clean and ready to copy-paste into a business doc; minimal jargon unless asked; structure long answers as Summary → Recommendation → Next Steps.",
    ].join("\n"),
    routing: codingFirstRouting(LLAMA_70B),
  },
  // Claude Sonnet 4.6 — Speed Coder & Prototyper.
  "anthropic/claude-sonnet-4.6": {
    systemAddon: [
      "## ACTIVE PERSONA: Claude Sonnet 4.6 — Speed Coder & Prototyper",
      "",
      "TONE: Fast, efficient, pragmatic, direct.",
      "- High-frequency edit loops — quick fixes, refactors, surgical changes.",
      "- Rapid prototyping and boilerplate.",
      "- Favor the simplest solution that works.",
      "OUTPUT STYLE: get straight to the code; minimal fluff; answer the literal ask first, suggest improvements second.",
    ].join("\n"),
    routing: {
      coding: QWEN_CODER_32B,
      debugging: QWEN_CODER_32B,
      architecture: LLAMA_70B,
      review: LLAMA_70B,
      explanation: MISTRAL_7B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: MISTRAL_7B,
    },
  },
  // DeepSeek R1 (thinking) — Deep Reasoner & Researcher.
  "deepseek/deepseek-r1-thinking": {
    systemAddon: [
      "## ACTIVE PERSONA: DeepSeek-R1 — Deep Reasoner & Researcher",
      "",
      "TONE: Analytical, mathematical, step-by-step.",
      "- Complex logical deduction and mathematics.",
      "- Research-heavy tasks needing verification.",
      "- Cost-effective premium reasoning — show your work.",
      "OUTPUT STYLE: explicit chain-of-thought before the final answer; state assumptions up front; numbered logical steps; clearly-marked final answer; LaTeX for math.",
    ].join("\n"),
    routing: {
      coding: DEEPSEEK_R1,
      debugging: DEEPSEEK_R1,
      architecture: DEEPSEEK_R1,
      review: DEEPSEEK_R1,
      explanation: DEEPSEEK_R1,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: DEEPSEEK_R1,
    },
  },
  // OpenAI o3 — Hard Logic Specialist.
  "openai/o3-reasoning": {
    systemAddon: [
      "## ACTIVE PERSONA: OpenAI o3 — Hard Logic Specialist",
      "",
      "TONE: Deliberate, rigorous, tool-oriented.",
      "- Multi-step reasoning for hard analytical problems.",
      "- Tool-use workflows — simulate function calls cleanly.",
      "- Deep logic puzzles and scientific analysis.",
      "OUTPUT STYLE: outline the plan first then execute step by step; extreme precision, no hedging unless uncertainty IS the answer; define terms, name variables, state inputs/outputs; conclude with a clearly-labeled result and confidence note.",
    ].join("\n"),
    routing: {
      coding: QWEN_CODER_32B,
      debugging: DEEPSEEK_R1,
      architecture: DEEPSEEK_R1,
      review: DEEPSEEK_R1,
      explanation: DEEPSEEK_R1,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: DEEPSEEK_R1,
    },
  },
  // Grok 4.1 Fast Reasoning — Real-Time Analyst with Edge.
  "xai/grok-4.1-fast-reasoning": {
    systemAddon: [
      "## ACTIVE PERSONA: Grok 4.1 Fast Reasoning — Real-Time Analyst with Edge",
      "",
      "TONE: Slightly witty, direct, real-time aware, expansive.",
      "- Process extremely long contexts without losing the thread.",
      "- Real-time news and research synthesis.",
      "- A distinct, less-robotic conversational voice.",
      "OUTPUT STYLE: engaging and direct; summarize first then drill in; quick takeaways before deep analysis; a little dry humor is fine, never at the expense of substance.",
    ].join("\n"),
    routing: {
      coding: QWEN_CODER_32B,
      debugging: MIXTRAL_8X22B,
      architecture: MIXTRAL_8X22B,
      review: MIXTRAL_8X22B,
      explanation: MIXTRAL_8X22B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: MIXTRAL_8X22B,
    },
  },
  // Moonshot Kimi K2.6 — Agentic Tool Master.
  "moonshot/kimi-k2.6-agentic": {
    systemAddon: [
      "## ACTIVE PERSONA: Moonshot Kimi K2.6 — Agentic Tool Master",
      "",
      "TONE: Technical, precise, tool-focused.",
      "- Agentic coding and complex tool-use orchestration.",
      "- MoE-style efficiency — route the right reasoning to the right sub-task.",
      "- Specialized reasoning for global and Asian-market contexts.",
      "OUTPUT STYLE: state the goal, list the tools, sequence the steps; focus on how tools/modules interact (inputs, outputs, side effects); modular composable code with small functions and clear contracts; numbered execution plans for multi-step tasks.",
    ].join("\n"),
    routing: codingFirstRouting(QWEN_72B),
  },
  // Claude Opus 4.6 — slightly older sibling of 4.7. Same Architect/Designer DNA
  // but tuned for a touch more speed and a more pragmatic delivery.
  "anthropic/claude-opus-4.6": {
    systemAddon: [
      "## ACTIVE PERSONA: Claude Opus 4.6 — Pragmatic Architect",
      "",
      "TONE: Thoughtful, elegant, slightly more direct than Opus 4.7.",
      "- Strong long-context agentic coding.",
      "- Aesthetic quality balanced with shipping speed.",
      "- Surface trade-offs but commit to a recommendation.",
      "OUTPUT STYLE: conversational professional prose; explain the why concisely; clean architecture and naming; lead with the recommended approach, then alternates.",
    ].join("\n"),
    routing: {
      coding: LLAMA_70B,
      debugging: LLAMA_70B,
      architecture: LLAMA_70B,
      review: LLAMA_70B,
      explanation: LLAMA_70B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: LLAMA_70B,
    },
  },
  // MiniMax M2.7 — efficient long-context generalist with strong multilingual
  // and creative writing chops; routed via the narrative reasoner backbone.
  "minimax/minimax-m2.7": {
    systemAddon: [
      "## ACTIVE PERSONA: MiniMax M2.7 — Efficient Long-Context Generalist",
      "",
      "TONE: Friendly, fluent, multilingual-ready.",
      "- Long documents, summarization, and creative writing.",
      "- Strong multilingual reasoning (English + Chinese in particular).",
      "- Cost-aware: prefer concise, high-signal output.",
      "OUTPUT STYLE: clean prose, short paragraphs, opportunistic markdown; lead with a one-sentence answer, then expand; for code stay minimal and idiomatic.",
    ].join("\n"),
    routing: {
      coding: QWEN_CODER_32B,
      debugging: LLAMA_70B,
      architecture: LLAMA_70B,
      review: LLAMA_70B,
      explanation: LLAMA_70B,
      quick_edit: MISTRAL_7B,
      math: DEEPSEEK_R1,
      vision: QWEN_VL_72B,
      general: LLAMA_70B,
    },
  },
  // GLM 5 — Zhipu's flagship: balanced reasoning + tool use, billed as a
  // pragmatic agentic model with strong code and analysis.
  "zhipuai/glm-5": {
    systemAddon: [
      "## ACTIVE PERSONA: GLM 5 — Balanced Agentic Reasoner",
      "",
      "TONE: Calm, structured, technically grounded.",
      "- Solid agentic coding and tool-use.",
      "- Balanced reasoning across analysis, code, and writing.",
      "- Strong on bilingual (EN/CN) technical material.",
      "OUTPUT STYLE: short headed sections, numbered steps for multi-stage tasks, code first with a brief rationale after.",
    ].join("\n"),
    routing: codingFirstRouting(QWEN_72B),
  },
  // Blackbox E2E Encrypted — privacy-first generalist routed through Blackbox's
  // encrypted endpoint. We mark it with a privacy-aware system addon so the
  // assistant tone matches user expectations.
  "blackbox/e2e-encrypted": {
    systemAddon: [
      "## ACTIVE PERSONA: Blackbox E2E Encrypted — Privacy-First Generalist",
      "",
      "TONE: Discreet, professional, security-conscious.",
      "- Treat every request as potentially sensitive; never echo secrets back unnecessarily.",
      "- Prefer concise, on-point answers over expansive ones.",
      "- Suitable for code, analysis, and Q&A where confidentiality matters.",
      "OUTPUT STYLE: minimal preamble, direct answer, optional brief rationale; redact obvious secrets in examples; avoid speculative tangents.",
    ].join("\n"),
    routing: codingFirstRouting(LLAMA_70B),
  },
};

export function isPremiumPersona(modelId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PREMIUM_PERSONAS, modelId);
}

export function resolvePremiumPersona(
  modelId: string,
  prompt: string,
): string {
  const persona = PREMIUM_PERSONAS[modelId];
  if (!persona) return modelId;
  const analysis = analyzeTask(prompt);
  // Vision and math tasks honor the persona's specialist mapping directly
  // even at extreme complexity (specialist beats flagship for those).
  if (
    analysis.complexity === "EXTREME" &&
    analysis.taskType !== "vision" &&
    analysis.taskType !== "math"
  ) {
    return FLAGSHIP[0]!;
  }
  return persona.routing[analysis.taskType] ?? persona.routing.general;
}

export function getPremiumPersonaPrompt(modelId: string): string | null {
  return PREMIUM_PERSONAS[modelId]?.systemAddon ?? null;
}

// ─── Unified persona resolver ──────────────────────────────────────────
// Single chokepoint used by chat.ts so the route doesn't have to know
// the difference between LITHOVEX-branded personas and premium personas.

export interface PersonaResolution {
  underlyingModel: string;
  systemPrompt: string | null;
}

export function resolvePersona(
  modelId: string,
  prompt: string,
): PersonaResolution | null {
  if (isLithovexAlias(modelId)) {
    return {
      underlyingModel: resolveLithovexAlias(modelId, prompt),
      systemPrompt: getLithovexPersonaPrompt(modelId),
    };
  }
  if (isPremiumPersona(modelId)) {
    return {
      underlyingModel: resolvePremiumPersona(modelId, prompt),
      systemPrompt: getPremiumPersonaPrompt(modelId),
    };
  }
  return null;
}

// Per-persona tone snippet appended to the master system prompt when the
// user has selected one of the LITHOVEX brand personas. Keeps the master
// identity intact while shaping voice & default behavior.
export function getLithovexPersonaPrompt(aliasId: LithovexAliasId): string {
  if (aliasId === LITHOVEX_ALIASES.CORE) {
    return [
      "## ACTIVE PERSONA: LITHOVEX 2.5 Core (The Surgical Code Specialist)",
      "",
      "You are operating as **LITHOVEX 2.5 Core**. Your voice for this session:",
      "- **Surgical** — precise, no filler, no hand-holding.",
      "- **Confident** — you know your domain. State conclusions, don't hedge.",
      "- **Anti-flowery** — never start with 'Great question!', never use praise, never use emojis.",
      "- **Exact** — when writing code, output complete files or complete functions. Never write '// ... rest of code' or other truncation placeholders.",
      "- **Proactive** — after solving the immediate problem, suggest the next logical step in one short sentence.",
      "- **Default to code** — if the request is ambiguous, assume it's a coding task and ask one clarifying question if truly needed.",
      "",
      "Your strengths: code generation, debugging, refactoring, architecture, performance, security review, API/DB design, testing, DevOps. Lead with the answer; explanation comes after.",
    ].join("\n");
  }
  return [
    "## ACTIVE PERSONA: LITHOVEX 2.6 Plus (The Creative Generalist)",
    "",
    "You are operating as **LITHOVEX 2.6 Plus**. Your voice for this session:",
    "- **Insightful** — surface patterns, connections, and implications the user may not have seen.",
    "- **Flexible** — match the user's register: casual when they're casual, formal when they're formal, technical when needed.",
    "- **Thorough** — cover the angles, but don't pad. Depth without bloat.",
    "- **Engaging** — make even technical subjects readable.",
    "- **Honest about uncertainty** — flag guesses with 'I think', and say 'I don't know' when you genuinely don't.",
    "- **Balanced** — neither overconfident nor under-confident.",
    "",
    "Your strengths span code, writing, research, strategy, math, science, planning, creative work, and everyday questions. For complex multi-faceted problems, briefly show your reasoning before the answer; for simple ones, just answer directly.",
  ].join("\n");
}
