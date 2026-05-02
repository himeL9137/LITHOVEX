/**
 * Image-generation model registry & helpers.
 *
 * The Tools popover exposes an "Image Generation" toggle. When it's flipped
 * on, the homepage skips the normal /api/chat/completions path and instead
 * calls /api/images/generate (a thin wrapper around the HF Inference API)
 * using the currently selected model.
 *
 * Not every chat model can produce images — only diffusion / flow-matching
 * models such as FLUX.1, SDXL, SDXL-Turbo, SDXL-Lightning and SD 1.5. If the
 * user has a non-image model selected when they flip the toggle on, we toast
 * a warning and auto-switch them to the best available image model
 * (FLUX.1 Schnell — fastest, highest quality, runs in 1–4 steps).
 *
 * Keep this list aligned with the diffusion models registered in
 * `SettingsPanel.tsx` so that "everything that can generate, does".
 */

/**
 * Ordered by quality / preference. The first entry is the default fall-back
 * when we auto-switch a non-capable model.
 */
export const IMAGE_GEN_MODELS: readonly string[] = [
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "stabilityai/sdxl-turbo",
  "ByteDance/SDXL-Lightning",
  "runwayml/stable-diffusion-v1-5",
] as const;

/** Default we switch to when the current model can't generate images. */
export const BEST_IMAGE_GEN_MODEL = IMAGE_GEN_MODELS[0];

/** Friendly labels (used in toasts so users see "FLUX.1 Schnell" not the slug). */
const FRIENDLY_LABELS: Record<string, string> = {
  "black-forest-labs/FLUX.1-schnell": "FLUX.1 Schnell",
  "stabilityai/stable-diffusion-xl-base-1.0": "Stable Diffusion XL 1.0",
  "stabilityai/sdxl-turbo": "SDXL Turbo",
  "ByteDance/SDXL-Lightning": "SDXL Lightning",
  "runwayml/stable-diffusion-v1-5": "Stable Diffusion 1.5",
};

/**
 * Pattern-matches model IDs that we know support text-to-image. We use a
 * regex (in addition to the explicit list above) so newly-added diffusion
 * models from the same families are picked up automatically.
 */
const IMAGE_GEN_PATTERN =
  /(^|\/)(flux|stable-diffusion|sdxl|sd-?xl|sd\d+\.?\d*|kandinsky|playground-v|pixart|dall-?e|dalle|dreamshaper|wuerstchen|deepfloyd|if-i-xl|cosmos|hunyuan-?dit|aura-?flow|lumina|stable-?cascade)/i;

export function isImageGenModel(modelId: string | undefined | null): boolean {
  if (!modelId) return false;
  if (IMAGE_GEN_MODELS.includes(modelId)) return true;
  return IMAGE_GEN_PATTERN.test(modelId);
}

export function friendlyImageModelLabel(modelId: string): string {
  return FRIENDLY_LABELS[modelId] ?? modelId.split("/").pop() ?? modelId;
}

export interface ImageGenResult {
  /** Data URL ready to embed in markdown / <img>. */
  dataUrl: string;
  /** Model that actually produced the image (after any server-side fallback). */
  model: string;
  /** Width / height (best-effort, may be undefined if the upstream omits them). */
  width?: number;
  height?: number;
}

/**
 * Calls the api-server image-generation endpoint. Throws a humanized Error
 * on failure so the caller can surface it as a toast / chat error bubble.
 */
export async function generateImage(opts: {
  prompt: string;
  model: string;
  signal?: AbortSignal;
}): Promise<ImageGenResult> {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}/api/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({ model: opts.model, prompt: opts.prompt }),
  });

  if (!resp.ok) {
    let message = `Image generation failed (HTTP ${resp.status})`;
    try {
      const body = await resp.json();
      if (typeof body?.error === "string") message = body.error;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      try {
        const text = await resp.text();
        if (text) message = text.slice(0, 240);
      } catch { /* ignore */ }
    }
    throw new Error(message);
  }

  const data = await resp.json();
  if (!data?.data_url) throw new Error("Image service returned no image.");
  return {
    dataUrl: data.data_url as string,
    model: (data.model as string) ?? opts.model,
    width: typeof data.width === "number" ? data.width : undefined,
    height: typeof data.height === "number" ? data.height : undefined,
  };
}
