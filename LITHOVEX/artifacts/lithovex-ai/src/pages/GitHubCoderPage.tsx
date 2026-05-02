/**
 * LITHOVEX AI — LITHOVEX Coder
 * Redesigned to match LITHOVEX AI's design system:
 * pure-black bg, purple accents, framer-motion, Inter font
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGitHub, type GitHubRepo, type FileTreeEntry } from "@/hooks/useGitHub";
import {
  Github, ArrowLeft, GitBranch, Lock, Folder, File, RefreshCw,
  Send, Loader2, Check, X, Upload, Zap, RotateCcw,
  Code2, Plus, Minus, Eye, GitCommit, Square, ExternalLink,
  Brain, ChevronDown, ChevronRight, FileText
} from "lucide-react";
import lithovexLogo from "@/assets/lithovex-logo.png";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextFile { path: string; content: string; selected: boolean; }
interface GeneratedFile { path: string; content: string; isNew: boolean; }
interface ModelSwitchEvent { from: string; to: string; token: number; }
type StreamStatus = "idle" | "streaming" | "done" | "error";

function shortModel(id: string) { return id.split("/").pop() ?? id; }
function langFromPath(p: string) {
  const ext = p.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    py: "python", rs: "rust", go: "go", java: "java", cs: "csharp",
    cpp: "cpp", c: "c", html: "html", css: "css", json: "json",
    md: "markdown", yaml: "yaml", yml: "yaml", sh: "bash", toml: "toml",
  };
  return map[ext] ?? "plaintext";
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">
      {children}
    </p>
  );
}

// ─── Auth Section ─────────────────────────────────────────────────────────────

function AuthSection({ gh }: { gh: ReturnType<typeof useGitHub> }) {
  const [pat, setPat] = useState("");
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState("");
  const [deviceStarting, setDeviceStarting] = useState(false);

  // True when GITHUB_CLIENT_ID is missing (from proactive config check)
  // or when the server returned a "not configured" error after a click attempt.
  const deviceUnavailable =
    gh.deviceFlowAvailable === false ||
    (gh.authError
      ? /not configured|GITHUB_CLIENT_ID|client.?id/i.test(gh.authError)
      : false);

  // Auto-expand PAT as soon as we know device flow is unavailable.
  const [showPat, setShowPat] = useState(false);
  const prevUnavailable = useRef(false);
  useEffect(() => {
    if (deviceUnavailable && !prevUnavailable.current) setShowPat(true);
    prevUnavailable.current = deviceUnavailable;
  }, [deviceUnavailable]);

  const handlePatConnect = async () => {
    if (!pat.trim()) return;
    setPatLoading(true);
    setPatError("");
    try { await gh.loginWithPAT(pat.trim()); }
    catch (e) { setPatError((e as Error).message); }
    finally { setPatLoading(false); }
  };

  const handleGitHubLogin = async () => {
    setDeviceStarting(true);
    try { await gh.startDeviceFlow(); }
    catch { /* error handled by gh.authError */ }
    finally { setDeviceStarting(false); }
  };

  if (gh.authStep === "authenticated" && gh.user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-3 py-2.5 bg-[#111111] border border-purple-500/20 rounded-xl"
      >
        <img src={gh.user.avatar_url} alt={gh.user.login}
          className="w-8 h-8 rounded-full border border-purple-500/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate leading-tight">{gh.user.name || gh.user.login}</p>
          <p className="text-[11px] text-purple-400 leading-tight flex items-center gap-1">
            <Check className="w-3 h-3" /> Connected to GitHub
          </p>
        </div>
        <button onClick={gh.logout}
          className="text-[11px] text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/8">
          Disconnect
        </button>
      </motion.div>
    );
  }

  if (gh.authStep === "polling") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[#111111] border border-purple-500/30 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Waiting for GitHub authorization…</span>
        </div>
        <div className="bg-black/60 border border-white/8 rounded-xl p-4 text-center space-y-3">
          <p className="text-[11px] text-gray-500">A new tab was opened — enter this code at:</p>
          <a href={gh.verificationUrl} target="_blank" rel="noreferrer"
            className="text-sm text-purple-400 hover:underline flex items-center justify-center gap-1.5">
            {gh.verificationUrl}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <div className="text-2xl font-mono font-black tracking-[0.4em] text-white bg-[#0a0a0a] rounded-xl py-3 px-6 inline-block border border-purple-500/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            {gh.userCode}
          </div>
          <p className="text-[10px] text-gray-600">Polling for confirmation automatically…</p>
        </div>
        <button
          onClick={() => window.open(gh.verificationUrl, "_blank")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-600/25 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Re-open GitHub tab
        </button>
      </motion.div>
    );
  }

  if (gh.authStep === "waiting_user") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-[#111111] border border-white/8 rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-purple-400 flex-shrink-0" />
        <span className="text-sm text-gray-400">Opening GitHub login…</span>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] border border-white/8 rounded-xl overflow-hidden">

      {/* Primary: Login with GitHub (Device Flow) */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Github className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Connect GitHub</span>
        </div>

        {/* Config-missing: soft amber setup guide */}
        {deviceUnavailable && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/8 border border-amber-500/25 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
              <span>⚙</span> One-time GitHub setup needed
            </p>
            <p className="text-[11px] text-amber-200/60 leading-relaxed">
              To use browser login, add a free{" "}
              <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer"
                className="underline hover:text-amber-300">GitHub OAuth App Client ID</a>{" "}
              as the <code className="bg-white/8 px-1 rounded text-amber-100/70">GITHUB_CLIENT_ID</code> secret.
              Or just use a Personal Access Token below — it works the same way.
            </p>
          </motion.div>
        )}

        {/* Generic (non-config) errors */}
        {gh.authError && !deviceUnavailable && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
            {gh.authError}
          </motion.div>
        )}

        {/* Big primary GitHub login button — greyed out when client ID is missing */}
        <button
          onClick={handleGitHubLogin}
          disabled={deviceStarting || deviceUnavailable}
          title={deviceUnavailable ? "GITHUB_CLIENT_ID not configured — use a Personal Access Token below" : undefined}
          className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-150 shadow-lg shadow-black/30 ${
            deviceUnavailable
              ? "bg-white/10 text-white/30 cursor-not-allowed border border-white/8"
              : "bg-white hover:bg-gray-100 text-black disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {deviceStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Github className="w-4 h-4 flex-shrink-0" />
          )}
          {deviceStarting ? "Opening GitHub…" : "Login with GitHub"}
        </button>
        <p className="text-[11px] text-gray-600 text-center leading-relaxed">
          {deviceUnavailable
            ? "Unavailable — GITHUB_CLIENT_ID not set (see above)"
            : "Opens GitHub in a new tab → you enter a short code → auto-connects"}
        </p>
      </div>

      <div className="flex items-center gap-2 px-4">
        <div className="flex-1 h-px bg-white/6" />
        <span className="text-[10px] text-gray-700 uppercase tracking-widest">or use a token</span>
        <div className="flex-1 h-px bg-white/6" />
      </div>

      {/* Secondary: Personal Access Token */}
      <div className="p-4 space-y-2.5">
        <button
          onClick={() => setShowPat(p => !p)}
          className="flex items-center gap-2 text-[11px] text-gray-500 hover:text-gray-300 transition-colors w-full"
        >
          <span className="font-semibold">Personal Access Token</span>
          <span className="ml-auto text-[10px] text-gray-600">{showPat ? "hide" : "show"}</span>
        </button>

        {showPat && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Create at{" "}
              <a href="https://github.com/settings/tokens/new?scopes=repo,read:user" target="_blank" rel="noreferrer"
                className="text-purple-400 hover:underline inline-flex items-center gap-0.5">
                github.com/settings/tokens <ExternalLink className="w-2.5 h-2.5" />
              </a>
              {" "}— select <code className="text-gray-300 bg-white/6 px-1 rounded">repo</code> + <code className="text-gray-300 bg-white/6 px-1 rounded">read:user</code>.
            </p>
            {patError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                {patError}
              </motion.div>
            )}
            <div className="flex flex-col rounded-xl bg-[#1c1c1c] border border-white/10 focus-within:border-purple-500/50 transition-all duration-200 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={pat}
                  onChange={e => { setPat(e.target.value); setPatError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handlePatConnect(); }}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-100 placeholder:text-gray-600 font-mono"
                />
                <button
                  onClick={handlePatConnect}
                  disabled={!pat.trim() || patLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all duration-150 flex-shrink-0">
                  {patLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Connect
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Repo Selector ────────────────────────────────────────────────────────────

function RepoSelector({ gh }: { gh: ReturnType<typeof useGitHub> }) {
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? gh.repos.filter(r => r.full_name.toLowerCase().includes(filter.toLowerCase()))
    : gh.repos;

  if (gh.repos.length === 0) {
    return (
      <button onClick={gh.loadRepos} disabled={gh.reposLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111111] hover:bg-white/5 border border-white/8 text-sm text-gray-400 hover:text-gray-200 rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
        {gh.reposLoading
          ? <><Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Loading repos…</>
          : <><GitBranch className="w-4 h-4 text-purple-400" /> Load My Repositories</>}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center bg-[#1c1c1c] border border-white/8 focus-within:border-purple-500/40 rounded-xl px-3 py-1.5 transition-all duration-200">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search repos…"
            className="flex-1 bg-transparent border-none outline-none text-xs text-gray-200 placeholder:text-gray-600"
          />
        </div>
        <button onClick={gh.loadRepos} title="Refresh"
          className="p-2 text-gray-600 hover:text-purple-400 border border-white/8 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/8 transition-all duration-150">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 thin-scrollbar">
        {filtered.map((repo, i) => (
          <motion.button key={repo.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            onClick={() => gh.selectRepo(repo)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150 ${
              gh.selectedRepo?.id === repo.id
                ? "bg-purple-500/12 border border-purple-500/30 text-white"
                : "hover:bg-white/4 text-gray-500 hover:text-gray-200 border border-transparent"
            }`}>
            {repo.private && <Lock className="w-3 h-3 text-amber-500/70 flex-shrink-0" />}
            <span className="flex-1 text-xs truncate font-medium">{repo.full_name}</span>
            {repo.language && (
              <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/8 rounded text-gray-600 flex-shrink-0">
                {repo.language}
              </span>
            )}
          </motion.button>
        ))}
      </div>
      <p className="text-[10px] text-gray-700 px-1">{gh.repos.length} repos · {gh.repos.filter(r => r.private).length} private</p>
    </div>
  );
}

// ─── File Tree ────────────────────────────────────────────────────────────────

function FileTreeView({ gh, onFileLoad }: { gh: ReturnType<typeof useGitHub>; onFileLoad: (path: string, content: string) => void; }) {
  const repo = gh.selectedRepo;
  if (!repo) return null;

  const handleEntry = async (entry: FileTreeEntry) => {
    if (entry.type === "dir") {
      gh.loadFileTree(repo, entry.path);
    } else {
      try {
        const content = await gh.readFile(repo, entry.path);
        onFileLoad(entry.path, content);
      } catch (e) { console.error("Failed to read file:", e); }
    }
  };

  return (
    <div className="space-y-0.5">
      {gh.treePath && (
        <button
          onClick={() => {
            const parts = gh.treePath.split("/");
            parts.pop();
            gh.loadFileTree(repo, parts.join("/"));
          }}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 px-2 py-1.5 rounded-lg hover:bg-white/4 transition-all w-full text-left">
          ← back
        </button>
      )}
      {gh.fileTree.length === 0 ? (
        <p className="text-xs text-gray-700 px-2 py-2">Empty directory</p>
      ) : (
        gh.fileTree.map((entry, i) => (
          <motion.button key={entry.path}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
            onClick={() => handleEntry(entry)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left w-full hover:bg-white/4 transition-all duration-150 group">
            {entry.type === "dir"
              ? <Folder className="w-3.5 h-3.5 text-purple-400/60 flex-shrink-0" />
              : <File className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 group-hover:text-gray-400" />}
            <span className={`text-xs truncate flex-1 ${entry.type === "dir" ? "text-gray-300" : "text-gray-500 group-hover:text-gray-200"}`}>
              {entry.name}
            </span>
            {entry.type === "file" && (
              <Plus className="w-3 h-3 text-gray-700 group-hover:text-purple-400 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
            )}
          </motion.button>
        ))
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GitHubCoderPage() {
  const [, setLocation] = useLocation();
  const gh = useGitHub();

  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [prompt, setPrompt] = useState("");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [streamText, setStreamText] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [contextFilesUsed, setContextFilesUsed] = useState<number>(0);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [currentToken, setCurrentToken] = useState<number>(0);
  const [modelSwitches, setModelSwitches] = useState<ModelSwitchEvent[]>([]);
  const [streamError, setStreamError] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [commitMsg, setCommitMsg] = useState("feat: LITHOVEX AI code edit");
  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "done" | "error">("idle");
  const [pushMessage, setPushMessage] = useState("");
  const [showPullLog, setShowPullLog] = useState(false);

  const streamTextRef = useRef("");
  const streamThinkingRef = useRef("");
  const outputRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [streamText]);

  useEffect(() => {
    if (thinkingRef.current && thinkingExpanded) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [streamThinking, thinkingExpanded]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "48px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const addContextFile = useCallback((path: string, content: string) => {
    setContextFiles(prev => {
      if (prev.some(f => f.path === path)) return prev;
      return [...prev, { path, content, selected: true }];
    });
  }, []);

  const removeContextFile = useCallback((path: string) => {
    setContextFiles(prev => prev.filter(f => f.path !== path));
  }, []);

  const toggleFileSelect = useCallback((path: string) => {
    setContextFiles(prev => prev.map(f => f.path === path ? { ...f, selected: !f.selected } : f));
  }, []);

  const runAI = useCallback(async () => {
    if (!prompt.trim() || streamStatus === "streaming") return;
    const selected = contextFiles.filter(f => f.selected);

    setStreamStatus("streaming");
    setStreamText("");
    setStreamThinking("");
    setThinkingExpanded(true);
    setContextFilesUsed(selected.length);
    setGeneratedFiles([]);
    setModelSwitches([]);
    setStreamError("");
    setPreviewFile(null);
    streamTextRef.current = "";
    streamThinkingRef.current = "";

    try {
      const res = await fetch("/api/github/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          contextFiles: selected.map(f => ({ path: f.path, content: f.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setStreamError(err.error ?? "Request failed");
        setStreamStatus("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStreamStatus("error"); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { setStreamStatus("done"); continue; }
          try {
            const evt = JSON.parse(raw);
            if (evt.thinking !== undefined) {
              streamThinkingRef.current += evt.thinking;
              setStreamThinking(streamThinkingRef.current);
              setCurrentModel(evt.model ?? "");
              setCurrentToken(evt.tokenIndex ?? 0);
            } else if (evt.token !== undefined) {
              streamTextRef.current += evt.token;
              setStreamText(streamTextRef.current);
              setCurrentModel(evt.model ?? "");
              setCurrentToken(evt.tokenIndex ?? 0);
            } else if (evt._model_switch) {
              setModelSwitches(p => [...p, evt._model_switch]);
              setCurrentModel(evt._model_switch.to);
              setCurrentToken(evt._model_switch.token);
            } else if (evt._done) {
              const files: GeneratedFile[] = (evt.files ?? []).map(
                (f: { path: string; content: string }) => ({
                  path: f.path, content: f.content,
                  isNew: !contextFiles.some(c => c.path === f.path),
                })
              );
              setGeneratedFiles(files);
              setCurrentModel(evt.model ?? "");
              setCurrentToken(evt.tokenIndex ?? 0);
              setStreamStatus("done");
              // Auto-collapse the thinking panel once we have actual output
              // — but only if there's also visible streamText to read.
              if (streamTextRef.current.length > 0 && streamThinkingRef.current.length > 0) {
                setThinkingExpanded(false);
              }
              if (files.length > 0) setPreviewFile(files[0]);
            } else if (evt.error) {
              setStreamError(evt.error);
              setStreamStatus("error");
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (e) {
      setStreamError((e as Error).message);
      setStreamStatus("error");
    }
  }, [prompt, contextFiles, streamStatus]);

  const stopAI = useCallback(() => {
    setStreamStatus("idle");
    setStreamText(streamTextRef.current);
    setStreamThinking(streamThinkingRef.current);
  }, []);

  const pushToGitHub = useCallback(async () => {
    if (!gh.selectedRepo || generatedFiles.length === 0 || pushStatus === "pushing") return;
    setPushStatus("pushing");
    setPushMessage("");
    const [owner, repo] = gh.selectedRepo.full_name.split("/");
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: generatedFiles.map(f => ({ path: f.path, content: f.content })),
          message: commitMsg.trim() || "feat: LITHOVEX AI code edit",
        }),
      });
      const data = await res.json();
      if (data.error) { setPushMessage(`Error: ${data.error}`); setPushStatus("error"); }
      else { setPushMessage(data.message ?? "Pushed!"); setPushStatus("done"); }
    } catch (e) {
      setPushMessage((e as Error).message);
      setPushStatus("error");
    }
  }, [gh.selectedRepo, generatedFiles, commitMsg, pushStatus]);

  const handlePull = useCallback(() => {
    if (!gh.selectedRepo) return;
    setShowPullLog(true);
    gh.pullRepo(gh.selectedRepo);
  }, [gh]);

  const isAuthenticated = gh.authStep === "authenticated";
  const hasRepo = !!gh.selectedRepo;
  const isCloned = gh.repoStatus?.cloned ?? false;
  const canRun = isAuthenticated && prompt.trim().length > 0;
  const isStreaming = streamStatus === "streaming";

  const emptyMsg = !isAuthenticated
    ? "Connect your GitHub account to get started"
    : !hasRepo
    ? "Select a repository from the left panel"
    : !isCloned
    ? "Clone the repository, then add files as context"
    : "Add context files, describe your changes, and run the AI";

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col overflow-hidden text-gray-100">

      {/* ─── Top Bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6 bg-[#0f0f0f] shrink-0">
        <button onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-300 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="w-px h-4 bg-white/8" />
        <img src={lithovexLogo} alt="LITHOVEX" className="w-5 h-5 object-contain logo-glow" />
        <Github className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-white">LITHOVEX Coder</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25">
            AI
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">
            9 tokens
          </span>
        </div>
        {currentModel && streamStatus !== "idle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="ml-auto flex items-center gap-2 text-xs text-gray-600">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-gray-400">{shortModel(currentModel)}</span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-600">tok #{currentToken}</span>
          </motion.div>
        )}
      </div>

      {/* ─── Main Layout ──────────────────────────────────────────────────────
          Mobile (<768px): single column, left sidebar stacks above the editor
          and is height-capped + scrollable so it doesn't dominate the screen.
          Desktop (≥768px): original side-by-side row layout — pixel identical.
       */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── Left Panel ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-72 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-white/6 bg-[#0a0a0a] flex flex-col overflow-hidden max-h-[45dvh] md:max-h-none"
        >
          <div className="flex-1 overflow-y-auto p-3 space-y-5 thin-scrollbar">

            {/* Auth */}
            <div>
              <SectionLabel>Authentication</SectionLabel>
              <AuthSection gh={gh} />
            </div>

            {/* Repo Selector */}
            <AnimatePresence>
              {isAuthenticated && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}>
                  <SectionLabel>Repository</SectionLabel>
                  <RepoSelector gh={gh} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selected repo info */}
            <AnimatePresence>
              {hasRepo && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-[#111111] border border-white/8 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-white truncate flex-1">{gh.selectedRepo!.full_name}</span>
                    {gh.selectedRepo!.private && <Lock className="w-3 h-3 text-amber-500/60 flex-shrink-0" />}
                  </div>
                  {gh.repoStatus && (
                    <div className="text-[11px] text-gray-600 space-y-0.5">
                      {gh.repoStatus.cloned ? (
                        <>
                          <div>branch: <span className="text-purple-400">{gh.repoStatus.branch}</span></div>
                          <div>commit: <span className="text-gray-500">{gh.repoStatus.lastCommit ?? "—"}</span></div>
                          {gh.repoStatus.modified.length > 0 && (
                            <div className="text-amber-400/80">{gh.repoStatus.modified.length} modified</div>
                          )}
                        </>
                      ) : (
                        <div className="text-orange-400/80">Not cloned yet</div>
                      )}
                    </div>
                  )}
                  <button onClick={handlePull} disabled={gh.pulling}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/18 border border-purple-500/25 text-purple-300 hover:text-purple-200 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
                    {gh.pulling
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Pulling…</>
                      : isCloned ? "↓ Pull Latest" : "↓ Clone Repository"}
                  </button>
                  <AnimatePresence>
                    {showPullLog && gh.pullLog.length > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="bg-black/60 border border-white/5 rounded-lg p-2 max-h-24 overflow-y-auto">
                        {gh.pullLog.map((l, i) => (
                          <div key={i} className="text-[10px] text-gray-500 font-mono">{l}</div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* File browser */}
            <AnimatePresence>
              {isCloned && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                      Files {gh.treePath && <span className="text-gray-700 normal-case font-normal">/{gh.treePath}</span>}
                    </p>
                    <span className="text-[10px] text-gray-700">click + to add</span>
                  </div>
                  <div className="bg-[#111111] border border-white/8 rounded-xl p-2 max-h-64 overflow-y-auto thin-scrollbar">
                    <FileTreeView gh={gh} onFileLoad={addContextFile} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Context files */}
            <AnimatePresence>
              {contextFiles.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <SectionLabel>
                    Context Files <span className="text-gray-700 normal-case font-normal tracking-normal">({contextFiles.filter(f => f.selected).length} selected)</span>
                  </SectionLabel>
                  <div className="space-y-1">
                    {contextFiles.map((f, i) => (
                      <motion.div key={f.path}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
                          f.selected ? "border-purple-500/25 bg-purple-500/8" : "border-white/5 bg-white/2 opacity-40"
                        }`}>
                        <button onClick={() => toggleFileSelect(f.path)}
                          className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                            f.selected ? "bg-purple-600 border-purple-500" : "border-white/20"
                          }`}>
                          {f.selected && <Check className="w-2.5 h-2.5 text-white" />}
                        </button>
                        <span className="flex-1 text-[11px] text-gray-400 truncate font-mono">{f.path}</span>
                        <button onClick={() => removeContextFile(f.path)}
                          className="text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>

        {/* ── Right Panel: AI Editor ─────────────────────────────────────
            On mobile this becomes the second stacked block under the sidebar
            and is guaranteed at least 50dvh so the editor stays usable. */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex-1 flex flex-col overflow-hidden min-h-[50dvh] md:min-h-0"
        >

          {/* ── Chat Input (matches Home page exactly) ─────────────────── */}
          <div className="border-b border-white/6 p-4 bg-[#0f0f0f] shrink-0">
            <div className={`
              relative flex flex-col rounded-2xl
              bg-[#1c1c1c] border border-white/10
              focus-within:border-purple-500/50 focus-within:bg-[#1e1e1e]
              transition-all duration-200 shadow-lg shadow-black/20
            `}>
              <div className="flex items-end gap-2 px-4 py-3">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); autoResize(); }}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAI(); }}
                  placeholder={
                    !isAuthenticated
                      ? "Connect GitHub first…"
                      : "Describe the changes you want the AI to make to your repo…"
                  }
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-base md:text-sm text-gray-100 placeholder:text-gray-600 overflow-y-auto leading-relaxed disabled:opacity-50"
                  style={{ minHeight: "48px", maxHeight: "160px" }}
                />
                {isStreaming ? (
                  <button onClick={stopAI}
                    className="flex-shrink-0 mb-0.5 p-3 md:p-2 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0 rounded-xl transition-all duration-150 bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/30 flex items-center justify-center"
                    title="Stop">
                    <Square className="w-4 h-4" fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={runAI} disabled={!canRun}
                    className={`
                      flex-shrink-0 mb-0.5 p-3 md:p-2 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0 rounded-xl transition-all duration-150 flex items-center justify-center
                      ${canRun
                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30"
                        : "bg-white/6 text-gray-600 cursor-not-allowed"}
                    `}
                    title="Run AI (⌘↵)">
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status bar */}
            <AnimatePresence>
              {streamStatus !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-3 text-xs mt-2.5 px-1">
                  {isStreaming && (
                    <div className="flex items-center gap-1.5 text-purple-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Generating with {shortModel(currentModel)}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-gray-600">token #{currentToken}</span>
                    </div>
                  )}
                  {streamStatus === "done" && generatedFiles.length > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Check className="w-3 h-3" />
                      <span>{generatedFiles.length} file{generatedFiles.length !== 1 ? "s" : ""} generated</span>
                    </div>
                  )}
                  {streamStatus === "done" && generatedFiles.length === 0 && (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Eye className="w-3 h-3" />
                      <span>Response generated — no file blocks detected</span>
                    </div>
                  )}
                  {streamStatus === "error" && (
                    <div className="flex items-center gap-1.5 text-red-400">
                      <X className="w-3 h-3" />
                      <span>{streamError}</span>
                    </div>
                  )}
                  {modelSwitches.length > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-400/70 ml-auto">
                      <RotateCcw className="w-3 h-3" />
                      <span>{modelSwitches.length} rotation{modelSwitches.length !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  {streamStatus === "done" && (
                    <button
                      onClick={() => {
                        setStreamText("");
                        setStreamThinking("");
                        streamTextRef.current = "";
                        streamThinkingRef.current = "";
                        setStreamStatus("idle");
                        setGeneratedFiles([]);
                        setPreviewFile(null);
                        setPushStatus("idle");
                        setPushMessage("");
                        setContextFilesUsed(0);
                      }}
                      className="ml-auto text-gray-700 hover:text-gray-400 transition-colors text-xs">
                      Clear
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Content area ──────────────────────────────────────────────
              Mobile: AI output stacks above generated files (each scrolls
              independently). Desktop: original side-by-side split. */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

            {/* AI output */}
            <div className="flex-1 flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-white/6 min-h-[40dvh] md:min-h-0">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/6 bg-[#0a0a0a] shrink-0">
                <Code2 className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs text-gray-600">AI Output</span>
                {isStreaming && (
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                    className="ml-2 w-1.5 h-1.5 rounded-full bg-purple-500" />
                )}
                {streamStatus !== "idle" && contextFilesUsed > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                    <FileText className="w-3 h-3" />
                    🔍 {contextFilesUsed} context file{contextFilesUsed !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
                {/* ── Thinking panel (chain-of-thought) ─────────────── */}
                {(streamThinking || (isStreaming && streamText === "")) && (
                  <div className="border-b border-white/6 shrink-0 max-h-[50%] flex flex-col">
                    <button
                      onClick={() => setThinkingExpanded(v => !v)}
                      className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-amber-400/80 hover:text-amber-300 hover:bg-white/[0.02] transition-colors shrink-0 text-left">
                      {thinkingExpanded
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />}
                      <Brain className="w-3 h-3" />
                      <span className="font-semibold">🧠 Thinking</span>
                      {isStreaming && streamText === "" && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                          className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                      <span className="ml-auto text-gray-700">
                        {streamThinking.length > 0 ? `${streamThinking.length} chars` : "waiting…"}
                      </span>
                    </button>
                    {thinkingExpanded && (
                      <div ref={thinkingRef}
                        className="overflow-y-auto px-4 pb-3 pt-1 font-mono text-[11px] text-amber-200/60 leading-relaxed whitespace-pre-wrap thin-scrollbar italic">
                        {streamThinking || (
                          <span className="text-gray-700 not-italic">Model is starting up — first tokens incoming…</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* ── Final output ───────────────────────────────────── */}
                <div ref={outputRef}
                  className="flex-1 overflow-y-auto p-4 font-mono text-xs text-gray-400 leading-relaxed whitespace-pre-wrap thin-scrollbar">
                  {streamText ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {streamText}
                    </motion.div>
                  ) : streamStatus === "streaming" ? (
                    <div className="flex items-center gap-2 text-gray-700 text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{streamThinking ? "✍️ Writing answer once thinking finishes…" : "Awaiting first tokens…"}</span>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col items-center justify-center h-full text-gray-700 font-sans">
                      <img src={lithovexLogo} alt="LITHOVEX" className="w-12 h-12 object-contain mb-3 opacity-20" />
                      <p className="font-semibold text-sm mb-1 text-gray-600">LITHOVEX Coder</p>
                      <p className="text-xs text-center max-w-xs leading-relaxed text-gray-700">{emptyMsg}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Generated files + push */}
            <AnimatePresence>
              {(generatedFiles.length > 0 || streamStatus === "done") && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full md:w-80 md:flex-shrink-0 flex flex-col overflow-hidden bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-white/6 max-h-[60dvh] md:max-h-none">

                  {/* File tabs header */}
                  <div className="border-b border-white/6 bg-[#0f0f0f] shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <GitCommit className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-white">Generated Files</span>
                      <span className="ml-auto text-xs text-gray-600">{generatedFiles.length}</span>
                    </div>
                    <div className="flex overflow-x-auto px-2 pb-0 gap-0.5 thin-scrollbar">
                      {generatedFiles.map(f => (
                        <button key={f.path}
                          onClick={() => setPreviewFile(f)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-[11px] transition-all flex-shrink-0 border-b-2 ${
                            previewFile?.path === f.path
                              ? "bg-[#0a0a0a] border-purple-500 text-white"
                              : "border-transparent text-gray-600 hover:text-gray-300 hover:bg-white/4"
                          }`}>
                          {f.isNew
                            ? <Plus className="w-2.5 h-2.5 text-emerald-400" />
                            : <Minus className="w-2.5 h-2.5 text-amber-400" />}
                          <span className="max-w-[100px] truncate font-mono">{f.path.split("/").pop()}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  {previewFile ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-3 py-1.5 border-b border-white/5 bg-[#0a0a0a]">
                        <p className="text-[10px] font-mono text-gray-600 truncate">{previewFile.path}</p>
                      </div>
                      <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap bg-black thin-scrollbar">
                        {previewFile.content}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">
                      Select a file to preview
                    </div>
                  )}

                  {/* Push section */}
                  <div className="border-t border-white/6 p-3 space-y-2.5 bg-[#0f0f0f] shrink-0">
                    <SectionLabel>Push to GitHub</SectionLabel>
                    {!isAuthenticated && <p className="text-[11px] text-amber-500/70">Connect GitHub to push</p>}
                    {isAuthenticated && !hasRepo && <p className="text-[11px] text-amber-500/70">Select a repo to push to</p>}
                    {isAuthenticated && hasRepo && !isCloned && <p className="text-[11px] text-amber-500/70">Clone the repo first</p>}
                    {isAuthenticated && hasRepo && isCloned && (
                      <>
                        <div className="flex items-center bg-[#1c1c1c] border border-white/8 focus-within:border-purple-500/40 rounded-xl px-3 py-2 transition-all duration-200">
                          <input
                            value={commitMsg}
                            onChange={e => setCommitMsg(e.target.value)}
                            placeholder="Commit message…"
                            className="flex-1 bg-transparent border-none outline-none text-base md:text-xs min-h-[44px] md:min-h-0 text-gray-300 placeholder:text-gray-600"
                          />
                        </div>
                        <button
                          onClick={pushToGitHub}
                          disabled={pushStatus === "pushing" || generatedFiles.length === 0}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3.5 md:py-2 min-h-[56px] md:min-h-0 text-sm md:text-xs font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                            pushStatus === "done"
                              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                              : pushStatus === "error"
                              ? "bg-red-500/12 border border-red-500/25 text-red-400"
                              : "bg-white/5 hover:bg-white/8 border border-white/10 hover:border-emerald-500/30 hover:text-emerald-300 text-gray-400"
                          }`}>
                          {pushStatus === "pushing"
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Pushing…</>
                            : pushStatus === "done"
                            ? <><Check className="w-3 h-3" /> Pushed!</>
                            : <><Upload className="w-3 h-3" /> Push {generatedFiles.length} file{generatedFiles.length !== 1 ? "s" : ""}</>}
                        </button>
                        {pushMessage && (
                          <p className={`text-[10px] break-all px-1 ${pushStatus === "done" ? "text-emerald-400" : "text-red-400"}`}>
                            {pushMessage}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>

      {/* ─── Model rotation log ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {modelSwitches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="border-t border-white/6 bg-[#0a0a0a] px-4 py-2 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-gray-700 flex-shrink-0">Rotations:</span>
              <div className="flex gap-3">
                {modelSwitches.map((sw, i) => (
                  <span key={i} className="text-[10px] text-amber-400/60 flex-shrink-0 font-mono">
                    {shortModel(sw.from)} → {shortModel(sw.to)} (tok#{sw.token})
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
