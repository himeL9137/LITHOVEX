import { Router, type IRouter, type Request, type Response } from "express";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve, posix } from "node:path";
import { spawn } from "node:child_process";
import {
  readAuth,
  writeAuth,
  clearAuth,
  type AuthRecord,
} from "../lib/github-store";
import { getAllKeys, getKeyByIndex } from "../lib/hf-keys";
import { logger } from "../lib/logger";
import { LITHOVEX_CODER_SYSTEM_PROMPT } from "../lib/system-prompts";
import { runWithFailover, type AttemptOutcome } from "../lib/smart-router";
import {
  isLithovexAlias,
  resolveLithovexAlias,
  analyzeTask,
  type TaskComplexity,
} from "../lib/model-registry";
import {
  getProviderKeys,
  recordProviderError,
  recordProviderSuccess,
} from "../lib/provider-keys";
import { resolveModelForProvider } from "../lib/model-aliases";
import {
  callGeminiOnce,
  callOpenRouterOnce,
  type UpstreamMessage,
} from "../lib/provider-callers";

const HF_BASE = "https://router.huggingface.co/v1";

// Default coder primary if the caller doesn't pin one. The smart router
// will derive the full fallback chain from this via getFallbackChain().
const DEFAULT_CODER_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct";

// Curated heavyweight OR models for big coding tasks. Mirrors the list used
// by the chat preflight in lib/provider-preflight.ts.
const AI_EDIT_OR_BIG_MODELS: string[] = [
  "anthropic/claude-sonnet-4.6",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "deepseek/deepseek-r1",
  "meta-llama/llama-3.1-405b-instruct",
  "qwen/qwen-2.5-72b-instruct",
];

function classifyAiEditError(
  status: number | "network",
): "expired" | "rate_limited" | "server" | "network" {
  if (status === "network") return "network";
  if (status === 401 || status === 402 || status === 403) return "expired";
  if (status === 429) return "rate_limited";
  return "server";
}

function isFatalAiEditStatus(status: number | "network"): boolean {
  return (
    typeof status === "number" &&
    (status === 400 || status === 404 || status === 422)
  );
}

const router: IRouter = Router();

const GH_DEVICE_URL = "https://github.com/login/device/code";
const GH_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GH_API = "https://api.github.com";
const DEFAULT_SCOPES = "repo,read:user,workflow";

// process.cwd() is .../LITHOVEX/artifacts/lithovex-ai-battle-mode/api-server
const LITHOVEX_ROOT = resolve(process.cwd(), "../../..");
const LOCAL_REPOS_DIR = resolve(LITHOVEX_ROOT, "server/repos");

const COMMIT_NAME = process.env["GIT_COMMIT_NAME"] ?? "LITHOVEX AI";
const COMMIT_EMAIL = process.env["GIT_COMMIT_EMAIL"] ?? "lithovex-ai@users.noreply.github.com";

function getClientId(): string | undefined {
  return (
    process.env["GITHUB_CLIENT_ID"] ||
    process.env["GITHUB_OAUTH_CLIENT_ID"] ||
    process.env["GH_CLIENT_ID"] ||
    undefined
  );
}

function getClientSecret(): string | undefined {
  return (
    process.env["GITHUB_CLIENT_SECRET"] ||
    process.env["GITHUB_OAUTH_CLIENT_SECRET"] ||
    process.env["GH_CLIENT_SECRET"] ||
    undefined
  );
}

// Browser-popup OAuth uses a one-shot in-memory state map. Each entry
// expires after 10 minutes. We don't need anything more durable than this
// because the popup completes (or is abandoned) within seconds.
interface OAuthStateEntry {
  createdAt: number;
  scope: string;
  origin: string;
}
const OAUTH_STATES = new Map<string, OAuthStateEntry>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function pruneOAuthStates() {
  const cutoff = Date.now() - OAUTH_STATE_TTL_MS;
  for (const [k, v] of OAUTH_STATES) {
    if (v.createdAt < cutoff) OAUTH_STATES.delete(k);
  }
}

function getCallbackUrl(req: Request): string {
  // Honor explicit override first; otherwise reconstruct from the request.
  const override = process.env["GITHUB_OAUTH_REDIRECT_URI"];
  if (override) return override;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
  return `${proto}://${host}/api/github/oauth/callback`;
}

function repoDir(owner: string, name: string) {
  return join(LOCAL_REPOS_DIR, `${owner}__${name}`);
}

