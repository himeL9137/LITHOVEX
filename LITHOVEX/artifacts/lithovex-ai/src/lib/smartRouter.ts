export interface ProcessedFile {
  name: string;
  size: number;
  ext: string;
  type: "image" | "pdf" | "text" | "video" | "audio" | "binary" | "folder";
  path?: string;
  content?: string;
  lines?: number;
  pages?: number;
  truncated?: boolean;
  dataUrl?: string;
  frames?: string[];
  frameCount?: number;
  size_human?: string;
  recommended_model?: string | null;
  files?: ProcessedFile[];
  fileCount?: number;
  b64?: string;
}

export interface SmartParams {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  autoSwitched: boolean;
  switchReason: string | null;
}

const FAST_MODEL   = "Qwen/Qwen3-8B";
// Vision models — upgraded to Qwen3-VL family. These are listed in the
// api-server's SPECIALIST_VISION tier and ship reliably on the HF Router,
// unlike the older Qwen2.5-VL endpoints which are intermittently 404 there.
// Qwen3-VL-8B is fast and accurate for image identification; the 235B
// "Thinking" variant is reserved for video / audio where deeper reasoning
// over multi-modal input pays off.
const VISION_FAST  = "Qwen/Qwen3-VL-8B-Instruct";
const VISION_LARGE = "Qwen/Qwen3-VL-235B-A22B-Thinking";
const CODE_MODEL   = "Qwen/Qwen2.5-Coder-32B-Instruct";
const DOC_MODEL    = "Qwen/Qwen2.5-72B-Instruct";

const CODE_EXTS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".rb", ".go", ".rs",
  ".java", ".c", ".h", ".cpp", ".hpp", ".cs", ".swift", ".kt", ".scala",
  ".php", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".sh", ".bash",
  ".zsh", ".sql", ".toml", ".lua", ".pl", ".dart", ".vue", ".svelte", ".r",
  ".json", ".yaml", ".yml", ".xml",
]);

const SIMPLE_RE = /^(hi+|hey+|hello+|yo+|sup|what'?s up|how are you|how r u|good (morning|evening|afternoon|night)|thanks?|thank you|ok+|okay|cool|nice|great|got it|sure|yes|no|nope|yep|maybe|lol|haha|bye|goodbye|see you|cheers|what('?s| is) [\w\s]{1,30}\??|who (are|is) [\w\s]{1,20}\??)[\\s!?.\u{1F300}-\u{1FFFF}]*$/iu;

