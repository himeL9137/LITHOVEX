/**
 * LITHOVEX AI — GitHubPanel
 * ──────────────────────────────────────────────────────────────────────────
 * Full GitHub integration panel: Device Flow OAuth, repo browser,
 * pull (clone/fetch), file tree, and push back to GitHub.
 * Aesthetic: cyber-gothic black + blood-red.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useGitHub, type GitHubRepo, type FileTreeEntry } from "@/hooks/useGitHub";

// ─── Icons (inline SVG to avoid extra deps) ──────────────────────────────────

const IconGitHub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const IconFolder = ({ open }: { open?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.85 }}>
    {open
      ? <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
      : <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />}
  </svg>
);

const IconFile = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
  </svg>
);

const IconLock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  panel: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    background: "#0a0a0c",
    color: "#e8e8e8",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    fontSize: "13px",
  },
  header: {
    padding: "14px 16px 10px",
    borderBottom: "1px solid #1e0a0a",
    background: "linear-gradient(to right, #0e0808, #0a0a0c)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#cc2020",
    textTransform: "uppercase" as const,
  },
  body: { flex: 1, overflowY: "auto" as const, padding: "12px 14px" },
  section: { marginBottom: "18px" },
  label: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.15em",
    color: "#5a1010",
    textTransform: "uppercase" as const,
    marginBottom: "8px",
  },
  btn: (variant: "primary" | "ghost" | "danger" = "ghost") => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "3px",
    border: variant === "primary" ? "1px solid #8b0000"
          : variant === "danger"  ? "1px solid #5a0000"
          : "1px solid #1e1212",
    background: variant === "primary" ? "linear-gradient(135deg, #6b0000, #3d0000)"
              : variant === "danger"  ? "#1a0000"
              : "transparent",
    color: variant === "primary" ? "#ff4444"
         : variant === "danger"  ? "#cc2020"
         : "#a08080",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    transition: "all 0.15s",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
  }),
  input: {
    width: "100%",
    background: "#0d0808",
    border: "1px solid #2a1010",
    borderRadius: "3px",
    padding: "8px 10px",
    color: "#e8e8e8",
    fontSize: "12px",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  badge: (variant: "red" | "dim") => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "10px",
    padding: "2px 7px",
    borderRadius: "2px",
    background: variant === "red" ? "#3d0000" : "#151010",
    color: variant === "red" ? "#ff4444" : "#6a4a4a",
    border: "1px solid " + (variant === "red" ? "#5a0000" : "#1e0e0e"),
    letterSpacing: "0.05em",
    fontWeight: 600,
  }),
  repoItem: (selected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "3px",
    cursor: "pointer",
    background: selected ? "#160808" : "transparent",
    border: `1px solid ${selected ? "#3d0000" : "transparent"}`,
    marginBottom: "2px",
    transition: "all 0.12s",
  }),
  codeBox: {
    background: "#060404",
    border: "1px solid #1e0a0a",
    borderRadius: "4px",
    padding: "14px",
    fontFamily: "inherit",
    fontSize: "12px",
    color: "#e8e8e8",
    maxHeight: "160px",
    overflowY: "auto" as const,
  },
  userCodeDisplay: {
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "0.25em",
    color: "#ff3030",
    textAlign: "center" as const,
    padding: "16px 0 8px",
    textShadow: "0 0 20px #ff000040",
  },
  treeItem: (isDir: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 8px",
    borderRadius: "2px",
    cursor: "pointer",
    color: isDir ? "#cc8080" : "#a08080",
    transition: "background 0.1s",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  statusBar: {
    padding: "6px 14px",
    borderTop: "1px solid #1e0a0a",
    fontSize: "11px",
    color: "#5a3030",
    display: "flex",
    gap: "12px",
    flexShrink: 0,
    background: "#080606",
  },
  divider: { height: "1px", background: "#1a0a0a", margin: "14px 0" },
  tabs: { display: "flex", gap: "2px", marginBottom: "12px" },
  tab: (active: boolean) => ({
    padding: "5px 12px",
    borderRadius: "2px 2px 0 0",
    border: "1px solid " + (active ? "#3d0000" : "transparent"),
    borderBottom: active ? "1px solid #0a0a0c" : "1px solid #1e0a0a",
    background: active ? "#160808" : "transparent",
    color: active ? "#ff4444" : "#5a3030",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    fontFamily: "inherit",
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeviceFlowAuth({ onPAT }: { onPAT: (t: string) => void }) {
  const { authStep, userCode, verificationUrl, authError, startDeviceFlow } = useGitHub();
  const [pat, setPat] = useState("");
  const [showPAT, setShowPAT] = useState(false);

  return (
    <div>
      {authStep === "idle" || authStep === "error" ? (
        <div>
          <div style={{ color: "#7a4a4a", fontSize: "12px", marginBottom: "14px", lineHeight: 1.6 }}>
            Connect GitHub to pull/push repos directly from LITHOVEX AI.<br />
            Uses <span style={{ color: "#cc4040" }}>Device Flow</span> — no redirect URL needed.
          </div>
          {authError && (
            <div style={{ color: "#ff4444", fontSize: "11px", marginBottom: "10px", background: "#1a0000", padding: "8px 10px", borderRadius: "3px", border: "1px solid #3d0000" }}>
              {authError}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button style={S.btn("primary")} onClick={startDeviceFlow}>
              <IconGitHub /> Login with GitHub
            </button>
            <button style={S.btn("ghost")} onClick={() => setShowPAT((v) => !v)}>
              Use PAT
            </button>
          </div>
          {showPAT && (
            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <input
                style={S.input}
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
              />
              <button style={S.btn("primary")} onClick={() => onPAT(pat)}>
                Connect
              </button>
            </div>
          )}
        </div>
      ) : authStep === "waiting_user" ? (
        <div style={{ textAlign: "center", color: "#7a4a4a", padding: "20px 0" }}>
          Starting device flow…
        </div>
      ) : authStep === "polling" ? (
        <div>
          <div style={{ color: "#7a4a4a", fontSize: "12px", marginBottom: "6px" }}>
            Open this URL in your browser, then enter the code:
          </div>
          <a href={verificationUrl} target="_blank" rel="noreferrer"
             style={{ color: "#cc4040", fontSize: "12px", wordBreak: "break-all" }}>
            {verificationUrl}
          </a>
          <div style={S.userCodeDisplay}>{userCode}</div>
          <div style={{ textAlign: "center", color: "#5a3030", fontSize: "11px", marginTop: "4px" }}>
            ⏳ Waiting for authorization…
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RepoList({
  repos, reposLoading, selectedRepo, onSelect, onRefresh,
}: {
  repos: GitHubRepo[];
  reposLoading: boolean;
  selectedRepo: GitHubRepo | null;
  onSelect: (r: GitHubRepo) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = filter
    ? repos.filter((r) => r.full_name.toLowerCase().includes(filter.toLowerCase()))
    : repos;

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", alignItems: "center" }}>
        <input
          style={{ ...S.input, flex: 1 }}
          placeholder="Filter repos…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button style={S.btn("ghost")} onClick={onRefresh} title="Refresh">
          {reposLoading ? "…" : "↺"}
        </button>
      </div>
      <div className="lvx-gh-repo-list" style={{ maxHeight: "240px", overflowY: "auto" }}>
        {reposLoading ? (
          <div style={{ color: "#5a3030", padding: "12px 0", textAlign: "center" }}>Loading repos…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#5a3030", padding: "12px 0", textAlign: "center" }}>No repos found</div>
        ) : (
          filtered.map((repo) => (
            <div key={repo.id} style={S.repoItem(selectedRepo?.id === repo.id)} onClick={() => onSelect(repo)}>
              {repo.private && <span><IconLock /></span>}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", color: selectedRepo?.id === repo.id ? "#ff6060" : "#c08080" }}>
                {repo.full_name}
              </span>
              {repo.language && (
                <span style={{ ...S.badge("dim"), flexShrink: 0 }}>{repo.language}</span>
              )}
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: "6px", color: "#3a2020", fontSize: "10px" }}>
        {repos.length} repos · {repos.filter((r) => r.private).length} private
      </div>
    </div>
  );
}

function FileTree({
  entries, treePath, onNavigate,
}: {
  entries: FileTreeEntry[];
  treePath: string;
  onNavigate: (path: string, isDir: boolean) => void;
}) {
  return (
    <div className="lvx-gh-tree" style={{ maxHeight: "200px", overflowY: "auto" }}>
      {treePath && (
        <div
          style={{ ...S.treeItem(true), color: "#8b4040" }}
          onClick={() => {
            const parts = treePath.split("/");
            parts.pop();
            onNavigate(parts.join("/"), true);
          }}
        >
          ← ..
        </div>
      )}
      {entries.length === 0 ? (
        <div style={{ color: "#3a2020", padding: "8px", fontSize: "11px" }}>Empty directory</div>
      ) : (
        entries.map((e) => (
          <div key={e.path} style={S.treeItem(e.type === "dir")} onClick={() => onNavigate(e.path, e.type === "dir")}>
            {e.type === "dir" ? <IconFolder /> : <IconFile />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", fontSize: "12px" }}>{e.name}</span>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GitHubPanelProps {
  /** Called when user selects a file — passes full content for use in chat */
  onFileSelect?: (fileName: string, content: string, repoFullName: string) => void;
  /** Called when a repo is pulled — so file explorer can refresh */
  onRepoPulled?: (localPath: string, repoFullName: string) => void;
}