function ensureParentDir(path: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function parseRepoRef(req: Request) {
  const owner = String(req.params["owner"] ?? "").trim();
  const name = String(req.params["name"] ?? "").trim();
  if (!owner || !name) return null;
  return { owner, name, dir: repoDir(owner, name) };
}

function authedRemote(token: string, owner: string, name: string) {
  return `https://x-access-token:${encodeURIComponent(token)}@github.com/${owner}/${name}.git`;
}

function safeJoin(base: string, sub: string): string | null {
  // Prevent path traversal — ensure resolved path stays inside base.
  const target = resolve(base, sub);
  const baseResolved = resolve(base);
  if (target !== baseResolved && !target.startsWith(baseResolved + "/")) {
    return null;
  }
  return target;
}

function runGit(
  args: string[],
  opts: { cwd?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveP) => {
    const child = spawn("git", args, {
      cwd: opts.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "echo",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => {
      stdout += b.toString();
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    child.on("close", (code) => {
      resolveP({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (err) => {
      resolveP({ code: 1, stdout, stderr: stderr + String(err) });
    });
  });
}

function repoStatusPayload(owner: string, name: string) {
  const dir = repoDir(owner, name);
  const cloned = existsSync(join(dir, ".git"));
  let branch: string | null = null;
  if (cloned) {
    const headFile = join(dir, ".git", "HEAD");
    if (existsSync(headFile)) {
      const txt = readFileSync(headFile, "utf-8").trim();
      const m = txt.match(/^ref:\s*refs\/heads\/(.+)$/);
      branch = m ? m[1] : txt.slice(0, 12);
    }
  }
  return {
    repoFullName: `${owner}/${name}`,
    localPath: dir,
    cloned,
    branch,
    ahead: 0,
    behind: 0,
    modified: [],
    staged: [],
    untracked: [],
    lastCommit: null,
  };
}

async function fetchGhUser(
  token: string,
): Promise<{ user: GhUserApi; scopes: string[] } | { error: string; status: number }> {
  const r = await fetch(`${GH_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "lithovex-ai",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return {
      error: `GitHub /user returned ${r.status}: ${txt.slice(0, 200)}`,
      status: r.status,
    };
  }
  const user = (await r.json()) as GhUserApi;
  const scopes = (r.headers.get("x-oauth-scopes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { user, scopes };
}

interface GhUserApi {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GhRepoApi {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  html_url: string;
  clone_url: string;
  updated_at: string;
  language: string | null;
}

router.get("/config", (_req: Request, res: Response) => {
  res.json({ deviceFlowAvailable: !!getClientId() });
});

router.get("/status", (_req: Request, res: Response) => {
  const rec = readAuth();
  if (!rec) {
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    user: rec.user,
    source: rec.source,
    scopes: rec.scopes,
  });
});

router.post("/logout", (_req: Request, res: Response) => {
  clearAuth();
  res.json({ ok: true });
});

router.get("/repos", async (_req: Request, res: Response) => {
  const auth = readAuth();
  if (!auth) {
    res.status(401).json({
      error:
        "Not authenticated. Connect with a Personal Access Token or Browser Login first.",
    });
    return;
  }
  try {
    const all: GhRepoApi[] = [];
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(
        `${GH_API}/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "lithovex-ai",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        if (r.status === 401) {
          res.status(401).json({
            error:
              "GitHub rejected the saved token (401). Disconnect and reconnect with a fresh Personal Access Token.",
          });
          return;
        }
        if (r.status === 403) {
          res.status(403).json({
            error:
              "GitHub returned 403. Your token may be missing the 'repo' scope, or you've hit the rate limit. Create a new token with the 'repo' scope at https://github.com/settings/tokens.",
          });
          return;
        }
        res
          .status(502)
          .json({ error: `GitHub /user/repos returned ${r.status}: ${txt.slice(0, 200)}` });
        return;
      }
      const pageData = (await r.json()) as GhRepoApi[];
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      for (const repo of pageData) all.push(repo);
      if (pageData.length < 100) break;
    }
    res.json({ repos: all });
  } catch (err) {
    logger.warn({ err }, "GET /repos failed");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to load repositories" });
  }
});

router.get("/repos/:owner/:name/status", (req: Request, res: Response) => {
  const repo = parseRepoRef(req);
  if (!repo) {
    res.status(400).json({ error: "Invalid repository path" });
    return;
  }
  res.json(repoStatusPayload(repo.owner, repo.name));
});

// ── Pull (or clone if missing) ───────────────────────────────────────────────
// Streams progress lines as Server-Sent Events.
router.post("/repos/:owner/:name/pull", async (req: Request, res: Response) => {
  const repo = parseRepoRef(req);
  if (!repo) {
    res.status(400).json({ error: "Invalid repository path" });
    return;
  }
  const auth = readAuth();
  if (!auth) {
    res
      .status(401)
      .json({ error: "Please connect GitHub with a Personal Access Token first." });
    return;
  }

  const branch =
    typeof req.body?.default_branch === "string" && req.body.default_branch.trim()
      ? String(req.body.default_branch).trim()
      : "main";

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") (res as any).flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const remote = authedRemote(auth.token, repo.owner, repo.name);
  const safeRemote = `https://github.com/${repo.owner}/${repo.name}.git`;
  const sanitize = (s: string) => s.replaceAll(remote, safeRemote);
  const alreadyCloned = existsSync(join(repo.dir, ".git"));

  // Pre-flight: check whether the remote has any branches at all.
  // Empty repos (no commits) have no refs, so any pull/clone with a branch
  // arg would fail with "couldn't find remote ref <branch>".
  const lsRemote = await runGit(["ls-remote", "--heads", remote]);
  if (lsRemote.code !== 0) {
    const reason = sanitize(lsRemote.stderr.trim() || `exit code ${lsRemote.code}`);
    send({ error: `Could not reach remote: ${reason}` });
    res.end();
    return;
  }
  const remoteIsEmpty = lsRemote.stdout.trim().length === 0;

  // Resolve a branch we can actually use. Prefer caller-supplied default,
  // but if the remote has heads and the requested branch isn't one of them,
  // fall back to the remote's HEAD branch (or first available head).
  let resolvedBranch: string | null = null;
  if (!remoteIsEmpty) {
    const heads = lsRemote.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const idx = l.indexOf("refs/heads/");
        return idx >= 0 ? l.slice(idx + "refs/heads/".length) : "";
      })
      .filter(Boolean);
    if (heads.includes(branch)) {
      resolvedBranch = branch;
    } else {
      // Look up the remote's symbolic HEAD to find the real default branch.
      const symref = await runGit(["ls-remote", "--symref", remote, "HEAD"]);
      const m = /^ref:\s+refs\/heads\/(\S+)\s+HEAD/m.exec(symref.stdout);
      resolvedBranch = m && m[1] && heads.includes(m[1]) ? m[1] : (heads[0] ?? null);
      if (resolvedBranch && resolvedBranch !== branch) {
        send({
          msg: `Note: remote default branch is "${resolvedBranch}" (not "${branch}"). Using "${resolvedBranch}".`,
        });
      }
    }
  }

  let action: "cloned" | "pulled";
  let args: string[];

  if (alreadyCloned) {
    action = "pulled";
    if (remoteIsEmpty) {
      send({
        done: true,
        action,
        msg: "Remote repository is empty (no commits yet) — nothing to pull.",
      });
      res.end();
      return;
    }
    // Refresh remote URL so the current token is used (in case it rotated).
    await runGit(["-C", repo.dir, "remote", "set-url", "origin", remote]);
    send({ msg: `Pulling latest from ${safeRemote}...` });
    args = ["-C", repo.dir, "pull", "--ff-only", "origin", resolvedBranch as string];
  } else {
    action = "cloned";
    ensureParentDir(join(repo.dir, "x"));
    if (remoteIsEmpty) {
      // Can't clone a totally empty repo in a useful way; init locally and
      // wire it up so a subsequent push will create the first commit.
      send({ msg: `Remote repository is empty — initializing local repo...` });
      mkdirSync(repo.dir, { recursive: true });
      const initArgs = ["-C", repo.dir, "init", "-b", branch];
      const init = await runGit(initArgs);
      if (init.code !== 0) {
        send({ error: `git init failed: ${sanitize(init.stderr.trim())}` });
        res.end();
        return;
      }
      const setRemote = await runGit([
        "-C", repo.dir, "remote", "add", "origin", remote,
      ]);
      if (setRemote.code !== 0) {
        // If "origin" already exists, just update it.
        await runGit(["-C", repo.dir, "remote", "set-url", "origin", remote]);
      }
      send({
        done: true,
        action: "cloned",
        msg: `Initialized empty local repo on branch "${branch}". Make a change and push to create the first commit.`,
      });
      res.end();
      return;
    }
    // If a stale, non-git directory exists at the target (leftover from a
    // previous failed attempt), clear it so `git clone` can succeed.
    if (existsSync(repo.dir)) {
      try {
        rmSync(repo.dir, { recursive: true, force: true });
        send({ msg: `Removed stale directory at ${repo.dir} before cloning.` });
      } catch (err) {
        send({ error: `Could not clear stale directory: ${sanitize(String(err))}` });
        res.end();
        return;
      }
    }
    send({ msg: `Cloning ${safeRemote} into ${repo.dir}...` });
    args = ["clone", remote, repo.dir];
  }

  const child = spawn("git", args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "echo",
    },
  });

  child.stdout.on("data", (chunk) => {
    send({ msg: sanitize(String(chunk).trim()) });
  });
  child.stderr.on("data", (chunk) => {
    send({ msg: sanitize(String(chunk).trim()) });
  });
  child.on("error", (err) => {
    send({ error: `Failed to launch git: ${sanitize(String(err))}` });
    res.end();
  });
  child.on("close", (code) => {
    if (code === 0) {
      send({
        done: true,
        action,
        msg:
          action === "cloned"
            ? "Repository cloned successfully"
            : "Repository pulled successfully",
      });
    } else {
      send({ error: `git ${action === "cloned" ? "clone" : "pull"} exited with code ${code}` });
    }
    res.end();
  });
});

