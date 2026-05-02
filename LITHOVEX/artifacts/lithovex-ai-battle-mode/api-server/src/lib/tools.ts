// LITHOVEX-CORE — Tool use (function calling).
//
// Exposes three small, dependency-free tools that the assistant (and the
// frontend, via /api/tools/*) can invoke:
//
//   * web_search(query)   — DuckDuckGo HTML scrape, top N results.
//   * calculator(expr)    — Safe arithmetic evaluator (no `eval`).
//   * fetch_url(url)      — GET a URL and return cleaned plaintext.
//
// All tools have the same shape: `{ ok: true, result } | { ok: false, error }`
// so the chat tool-call loop can serialize them uniformly.

export interface ToolOk<T = unknown> {
  ok: true;
  result: T;
}
export interface ToolErr {
  ok: false;
  error: string;
}
export type ToolResult<T = unknown> = ToolOk<T> | ToolErr;

// JSON-schema descriptions consumed by both the OpenAI-compatible
// function-calling protocol AND by /api/tools/list for the frontend.
export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Search the public web for up-to-date information using DuckDuckGo. Use when the user asks about current events, recent releases, prices, news, or any fact that may have changed after training.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Concise search query, like a Google search.",
          },
          max_results: {
            type: "integer",
            description: "How many results to return (1-10).",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculator",
      description:
        "Evaluate a numeric arithmetic expression. Supports + - * / ^ () and standard math functions (sqrt, sin, cos, tan, log, ln, abs, min, max, floor, ceil, round, pi, e). Use this for any non-trivial arithmetic instead of doing it in your head.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Arithmetic expression." },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_url",
      description:
        "Fetch a URL and return the cleaned plaintext content (HTML stripped). Use to read a specific page the user mentioned, or to follow up on a search result.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute http(s) URL." },
          max_chars: {
            type: "integer",
            description: "Truncate the returned text after this many chars.",
            default: 4000,
          },
        },
        required: ["url"],
      },
    },
  },
];

export type ToolName = "web_search" | "calculator" | "fetch_url";

// ─── 1. Web search (DuckDuckGo HTML) ───────────────────────────────────

const DDG_HTML = "https://html.duckduckgo.com/html/";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<ToolResult<WebSearchResult[]>> {
  const q = (query || "").trim();
  if (!q) return { ok: false, error: "query is required" };
  const limit = Math.max(1, Math.min(10, Math.floor(maxResults || 5)));

  try {
    const form = new URLSearchParams({ q, kl: "us-en" }).toString();
    const r = await fetch(DDG_HTML, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // DDG returns a cleaner page when we look like a real browser.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      body: form,
    });
    if (!r.ok) {
      return { ok: false, error: `DuckDuckGo HTTP ${r.status}` };
    }
    const html = await r.text();

    // Each result is in a <div class="result"> ... <a class="result__a"
    // href="..."> title </a> ... <a class="result__snippet"> snippet </a>
    const results: WebSearchResult[] = [];
    const blockRx = /<div class="result\b[\s\S]*?<\/div>\s*<\/div>/g;
    const titleRx = /<a [^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
    const snippetRx = /<a [^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

    for (const block of html.match(blockRx) ?? []) {
      const t = block.match(titleRx);
      if (!t) continue;
      let url = decodeHtmlEntities(t[1] ?? "");
      // DDG wraps real URLs in /l/?uddg=<encoded>. Unwrap it.
      const uddg = url.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try {
          url = decodeURIComponent(uddg[1] ?? "");
        } catch {
          /* keep original */
        }
      }
      const title = stripTags(t[2] ?? "");
      const sm = block.match(snippetRx);
      const snippet = sm ? stripTags(sm[1] ?? "") : "";
      if (title && url.startsWith("http")) {
        results.push({ title, url, snippet });
        if (results.length >= limit) break;
      }
    }

    return { ok: true, result: results };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "web_search failed",
    };
  }
}

// ─── 2. Calculator (safe arithmetic evaluator) ─────────────────────────
//
// Hand-rolled shunting-yard parser → no `eval`, no `new Function`, no
// runtime dependencies. Supports: + - * / % ^, unary minus, parentheses,
// constants (pi, e), and a small set of single-arg functions (sqrt, sin,
// cos, tan, log, ln, abs, exp, floor, ceil, round) plus min/max.

const FUNCS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  abs: Math.abs,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" }
  | { t: "ident"; v: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = src.trim();
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.eE+\-]/.test(s[j]!)) {
        // Be careful not to swallow a binary +/- after a digit. Only consume
        // +/- when it's part of an exponent (e.g. 1e-5).
        if ((s[j] === "+" || s[j] === "-") && !/[eE]/.test(s[j - 1] ?? "")) {
          break;
        }
        j += 1;
      }
      const numStr = s.slice(i, j);
      const v = Number(numStr);
      if (!Number.isFinite(v)) {
        throw new Error(`bad number "${numStr}"`);
      }
      tokens.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j]!)) j += 1;
      tokens.push({ t: "ident", v: s.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if ("+-*/%^".includes(c)) {
      tokens.push({ t: "op", v: c });
      i += 1;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lp" });
      i += 1;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rp" });
      i += 1;
      continue;
    }
    if (c === ",") {
      tokens.push({ t: "comma" });
      i += 1;
      continue;
    }
    throw new Error(`unexpected character "${c}"`);
  }
  return tokens;
}

