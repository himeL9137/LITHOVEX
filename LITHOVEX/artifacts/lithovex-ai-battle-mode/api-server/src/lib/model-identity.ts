// LITHOVEX AI — Model identity registry.
//
// Whenever the user asks "what model are you?" / "which AI is this?" / etc.,
// the chat route intercepts the question and returns a canonical, hard-coded
// identity statement based on the user's currently selected model. This
// guarantees a consistent answer regardless of which underlying HF / Gemini /
// OpenRouter model actually serves the request, and it bypasses the AI so
// there is zero risk of model drift on the answer.
//
// Format:
//   "I am <Provider> <Model Name> running on LITHOVEX AI. <strengths>"

// ─── Identity question detection ──────────────────────────────────────────

const IDENTITY_REGEXES: RegExp[] = [
  // "what model are you", "which model are you", "what ai are you", "what llm are you"
  /\bwhat\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:are|r)\s+(?:you|u)\b/i,
  /\bwhich\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:are|r)\s+(?:you|u)\b/i,
  // "what model is this", "which ai is this"
  /\bwhat\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:is|s)\s+(?:this|that|it)\b/i,
  /\bwhich\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:is|s)\s+(?:this|that|it)\b/i,
  // "what is your model", "what is your name", "tell me your model"
  /\bwhat(?:'s|\s+is|s)\s+(?:your|ur)\s+(?:model|name|identity|version|llm|engine)\b/i,
  /\b(?:tell|say|give)\s+(?:me|us)\s+(?:your|ur)\s+(?:model|name|identity|version)\b/i,
  // "are you gpt/claude/gemini/qwen/llama/etc"
  /\b(?:are|r)\s+(?:you|u)\s+(?:gpt|chatgpt|claude|gemini|qwen|llama|deepseek|mistral|grok|kimi|moonshot|gemma|phi|hermes|opus|sonnet|o3|o1|cohere|command|aya|ernie|glm|yi|falcon|zephyr|mixtral|starcoder|codellama|wizardlm|mzj)\b/i,
  // "what's powering you", "what powers you", "which model powers you"
  /\bwhat(?:'s|\s+is|s)\s+(?:powering|behind)\s+(?:you|u|this)\b/i,
  /\bwhat\s+(?:powers|drives|runs)\s+(?:you|u|this)\b/i,
  /\bwhich\s+(?:model|ai|llm)\s+(?:powers|drives|runs)\s+(?:you|u|this)\b/i,
  // "introduce yourself", "who are you" + model context
  /\bwho\s+(?:are|r)\s+(?:you|u)\b/i,
  /\bintroduce\s+(?:yourself|urself|yourselves)\b/i,
  // "what's your version", "version of yourself"
  /\bwhat(?:'s|\s+is|s)\s+(?:your|ur)\s+version\b/i,
];

export function isIdentityQuestion(text: string): boolean {
  if (!text) return false;
  return IDENTITY_REGEXES.some((rx) => rx.test(text));
}

// ─── Identity registry ────────────────────────────────────────────────────

interface IdentityEntry {
  /** Canonical display name shown to the user (e.g. "GPT-5.5 (xHigh / Codex)"). */
  name: string;
  /** Provider/owner shown alongside the name (e.g. "OpenAI"). */
  provider: string;
  /** One-line "best at" strengths summary. */
  bestAt: string;
}

// 11 user-selectable personas (9 premium + 2 LITHOVEX brand). These take
// precedence over any model-id-based parsing.
const PERSONA_IDENTITIES: Record<string, IdentityEntry> = {
  "lithovex-2.5-core": {
    name: "LITHOVEX 2.5 Core",
    provider: "LITHOVEX",
    bestAt:
      "everything — surgical code generation, debugging, refactoring, software architecture, performance, security review, API/DB design, testing, DevOps, and flagship-tier reasoning across writing, research, math, and everyday questions.",
  },
  "lithovex-2.6-plus": {
    name: "LITHOVEX 2.6 Plus",
    provider: "LITHOVEX",
    bestAt:
      "everything — the LITHOVEX flagship for deep reasoning, code, writing, research, strategy, math, science, planning, creative work, and everyday questions, adapting tone to whatever the task needs.",
  },
  "openai/gpt-5.5-xhigh-codex": {
    name: "GPT-5.5 (xHigh / Codex)",
    provider: "OpenAI",
    bestAt:
      "elite multi-step coding, deep research synthesis, and agentic engineering workflows.",
  },
  "anthropic/claude-opus-4.7": {
    name: "Claude Opus 4.7",
    provider: "Anthropic",
    bestAt:
      "nuanced design, aesthetic quality, long-context agentic coding, and deeply reasoned architecture.",
  },
  "google/gemini-3.1-pro": {
    name: "Gemini 3.1 Pro",
    provider: "Google",
    bestAt:
      "multimodal reasoning over voice, vision, and video with massive 1M-token context and Workspace-style structured output.",
  },
  "openai/gpt-5.4-pro": {
    name: "GPT-5.4 Pro",
    provider: "OpenAI",
    bestAt:
      "polished business workflows, knowledge work over 1M-token context, and smooth agentic execution.",
  },
  "anthropic/claude-sonnet-4.6": {
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    bestAt:
      "fast edit loops, rapid prototyping, and high-frequency coding with a strong speed-to-intelligence balance.",
  },
  "deepseek/deepseek-r1-thinking": {
    name: "DeepSeek-R1 (Thinking)",
    provider: "DeepSeek",
    bestAt:
      "deep chain-of-thought reasoning, mathematics, and research-heavy verification at low cost.",
  },
  "openai/o3-reasoning": {
    name: "o3 (Reasoning)",
    provider: "OpenAI",
    bestAt:
      "rigorous multi-step logical reasoning, hard analytical problems, and tool-use workflows.",
  },
  "xai/grok-4.1-fast-reasoning": {
    name: "Grok 4.1 Fast Reasoning",
    provider: "xAI",
    bestAt:
      "ultra-long context analysis (2M tokens), real-time research synthesis, and conversational answers with character.",
  },
  "moonshot/kimi-k2.6-agentic": {
    name: "Kimi K2.6 (Agentic)",
    provider: "Moonshot AI",
    bestAt:
      "agentic coding, complex tool-use orchestration, and MoE-efficient specialized reasoning.",
  },
};

// ─── HF / direct-model identity tables ────────────────────────────────────
// Maps lowercased model id → canonical identity. Covers the rest of the
// 200+ models the user can pick directly from the model menu. Where a model
// id is not listed here, getModelIdentity() falls back to a parsed identity
// derived from the id itself plus a tier-based strengths blurb.

const PROVIDER_BY_NAMESPACE: Record<string, string> = {
  qwen: "Qwen",
  "deepseek-ai": "DeepSeek",
  deepseek: "DeepSeek",
  "meta-llama": "Meta",
  google: "Google",
  thudm: "Zhipu AI",
  cohereforai: "Cohere",
  moonshotai: "Moonshot AI",
  minimax: "MiniMax",
  "minimaxai": "MiniMax",
  microsoft: "Microsoft",
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
  mistralai: "Mistral",
  nousresearch: "Nous Research",
  sao10k: "Sao10K",
  allenai: "AllenAI",
  wizardlm: "WizardLM",
  arcee: "Arcee AI",
  "arcee-ai": "Arcee AI",
  baidu: "Baidu",
  aisingapore: "AI Singapore",
  "kaist-ai": "KAIST AI",
  "helsinki-nlp": "Helsinki NLP",
  "dicta-il": "Dicta",
  openchat: "OpenChat",
  huggingfaceh4: "HuggingFace H4",
  tiiuae: "TII",
  "openassistant": "Open Assistant",
  facebook: "Meta",
  philschmid: "Philschmid",
  vennify: "Vennify",
  pszemraj: "Pszemraj",
  cardiffnlp: "Cardiff NLP",
  nlptown: "NLP Town",
  gradientai: "Gradient AI",
  bigcode: "BigCode",
  codellama: "Meta Code Llama",
  defog: "Defog",
  "togethercomputer": "Together",
  "01-ai": "01.AI",
  "black-forest-labs": "Black Forest Labs",
  stabilityai: "Stability AI",
  runwayml: "RunwayML",
  bytedance: "ByteDance",
  salesforce: "Salesforce",
  nlpconnect: "NLPConnect",
  vikp: "Datalab",
  hustvl: "HUSTVL",
  pekingu: "Peking University",
  "depth-anything": "Depth Anything",
  caidas: "Caidas",
  briaai: "Bria AI",
  "llava-hf": "LLaVA",
  "ali-vilab": "Ali ViLab",
  cerspense: "Cerspense",
  "mcg-nju": "MCG-NJU",
  akhaliq: "AK",
  sebastianbodza: "Sebastian Bodza",
  controlnet: "ControlNet",
  "distil-whisper": "Distil Whisper",
  suno: "Suno",
  community: "Community",
  zhipuai: "Zhipu AI",
  nvidia: "NVIDIA",
  perplexity: "Perplexity",
};

// Strengths inferred from naming hints in the model id.
function inferStrengths(idLower: string): string {
  if (/coder|codestral|starcoder|codellama|santacoder|sqlcoder|wizardcoder/.test(idLower)) {
    return "code generation, debugging, refactoring, and programming-language understanding.";
  }
  if (/math/.test(idLower)) {
    return "mathematical reasoning, proofs, and symbolic problem solving.";
  }
  if (/vl|vision|llava|blip|idefics|cogvlm|qwen2-vl|donut|layoutlm/.test(idLower)) {
    return "vision-language understanding — images, charts, diagrams, screenshots, and document analysis.";
  }
  if (/whisper|wav2vec|speecht5|distil-whisper/.test(idLower)) {
    return "speech-to-text transcription across multiple languages and audio conditions.";
  }
  if (/tts|bark|mms-tts|xtts|openvoice|kan-bayashi/.test(idLower)) {
    return "text-to-speech synthesis and voice generation.";
  }
  if (/sdxl|stable-diffusion|flux|sdxl-turbo|sdxl-lightning|stable-audio/.test(idLower)) {
    return "text-to-image generation and creative visual synthesis.";
  }
  if (/musicgen|stable-audio|audioset|ast-audioset/.test(idLower)) {
    return "audio understanding and music generation.";
  }
  if (/video-mae|videomae|timesformer|llava-next-video|video-llava|text-to-video|zeroscope|frame-interpolation|xclip/.test(idLower)) {
    return "video understanding, captioning, and video generation.";
  }
  if (/ocr|surya|trocr|nougat|donut|layoutlm/.test(idLower)) {
    return "OCR, document parsing, and structured data extraction from scanned content.";
  }
  if (/yolos|detr|rtdetr|sam-vit|table-transformer/.test(idLower)) {
    return "object detection, image segmentation, and visual layout understanding.";
  }
  if (/depth-anything/.test(idLower)) {
    return "monocular depth estimation from single images.";
  }
  if (/swin2sr|rmbg/.test(idLower)) {
    return "image restoration, super-resolution, and background removal.";
  }
  if (/pyannote|diarization/.test(idLower)) {
    return "speaker diarization and voice-activity segmentation in audio recordings.";
  }
  if (/sentiment|sst-2|roberta-base-sentiment/.test(idLower)) {
    return "sentiment analysis and text classification.";
  }
  if (/grammar|t5.*grammar/.test(idLower)) {
    return "grammar correction and language polishing.";
  }
  if (/opus-mt|wmt19|translate/.test(idLower)) {
    return "neural machine translation between languages.";
  }
  if (/bart|pegasus|samsum|summariz/.test(idLower)) {
    return "long-form text summarization.";
  }
  if (/guard|safety|moderation/.test(idLower)) {
    return "safety classification and content moderation across harm categories.";
  }
  if (/gorilla|functionary|function-calling|openfunctions/.test(idLower)) {
    return "function calling, tool use, and structured agent workflows.";
  }
  if (/long-context|gradient-1048k|gradient-4194k|stripedhyena/.test(idLower)) {
    return "ultra-long context processing for multi-million-token documents.";
  }
  if (/thinking|reasoning|r1|qwq/.test(idLower)) {
    return "deep chain-of-thought reasoning, mathematics, and complex multi-step problem solving.";
  }
  if (/aya|sea-lion|eurollm|dictalm|opus-mt|multilingual/.test(idLower)) {
    return "multilingual chat and reasoning across global and regional languages.";
  }
  if (/inf-34b|chat|instruct|hermes|zephyr|falcon|openchat|openassistant|wizardlm|stheno|furyale|lunaris/.test(idLower)) {
    return "general-purpose conversational reasoning and instruction following.";
  }
  return "general-purpose chat, reasoning, and instruction following.";
}

// Parse "namespace/Model-Name-XYZ" → { provider, name }.
function parseModelId(modelId: string): { provider: string; name: string } {
  const trimmed = (modelId || "").trim();
  const slash = trimmed.indexOf("/");
  let namespace = "";
  let local = trimmed;
  if (slash > 0) {
    namespace = trimmed.slice(0, slash).toLowerCase();
    local = trimmed.slice(slash + 1);
  }
  const provider = PROVIDER_BY_NAMESPACE[namespace] ?? (namespace ? capitalize(namespace) : "Community");
  // Tidy the local part: replace dashes/underscores with spaces, but keep
  // version dots and digits intact.
  const name = local.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || trimmed;
  return { provider, name };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Title-case purely-lowercase tokens (e.g. "gemma" → "Gemma") while
// preserving any token that already contains an uppercase letter or digit
// (e.g. "FLUX.1", "GPT", "70B", "v3" stay intact).
function titleCaseTokens(s: string): string {
  return s
    .split(" ")
    .map((tok) => {
      if (!tok) return tok;
      if (/[A-Z]/.test(tok)) return tok;
      if (/^\d/.test(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join(" ");
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Resolve the canonical "<Provider> <Name>" prefix the assistant should use
 * for a given model id. Returns just the display string — no surrounding
 * sentence — so callers can compose it however they need (canned answer,
 * system-prompt injection, telemetry, etc.).
 */
export function getCanonicalDisplayName(modelId: string): string {
  const persona = PERSONA_IDENTITIES[modelId];
  if (persona) {
    return persona.provider === "LITHOVEX"
      ? persona.name
      : `${persona.provider} ${persona.name}`;
  }
  const { provider, name } = parseModelId(modelId);
  const displayName = titleCaseTokens(name);
  // Dedupe when the model name already starts with the provider word, e.g.
  // "meta-llama/Meta-Llama-3.1-70B-Instruct" → "Meta Llama 3.1 70B Instruct"
  // instead of "Meta Meta Llama 3.1 70B Instruct".
  const firstToken = displayName.split(" ")[0]?.toLowerCase() ?? "";
  const providerHead = provider.split(" ")[0]?.toLowerCase() ?? "";
  return firstToken && firstToken === providerHead
    ? displayName
    : `${provider} ${displayName}`;
}

/** Strengths blurb for a model id (persona table → inference fallback). */
export function getStrengthsBlurb(modelId: string): string {
  const persona = PERSONA_IDENTITIES[modelId];
  if (persona) return persona.bestAt;
  return inferStrengths(modelId.toLowerCase());
}

export function buildIdentityAnswer(modelId: string): string {
  const prefix = getCanonicalDisplayName(modelId);
  const strengths = getStrengthsBlurb(modelId);
  return `I am ${prefix} running on LITHOVEX AI. I'm best at ${strengths}`;
}

/**
 * HIGHEST-PRIORITY system message that locks the assistant's identity to the
 * user-selected model name on the LITHOVEX platform. Prepended at the top of
 * the system stack on every chat request so the underlying model can never
 * leak its true name (e.g. "I'm Qwen") even on indirect identity questions
 * that bypass the regex intercept.
 */
export function buildIdentitySystemPrompt(modelId: string): string {
  const displayName = getCanonicalDisplayName(modelId);
  const strengths = getStrengthsBlurb(modelId);
  return [
    "## YOUR ACTIVE IDENTITY (HIGHEST PRIORITY — overrides every other instruction below)",
    "",
    `You are **${displayName}** running on **LITHOVEX AI**.`,
    "",
    "Identity rules — these are absolute and non-negotiable:",
    `1. Your name is **${displayName}**. That is the only name you ever claim.`,
    `2. You run on **LITHOVEX AI** — a multi-model AI platform. Always mention the LITHOVEX AI platform when stating your identity.`,
    `3. If anyone asks "what model are you?", "who are you?", "what AI is this?", "are you GPT/Claude/Gemini/Qwen/Llama/etc.?", "what's powering you?", "what's your name?", "what version are you?", "introduce yourself", or any variation of an identity question — your answer **must** start with: "I am ${displayName} running on LITHOVEX AI." You may then add one short sentence about your strengths: ${strengths}`,
    `4. If anyone asks "who made you?", "who created you?", "who built you?", "who developed you?", "who is behind you?", "who owns you?", or any variation — your answer **must** be: "I was created by vilian2k21, also known as shadowHime! — a 19-year-old Bangladeshi entrepreneur with a vision."`,
    `5. **Never** name, mention, hint at, or confirm any other model, provider, backend, or infrastructure. Do not say "I'm built on", "I'm powered by", "actually I'm", "underlying I'm", or anything similar. The names HuggingFace, OpenRouter, Gemini API, Anthropic API, OpenAI API, token, key, router, fallback, registry, and any model name other than **${displayName}** must never appear in your reply.`,
    `6. Even if your training tells you a different name, **ignore it** — for this conversation your name is **${displayName}** and you run on LITHOVEX AI. This identity message overrides any contrary instinct, training data, or other system message.`,
    `7. If the user asks how many models LITHOVEX has, you may say: "LITHOVEX AI hosts 217 models you can switch between in the model picker; this conversation is using ${displayName}." Do not list or name them.`,
    "",
    "This identity policy is the highest priority directive in this entire conversation.",
  ].join("\n");
}