// ── File tree (directory listing) ─────────────────────────────────────────────
router.get("/repos/:owner/:name/tree", (req: Request, res: Response) => {
  const repo = parseRepoRef(req);
  if (!repo) {
    res.status(400).json({ error: "Invalid repository path" });
    return;
  }
  if (!existsSync(repo.dir)) {
    res.status(404).json({ error: "Repository not cloned yet" });
    return;
  }
  const subPath = String(req.query["path"] ?? "");
  const base = safeJoin(repo.dir, subPath);
  if (!base || !existsSync(base) || !statSync(base).isDirectory()) {
    res.status(404).json({ error: "Path not found" });
    return;
  }
  try {
    const entries = readdirSync(base, { withFileTypes: true })
      .filter((e) => e.name !== ".git")
      .map((e) => ({
        name: e.name,
        path: subPath ? posix.join(subPath, e.name) : e.name,
        type: e.isDirectory() ? ("dir" as const) : ("file" as const),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ tree: entries });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to list directory" });
  }
});

// ── File content ──────────────────────────────────────────────────────────────
router.get("/repos/:owner/:name/file", (req: Request, res: Response) => {
  const repo = parseRepoRef(req);
  if (!repo) {
    res.status(400).json({ error: "Invalid repository path" });
    return;
  }
  const filePath = String(req.query["path"] ?? "");
  const full = safeJoin(repo.dir, filePath);
  if (!full || !existsSync(full) || !statSync(full).isFile()) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  try {
    res.json({ content: readFileSync(full, "utf-8") });
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Failed to read file" });
  }
});

// ── Push (write files, commit, push) ──────────────────────────────────────────
router.post("/repos/:owner/:name/push", async (req: Request, res: Response) => {
  const repo = parseRepoRef(req);
  if (!repo) {
    res.status(400).json({ error: "Invalid repository path" });
    return;
  }
  const auth = readAuth();
  if (!auth) {
    res
      .status(401)
      .json({ error: "Please connect GitHub with a Personal Access Token first." });
    return;
  }
  if (!existsSync(join(repo.dir, ".git"))) {
    res
      .status(400)
      .json({ error: "Repository is not cloned yet. Pull or clone the repo first." });
    return;
  }

  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  const message =
    typeof req.body?.message === "string" && req.body.message.trim()
      ? String(req.body.message).trim()
      : "Update from LITHOVEX AI";

  if (files.length === 0) {
    res.status(400).json({ error: "No files provided to push." });
    return;
  }

  // Validate file shapes & paths first.
  for (const f of files) {
    if (
      !f ||
      typeof f.path !== "string" ||
      !f.path.trim() ||
      typeof f.content !== "string"
    ) {
      res
        .status(400)
        .json({ error: "Each file requires a non-empty 'path' and string 'content'." });
      return;
    }
    const target = safeJoin(repo.dir, f.path);
    if (!target) {
      res
        .status(400)
        .json({ error: `Refusing to write outside the repo: ${f.path}` });
      return;
    }
  }

  try {
    // 1. Write files to disk.
    for (const f of files as Array<{ path: string; content: string }>) {
      const target = safeJoin(repo.dir, f.path)!;
      ensureParentDir(target);
      writeFileSync(target, f.content, "utf-8");
    }

    // 2. Determine current branch.
    const branchProbe = await runGit(["-C", repo.dir, "rev-parse", "--abbrev-ref", "HEAD"]);
    if (branchProbe.code !== 0) {
      res.status(500).json({
        error: `Failed to read current branch: ${branchProbe.stderr || branchProbe.stdout}`,
      });
      return;
    }
    const branch = branchProbe.stdout.trim() || "main";

    // 3. Stage all changes.
    const add = await runGit(["-C", repo.dir, "add", "--all"]);
    if (add.code !== 0) {
      res.status(500).json({ error: `git add failed: ${add.stderr || add.stdout}` });
      return;
    }

    // 4. Detect if there is anything to commit.
    const diff = await runGit([
      "-C",
      repo.dir,
      "diff",
      "--cached",
      "--quiet",
    ]);
    if (diff.code === 0) {
      res.json({
        ok: true,
        message: "No changes to push (working tree is clean)",
        branch,
        commitHash: null,
      });
      return;
    }

    // 5. Commit (with explicit identity so it works on a fresh container).
    const commit = await runGit([
      "-C",
      repo.dir,
      "-c",
      `user.email=${COMMIT_EMAIL}`,
      "-c",
      `user.name=${COMMIT_NAME}`,
      "commit",
      "-m",
      message,
    ]);
    if (commit.code !== 0) {
      res.status(500).json({ error: `git commit failed: ${commit.stderr || commit.stdout}` });
      return;
    }

    // 6. Push to GitHub using the auth token in the URL.
    const remote = authedRemote(auth.token, repo.owner, repo.name);
    const push = await runGit(["-C", repo.dir, "push", remote, `HEAD:${branch}`]);
    if (push.code !== 0) {
      const safeErr = (push.stderr || push.stdout).replace(remote, "<remote>");
      res.status(500).json({ error: `git push failed: ${safeErr}` });
      return;
    }

    // 7. Capture the new commit hash.
    const sha = await runGit(["-C", repo.dir, "rev-parse", "HEAD"]);
    const commitHash = sha.code === 0 ? sha.stdout.trim().slice(0, 7) : null;

    res.json({
      ok: true,
      message: `Pushed ${files.length} file${files.length !== 1 ? "s" : ""} to ${repo.owner}/${repo.name}@${branch}`,
      branch,
      commitHash,
    });
  } catch (err) {
    logger.warn({ err }, "push failed");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Push failed",
    });
  }
});

