// REST surface for the cross-session memory store.
//
//   GET    /api/memory/profile           → list facts
//   POST   /api/memory/profile           → { text } add fact
//   DELETE /api/memory/profile/:id       → remove fact
//   POST   /api/memory/profile/clear     → wipe all facts
//   GET    /api/memory/summary/:chatId   → get summary
//   PUT    /api/memory/summary/:chatId   → { summary, upToMessageIndex }
//   DELETE /api/memory/summary/:chatId   → drop summary

import { Router, type IRouter, type Request, type Response } from "express";
import {
  addProfileFact,
  clearChatSummary,
  clearProfile,
  getChatSummary,
  listProfileFacts,
  removeProfileFact,
  setChatSummary,
} from "../lib/memory";

const router: IRouter = Router();

router.get("/profile", (_req: Request, res: Response) => {
  res.json({ facts: listProfileFacts() });
});

router.post("/profile", (req: Request, res: Response) => {
  const text = String((req.body ?? {}).text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const fact = addProfileFact(text);
  if (!fact) {
    res.json({ added: false, facts: listProfileFacts() });
    return;
  }
  res.json({ added: true, fact, facts: listProfileFacts() });
});

router.delete("/profile/:id", (req: Request, res: Response) => {
  const id = String(req.params["id"] ?? "");
  const removed = removeProfileFact(id);
  res.json({ removed, facts: listProfileFacts() });
});

router.post("/profile/clear", (_req: Request, res: Response) => {
  clearProfile();
  res.json({ cleared: true });
});

router.get("/summary/:chatId", (req: Request, res: Response) => {
  const chatId = String(req.params["chatId"] ?? "");
  res.json({ summary: getChatSummary(chatId) });
});

router.put("/summary/:chatId", (req: Request, res: Response) => {
  const chatId = String(req.params["chatId"] ?? "");
  const body = req.body ?? {};
  const text = String(body.summary ?? "").trim();
  const upToIdx = Number(body.upToMessageIndex ?? 0);
  if (!chatId || !text) {
    res.status(400).json({ error: "chatId and summary are required" });
    return;
  }
  const record = setChatSummary(chatId, text, Number.isFinite(upToIdx) ? upToIdx : 0);
  res.json({ summary: record });
});

router.delete("/summary/:chatId", (req: Request, res: Response) => {
  const chatId = String(req.params["chatId"] ?? "");
  clearChatSummary(chatId);
  res.json({ cleared: true });
});

export default router;
