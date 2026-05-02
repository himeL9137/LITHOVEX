/**
 * POST /api/images/generate
 *
 * Priority 1 — Blackbox.ai image generation:
 *   Uses the Blackbox API key pool (already registered in provider-keys.ts) to
 *   call https://api.blackbox.ai/api/generate-image. Blackbox automatically
 *   routes to the best available AI model (FLUX, SDXL, Playground, etc.) so
 *   no model-slug validation is needed on our side.
 *
 * Priority 2 — HuggingFace Inference API (fallback):
 *   If no Blackbox key is configured, or every Blackbox attempt fails, we fall
 *   through to the original HF Inference path (FLUX.1-schnell default) using
 *   the rotating HF token pool.
 *
 * Both paths return the same JSON shape:
 *   { model, data_url, bytes, content_type }
 * so the frontend never needs to know which backend was used.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { getAllKeys, recordKeyError, recordKeySuccess } from "../lib/hf-keys";
import {
  getProviderKeys,
  recordProviderSuccess,
  recordProviderError,
} from "../lib/provider-keys";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BLACKBOX_BASE = "https://api.blackbox.ai";
const HF_INFERENCE_BASE = "https://api-inference.huggingface.co/models";

const IMAGE_MODEL_PATTERN =
  /(^|\/)(flux|stable-diffusion|sdxl|sd-?xl|sd\d+\.?\d*|kandinsky|playground-v|pixart|dreamshaper|wuerstchen|deepfloyd|if-i-xl|hunyuan-?dit|aura-?flow|lumina|stable-?cascade)/i;

const DEFAULT_HF_MODEL = "black-forest-labs/FLUX.1-schnell";

interface GenerateBody {
  model?: string;
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
}

/**
 * Fetch a remote image URL and convert it to a base64 data URL.
 * Returns null if the fetch fails or the response is not an image.
 */
async function urlToDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Attempt image generation via Blackbox.ai.
 * Returns a data URL string on success, or null if all keys failed.
 */
async function tryBlackbox(
  prompt: string,
  hintModel?: string,
): Promise<{ dataUrl: string; model: string } | null> {
  const keys = getProviderKeys("blackbox");
  if (keys.length === 0) return null;

  for (const key of keys) {
    if (!key?.token) continue;

    let r: globalThis.Response;
    try {
      r = await fetch(`${BLACKBOX_BASE}/api/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${key.token}`,
          "X-Title": "LITHOVEX AI",
        },
        body: JSON.stringify({
          prompt,
          query: prompt,
          model: hintModel ?? "flux",
          agentMode: {},
          isMicMode: false,
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordProviderError("blackbox", key.index, "network", msg);
      logger.warn({ keyIndex: key.index, err: msg }, "blackbox image-gen network error");
      continue;
    }

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      const kind =
        r.status === 401 || r.status === 403
          ? "expired"
          : r.status === 429
          ? "rate_limited"
          : "server";
      recordProviderError("blackbox", key.index, kind, text.slice(0, 200));
      logger.warn(
        { keyIndex: key.index, status: r.status, body: text.slice(0, 120) },
        "blackbox image-gen upstream error",
      );
      continue;
    }

    const ct = r.headers.get("content-type") || "";

    // If Blackbox responds with raw binary image data
    if (ct.startsWith("image/")) {
      const buf = Buffer.from(await r.arrayBuffer());
      recordProviderSuccess("blackbox", key.index);
      return {
        dataUrl: `data:${ct};base64,${buf.toString("base64")}`,
        model: "blackbox/auto",
      };
    }

    // JSON response — Blackbox may return a URL or inline base64
    let data: any = null;
    try {
      data = await r.json();
    } catch {
      recordProviderError("blackbox", key.index, "server", "non-json response");
      continue;
    }

    // Shape 1: { url: "https://..." }
    const imageUrl: string | undefined =
      data?.url ?? data?.image_url ?? data?.imageUrl ?? data?.output?.url;

    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      const dataUrl = await urlToDataUrl(imageUrl);
      if (dataUrl) {
        recordProviderSuccess("blackbox", key.index);
        return { dataUrl, model: data?.model ?? "blackbox/auto" };
      }
    }

    // Shape 2: { image: "data:image/..." } or base64 string directly
    const inline: string | undefined =
      data?.image ?? data?.data_url ?? data?.b64_json ?? data?.output;

    if (inline && typeof inline === "string") {
      const dataUrl = inline.startsWith("data:")
        ? inline
        : `data:image/png;base64,${inline}`;
      recordProviderSuccess("blackbox", key.index);
      return { dataUrl, model: data?.model ?? "blackbox/auto" };
    }

    // Shape 3: Blackbox sometimes wraps a markdown image URL in a text response
    const text = typeof data === "string" ? data : (data?.response ?? data?.text ?? "");
    const mdMatch = typeof text === "string" && text.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
    if (mdMatch) {
      const dataUrl = await urlToDataUrl(mdMatch[1]);
      if (dataUrl) {
        recordProviderSuccess("blackbox", key.index);
        return { dataUrl, model: "blackbox/auto" };
      }
    }

    recordProviderError("blackbox", key.index, "server", "unrecognised response shape");
    logger.warn(
      { keyIndex: key.index, keys: Object.keys(data ?? {}) },
      "blackbox image-gen: unrecognised response shape",
    );
  }

  return null;
}