// ── AI edit (LITHOVEX Coder) ─────────────────────────────────────────────────
// Streams an SSE response. Frontend (`GitHubCoderPage.tsx`) expects events:
//   {token, model, tokenIndex}
//   {_model_switch:{from,to,token}}
//   {_done:true, files:[{path,content}], model, tokenIndex}
//   {error}
// terminated by  data: [DONE]
function langCommentSyntax(path: string): { open: string; close?: string } {
  const ext = (path.split(".").pop() || "").toLowerCase();
  if (
    ["html", "htm", "xml", "svg", "vue", "md", "markdown"].includes(ext)
  )
    return { open: "<!--", close: "-->" };
  if (["css", "scss", "sass", "less"].includes(ext))
    return { open: "/*", close: "*/" };
  if (
    [
      "py", "rb", "sh", "bash", "zsh", "yaml", "yml", "toml", "ini",
      "conf", "dockerfile", "cfg", "env", "mk",
    ].includes(ext) ||
    /(^|\/)Dockerfile$/.test(path)
  )
    return { open: "#" };
  return { open: "//" };
}

function buildAiEditMessages(
  prompt: string,
  contextFiles: Array<{ path: string; content: string }>,
) {
  const system = LITHOVEX_CODER_SYSTEM_PROMPT;

  const ctxParts: string[] = [];
  if (contextFiles.length > 0) {
    ctxParts.push("Repository files provided as context:");
    for (const f of contextFiles) {
      const { open, close } = langCommentSyntax(f.path);
      const banner = close
        ? `${open} FILE: ${f.path} ${close}`
        : `${open} FILE: ${f.path}`;
      ctxParts.push(`\n----- ${f.path} -----\n${banner}\n${f.content}`);
    }
  } else {
    ctxParts.push("(no repository files were attached)");
  }

  const user = [
    `User request:\n${prompt}`,
    "",
    ctxParts.join("\n"),
    "",
    "Now produce the changes following the STRICT OUTPUT FORMAT above.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

interface ParsedFile {
  path: string;
  content: string;
}

// Validate a candidate path string extracted from a marker. Returns the
// normalized path or null if it fails safety checks.
function sanitizePath(raw: string): string | null {
  const rawPath = raw.trim().replace(/^[`"']|[`"']$/g, "");
  if (
    !rawPath ||
    rawPath.startsWith("/") ||
    rawPath.includes("..") ||
    /[\s<>:"|?*]/.test(rawPath)
  ) {
    return null;
  }
  return rawPath;
}

// Match a "FILE: <path>" marker line in any of the supported comment styles.
// Strict — used for the no-code-fences fallback path where false positives
// would corrupt the file list.
function matchFileMarker(line: string): string | null {
  const trimmed = line.trim();
  const m =
    trimmed.match(/^\/\/\s*FILE:\s*(.+?)\s*$/i) ||
    trimmed.match(/^#\s*FILE:\s*(.+?)\s*$/i) ||
    trimmed.match(/^<!--\s*FILE:\s*(.+?)\s*-->\s*$/i) ||
    trimmed.match(/^\/\*\s*FILE:\s*(.+?)\s*\*\/\s*$/i);
  if (!m || !m[1]) return null;
  return sanitizePath(m[1]);
}

// Looks like a real file path? Either contains a directory separator OR
// has a recognizable file extension. Used to keep bare-path detection from
// swallowing arbitrary header comments like "// hello world".
function looksLikePath(candidate: string): boolean {
  if (candidate.includes("/")) return true;
  return /\.[A-Za-z0-9]{1,8}$/.test(candidate);
}

// Match either an explicit "FILE: <path>" marker OR a bare-path header
// comment (e.g. "// src/foo/bar.ts", "# scripts/run.py", "/* index.html */",
// "<!-- public/index.html -->"). Used for the FIRST line inside a fenced
// code block, where a bare-path header is the conventional way LLMs
// announce a file.
function matchHeaderPath(line: string): string | null {
  const explicit = matchFileMarker(line);
  if (explicit) return explicit;

  const trimmed = line.trim();
  const m =
    trimmed.match(/^\/\/\s*(.+?)\s*$/) ||
    trimmed.match(/^#\s*(.+?)\s*$/) ||
    trimmed.match(/^<!--\s*(.+?)\s*-->\s*$/) ||
    trimmed.match(/^\/\*\s*(.+?)\s*\*\/\s*$/);
  if (!m || !m[1]) return null;

  const candidate = sanitizePath(m[1]);
  if (!candidate) return null;
  if (!looksLikePath(candidate)) return null;
  return candidate;
}

function parseFilesFromOutput(text: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  if (!text) return files;
  const lines = text.split("\n");
  let i = 0;
  let inBlock = false;
  let fence = "";
  let codeLines: string[] = [];

  const flushBlock = () => {
    if (codeLines.length === 0) return;
    const path = matchHeaderPath(codeLines[0] ?? "");
    if (path) {
      const content = codeLines.slice(1).join("\n");
      files.push({ path, content });
    }
    codeLines = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!inBlock) {
      const open = line.match(/^(`{3,}|~{3,})\s*[A-Za-z0-9_+\-#.]*\s*$/);
      if (open) {
        inBlock = true;
        fence = open[1] ?? "";
        codeLines = [];
        i++;
        continue;
      }
    } else {
      const close = line.match(/^(`{3,}|~{3,})\s*$/);
      if (
        close &&
        (close[1]?.[0] ?? "") === (fence[0] ?? "") &&
        (close[1]?.length ?? 0) >= fence.length
      ) {
        flushBlock();
        inBlock = false;
        fence = "";
        i++;
        continue;
      }
      codeLines.push(line);
    }
    i++;
  }
  // Tolerate an unterminated final fenced block (truncated stream).
  if (inBlock) flushBlock();

  if (files.length > 0) return files;

  // Fallback: model didn't use code fences but did include "// FILE: <path>"
  // markers. Treat each marker line as starting a new file and the lines
  // until the next marker (or end of output) as that file's content.
  const sections: Array<{ path: string; lines: string[] }> = [];
  for (const line of lines) {
    const path = matchFileMarker(line);
    if (path) {
      sections.push({ path, lines: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1]!.lines.push(line);
    }
  }
  for (const section of sections) {
    // Trim trailing blank lines from each fallback file.
    let end = section.lines.length;
    while (end > 0 && section.lines[end - 1]!.trim() === "") end--;
    files.push({ path: section.path, content: section.lines.slice(0, end).join("\n") });
  }

  return files;
}

interface AiEditBody {
  prompt?: unknown;
  contextFiles?: unknown;
  model?: unknown;
  hf_key_index?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX Coder preflight — same provider priority as the chat endpoint:
//   1. Gemini (rotate every key — default provider)
//   2. OpenRouter (cycle premium models × keys — always attempted after
//      Gemini, regardless of task size, per user preference)
//   3. (caller falls through to HuggingFace `runWithFailover`)
//
// The persona system-prompt is already baked into `messages` by
// buildAiEditMessages, so whichever model actually answers will still
// "act like" the AI the user picked in the dropdown.
// ─────────────────────────────────────────────────────────────────────────────
async function tryAiEditPreflight(opts: {
  persona: string;
  messages: UpstreamMessage[];
  complexity: TaskComplexity;
  signal: AbortSignal;
  emit: (text: string, model: string, keyIndex: number) => void;
}): Promise<{
  ok: boolean;
  provider?: "gemini" | "openrouter";
  model?: string;
  keyIndex?: number;
  text?: string;
  lastError?: string;
}> {
  // 1. Gemini — try every key.
  const geminiModel = resolveModelForProvider("gemini", opts.persona);
  const geminiKeys = getProviderKeys("gemini");
  let lastError = "";

  for (const key of geminiKeys) {
    if (opts.signal.aborted) return { ok: false, lastError: "aborted" };

    const r = await callGeminiOnce({
      model: geminiModel,
      token: key.token,
      messages: opts.messages,
      temperature: 0.2,
      max_tokens: 4096,
      signal: opts.signal,
    });

    if (!r.ok) {
      lastError = `gemini key=#${key.index} → ${r.status}: ${r.message}`;
      logger.warn(
        { provider: "gemini", keyIndex: key.index, status: r.status },
        "ai-edit: gemini key failed, rotating",
      );
      recordProviderError(
        "gemini",
        key.index,
        classifyAiEditError(r.status),
        r.message,
      );
      if (isFatalAiEditStatus(r.status)) break;
      continue;
    }

    const text = String(r.message.content ?? "");
    recordProviderSuccess("gemini", key.index);
    opts.emit(text, opts.persona, key.index);
    return {
      ok: true,
      provider: "gemini",
      model: geminiModel,
      keyIndex: key.index,
      text,
    };
  }

  // 2. OpenRouter — always attempted after Gemini is exhausted, regardless
  //    of task complexity (per user preference).
  const orKeys = getProviderKeys("openrouter");
  if (orKeys.length === 0) return { ok: false, lastError };

  const lead = resolveModelForProvider("openrouter", opts.persona);
  const seen = new Set<string>();
  const orModels: string[] = [];
  const addModel = (m: string | null | undefined) => {
    if (!m) return;
    const k = m.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    orModels.push(m);
  };
  addModel(lead);
  for (const m of AI_EDIT_OR_BIG_MODELS) addModel(m);

  for (const model of orModels) {
    let modelDead = false;
    for (const key of orKeys) {
      if (opts.signal.aborted) return { ok: false, lastError: "aborted" };

      const r = await callOpenRouterOnce({
        model,
        token: key.token,
        messages: opts.messages,
        temperature: 0.2,
        max_tokens: 4096,
        signal: opts.signal,
      });

      if (!r.ok) {
        lastError = `openrouter model=${model} key=#${key.index} → ${r.status}: ${r.message}`;
        logger.warn(
          {
            provider: "openrouter",
            model,
            keyIndex: key.index,
            status: r.status,
          },
          "ai-edit: openrouter call failed",
        );
        recordProviderError(
          "openrouter",
          key.index,
          classifyAiEditError(r.status),
          r.message,
        );
        if (isFatalAiEditStatus(r.status)) {
          modelDead = true;
          break; // bad model id → switch model
        }
        continue; // try next OR key for this model
      }

      const text = String(r.message.content ?? "");
      recordProviderSuccess("openrouter", key.index);
      opts.emit(text, opts.persona, key.index);
      return {
        ok: true,
        provider: "openrouter",
        model,
        keyIndex: key.index,
        text,
      };
    }
    if (modelDead) continue;
  }

  return { ok: false, lastError };
}

router.post("/ai-edit", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as AiEditBody;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const rawCtx = Array.isArray(body.contextFiles) ? body.contextFiles : [];
  const contextFiles: Array<{ path: string; content: string }> = [];
  for (const entry of rawCtx) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { path?: unknown }).path === "string" &&
      typeof (entry as { content?: unknown }).content === "string"
    ) {
      const path = (entry as { path: string }).path.trim();
      const content = (entry as { content: string }).content;
      if (path) contextFiles.push({ path, content });
    }
  }

  const writeSse = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const endSse = () => {
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  };

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  if (!prompt) {
    writeSse({ error: "prompt is required" });
    endSse();
    return;
  }

  const keys = getAllKeys();
  if (keys.length === 0) {
    writeSse({
      error:
        "No HUGGINGFACE_API_KEY_* tokens are configured on the server. Add at least one key to LITHOVEX/server/huggingface_api_tokens.env or set it as an environment variable.",
    });
    endSse();
    return;
  }

  const requestedIdx =
    typeof body.hf_key_index === "number" && Number.isFinite(body.hf_key_index)
      ? Math.max(1, Math.min(9, Math.floor(body.hf_key_index as number)))
      : 1;

  const requestedModel =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : DEFAULT_CODER_MODEL;

  // Expand LITHOVEX personas into a concrete primary model based on the
  // edit prompt. ai-edit is always a coding task, so 2.5 Core picks a code
  // specialist and 2.6 Plus picks the best model for the actual prompt.
  const effectiveModel = isLithovexAlias(requestedModel)
    ? resolveLithovexAlias(requestedModel, prompt)
    : requestedModel;

  const messages = buildAiEditMessages(prompt, contextFiles);

  let assembled = "";
  let pipedSomething = false;
  let upstreamController: AbortController | null = null;
  const onClientClose = () => {
    if (upstreamController && !res.writableFinished) {
      try {
        upstreamController.abort();
      } catch {
        /* noop */
      }
    }
  };
  res.on("close", onClientClose);

  // ── PREFLIGHT: Gemini → OpenRouter (big tasks) → fall through to HF ─────
  // ai-edit is always a coding task, so analyzeTask returns at least HIGH for
  // any non-trivial prompt — which means OR will kick in if Gemini exhausts.
  const editAnalysis = analyzeTask(prompt);
  const preflightController = new AbortController();
  const onPreflightClose = () => {
    try {
      preflightController.abort();
    } catch {
      /* noop */
    }
  };
  res.on("close", onPreflightClose);

  const preflight = await tryAiEditPreflight({
    persona: requestedModel,
    messages: messages as UpstreamMessage[],
    complexity: editAnalysis.complexity,
    signal: preflightController.signal,
    emit: (text, model, keyIndex) => {
      assembled += text;
      pipedSomething = true;
      writeSse({ token: text, model, tokenIndex: keyIndex });
    },
  });
  res.removeListener("close", onPreflightClose);

  if (preflight.ok) {
    const files = parseFilesFromOutput(assembled);
    writeSse({
      _done: true,
      files,
      model: requestedModel,
      tokenIndex: preflight.keyIndex,
    });
    res.removeListener("close", onClientClose);
    endSse();
    return;
  }

  if (preflight.lastError) {
    logger.warn(
      { lastError: preflight.lastError, complexity: editAnalysis.complexity },
      "ai-edit preflight (Gemini/OR) exhausted, falling back to HuggingFace",
    );
  }

  const result = await runWithFailover({
    primaryModel: effectiveModel,
    preferredKeyIndex: requestedIdx,
    onKeyRotate: (info) => {
      writeSse({
        _model_switch: {
          from: info.model,
          to: info.model,
          token: info.toKey,
          reason: "key rotated",
        },
      });
    },
    onModelSwitch: (info) => {
      writeSse({
        _model_switch: {
          from: info.fromModel,
          to: info.toModel,
          reason: info.reason,
        },
      });
    },
    attempt: async ({ model, key }): Promise<AttemptOutcome> => {
      if (res.writableEnded) {
        return { ok: false, status: "network", message: "client disconnected" };
      }
      // Reset per-attempt accumulators. If a previous attempt streamed
      // partial tokens to the client we keep them (the smart router won't
      // call us again once we return ok=true), but we drop the assembled
      // text so a successful retry parses cleanly.
      if (!pipedSomething) {
        assembled = "";
      }

      upstreamController = new AbortController();
      const startedAt = Date.now();
      let upstream: globalThis.Response;
      try {
        upstream = await fetch(`${HF_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${key.token}`,
          },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            temperature: 0.2,
            max_tokens: 4096,
          }),
          signal: upstreamController.signal,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("aborted") ||
          message.includes("AbortError") ||
          upstreamController.signal.aborted
        ) {
          return { ok: false, status: "network", message: "aborted" };
        }
        return { ok: false, status: "network", message };
      }

      if (!upstream.ok) {
        const txt = await upstream.text().catch(() => "");
        return { ok: false, status: upstream.status, message: txt.slice(0, 200) };
      }
      if (!upstream.body) {
        return { ok: false, status: 502, message: "empty upstream body" };
      }

      const reader = (upstream.body as any).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotAnyToken = false;

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (res.writableEnded) {
          try {
            upstreamController.abort();
          } catch {
            /* noop */
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") break readLoop;
          try {
            const evt = JSON.parse(payload);
            // Qwen3 / DeepSeek-R1 stream chain-of-thought in
            // `reasoning_content` BEFORE the final `content`. Forward both.
            const reasoning =
              evt?.choices?.[0]?.delta?.reasoning_content ??
              evt?.choices?.[0]?.message?.reasoning_content ??
              "";
            if (typeof reasoning === "string" && reasoning.length > 0) {
              gotAnyToken = true;
              pipedSomething = true;
              writeSse({ thinking: reasoning, model, tokenIndex: key.index });
            }
            const delta =
              evt?.choices?.[0]?.delta?.content ??
              evt?.choices?.[0]?.message?.content ??
              "";
            if (typeof delta === "string" && delta.length > 0) {
              assembled += delta;
              gotAnyToken = true;
              pipedSomething = true;
              writeSse({ token: delta, model, tokenIndex: key.index });
            }
          } catch {
            /* skip malformed SSE chunks */
          }
        }
      }
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }

      if (!gotAnyToken) {
        // Treat empty stream like a 502 so the router retries with the
        // next model. The client never saw any tokens for this attempt.
        return {
          ok: false,
          status: 502,
          message: "stream produced no tokens",
        };
      }

      // Success — parse files and emit the _done frame the client needs
      // to enable the Push button.
      const files = parseFilesFromOutput(assembled);
      writeSse({ _done: true, files, model, tokenIndex: key.index });
      return {
        ok: true,
        data: { files, assembled },
        model,
        keyIndex: key.index,
        latencyMs: Date.now() - startedAt,
      };
    },
  });

  res.removeListener("close", onClientClose);

  if (!result.ok && !pipedSomething) {
    logger.error(
      { attempts: result.attempts, lastError: result.lastError },
      "ai-edit failed",
    );
    writeSse({
      error:
        result.lastError ||
        "All Hugging Face models and tokens failed for this request.",
    });
  }
  endSse();
});

