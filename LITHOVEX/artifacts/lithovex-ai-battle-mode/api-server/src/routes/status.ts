// LITHOVEX-CORE — Startup Status Endpoint.
//
// Implements Section 11 of the master prompt: returns a single snapshot
// the frontend banner can render as
//   "🧠 LITHOVEX-CORE online. 📡 Tokens: N/9 active | 🤖 Models: 206 |
//    🔗 Repo: ... | ⚡ Failover: Armed"

import { Router, type IRouter, type Request, type Response } from "express";
import { getKeySnapshot } from "../lib/hf-keys";
import { getProviderSnapshot } from "../lib/provider-keys";
import { getModelSnapshot } from "../lib/model-health";
import { DEFAULT_MODEL, MODEL_COUNT, listKnownModels } from "../lib/model-registry";
import { readAuth } from "../lib/github-store";

const router: IRouter = Router();

router.get("/", (_req: Request, res: Response) => {
  const keys = getKeySnapshot();
  const configured = keys.filter((k) => k.configured);
  const active = configured.filter((k) => k.status === "active").length;
  const ratelimited = configured.filter((k) => k.status === "rate_limited").length;
  const expired = configured.filter((k) => k.status === "expired").length;
  const degraded = configured.filter((k) => k.status === "degraded").length;
  const cooling = configured.filter((k) => k.status === "cooling_down").length;

  const modelHealth = getModelSnapshot();
  const known = listKnownModels();
  const downModels = modelHealth.filter((m) => m.status === "down").length;
  const degradedModels = modelHealth.filter((m) => m.status === "degraded").length;

  const auth = readAuth();
  const repo = auth?.user
    ? { connected: true, login: auth.user.login, name: auth.user.name }
    : { connected: false, login: null, name: null };

  // ── Provider snapshots: OpenRouter (primary), Gemini (secondary) ─────
  const orSlots = getProviderSnapshot("openrouter");
  const geminiSlots = getProviderSnapshot("gemini");
  const summarise = (slots: typeof orSlots) => {
    const cfg = slots.filter((s) => s.configured);
    return {
      total: cfg.length,
      max: slots.length,
      active: cfg.filter((s) => s.status === "active").length,
      rate_limited: cfg.filter((s) => s.status === "rate_limited").length,
      cooling_down: cfg.filter((s) => s.status === "cooling_down").length,
      degraded: cfg.filter((s) => s.status === "degraded").length,
      expired: cfg.filter((s) => s.status === "expired").length,
      slots,
    };
  };
  const orProvider = summarise(orSlots);
  const geminiProvider = summarise(geminiSlots);

  let failover: "armed" | "degraded" | "down";
  const totalActiveAcrossProviders =
    active + orProvider.active + geminiProvider.active;
  if (totalActiveAcrossProviders === 0) failover = "down";
  else if (degraded > 0 || ratelimited > 0 || downModels > 0) failover = "degraded";
  else failover = "armed";

  // Public banner — intentionally vague about counts, models, and tokens.
  // Internal metrics (tokens.*, models.*) below remain available for ops/admin
  // tooling but the user-facing chip should not surface them.
  const banner =
    `🧠 LITHOVEX online · ` +
    `🔗 Repo: ${repo.connected ? repo.login : "Not connected"} · ` +
    `⚡ Failover: ${failover === "armed" ? "Armed and ready" : failover}`;

  res.json({
    online: true,
    banner,
    tokens: {
      total: configured.length,
      max: 11,
      active,
      rate_limited: ratelimited,
      cooling_down: cooling,
      degraded,
      expired,
      slots: keys,
      providers: {
        openrouter: orProvider,
        gemini: geminiProvider,
        huggingface: {
          total: configured.length,
          max: 11,
          active,
          rate_limited: ratelimited,
          cooling_down: cooling,
          degraded,
          expired,
          slots: keys,
        },
      },
    },
    models: {
      count: MODEL_COUNT,
      curated: known.length,
      primary: DEFAULT_MODEL,
      down: downModels,
      degraded: degradedModels,
      health: modelHealth,
    },
    repo,
    failover,
  });
});

export default router;
