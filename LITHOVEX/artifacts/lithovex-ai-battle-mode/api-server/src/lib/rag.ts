// LITHOVEX-CORE — Knowledge base / RAG.
//
// A tiny, dependency-free retrieval index for documents the user uploads
// or pastes in. Each document is broken into ~600-char chunks; retrieval
// uses normalized term-frequency (TF) with a stoplist + length penalty,
// which is good enough to surface the right chunk for a few hundred
// documents without bringing in a vector DB.
//
// Persistence: a JSON file alongside chats.json + memory.json. All chunks
// share one global namespace today (single-user system); when multi-user
// auth lands, swap the namespace key.

import fs from "node:fs";
import path from "node:path";

const DATA_FILE_CANDIDATES = [
  path.resolve(process.cwd(), "LITHOVEX/server/data/rag.json"),
  path.resolve(process.cwd(), "../../../server/data/rag.json"),
  path.resolve(process.cwd(), "server/data/rag.json"),
];

function pickDataFile(): string {
  for (const candidate of DATA_FILE_CANDIDATES) {
    const dir = path.dirname(candidate);
    try {
      if (fs.existsSync(dir)) return candidate;
    } catch {
      /* skip */
    }
  }
  const fallbackDir = path.resolve(process.cwd(), ".data");
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  return path.join(fallbackDir, "rag.json");
}

const DATA_FILE = pickDataFile();

export interface RagChunk {
  id: string;
  docId: string;
  docName: string;
  source: string; // "upload" | "paste" | etc.
  index: number; // chunk index within the doc
  text: string;
  // Term frequency map for this chunk (term → count).
  tf: Record<string, number>;
  // Total token count (used for normalization).
  tokens: number;
  createdAt: string;
}

export interface RagDoc {
  id: string;
  name: string;
  source: string;
  chunkCount: number;
  charCount: number;
  createdAt: string;
}

interface RagFile {
  docs: RagDoc[];
  chunks: RagChunk[];
}

let cache: RagFile | null = null;

function load(): RagFile {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<RagFile>;
      cache = {
        docs: Array.isArray(parsed.docs) ? parsed.docs : [],
        chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
      };
      return cache;
    }
  } catch {
    /* fall through */
  }
  cache = { docs: [], chunks: [] };
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(cache), "utf8");
  } catch (err) {
    console.error("[rag] failed to persist", err);
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Tokenization ─────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to",
  "in", "on", "at", "for", "with", "from", "by", "as", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "should", "could", "can", "may", "might", "must", "this",
  "that", "these", "those", "it", "its", "they", "them", "their", "i", "you",
  "your", "we", "our", "he", "she", "him", "her", "his", "hers", "not", "no",
  "yes", "so", "than", "such", "into", "about", "over", "under", "out", "up",
  "down", "off", "all", "any", "some", "more", "most", "other", "what",
  "which", "who", "when", "where", "why", "how",
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  const out: string[] = [];
  for (const m of lowered.matchAll(/[a-z0-9][a-z0-9_'-]{1,}/g)) {
    const tok = m[0];
    if (tok.length < 2 || tok.length > 32) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

function buildTf(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) {
    tf[t] = (tf[t] ?? 0) + 1;
  }
  return tf;
}

// ─── Chunking ─────────────────────────────────────────────────────────

const CHUNK_SIZE = 600; // chars
const CHUNK_OVERLAP = 100; // chars

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= CHUNK_SIZE) return [cleaned];
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + CHUNK_SIZE, cleaned.length);
    // Prefer to break on a paragraph or sentence boundary near the end.
    if (end < cleaned.length) {
      const slice = cleaned.slice(i, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastSent = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
      );
      if (lastPara > CHUNK_SIZE * 0.5) end = i + lastPara;
      else if (lastSent > CHUNK_SIZE * 0.5) end = i + lastSent + 1;
    }
    const piece = cleaned.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= cleaned.length) break;
    i = Math.max(end - CHUNK_OVERLAP, i + 1);
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────

export interface IndexOptions {
  name: string;
  text: string;
  source?: string;
  // Optional doc ID — when re-indexing the same document, pass the prior ID
  // so the previous chunks are replaced atomically.
  docId?: string;
}