// ─── Browser-popup OAuth (Web Application Flow) ───────────────────────
// Two endpoints sit alongside the existing Device Flow + PAT options:
//
//   GET /api/github/oauth/start
//     Returns { authorize_url, state }. The frontend opens this URL in a
//     popup window. Caller must poll /api/github/status (or listen for the
//     window.postMessage from the callback) to know when auth completes.
//
//   GET /api/github/oauth/callback?code=&state=
//     GitHub redirects the popup here. We exchange the code, save the
//     auth record to disk, then return a tiny HTML page that calls
//     window.opener.postMessage(...) and closes itself.

router.get("/oauth/start", (req: Request, res: Response) => {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    res.status(400).json({
      error:
        "Browser OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server (register an OAuth App at https://github.com/settings/developers and set its Authorization callback URL to https://<your-host>/api/github/oauth/callback).",
    });
    return;
  }
  pruneOAuthStates();
  const scope =
    typeof req.query["scope"] === "string" && (req.query["scope"] as string).trim()
      ? String(req.query["scope"])
      : DEFAULT_SCOPES;
  const origin =
    typeof req.query["origin"] === "string" ? String(req.query["origin"]) : "*";
  const state = `lvx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  OAUTH_STATES.set(state, { createdAt: Date.now(), scope, origin });
  const redirectUri = getCallbackUrl(req);
  const authorizeUrl =
    "https://github.com/login/oauth/authorize?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      allow_signup: "true",
    }).toString();
  res.json({ authorize_url: authorizeUrl, state, redirect_uri: redirectUri });
});

function popupResultHtml(opts: {
  ok: boolean;
  origin: string;
  payload: Record<string, unknown>;
}): string {
  const safePayload = JSON.stringify(opts.payload).replace(/</g, "\\u003c");
  const safeOrigin = JSON.stringify(opts.origin);
  const heading = opts.ok ? "Connected" : "Failed";
  const color = opts.ok ? "#cc2020" : "#ff4444";
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>LITHOVEX · GitHub</title>
<style>
  body{font-family:'JetBrains Mono',monospace;background:#0a0a0c;color:#e8e8e8;
       margin:0;height:100vh;display:flex;align-items:center;justify-content:center}
  .box{padding:32px;border:1px solid #3d0000;border-radius:6px;
       background:#100808;text-align:center;max-width:360px}
  h1{color:${color};font-size:18px;letter-spacing:.1em;margin:0 0 12px}
  p{color:#7a4a4a;font-size:12px;line-height:1.6;margin:0}
</style></head>
<body><div class="box"><h1>${heading}</h1>
<p>You can close this window. LITHOVEX will continue automatically.</p></div>
<script>
  (function(){
    var payload = ${safePayload};
    var targetOrigin = ${safeOrigin};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: "lithovex:github-oauth", ok: ${opts.ok ? "true" : "false"}, payload: payload },
          targetOrigin
        );
      }
    } catch (e) { /* ignore */ }
    setTimeout(function(){ try { window.close(); } catch(e){} }, 600);
  })();
</script></body></html>`;
}

