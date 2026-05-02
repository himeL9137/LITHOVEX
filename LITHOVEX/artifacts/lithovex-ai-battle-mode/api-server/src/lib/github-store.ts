import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface AuthRecord {
  token: string;
  source: "device" | "pat" | "oauth";
  user: {
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
  };
  scopes: string[];
  savedAt: string;
}

// process.cwd() when this server runs is .../LITHOVEX/artifacts/lithovex-ai-battle-mode/api-server
// so going up three levels lands at the LITHOVEX/ root.
const LITHOVEX_ROOT = resolve(process.cwd(), "../../..");
const DATA_FILE = resolve(LITHOVEX_ROOT, "server/data/github-auth.json");

function ensureDir() {
  const dir = dirname(DATA_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readAuth(): AuthRecord | null {
  try {
    if (!existsSync(DATA_FILE)) return null;
    const txt = readFileSync(DATA_FILE, "utf-8");
    if (!txt.trim()) return null;
    return JSON.parse(txt) as AuthRecord;
  } catch {
    return null;
  }
}

export function writeAuth(record: AuthRecord): void {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(record, null, 2), "utf-8");
}

export function clearAuth(): void {
  if (existsSync(DATA_FILE)) {
    try {
      writeFileSync(DATA_FILE, "", "utf-8");
    } catch {
      /* noop */
    }
  }
}

export type { AuthRecord };
