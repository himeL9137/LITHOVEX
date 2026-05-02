// REST surface for built-in tools.
//
//   GET  /api/tools/list             → JSON-schema list of tools
//   POST /api/tools/web-search       → { query, max_results? }
//   POST /api/tools/calculator       → { expression }
//   POST /api/tools/fetch-url        → { url, max_chars? }
//   POST /api/tools/run              → { name, arguments } (generic)

import { Router, type IRouter, type Request, type Response } from "express";
import {
  TOOL_SCHEMAS,
  calculate,
  fetchUrl,
  runTool,
  webSearch,
} from "../lib/tools";

const router: IRouter = Router();

router.get("/list", (_req: Request, res: Response) => {
  res.json({ tools: TOOL_SCHEMAS });
});

router.post("/web-search", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const out = await webSearch(String(body.query ?? ""), Number(body.max_results ?? 5));
  if (!out.ok) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json({ results: out.result });
});

router.post("/calculator", (req: Request, res: Response) => {
  const out = calculate(String((req.body ?? {}).expression ?? ""));
  if (!out.ok) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json(out.result);
});

router.post("/fetch-url", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const out = await fetchUrl(String(body.url ?? ""), Number(body.max_chars ?? 4000));
  if (!out.ok) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json(out.result);
});

router.post("/run", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const name = String(body.name ?? "");
  const args =
    typeof body.arguments === "object" && body.arguments
      ? (body.arguments as Record<string, unknown>)
      : {};
  const out = await runTool(name, args);
  if (!out.ok) {
    res.status(400).json({ error: out.error });
    return;
  }
  res.json({ result: out.result });
});

export default router;