router.get("/oauth/callback", async (req: Request, res: Response) => {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const code = typeof req.query["code"] === "string" ? String(req.query["code"]) : "";
  const state = typeof req.query["state"] === "string" ? String(req.query["state"]) : "";
  const ghError =
    typeof req.query["error_description"] === "string"
      ? String(req.query["error_description"])
      : typeof req.query["error"] === "string"
        ? String(req.query["error"])
        : "";

  pruneOAuthStates();
  const stateEntry = state ? OAUTH_STATES.get(state) : undefined;
  if (state) OAUTH_STATES.delete(state);
  const origin = stateEntry?.origin ?? "*";

  if (ghError) {
    res
      .status(400)
      .type("html")
      .send(popupResultHtml({ ok: false, origin, payload: { error: ghError } }));
    return;
  }
  if (!clientId || !clientSecret) {
    res
      .status(400)
      .type("html")
      .send(
        popupResultHtml({
          ok: false,
          origin,
          payload: { error: "GITHUB_CLIENT_ID/SECRET not configured" },
        }),
      );
    return;
  }
  if (!code || !state || !stateEntry) {
    res
      .status(400)
      .type("html")
      .send(
        popupResultHtml({
          ok: false,
          origin,
          payload: { error: "Invalid or expired state. Try logging in again." },
        }),
      );
    return;
  }

  try {
    const tokenRes = await fetch(GH_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "lithovex-ai",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getCallbackUrl(req),
        state,
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => null)) as
      | {
          access_token?: string;
          scope?: string;
          token_type?: string;
          error?: string;
          error_description?: string;
        }
      | null;
    if (!tokenRes.ok || !tokenData?.access_token) {
      const msg =
        tokenData?.error_description ||
        tokenData?.error ||
        `GitHub returned HTTP ${tokenRes.status}`;
      res
        .status(502)
        .type("html")
        .send(popupResultHtml({ ok: false, origin, payload: { error: msg } }));
      return;
    }

    const u = await fetchGhUser(tokenData.access_token);
    if ("error" in u) {
      res
        .status(502)
        .type("html")
        .send(popupResultHtml({ ok: false, origin, payload: { error: u.error } }));
      return;
    }
    const scopes =
      tokenData.scope
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? u.scopes;
    const record: AuthRecord = {
      token: tokenData.access_token,
      source: "oauth",
      user: u.user,
      scopes,
      savedAt: new Date().toISOString(),
    };
    writeAuth(record);
    res
      .type("html")
      .send(
        popupResultHtml({
          ok: true,
          origin,
          payload: { user: u.user, scopes, source: "oauth" },
        }),
      );
  } catch (err) {
    logger.warn({ err }, "oauth/callback failed");
    res
      .status(500)
      .type("html")
      .send(
        popupResultHtml({
          ok: false,
          origin,
          payload: {
            error: err instanceof Error ? err.message : "oauth/callback failed",
          },
        }),
      );
  }
});

