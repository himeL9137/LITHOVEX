import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "api keys.env") });

export const PORT = process.env.PORT ?? "5000";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "Qwen/Qwen2.5-Coder-32B-Instruct";

export const HUGGINGFACE_API_KEYS = [
  process.env.HUGGINGFACE_API_KEY_1,
  process.env.HUGGINGFACE_API_KEY_2,
  process.env.HUGGINGFACE_API_KEY_3,
  process.env.HUGGINGFACE_API_KEY_4,
  process.env.HUGGINGFACE_API_KEY_5,
  process.env.HUGGINGFACE_API_KEY_6,
  process.env.HUGGINGFACE_API_KEY_7,
  process.env.HUGGINGFACE_API_KEY_8,
  process.env.HUGGINGFACE_API_KEY_9,
  process.env.HUGGINGFACE_API_KEY_10,
  process.env.HUGGINGFACE_API_KEY_11,
].filter(Boolean) as string[];

export const OPENROUTER_API_KEYS = [
  process.env.OPENROUTER_API_KEY_1,
  process.env.OPENROUTER_API_KEY_2,
  process.env.OPENROUTER_API_KEY_3,
  process.env.OPENROUTER_API_KEY_4,
  process.env.OPENROUTER_API_KEY_5,
  process.env.OPENROUTER_API_KEY_6,
  process.env.OPENROUTER_API_KEY_7,
  process.env.OPENROUTER_API_KEY_8,
  process.env.OPENROUTER_API_KEY_9,
  process.env.OPENROUTER_API_KEY_10,
].filter(Boolean) as string[];

export const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
].filter(Boolean) as string[];

export const BLACKBOX_API_KEYS = {
  lithovex: process.env.BLACKBOX_API_KEY_LITHOVEX ?? "",
  default: process.env.BLACKBOX_API_KEY ?? "",
};

let huggingfaceIndex = 0;
let openrouterIndex = 0;
let geminiIndex = 0;

export function getNextHuggingFaceKey(): string {
  const key = HUGGINGFACE_API_KEYS[huggingfaceIndex % HUGGINGFACE_API_KEYS.length];
  huggingfaceIndex++;
  return key;
}

export function getNextOpenRouterKey(): string {
  const key = OPENROUTER_API_KEYS[openrouterIndex % OPENROUTER_API_KEYS.length];
  openrouterIndex++;
  return key;
}

export function getNextGeminiKey(): string {
  const key = GEMINI_API_KEYS[geminiIndex % GEMINI_API_KEYS.length];
  geminiIndex++;
  return key;
}
