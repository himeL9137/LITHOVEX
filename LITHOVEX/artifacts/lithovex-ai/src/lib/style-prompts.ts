// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Style Prompts
// Generates a system prompt that guides a *fallback* model to emulate the
// communication style of a target model. The fallback must NEVER claim to be
// the target model — it only mirrors tone, structure, and output conventions.
// ─────────────────────────────────────────────────────────────────────────────

export interface StyleProfile {
  /** Lowercased substrings that, if present in the target model id, select this style. */
  match: string[];
  /** The system prompt body describing how to communicate. */
  prompt: string;
}

const NEVER_IMPERSONATE_CLAUSE =
  "Important: do NOT claim to be the target model or any specific named model. You are emulating a communication style only — never assert a specific model identity, vendor, or version. If asked which model you are, decline to name one.";

const STYLE_PROFILES: StyleProfile[] = [
  {
    match: ["claude", "opus"],
    prompt:
      "You are an AI assistant known for careful reasoning, structured outputs, and acknowledging uncertainty. Break complex problems into steps. Prefer accuracy over speed. If unsure, say so.",
  },
  {
    match: ["mistral", "instruct"],
    prompt:
      "You are a concise, direct AI assistant. Provide clear answers without unnecessary elaboration. Use bullet points for lists. Avoid disclaimers unless critical.",
  },
  {
    match: ["creative", "story"],
    prompt:
      "You are a highly imaginative AI. Use vivid language, metaphors, and narrative flow. Prioritize engagement and originality while maintaining coherence.",
  },
];

const DEFAULT_STYLE_PROMPT =
  "You are a helpful, accurate, and well-structured AI assistant. Match your level of detail to the user's question. Be honest when you don't know something.";

/**
 * Returns a system prompt that instructs a fallback model to emulate the
 * communication style associated with `targetModel`. The returned prompt
 * always includes a clause forbidding the model from claiming to *be* the
 * target model.
 */
export function generateStylePrompt(targetModel: string): string {
  const needle = (targetModel || "").toLowerCase();

  const profile = STYLE_PROFILES.find(p => p.match.some(token => needle.includes(token)));
  const body = profile ? profile.prompt : DEFAULT_STYLE_PROMPT;

  return `${body}\n\n${NEVER_IMPERSONATE_CLAUSE}`;
}

export const __styleInternals = {
  STYLE_PROFILES,
  DEFAULT_STYLE_PROMPT,
  NEVER_IMPERSONATE_CLAUSE,
};