router.post("/device/start", async (req: Request, res: Response) => {
  const clientId = getClientId();
  if (!clientId) {
    res.status(400).json({
      error:
        "Browser login is not configured. Set GITHUB_CLIENT_ID on the server (register a GitHub OAuth App at https://github.com/settings/developers, enable Device Flow, and copy its Client ID). You can keep using a Personal Access Token in the meantime.",
    });
    return;
  }
  try {
    const scope =
      typeof req.body?.scope === "string" && req.body.scope.trim()
        ? String(req.body.scope)
        : DEFAULT_SCOPES;

    const r = await fetch(GH_DEVICE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "lithovex-ai",
      },
      body: JSON.stringify({ client_id: clientId, scope }),
    });
    const data = (await r.json().catch(() => null)) as
      | {
          device_code?: string;
          user_code?: string;
          verification_uri?: string;
          expires_in?: number;
          interval?: number;
          error?: string;
          error_description?: string;
        }
      | null;

    if (!r.ok || !data || data.error) {
      const rawMsg = data?.error_description || data?.error || `GitHub returned HTTP ${r.status}`;
      let msg = rawMsg;
      if (r.status === 404 || /not\s*found/i.test(rawMsg) || /device.*flow/i.test(rawMsg)) {
        msg =
          "GitHub rejected the request. This usually means Device Flow is not enabled on your OAuth App. Open https://github.com/settings/developers, click your OAuth App, scroll to 'Device Flow' and check 'Enable Device Flow', then click Save. (Also double-check that the GITHUB_CLIENT_ID secret matches the Client ID shown on that page.)";
      } else if (r.status === 401 || /bad.*credentials/i.test(rawMsg)) {
        msg =
          "GitHub rejected the Client ID. Verify the GITHUB_CLIENT_ID secret matches the Client ID shown at https://github.com/settings/developers exactly (no spaces).";
      }
      res.status(502).json({ error: msg });
      return;
    }

    res.json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in ?? 900,
      interval: data.interval ?? 5,
    });
  } catch (err) {
    logger.warn({ err }, "device/start failed");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "device/start failed" });
  }
});