export function GitHubPanel({ onFileSelect, onRepoPulled }: GitHubPanelProps) {
  const gh = useGitHub();
  const [tab, setTab] = useState<"repos" | "push">("repos");
  const [commitMsg, setCommitMsg] = useState("LITHOVEX AI: update files");
  const [filesToPush, setFilesToPush] = useState<Array<{ path: string; content: string }>>([]);
  const [newFilePath, setNewFilePath] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const handleRepoSelect = useCallback(async (repo: GitHubRepo) => {
    await gh.selectRepo(repo);
  }, [gh]);

  const handleTreeNavigate = useCallback((path: string, isDir: boolean) => {
    if (!gh.selectedRepo) return;
    if (isDir) {
      gh.loadFileTree(gh.selectedRepo, path);
    } else {
      gh.readFile(gh.selectedRepo, path).then((content) => {
        onFileSelect?.(path.split("/").pop() ?? path, content, gh.selectedRepo!.full_name);
      }).catch(console.error);
    }
  }, [gh, onFileSelect]);

  const handlePull = useCallback(() => {
    if (!gh.selectedRepo) return;
    gh.pullRepo(gh.selectedRepo).then(() => {
      if (gh.selectedRepo && gh.repoStatus?.localPath) {
        onRepoPulled?.(gh.repoStatus.localPath, gh.selectedRepo.full_name);
      }
    });
  }, [gh, onRepoPulled]);

  const handlePush = useCallback(() => {
    if (!gh.selectedRepo || filesToPush.length === 0) return;
    gh.pushChanges(gh.selectedRepo, filesToPush, commitMsg);
  }, [gh, filesToPush, commitMsg]);

  const addFile = useCallback(() => {
    if (!newFilePath.trim()) return;
    setFilesToPush((prev) => {
      const existing = prev.findIndex((f) => f.path === newFilePath);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { path: newFilePath, content: newFileContent };
        return updated;
      }
      return [...prev, { path: newFilePath, content: newFileContent }];
    });
    setNewFilePath(""); setNewFileContent("");
  }, [newFilePath, newFileContent]);

  // ── Mobile responsive overrides ─────────────────────────────────────────
  // The panel is heavily inline-styled (cyber-gothic theme). Rather than
  // re-author every style entry, we scope a single <style> block to a wrapper
  // class that only fires under 768px — this leaves desktop pixel-perfect
  // while giving mobile users 16px inputs (no iOS zoom), 44px tap targets,
  // and 56px primary action buttons in a sticky bottom toolbar feel.
  const mobileCss = `
    @media (max-width: 767px) {
      .lvx-gh-panel { font-size: 14px; }
      .lvx-gh-panel input,
      .lvx-gh-panel textarea {
        font-size: 16px !important;
        min-height: 44px;
        padding: 10px 12px !important;
        box-sizing: border-box;
      }
      .lvx-gh-panel textarea { min-height: 96px; }
      .lvx-gh-panel button {
        min-height: 44px;
        padding-left: 14px !important;
        padding-right: 14px !important;
        font-size: 13px !important;
      }
      .lvx-gh-panel .lvx-gh-primary-btn { min-height: 56px; width: 100%; justify-content: center; }
      .lvx-gh-panel .lvx-gh-section { margin-bottom: 22px; }
      .lvx-gh-panel .lvx-gh-repo-list { max-height: 38dvh !important; }
      .lvx-gh-panel .lvx-gh-tree { max-height: 38dvh !important; }
    }
  `;

  // Not authenticated
  if (gh.authStep !== "authenticated") {
    return (
      <div className="lvx-gh-panel" style={S.panel}>
        <style>{mobileCss}</style>
        <div style={S.header}>
          <span style={{ color: "#8b0000" }}><IconGitHub /></span>
          <span style={S.headerTitle}>GitHub</span>
        </div>
        <div style={S.body}>
          <DeviceFlowAuth onPAT={gh.loginWithPAT} />
        </div>
      </div>
    );
  }

  return (
    <div className="lvx-gh-panel" style={S.panel}>
      <style>{mobileCss}</style>
      {/* Header */}
      <div style={S.header}>
        <span style={{ color: "#cc2020" }}><IconGitHub /></span>
        <span style={S.headerTitle}>GitHub</span>
        <div style={{ flex: 1 }} />
        {gh.user && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img
              src={gh.user.avatar_url}
              alt={gh.user.login}
              style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #3d0000" }}
            />
            <span style={{ color: "#8b4040", fontSize: "11px" }}>{gh.user.login}</span>
            <button style={{ ...S.btn("ghost"), padding: "3px 8px", fontSize: "10px" }} onClick={gh.logout}>
              logout
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: "10px 14px 0", borderBottom: "1px solid #1e0a0a" }}>
        <div style={S.tabs}>
          <button style={S.tab(tab === "repos")} onClick={() => setTab("repos")}>Repos</button>
          <button style={S.tab(tab === "push")} onClick={() => setTab("push")}>Push</button>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>

        {/* ── REPOS TAB ── */}
        {tab === "repos" && (
          <>
            <div style={S.section}>
              <div style={S.label}>Your Repositories</div>
              {gh.repos.length === 0 ? (
                <button style={S.btn("primary")} onClick={gh.loadRepos}>
                  <IconGitHub /> Load Repos
                </button>
              ) : (
                <RepoList
                  repos={gh.repos}
                  reposLoading={gh.reposLoading}
                  selectedRepo={gh.selectedRepo}
                  onSelect={handleRepoSelect}
                  onRefresh={gh.loadRepos}
                />
              )}
            </div>

            {gh.selectedRepo && (
              <>
                <div style={S.divider} />
                <div style={S.section}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <span style={{ ...S.badge("red"), fontSize: "12px" }}>
                      {gh.selectedRepo.full_name}
                    </span>
                    {gh.selectedRepo.private && <span style={S.badge("dim")}><IconLock /> private</span>}
                  </div>

                  {/* Git status */}
                  {gh.repoStatus && (
                    <div style={{ ...S.codeBox, maxHeight: "80px", marginBottom: "10px", fontSize: "11px", color: "#7a4a4a" }}>
                      {gh.repoStatus.cloned ? (
                        <>
                          <div>branch: <span style={{ color: "#cc4040" }}>{gh.repoStatus.branch}</span></div>
                          <div>commit: <span style={{ color: "#8b5050" }}>{gh.repoStatus.lastCommit ?? "—"}</span></div>
                          {gh.repoStatus.modified.length > 0 && (
                            <div>modified: <span style={{ color: "#ff6060" }}>{gh.repoStatus.modified.length} files</span></div>
                          )}
                          {(gh.repoStatus.ahead > 0 || gh.repoStatus.behind > 0) && (
                            <div>↑{gh.repoStatus.ahead} ↓{gh.repoStatus.behind}</div>
                          )}
                        </>
                      ) : (
                        <div style={{ color: "#5a3030" }}>Not cloned locally yet</div>
                      )}
                    </div>
                  )}

                  <button
                    className="lvx-gh-primary-btn"
                    style={S.btn("primary")}
                    onClick={handlePull}
                    disabled={gh.pulling}
                  >
                    {gh.pulling ? "⏳ Pulling…" : gh.repoStatus?.cloned ? "↓ Pull Latest" : "↓ Clone Repo"}
                  </button>

                  {gh.pullLog.length > 0 && (
                    <div style={{ ...S.codeBox, marginTop: "10px" }}>
                      {gh.pullLog.map((l, i) => (
                        <div key={i} style={{ marginBottom: "2px" }}>{l}</div>
                      ))}
                    </div>
                  )}
                </div>

                {gh.repoStatus?.cloned && (
                  <>
                    <div style={S.divider} />
                    <div style={S.section}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <div style={S.label}>File Explorer</div>
                        {gh.treePath && (
                          <span style={{ color: "#5a3030", fontSize: "11px" }}>/{gh.treePath}</span>
                        )}
                      </div>
                      <div style={{ ...S.codeBox, padding: "6px" }}>
                        <FileTree
                          entries={gh.fileTree}
                          treePath={gh.treePath}
                          onNavigate={handleTreeNavigate}
                        />
                      </div>
                      <div style={{ marginTop: "6px", color: "#3a2020", fontSize: "10px" }}>
                        Click file → opens in chat context · Click folder → navigate
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── PUSH TAB ── */}
        {tab === "push" && (
          <>
            {!gh.selectedRepo ? (
              <div style={{ color: "#5a3030", fontSize: "12px", padding: "10px 0" }}>
                Select a repo first in the Repos tab.
              </div>
            ) : (
              <>
                <div style={S.section}>
                  <div style={S.label}>Target Repo</div>
                  <span style={S.badge("red")}>{gh.selectedRepo.full_name}</span>
                  {!gh.repoStatus?.cloned && (
                    <div style={{ color: "#8b4040", fontSize: "11px", marginTop: "8px" }}>
                      ⚠️ Clone this repo first in the Repos tab.
                    </div>
                  )}
                </div>

                <div style={S.section}>
                  <div style={S.label}>Commit Message</div>
                  <input
                    style={S.input}
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    placeholder="feat: update via LITHOVEX AI"
                  />
                </div>

                <div style={S.section}>
                  <div style={S.label}>Files to Commit</div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                    <input
                      style={{ ...S.input, flex: 1 }}
                      placeholder="src/index.ts"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                    />
                    <button style={{ ...S.btn("ghost"), flexShrink: 0 }} onClick={addFile}>
                      + Add
                    </button>
                  </div>
                  <textarea
                    style={{ ...S.input, height: "80px", resize: "vertical" }}
                    placeholder="File content…"
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                  />

                  {filesToPush.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      {filesToPush.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", background: "#0d0606", borderRadius: "2px", marginBottom: "2px" }}>
                          <IconFile />
                          <span style={{ flex: 1, color: "#8b5050", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis" }}>{f.path}</span>
                          <button
                            style={{ ...S.btn("danger"), padding: "2px 8px", fontSize: "10px" }}
                            onClick={() => setFilesToPush((prev) => prev.filter((_, j) => j !== i))}
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="lvx-gh-primary-btn"
                  style={S.btn("primary")}
                  onClick={handlePush}
                  disabled={gh.pushing || filesToPush.length === 0 || !gh.repoStatus?.cloned}
                >
                  {gh.pushing ? "⏳ Pushing…" : `↑ Commit & Push (${filesToPush.length} file${filesToPush.length !== 1 ? "s" : ""})`}
                </button>

                {gh.pushResult && (
                  <div style={{
                    ...S.codeBox,
                    marginTop: "10px",
                    color: gh.pushResult.startsWith("✅") ? "#44cc44" : "#ff4444",
                  }}>
                    {gh.pushResult}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={S.statusBar}>
        <span>{gh.authStep === "authenticated" ? `● connected as ${gh.user?.login}` : "○ not connected"}</span>
        {gh.selectedRepo && <span style={{ color: "#3a2020" }}>repo: {gh.selectedRepo.name}</span>}
        {gh.repoStatus?.branch && <span style={{ color: "#3a2020" }}>branch: {gh.repoStatus.branch}</span>}
      </div>
    </div>
  );
}
