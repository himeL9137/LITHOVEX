/**
 * LITHOVEX AI — useGitHub hook
 * Manages GitHub auth state, repo listing, pull/push, and file operations.
 */

import { useState, useCallback, useEffect } from "react";

const API = "/api/github";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
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

export interface RepoStatus {
  repoFullName: string;
  localPath: string;
  cloned: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
  lastCommit: string | null;
}

export interface FileTreeEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export type AuthStep =
  | "idle"
  | "waiting_user"
  | "polling"
  | "popup_open"
  | "authenticated"
  | "error";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGitHub() {
  const [authStep, setAuthStep] = useState<AuthStep>("idle");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [userCode, setUserCode] = useState<string>("");
  const [verificationUrl, setVerificationUrl] = useState<string>("");
  const [deviceCode, setDeviceCode] = useState<string>("");
  const [pollInterval, setPollInterval] = useState<number>(5);
  const [authError, setAuthError] = useState<string>("");
  const [deviceFlowAvailable, setDeviceFlowAvailable] = useState<boolean | null>(null);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeEntry[]>([]);
  const [treePath, setTreePath] = useState<string>("");
  const [pullLog, setPullLog] = useState<string[]>([]);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string>("");

  // Check auth + device-flow config on mount
  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setUser(d.user);
          setAuthStep("authenticated");
        }
      })
      .catch(() => {});

    fetch(`${API}/config`)
      .then((r) => r.json())
      .then((d) => setDeviceFlowAvailable(d.deviceFlowAvailable === true))
      .catch(() => setDeviceFlowAvailable(false));
  }, []);

  // ── OAuth Device Flow ────────────────────────────────────────────────────────

  const startDeviceFlow = useCallback(async () => {
    setAuthError("");
    setAuthStep("waiting_user");
    try {
      const res = await fetch(`${API}/device/start`, { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUserCode(data.user_code);
      setVerificationUrl(data.verification_uri);
      setDeviceCode(data.device_code);
      setPollInterval(data.interval ?? 5);
      // Open browser
      window.open(data.verification_uri, "_blank");
      setAuthStep("polling");
    } catch (e) {
      setAuthError((e as Error).message);
      setAuthStep("error");
    }
  }, []);

  // ── Browser-popup OAuth (Web Application Flow) ──────────────────────────────
  // Opens a small popup window pointed at GitHub's authorize URL. Backend
  // returns an HTML page that calls window.opener.postMessage(...) once the
  // exchange completes, so we don't need polling.
  const startBrowserOAuth = useCallback(async () => {
    setAuthError("");
    try {
      const r = await fetch(
        `${API}/oauth/start?origin=${encodeURIComponent(window.location.origin)}`,
      );
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error ?? `HTTP ${r.status}`);
      const url = data.authorize_url as string;
      const w = 720;
      const h = 800;
      const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      const popup = window.open(
        url,
        "lithovex-github-oauth",
        `width=${w},height=${h},left=${left},top=${top},popup=yes,noopener=no`,
      );
      if (!popup) {
        throw new Error(
          "Popup was blocked. Allow popups for this site and try again, or use Device Flow.",
        );
      }
      setAuthStep("popup_open");

      // Listen once for the postMessage from the callback page.
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          clearInterval(checkClosed);
        };
        const onMessage = (ev: MessageEvent) => {
          const d = ev.data;
          if (!d || d.type !== "lithovex:github-oauth") return;
          done = true;
          cleanup();
          if (d.ok && d.payload?.user) {
            setUser(d.payload.user);
            setAuthStep("authenticated");
            resolve();
          } else {
            const msg =
              d.payload?.error ?? "GitHub authorization failed.";
            setAuthError(String(msg));
            setAuthStep("error");
            reject(new Error(String(msg)));
          }
        };
        window.addEventListener("message", onMessage);
        // If the user closes the popup before completing, fall back to a
        // status-check so we don't get stuck.
        const checkClosed = setInterval(async () => {
          if (popup.closed && !done) {
            cleanup();
            try {
              const sr = await fetch(`${API}/status`).then((r) => r.json());
              if (sr.authenticated && sr.user) {
                setUser(sr.user);
                setAuthStep("authenticated");
                resolve();
                return;
              }
            } catch {/* ignore */}
            setAuthError("Authorization window closed before completing.");
            setAuthStep("error");
            reject(new Error("popup closed"));
          }
        }, 500);
      });
    } catch (e) {
      setAuthError((e as Error).message);
      setAuthStep("error");
    }
  }, []);

  const loginWithPAT = useCallback(async (token: string) => {
    const res = await fetch(`${API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.user) {
      setUser(data.user);
      setAuthStep("authenticated");
    }
  }, []);

  // Poll for token
  useEffect(() => {
    if (authStep !== "polling" || !deviceCode) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${API}/device/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: deviceCode }),
        });
        const data = await res.json();
        if (data.status === "authorized" && data.user) {
          setUser(data.user);
          setAuthStep("authenticated");
          clearInterval(id);
        } else if (data.status === "expired" || data.status === "error") {
          setAuthError("Authorization expired or failed. Try again.");
          setAuthStep("error");
          clearInterval(id);
        }
      } catch {/* keep polling */}
    }, pollInterval * 1000);
    return () => clearInterval(id);
  }, [authStep, deviceCode, pollInterval]);

  const logout = useCallback(async () => {
    await fetch(`${API}/logout`, { method: "POST" });
    setUser(null); setAuthStep("idle"); setRepos([]); setSelectedRepo(null);
  }, []);

  // ── Repos ────────────────────────────────────────────────────────────────────

  const loadRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch(`${API}/repos`);
      const data = await res.json();
      setRepos(data.repos ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setReposLoading(false);
    }
  }, []);

  const selectRepo = useCallback(async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setPullLog([]);
    setPushResult("");
    setTreePath("");
    setFileTree([]);
    // Load status
    try {
      const [owner, name] = repo.full_name.split("/");
      const res = await fetch(`${API}/repos/${owner}/${name}/status`);
      const data = await res.json();
      setRepoStatus(data);
      if (data.cloned) loadFileTree(repo, "");
    } catch {/* ok */}
  }, []);

  const loadFileTree = useCallback(async (repo: GitHubRepo, subPath: string) => {
    const [owner, name] = repo.full_name.split("/");
    const res = await fetch(`${API}/repos/${owner}/${name}/tree?path=${encodeURIComponent(subPath)}`);
    const data = await res.json();
    setFileTree(data.tree ?? []);
    setTreePath(subPath);
  }, []);

  const pullRepo = useCallback(async (repo: GitHubRepo) => {
    const [owner, name] = repo.full_name.split("/");
    setPulling(true);
    setPullLog([]);
    const res = await fetch(`${API}/repos/${owner}/${name}/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_branch: repo.default_branch }),
    });
    const reader = res.body?.getReader();
    if (!reader) { setPulling(false); return; }
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.msg) setPullLog((l) => [...l, payload.msg]);
            if (payload.done) {
              setPullLog((l) => [...l, `✅ ${payload.action === "cloned" ? "Cloned" : "Pulled"} successfully!`]);
              loadFileTree(repo, "");
              // Refresh status
              const sRes = await fetch(`${API}/repos/${owner}/${name}/status`);
              setRepoStatus(await sRes.json());
            }
            if (payload.error) setPullLog((l) => [...l, `❌ ${payload.error}`]);
          } catch {/* skip */}
        }
      }
    }
    setPulling(false);
  }, [loadFileTree]);

  const pushChanges = useCallback(async (
    repo: GitHubRepo,
    files: Array<{ path: string; content: string }>,
    message: string,
  ) => {
    const [owner, name] = repo.full_name.split("/");
    setPushing(true);
    setPushResult("");
    try {
      const res = await fetch(`${API}/repos/${owner}/${name}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, message }),
      });
      const data = await res.json();
      if (data.error) setPushResult(`❌ ${data.error}`);
      else setPushResult(`✅ ${data.message} (${data.commitHash ?? ""})`);
    } catch (e) {
      setPushResult(`❌ ${(e as Error).message}`);
    } finally {
      setPushing(false);
    }
  }, []);

  const readFile = useCallback(async (repo: GitHubRepo, filePath: string): Promise<string> => {
    const [owner, name] = repo.full_name.split("/");
    const res = await fetch(`${API}/repos/${owner}/${name}/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.content as string;
  }, []);

  return {
    // Auth
    authStep, user, userCode, verificationUrl, authError, deviceFlowAvailable,
    startDeviceFlow, startBrowserOAuth, loginWithPAT, logout,
    // Repos
    repos, reposLoading, selectedRepo,
    repoStatus, fileTree, treePath,
    loadRepos, selectRepo, loadFileTree,
    // Git ops
    pullLog, pulling, pushResult, pushing,
    pullRepo, pushChanges, readFile,
  };
}