router.post("/generate", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as GenerateBody;
  const prompt = (body.prompt ?? "").toString().trim();
  const requestedModel = (body.model ?? DEFAULT_HF_MODEL).toString().trim();

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  // ── Priority 1: Blackbox.ai ──────────────────────────────────────────────
  // Blackbox auto-routes to the best image model, so we don't need to
  // validate model slugs. We pass the hint model in case Blackbox ever
  // exposes per-model selection, but the API may ignore it.
  const bbResult = await tryBlackbox(prompt, requestedModel).catch(() => null);
  if (bbResult) {
    logger.info({ model: bbResult.model }, "image-gen served by blackbox");
    const buf = Buffer.from(
      bbResult.dataUrl.replace(/^data:[^;]+;base64,/, ""),
      "base64",
    );
    res.json({
      model: bbResult.model,
      data_url: bbResult.dataUrl,
      bytes: buf.length,
      content_type: "image/png",
      provider: "blackbox",
    });
    return;
  }

  // ── Priority 2: HuggingFace Inference API (fallback) ────────────────────
  // Only allow known diffusion / flow-matching model families.
  if (!IMAGE_MODEL_PATTERN.test(requestedModel)) {
    res.status(400).json({
      error: `Model "${requestedModel}" does not support image generation. Pick a Stable Diffusion or FLUX model.`,
    });
    return;
  }

  const hfKeys = getAllKeys();
  if (hfKeys.length === 0) {
    res.status(503).json({
      error: "No image generation API keys configured on the server.",
    });
    return;
  }

  const parameters: Record<string, unknown> = {};
  if (typeof body.negative_prompt === "string" && body.negative_prompt.trim()) {
    parameters["negative_prompt"] = body.negative_prompt.trim();
  }
  if (typeof body.width === "number") parameters["width"] = body.width;
  if (typeof body.height === "number") parameters["height"] = body.height;
  if (typeof body.num_inference_steps === "number") {
    parameters["num_inference_steps"] = body.num_inference_steps;
  }
  if (typeof body.guidance_scale === "number") {
    parameters["guidance_scale"] = body.guidance_scale;
  }
  if (typeof body.seed === "number") parameters["seed"] = body.seed;

  const upstreamBody = JSON.stringify({
    inputs: prompt,
    parameters,
    options: { wait_for_model: true, use_cache: false },
  });

  let lastErrorStatus = 0;
  let lastErrorMessage = "All image generation providers failed.";

  for (let i = 0; i < hfKeys.length; i++) {
    const key = hfKeys[i];
    if (!key?.token) continue;

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(
        `${HF_INFERENCE_BASE}/${encodeURI(requestedModel)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "image/png",
            Authorization: `Bearer ${key.token}`,
            "X-Wait-For-Model": "true",
          },
          body: upstreamBody,
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recordKeyError(key.index, "network", message);
      lastErrorStatus = 0;
      lastErrorMessage = `Network error contacting HF (${message}).`;
      continue;
    }

    if (upstream.ok) {
      const contentType = upstream.headers.get("content-type") || "image/png";
      if (contentType.startsWith("application/json")) {
        const json = await upstream.json().catch(() => null);
        const message =
          (json && typeof (json as any).error === "string"
            ? (json as any).error
            : null) ?? "Upstream returned JSON instead of an image.";
        recordKeyError(key.index, "server", message);
        lastErrorStatus = 502;
        lastErrorMessage = message;
        continue;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      const b64 = buf.toString("base64");
      const dataUrl = `data:${contentType};base64,${b64}`;
      recordKeySuccess(key.index);

      res.json({
        model: requestedModel,
        data_url: dataUrl,
        bytes: buf.length,
        content_type: contentType,
        provider: "huggingface",
      });
      return;
    }

    const text = await upstream.text().catch(() => "");
    const errKind: "expired" | "rate_limited" | "server" =
      upstream.status === 401 || upstream.status === 403
        ? "expired"
        : upstream.status === 429
        ? "rate_limited"
        : "server";
    recordKeyError(key.index, errKind, text.slice(0, 200));
    lastErrorStatus = upstream.status;

    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* not json */
    }
    if (parsed && typeof parsed.error === "string") {
      lastErrorMessage = parsed.error;
    } else if (text) {
      lastErrorMessage = text.slice(0, 240);
    } else {
      lastErrorMessage = `HF returned HTTP ${upstream.status}.`;
    }

    logger.warn(
      { model: requestedModel, keyIndex: key.index, status: upstream.status },
      "image-gen HF upstream failed",
    );

    if (
      upstream.status !== 401 &&
      upstream.status !== 403 &&
      upstream.status !== 404 &&
      upstream.status !== 429 &&
      upstream.status >= 400 &&
      upstream.status < 500
    ) {
      break;
    }
  }

  res
    .status(lastErrorStatus >= 400 ? lastErrorStatus : 502)
    .json({ error: lastErrorMessage });
});

export default router;