interface Parser {
  toks: Token[];
  pos: number;
}

function peek(p: Parser): Token | null {
  return p.toks[p.pos] ?? null;
}
function consume(p: Parser): Token {
  const tok = p.toks[p.pos];
  if (!tok) throw new Error("unexpected end of expression");
  p.pos += 1;
  return tok;
}

function parseExpr(p: Parser): number {
  return parseAdd(p);
}
function parseAdd(p: Parser): number {
  let left = parseMul(p);
  while (true) {
    const t = peek(p);
    if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
      consume(p);
      const right = parseMul(p);
      left = t.v === "+" ? left + right : left - right;
    } else break;
  }
  return left;
}
function parseMul(p: Parser): number {
  let left = parsePow(p);
  while (true) {
    const t = peek(p);
    if (t && t.t === "op" && (t.v === "*" || t.v === "/" || t.v === "%")) {
      consume(p);
      const right = parsePow(p);
      if (t.v === "*") left = left * right;
      else if (t.v === "/") left = left / right;
      else left = left % right;
    } else break;
  }
  return left;
}
function parsePow(p: Parser): number {
  const base = parseUnary(p);
  const t = peek(p);
  if (t && t.t === "op" && t.v === "^") {
    consume(p);
    const exp = parsePow(p); // right-associative
    return Math.pow(base, exp);
  }
  return base;
}
function parseUnary(p: Parser): number {
  const t = peek(p);
  if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
    consume(p);
    const v = parseUnary(p);
    return t.v === "-" ? -v : v;
  }
  return parsePrimary(p);
}
function parsePrimary(p: Parser): number {
  const t = consume(p);
  if (t.t === "num") return t.v;
  if (t.t === "lp") {
    const v = parseExpr(p);
    const close = consume(p);
    if (close.t !== "rp") throw new Error('expected ")"');
    return v;
  }
  if (t.t === "ident") {
    const next = peek(p);
    if (next && next.t === "lp") {
      consume(p); // (
      const args: number[] = [];
      const after = peek(p);
      if (!after || after.t !== "rp") {
        args.push(parseExpr(p));
        while (true) {
          const sep = peek(p);
          if (sep && sep.t === "comma") {
            consume(p);
            args.push(parseExpr(p));
          } else break;
        }
      }
      const close = consume(p);
      if (close.t !== "rp") throw new Error('expected ")"');
      const fn = FUNCS[t.v];
      if (!fn) throw new Error(`unknown function "${t.v}"`);
      return fn(...args);
    }
    if (t.v in CONSTS) return CONSTS[t.v]!;
    throw new Error(`unknown identifier "${t.v}"`);
  }
  throw new Error(`unexpected token`);
}

export function calculate(expression: string): ToolResult<{
  expression: string;
  value: number;
}> {
  const expr = (expression || "").trim();
  if (!expr) return { ok: false, error: "expression is required" };
  if (expr.length > 500) return { ok: false, error: "expression too long" };
  try {
    const toks = tokenize(expr);
    const parser: Parser = { toks, pos: 0 };
    const value = parseExpr(parser);
    if (parser.pos !== toks.length) {
      throw new Error("trailing characters in expression");
    }
    if (!Number.isFinite(value)) {
      return { ok: false, error: "result is not finite" };
    }
    return { ok: true, result: { expression: expr, value } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "calculator failed",
    };
  }
}

// ─── 3. Fetch URL (cleaned plaintext) ──────────────────────────────────

export async function fetchUrl(
  url: string,
  maxChars = 4000,
): Promise<ToolResult<{ url: string; title: string; text: string }>> {
  const u = (url || "").trim();
  if (!/^https?:\/\//i.test(u)) {
    return { ok: false, error: "url must start with http(s)://" };
  }
  const cap = Math.max(200, Math.min(20_000, Math.floor(maxChars || 4000)));
  try {
    const r = await fetch(u, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LITHOVEX-AI/1.0; +https://lithovex.ai)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
      },
      redirect: "follow",
    });
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status}` };
    }
    const ctype = (r.headers.get("content-type") || "").toLowerCase();
    const raw = await r.text();
    let title = "";
    let text = raw;
    if (ctype.includes("html") || /<html/i.test(raw)) {
      const tm = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      title = tm ? stripTags(tm[1] ?? "") : "";
      // Drop nav/script/style first, then strip remaining tags.
      const cleaned = raw
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
      text = stripTags(cleaned);
    } else {
      text = raw.replace(/\s+/g, " ").trim();
    }
    if (text.length > cap) text = text.slice(0, cap) + "…";
    return { ok: true, result: { url: u, title, text } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fetch_url failed",
    };
  }
}

// Generic dispatcher used by the chat tool-call loop.
export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "web_search":
      return webSearch(
        String(args["query"] ?? ""),
        Number(args["max_results"] ?? 5),
      );
    case "calculator":
      return calculate(String(args["expression"] ?? ""));
    case "fetch_url":
      return fetchUrl(
        String(args["url"] ?? ""),
        Number(args["max_chars"] ?? 4000),
      );
    default:
      return { ok: false, error: `unknown tool "${name}"` };
  }
}