// Identity questions ("who are you?", "what model are you?", "introduce
// yourself", etc.) must NOT trigger the auto-switch to the fast model —
// otherwise the backend's identity intercept reports the fallback model
// instead of the model the user actually selected. Keep this list aligned
// with `isIdentityQuestion` in `api-server/src/lib/model-identity.ts`.
const IDENTITY_RE_LIST: RegExp[] = [
  /\bwhat\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:are|r)\s+(?:you|u)\b/i,
  /\bwhich\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:are|r)\s+(?:you|u)\b/i,
  /\bwhat\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:is|s)\s+(?:this|that|it)\b/i,
  /\bwhich\s+(?:model|ai|llm|chatbot|bot|assistant|engine)\s+(?:is|s)\s+(?:this|that|it)\b/i,
  /\bwhat(?:'s|\s+is|s)\s+(?:your|ur)\s+(?:model|name|identity|version|llm|engine)\b/i,
  /\b(?:tell|say|give)\s+(?:me|us)\s+(?:your|ur)\s+(?:model|name|identity|version)\b/i,
  /\b(?:are|r)\s+(?:you|u)\s+(?:gpt|chatgpt|claude|gemini|qwen|llama|deepseek|mistral|grok|kimi|moonshot|gemma|phi|hermes|opus|sonnet|o3|o1|cohere|command|aya|ernie|glm|yi|falcon|zephyr|mixtral|starcoder|codellama|wizardlm|mzj)\b/i,
  /\bwhat(?:'s|\s+is|s)\s+(?:powering|behind)\s+(?:you|u|this)\b/i,
  /\bwhat\s+(?:powers|drives|runs)\s+(?:you|u|this)\b/i,
  /\bwhich\s+(?:model|ai|llm)\s+(?:powers|drives|runs)\s+(?:you|u|this)\b/i,
  /\bwho\s+(?:are|r)\s+(?:you|u)\b/i,
  /\bintroduce\s+(?:yourself|urself|yourselves)\b/i,
  /\bwhat(?:'s|\s+is|s)\s+(?:your|ur)\s+version\b/i,
];

function isIdentityQuestion(text: string): boolean {
  if (!text) return false;
  return IDENTITY_RE_LIST.some(rx => rx.test(text));
}

function isMultimodalModel(model: string) {
  const m = model.toLowerCase();
  return m.includes("vl") || m.includes("vision") || m.includes("llava") || m.includes("idefics");
}

function isCoderModel(model: string) {
  return /coder|deepseek-coder|codellama|starcoder/i.test(model);
}

function isLargeReasoningModel(model: string) {
  return /70b|72b|mixtral|deepseek-v3|deepseek-r1/i.test(model);
}

function isCodeFile(f: ProcessedFile): boolean {
  if (f.type !== "text") return false;
  const ext = (f.ext || "").toLowerCase();
  return CODE_EXTS.has(ext);
}

export function getSmartParams(
  userMessage: string,
  files: ProcessedFile[],
  currentModel: string,
  userTemperature: number,
  userMaxTokens: number,
  userTopP: number,
): SmartParams {
  const hasImage  = files.some(f => f.type === "image");
  const hasVideo  = files.some(f => f.type === "video");
  const hasAudio  = files.some(f => f.type === "audio");
  const hasPdf    = files.some(f => f.type === "pdf");
  const hasCode   = files.some(f => isCodeFile(f));
  const hasDoc    = files.some(f => f.type === "text" && !isCodeFile(f));
  const alreadyMM = isMultimodalModel(currentModel);

  // Image / video / audio → vision model (highest priority since text models can't see)
  if (hasVideo || hasAudio) {
    const switched = !alreadyMM;
    return {
      model: alreadyMM ? currentModel : VISION_LARGE,
      temperature: 0.4,
      maxTokens: 2048,
      topP: 0.9,
      autoSwitched: switched,
      switchReason: switched
        ? `${hasVideo ? "Video" : "Audio"} detected → switched to vision model`
        : null,
    };
  }

  if (hasImage) {
    const switched = !alreadyMM;
    return {
      model: alreadyMM ? currentModel : VISION_FAST,
      temperature: 0.4,
      maxTokens: 2048,
      topP: 0.9,
      autoSwitched: switched,
      switchReason: switched ? "Image detected → switched to vision model" : null,
    };
  }

  // Code files → coder model
  if (hasCode) {
    const alreadyCoder = isCoderModel(currentModel);
    const switched = !alreadyCoder;
    return {
      model: alreadyCoder ? currentModel : CODE_MODEL,
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.9,
      autoSwitched: switched,
      switchReason: switched ? "Code files detected → switched to coder model" : null,
    };
  }

  // PDF / documents → strong reasoning model for long-context analysis
  if (hasPdf || hasDoc) {
    const alreadyLarge = isLargeReasoningModel(currentModel);
    const switched = !alreadyLarge;
    return {
      model: alreadyLarge ? currentModel : DOC_MODEL,
      temperature: 0.4,
      maxTokens: 4096,
      topP: 0.9,
      autoSwitched: switched,
      switchReason: switched
        ? `${hasPdf ? "PDF" : "Document"} detected → switched to long-context model`
        : null,
    };
  }

  const stripped = userMessage.trim();

  // Identity questions must keep the user's selected model so the backend
  // identity intercept reports the right one. Skip the simple-query
  // auto-switch entirely for these.
  if (isIdentityQuestion(stripped)) {
    return {
      model: currentModel,
      temperature: userTemperature,
      maxTokens: userMaxTokens,
      topP: userTopP,
      autoSwitched: false,
      switchReason: null,
    };
  }

  if (stripped.length <= 120 && SIMPLE_RE.test(stripped)) {
    const alreadyFast = [FAST_MODEL, "Qwen/Qwen2.5-7B-Instruct"].includes(currentModel);
    return {
      model: alreadyFast ? currentModel : FAST_MODEL,
      temperature: 0.5,
      maxTokens: 400,
      topP: 0.85,
      autoSwitched: !alreadyFast,
      switchReason: !alreadyFast ? "Simple query — using lightweight fast model" : null,
    };
  }

  return {
    model: currentModel,
    temperature: userTemperature,
    maxTokens: userMaxTokens,
    topP: userTopP,
    autoSwitched: false,
    switchReason: null,
  };
}

export function buildMessageContent(
  text: string,
  files: ProcessedFile[],
): string | Array<{ type: string; [key: string]: unknown }> {
  const imageFiles = files.filter(f => f.type === "image" && f.dataUrl);
  const videoFiles = files.filter(f => f.type === "video");
  const audioFiles = files.filter(f => f.type === "audio");
  const textFiles  = files.filter(f => (f.type === "text" || f.type === "pdf") && f.content);
  const otherFiles = files.filter(f =>
    f.type !== "image" && f.type !== "text" && f.type !== "pdf"
    && f.type !== "video" && f.type !== "audio" && f.type !== "folder"
  );

  const parts: Array<{ type: string; [key: string]: unknown }> = [];

  let contextText = text;

  // inject extracted text files / PDFs as context
  for (const f of textFiles) {
    const label = f.type === "pdf" ? `[PDF: ${f.name}, ${f.pages} page(s)]` : `[File: ${f.name}]`;
    contextText += `\n\n${label}\n\`\`\`\n${f.content}${f.truncated ? "\n\n[...truncated...]" : ""}\n\`\`\``;
  }

  // inject video/audio metadata
  for (const f of [...videoFiles, ...audioFiles]) {
    contextText += `\n\n[${f.type === "video" ? "Video" : "Audio"} file attached: ${f.name} (${f.size_human || f.size + " B"})]`;
    if (f.type === "video" && f.frames && f.frames.length > 0) {
      contextText += ` — ${f.frames.length} key frame(s) extracted and included below.`;
    } else if (f.type === "video") {
      contextText += " — frame extraction not available; please analyse based on filename/context.";
    }
  }

  for (const f of otherFiles) {
    contextText += `\n\n[Binary file attached: ${f.name} (${f.ext}, ${f.size} bytes)]`;
  }

  // if there are images (or video frames), use multipart content
  const allImages: string[] = [
    ...imageFiles.map(f => f.dataUrl!),
    ...videoFiles.flatMap(f => f.frames ?? []),
  ];

  if (allImages.length > 0) {
    parts.push({ type: "text", text: contextText });
    for (const url of allImages) {
      parts.push({ type: "image_url", image_url: { url, detail: "auto" } });
    }
    return parts;
  }

  return contextText;
}
