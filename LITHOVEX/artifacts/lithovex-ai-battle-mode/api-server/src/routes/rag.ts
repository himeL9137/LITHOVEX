// REST surface for the document knowledge base.
//
//   GET    /api/rag/docs            → list indexed documents
//   POST   /api/rag/index           → { name, text, source?, docId? }
//   DELETE /api/rag/docs/:docId     → remove a document
//   POST   /api/rag/clear           → wipe everything
//   POST   /api/rag/query           → { query, k? } → { hits }

import { Router, type IRouter, type Request, type Response } from "express";
import {
  clearAllDocs,
  indexDocument,
  listDocs,
  queryRag,
  removeDoc,
} from "../lib/rag";

const router: IRouter = Router();

router.get("/docs", (_req: Request, res: Response) => {
  res.json({ docs: listDocs() });
});

router.post("/index", (req: Request, res: Response) => {
  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  const text = String(body.text ?? "");
  if (!name || !text.trim()) {
    res.status(400).json({ error: "name and text are required" });
    return;
  }
  const doc = indexDocument({
    name,
    text,
    source: body.source ? String(body.source) : "paste",
    docId: body.docId ? String(body.docId) : undefined,
  });
  res.json({ doc });
});

router.delete("/docs/:docId", (req: Request, res: Response) => {
  const docId = String(req.params["docId"] ?? "");
  const removed = removeDoc(docId);
  res.json({ removed });
});

router.post("/clear", (_req: Request, res: Response) => {
  clearAllDocs();
  res.json({ cleared: true });
});

router.post("/query", (req: Request, res: Response) => {
  const body = req.body ?? {};
  const query = String(body.query ?? "").trim();
  const k = Number(body.k ?? 4);
  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }
  const hits = queryRag(query, Number.isFinite(k) ? k : 4);
  res.json({ hits });
});

export default router;
