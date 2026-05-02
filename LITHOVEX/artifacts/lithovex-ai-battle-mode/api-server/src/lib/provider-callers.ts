// Upstream HTTP callers for OpenRouter and Gemini.
//
// Both return the same OpenAI-compatible response shape so chat.ts can
// dispatch through a single attempt() callback regardless of provider.

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const BLACKBOX_BASE = "https://api.blackbox.ai";

export interface UpstreamMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export type UpstreamCallResult =
  | {
      ok: true;
      message: UpstreamMessage;
      finishReason: string;
      raw: unknown;
    }
  | { ok: false; status: number | "network"; message: string };

interface CommonOpts {
  model: string;
  token: string;
  messages: UpstreamMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  signal: AbortSignal;
}

export interface OpenRouterOpts extends CommonOpts {
  withTools?: boolean;
  tools?: unknown;
  tool_choice?: unknown;
}

export async function callOpenRouterOnce(
  opts: OpenRouterOpts,
): Promise<UpstreamCallResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: false,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.top_p === "number") body.top_p = opts.top_p;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;
  if (opts.withTools && opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.tool_choice ?? "auto";
  }

  let r: Response;
  try {
    r = (await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${opts.token}`,
        "HTTP-Referer": "https://lithovex.ai",
        "X-Title": "LITHOVEX AI",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  const data = (await r.json().catch(() => null)) as any;
  const choice = data?.choices?.[0];
  const message = choice?.message as UpstreamMessage | undefined;
  if (!message) {
    return { ok: false, status: 502, message: "openrouter returned no message" };
  }
  return {
    ok: true,
    message,
    finishReason: String(choice?.finish_reason ?? "stop"),
    raw: data,
  };
}

// Streaming variant: returns the raw upstream Response so the caller can pipe
// the SSE body straight to the client. OpenRouter speaks OpenAI-compatible
// SSE so the existing stream pipe in chat.ts works unchanged.
export async function callOpenRouterStream(
  opts: Omit<OpenRouterOpts, "withTools" | "tools" | "tool_choice">,
): Promise<{ ok: true; response: Response } | { ok: false; status: number | "network"; message: string }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.top_p === "number") body.top_p = opts.top_p;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;

  let r: Response;
  try {
    r = (await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${opts.token}`,
        "HTTP-Referer": "https://lithovex.ai",
        "X-Title": "LITHOVEX AI",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  return { ok: true, response: r };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blackbox.ai — OpenAI-compatible chat completions endpoint.
// Base URL: https://api.blackbox.ai
// Auth   : Authorization: Bearer <BLACKBOX_API_KEY>
// Body   : standard OpenAI chat-completions JSON.
// ─────────────────────────────────────────────────────────────────────────────

export async function callBlackboxOnce(
  opts: CommonOpts,
): Promise<UpstreamCallResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: false,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.top_p === "number") body.top_p = opts.top_p;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;

  let r: Response;
  try {
    r = (await fetch(`${BLACKBOX_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${opts.token}`,
        "X-Title": "LITHOVEX AI",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  const data = (await r.json().catch(() => null)) as any;
  // Blackbox typically returns OpenAI-compatible {choices:[{message:{...}}]}.
  // A few of their model variants return a plain `{response: "..."} ` payload
  // or even a raw string — handle all three shapes.
  const choice = data?.choices?.[0];
  let message = choice?.message as UpstreamMessage | undefined;
  if (!message) {
    const fallbackText =
      typeof data === "string"
        ? data
        : typeof data?.response === "string"
        ? data.response
        : typeof data?.text === "string"
        ? data.text
        : typeof data?.output === "string"
        ? data.output
        : null;
    if (fallbackText != null) {
      message = { role: "assistant", content: fallbackText };
    }
  }
  if (!message) {
    return { ok: false, status: 502, message: "blackbox returned no message" };
  }
  return {
    ok: true,
    message,
    finishReason: String(choice?.finish_reason ?? "stop"),
    raw: data,
  };
}

export async function callBlackboxStream(
  opts: CommonOpts,
): Promise<
  | { ok: true; response: Response }
  | { ok: false; status: number | "network"; message: string }
> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.top_p === "number") body.top_p = opts.top_p;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;

  let r: Response;
  try {
    r = (await fetch(`${BLACKBOX_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${opts.token}`,
        "X-Title": "LITHOVEX AI",
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  return { ok: true, response: r };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────────────────────

export async function callGeminiOnce(opts: CommonOpts): Promise<UpstreamCallResult> {
  const systemParts: string[] = [];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const m of opts.messages) {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
    if (!text) continue;
    if (m.role === "system") {
      systemParts.push(text);
      continue;
    }
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text }] });
  }

  const body: Record<string, unknown> = { contents };
  if (systemParts.length) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }
  const generationConfig: Record<string, unknown> = {};
  if (typeof opts.temperature === "number") generationConfig.temperature = opts.temperature;
  if (typeof opts.top_p === "number") generationConfig.topP = opts.top_p;
  if (typeof opts.max_tokens === "number") generationConfig.maxOutputTokens = opts.max_tokens;
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.token)}`;

  let r: Response;
  try {
    r = (await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  const data = (await r.json().catch(() => null)) as any;
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p: any) => p?.text ?? "").join("");
  if (!text && !candidate) {
    return { ok: false, status: 502, message: "gemini returned no candidate" };
  }
  return {
    ok: true,
    message: { role: "assistant", content: text },
    finishReason: String(candidate?.finishReason ?? "STOP").toLowerCase(),
    raw: data,
  };
}
