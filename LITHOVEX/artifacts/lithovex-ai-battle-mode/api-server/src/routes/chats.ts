import { Router, type IRouter, type Request, type Response } from "express";
import { chatStore, type ChatMessage } from "../lib/store";

const router: IRouter = Router();

function sanitizeMessages(value: unknown): ChatMessage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ChatMessage[] = [];
  for (const m of value) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    // Allow string OR array (multipart) content; serialize array to string for storage.
    const stored: string =
      typeof content === "string"
        ? content
        : content == null
          ? ""
          : JSON.stringify(content);
    out.push({ role, content: stored });
  }
  return out;
}

router.get("/", (_req: Request, res: Response) => {
  res.json({ chats: chatStore.list() });
});

router.post("/", (req: Request, res: Response) => {
  const body = req.body ?? {};
  const title = typeof body.title === "string" ? body.title : "New Chat";
  const messages = sanitizeMessages(body.messages);
  const chat = chatStore.create({ title, messages });
  res.status(201).json(chat);
});

router.get("/:id", (req: Request, res: Response) => {
  const chat = chatStore.get(req.params.id);
  if (!chat) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  res.json(chat);
});

function handleUpdate(req: Request, res: Response) {
  const body = req.body ?? {};
  const data = body.data ?? body;
  const patch: { title?: string | null; messages?: ChatMessage[] } = {};
  if (typeof data.title === "string" || data.title === null) {
    patch.title = data.title;
  }
  const messages = sanitizeMessages(data.messages);
  if (messages) patch.messages = messages;
  const updated = chatStore.update(req.params.id, patch);
  if (!updated) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  res.json(updated);
}

router.put("/:id", handleUpdate);
router.patch("/:id", handleUpdate);

router.delete("/:id", (req: Request, res: Response) => {
  const ok = chatStore.remove(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Chat not found" });
    return;
  }
  res.status(204).end();
});

export default router;
