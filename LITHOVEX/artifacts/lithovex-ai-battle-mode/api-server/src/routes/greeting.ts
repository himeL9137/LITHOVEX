// GET /api/greeting?name=<displayName>
//
// Returns a single short, random greeting line (one sentence, max ~120 chars).
// Tries the Gemini key pool first (rotates through keys on rate-limit / errors)
// and falls back to a curated local list so this endpoint always succeeds.

import { Router, type IRouter } from "express";
import {
  getProviderKeys,
  recordProviderError,
  recordProviderSuccess,
} from "../lib/provider-keys";
import { callGeminiOnce } from "../lib/provider-callers";

const router: IRouter = Router();

const FALLBACK_LINES = [
  "the night feels unusually quiet today, like the world pressed pause for a second.",
  "ever noticed how rain smells different depending on where you are?",
  "Wanna explore a city where nobody knows your name?",
  "octopuses have three hearts and blue blood, pretty wild right?",
  "if you could time travel once, would you go forward or back?",
  "Buy me a cup of coffee will ya? I'll tell you a secret in return.",
  "honey never spoils, jars found in ancient tombs are still edible.",
  "sometimes the smallest decisions change everything in ways we never see.",
  "Wanna just disappear into the mountains for a week?",
  "sharks existed before trees, imagine that timeline.",
  "the brain can generate enough electricity to power a small light bulb.",
  "what's the most random memory you still remember clearly?",
  "Wanna race through an empty highway at midnight?",
  "bananas are technically berries, but strawberries aren't.",
  "ever feel like you're the main character in a quiet scene?",
  "the moon is slowly drifting away from Earth every year.",
  "Wanna build something crazy just for fun?",
  "your fingerprints are unique, even identical twins don't share them.",
  "if silence had a color, what do you think it would be?",
  "somewhere out there, someone is having the best day of their life right now.",
  "a day on Venus is longer than a year on Venus, time gets weird out there.",
  "Wanna chase a sunset until it actually catches you?",
  "your stomach gets a new lining every few days, you're constantly rebuilding.",
  "what would your ten-year-old self think of who you are today?",
  "octopi can taste with their arms, imagine ordering food like that.",
  "Wanna invent a word that doesn't exist yet?",
  "lightning is five times hotter than the surface of the sun.",
  "sometimes the best ideas show up while you're doing absolutely nothing.",
  "Wanna stay up just to watch the sky shift colors at dawn?",
  "there are more possible chess games than atoms in the observable universe.",
];

function pickFallback(name: string): string {
  const line = FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];
  return name ? `Hey ${name} ${line}` : line.charAt(0).toUpperCase() + line.slice(1);
}

const SYSTEM_PROMPT =
  "You write a single short greeting line for a user opening the LITHOVEX AI app. " +
  "Style: casual, curious, sometimes a fun fact, sometimes a playful invitation, sometimes a quiet observation. " +
  "Rules: ONE sentence only, max 120 characters, no quotes, no emojis, no markdown, no preamble. " +
  "If a name is given, start with 'Hey <name>' (no comma after the name) then the line in lowercase. " +
  "Vary the vibe each time — never repeat the same opener.";

function buildUserPrompt(name: string): string {
  const seed = Math.random().toString(36).slice(2, 10);
  if (name) {
    return `Write one greeting line for a user named "${name}". Seed: ${seed}. Output just the line, nothing else.`;
  }
  return `Write one greeting line. Seed: ${seed}. Output just the line, nothing else.`;
}

function sanitizeLine(raw: string, name: string): string | null {
  let s = raw.trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
  s = s.split(/\r?\n/)[0]!.trim();
  if (!s) return null;
  if (s.length > 180) s = s.slice(0, 180).trim();
  if (name && !s.toLowerCase().startsWith(`hey ${name.toLowerCase()}`)) {
    s = `Hey ${name} ${s.charAt(0).toLowerCase() + s.slice(1)}`;
  }
  return s;
}

router.get("/", async (req, res) => {
  const rawName = typeof req.query.name === "string" ? req.query.name : "";
  const name = rawName.trim().slice(0, 40).replace(/[^\w.\- ]/g, "");

  const keys = getProviderKeys("gemini");
  if (keys.length === 0) {
    return res.json({ text: pickFallback(name), source: "fallback" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    for (const key of keys) {
      const result = await callGeminiOnce({
        model: "gemini-2.5-flash",
        token: key.token,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(name) },
        ],
        temperature: 1.1,
        max_tokens: 1024,
        signal: controller.signal,
      });

      if (result.ok) {
        const text =
          typeof result.message.content === "string" ? result.message.content : "";
        const cleaned = sanitizeLine(text, name);
        if (cleaned) {
          recordProviderSuccess("gemini", key.index);
          clearTimeout(timeout);
          return res.json({ text: cleaned, source: "gemini" });
        }
        recordProviderError("gemini", key.index, "server", "empty response");
        continue;
      }

      const status = result.status;
      if (status === 429) {
        recordProviderError("gemini", key.index, "rate_limited", result.message);
      } else if (status === 401 || status === 403) {
        recordProviderError("gemini", key.index, "expired", result.message);
      } else if (status === "network") {
        recordProviderError("gemini", key.index, "network", result.message);
      } else {
        recordProviderError("gemini", key.index, "server", result.message);
      }
    }
  } catch {
    /* fall through to fallback */
  } finally {
    clearTimeout(timeout);
  }

  return res.json({ text: pickFallback(name), source: "fallback" });
});

export default router;
