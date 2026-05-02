#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Validate src/config/model-mapping.json against OpenRouter's /models endpoint.
//
// For each entry that declares an `openrouter_model_id`, this script verifies
// that the id is present in the live OpenRouter catalog. Entries without
// `openrouter_model_id` are skipped (and reported as INFO).
//
// Usage:
//   node scripts/validate-model-mapping.mjs
//   node scripts/validate-model-mapping.mjs --json     # machine-readable output
//   node scripts/validate-model-mapping.mjs --strict   # exit 1 on any warning
//
// Optional env: OPENROUTER_API_KEY (the /models endpoint is public, but a key
// avoids per-IP rate limits if you run the script frequently in CI).
// ─────────────────────────────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAPPING_PATH = resolve(__dirname, "../src/config/model-mapping.json");
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const args = new Set(process.argv.slice(2));
const JSON_OUTPUT = args.has("--json");
const STRICT = args.has("--strict");

function color(code, s) {
  if (JSON_OUTPUT || !process.stdout.isTTY) return s;
  return `\x1b[${code}m${s}\x1b[0m`;
}
const red = (s) => color(31, s);
const green = (s) => color(32, s);
const yellow = (s) => color(33, s);
const dim = (s) => color(2, s);

async function loadMapping() {
  const raw = await readFile(MAPPING_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${MAPPING_PATH}: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected ${MAPPING_PATH} to contain a JSON object.`);
  }
  return parsed;
}

async function fetchOpenRouterModels() {
  const headers = { "Accept": "application/json" };
  if (process.env.OPENROUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  let res;
  try {
    res = await fetch(OPENROUTER_MODELS_URL, { headers, signal: ctrl.signal });
  } catch (err) {
    throw new Error(`Network error contacting OpenRouter: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter returned HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const ids = new Set();
  for (const m of list) {
    if (m && typeof m.id === "string") ids.add(m.id);
  }
  if (ids.size === 0) {
    throw new Error("OpenRouter returned an empty model list — refusing to validate against an empty catalog.");
  }
  return ids;
}

function validate(mapping, openrouterIds) {
  const results = [];

  for (const [name, entry] of Object.entries(mapping)) {
    if (!entry || typeof entry !== "object") {
      results.push({ name, level: "error", message: "Entry is not an object" });
      continue;
    }
    if (typeof entry.primary !== "string") {
      results.push({ name, level: "error", message: "Missing or invalid `primary` field" });
    }
    if (!Array.isArray(entry.fallbacks)) {
      results.push({ name, level: "error", message: "Missing or invalid `fallbacks` array" });
    }

    const orId = entry.openrouter_model_id;
    if (orId === undefined || orId === null || orId === "") {
      const declaresOpenRouterFallback =
        entry.primary === "openrouter" ||
        (Array.isArray(entry.fallbacks) && entry.fallbacks.includes("openrouter"));
      if (declaresOpenRouterFallback) {
        results.push({
          name,
          level: "warn",
          message: "Declares OpenRouter as primary/fallback but has no `openrouter_model_id` — that fallback will be unreachable.",
        });
      } else {
        results.push({ name, level: "info", message: "No `openrouter_model_id` declared; skipping OpenRouter check." });
      }
      continue;
    }

    if (typeof orId !== "string") {
      results.push({ name, level: "error", message: "`openrouter_model_id` must be a string" });
      continue;
    }

    if (openrouterIds.has(orId)) {
      results.push({ name, level: "ok", message: `OpenRouter id "${orId}" is valid.` });
    } else {
      results.push({
        name,
        level: "error",
        message: `OpenRouter id "${orId}" was NOT found in the live catalog.`,
      });
    }
  }

  return results;
}

function summarize(results) {
  const counts = { ok: 0, info: 0, warn: 0, error: 0 };
  for (const r of results) counts[r.level] = (counts[r.level] ?? 0) + 1;
  return counts;
}

function printHuman(results, counts) {
  for (const r of results) {
    const tag =
      r.level === "ok"    ? green("OK   ") :
      r.level === "info"  ? dim("INFO ") :
      r.level === "warn"  ? yellow("WARN ") :
                            red("ERR  ");
    console.log(`${tag} ${r.name.padEnd(28)} ${r.message}`);
  }
  console.log("");
  console.log(
    `Summary: ${green(counts.ok + " ok")}, ` +
    `${dim(counts.info + " info")}, ` +
    `${yellow(counts.warn + " warn")}, ` +
    `${red(counts.error + " error")}`,
  );
}

async function main() {
  const mapping = await loadMapping();
  const openrouterIds = await fetchOpenRouterModels();
  const results = validate(mapping, openrouterIds);
  const counts = summarize(results);

  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ counts, results }, null, 2));
  } else {
    printHuman(results, counts);
  }

  if (counts.error > 0) process.exit(1);
  if (STRICT && counts.warn > 0) process.exit(1);
}

main().catch((err) => {
  console.error(red(`validate-model-mapping failed: ${err.message}`));
  process.exit(2);
});