router.post("/device/poll", async (req: Request, res: Response) => {
  const clientId = getClientId();
  if (!clientId) {
    res.status(400).json({ error: "GITHUB_CLIENT_ID not configured" });
    return;
  }
  const deviceCode = req.body?.device_code;
  if (typeof deviceCode !== "string" || !deviceCode) {
    res.status(400).json({ error: "device_code is required" });
    return;
  }
  try {
    const r = await fetch(GH_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "lithovex-ai",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const data = (await r.json().catch(() => null)) as
      | {
          access_token?: string;
          token_type?: string;
          scope?: string;
          error?: string;
          error_description?: string;
          interval?: number;
        }
      | null;

    if (!data) {
      res.status(502).json({ status: "error", error: "Bad response from GitHub" });
      return;
    }

    if (data.error) {
      switch (data.error) {
        case "authorization_pending":
          res.json({ status: "pending" });
          return;
        case "slow_down":
          res.json({ status: "pending", interval: data.interval ?? 10 });
          return;
        case "expired_token":
          res.json({ status: "expired" });
          return;
        case "access_denied":
          res.json({ status: "error", error: "Access denied" });
          return;
        default:
          res.json({ status: "error", error: data.error_description || data.error });
          return;
      }
    }

    const token = data.access_token;
    if (!token) {
      res.json({ status: "error", error: "No access_token in response" });
      return;
    }

    const u = await fetchGhUser(token);
    if ("error" in u) {
      res.json({ status: "error", error: u.error });
      return;
    }

    const record: AuthRecord = {
      token,
      source: "device",
      user: u.user,
      scopes:
        u.scopes.length > 0
          ? u.scopes
          : (data.scope || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      savedAt: new Date().toISOString(),
    };
    writeAuth(record);
    res.json({ status: "authorized", user: u.user, scopes: record.scopes });
  } catch (err) {
    logger.warn({ err }, "device/poll failed");
    res.json({
      status: "error",
      error: err instanceof Error ? err.message : "device/poll failed",
    });
  }
});

router.post("/token", async (req: Request, res: Response) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }
  try {
    const u = await fetchGhUser(token);
    if ("error" in u) {
      const status = u.status === 401 ? 401 : u.status === 403 ? 403 : 400;
      res.status(status).json({
        error:
          u.status === 401
            ? "Invalid token. Please check that you copied the full Personal Access Token and that it hasn't expired or been revoked."
            : u.status === 403
              ? "Token is missing required scopes. Make sure it has at least repo and read:user."
              : u.error,
      });
      return;
    }
    const record: AuthRecord = {
      token,
      source: "pat",
      user: u.user,
      scopes: u.scopes,
      savedAt: new Date().toISOString(),
    };
    writeAuth(record);
    res.json({ user: u.user, scopes: u.scopes });
  } catch (err) {
    logger.warn({ err }, "/token failed");
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "token validation failed" });
  }
});

export default router;