export function indexDocument(opts: IndexOptions): RagDoc {
  const data = load();
  const docId = opts.docId || newId("doc");
  // Remove any prior chunks for this docId.
  data.chunks = data.chunks.filter((c) => c.docId !== docId);
  data.docs = data.docs.filter((d) => d.id !== docId);

  const pieces = chunkText(opts.text || "");
  const now = new Date().toISOString();
  for (let i = 0; i < pieces.length; i++) {
    const txt = pieces[i]!;
    const toks = tokenize(txt);
    data.chunks.push({
      id: newId("chk"),
      docId,
      docName: opts.name,
      source: opts.source ?? "upload",
      index: i,
      text: txt,
      tf: buildTf(toks),
      tokens: toks.length,
      createdAt: now,
    });
  }

  const doc: RagDoc = {
    id: docId,
    name: opts.name,
    source: opts.source ?? "upload",
    chunkCount: pieces.length,
    charCount: (opts.text || "").length,
    createdAt: now,
  };
  data.docs.push(doc);
  persist();
  return doc;
}

export function listDocs(): RagDoc[] {
  return [...load().docs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function removeDoc(docId: string): boolean {
  const data = load();
  const before = data.docs.length;
  data.docs = data.docs.filter((d) => d.id !== docId);
  data.chunks = data.chunks.filter((c) => c.docId !== docId);
  if (data.docs.length === before) return false;
  persist();
  return true;
}

export function clearAllDocs(): void {
  const data = load();
  data.docs = [];
  data.chunks = [];
  persist();
}

export interface RagHit {
  chunkId: string;
  docId: string;
  docName: string;
  source: string;
  index: number;
  text: string;
  score: number;
}

// Compute a TF-style score for `query` against each chunk.
//
//   score = Σ_term ( queryCount[term] × log(1 + chunkCount[term]) ) × idf
//
// where idf = log(1 + N / (1 + df)). We don't precompute an inverted index
// because today's volumes are small; we recompute IDF on every query for
// freshness. Add a mild length penalty so 30-token chunks don't dominate.
export function queryRag(query: string, k = 4): RagHit[] {
  const data = load();
  if (data.chunks.length === 0) return [];
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const qCount: Record<string, number> = {};
  for (const t of qTokens) qCount[t] = (qCount[t] ?? 0) + 1;

  const N = data.chunks.length;
  // Document frequency (number of chunks containing each query term).
  const df: Record<string, number> = {};
  for (const term of Object.keys(qCount)) {
    let count = 0;
    for (const chunk of data.chunks) {
      if (chunk.tf[term]) count += 1;
    }
    df[term] = count;
  }

  const scored: RagHit[] = [];
  for (const chunk of data.chunks) {
    let score = 0;
    let matchedTerms = 0;
    for (const [term, qc] of Object.entries(qCount)) {
      const cf = chunk.tf[term] ?? 0;
      if (cf === 0) continue;
      matchedTerms += 1;
      const idf = Math.log(1 + N / (1 + (df[term] ?? 0)));
      score += qc * Math.log(1 + cf) * idf;
    }
    if (score === 0) continue;
    // Length penalty: shorter chunks slightly preferred when ties.
    const lenPenalty = 1 / (1 + Math.log(1 + chunk.tokens) * 0.05);
    // Coverage bonus: prefer chunks that match more distinct query terms.
    const coverage = matchedTerms / Object.keys(qCount).length;
    const finalScore = score * lenPenalty * (0.5 + 0.5 * coverage);
    scored.push({
      chunkId: chunk.id,
      docId: chunk.docId,
      docName: chunk.docName,
      source: chunk.source,
      index: chunk.index,
      text: chunk.text,
      score: finalScore,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, Math.min(20, k)));
}

// Build a single system message that injects RAG hits as grounded context.
// Returns null when nothing matched. Used by chat.ts on every turn.
export function buildRagSystemMessage(
  query: string,
  k = 4,
): { role: "system"; content: string } | null {
  const hits = queryRag(query, k);
  if (hits.length === 0) return null;
  const parts: string[] = [
    "## LITHOVEX KNOWLEDGE BASE (retrieved excerpts)",
    "",
    "The user has uploaded documents. The most relevant excerpts for the current question are below. Cite them as `[source: <docName>]` when you use them. If they don't actually answer the question, say so honestly and answer from your own knowledge.",
  ];
  for (const h of hits) {
    parts.push("", `### ${h.docName} (chunk ${h.index + 1})`, h.text);
  }
  return { role: "system", content: parts.join("\n") };
}
