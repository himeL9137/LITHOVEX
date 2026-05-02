// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Playground Page
// Phases 3-8: Model selector, layout, persona, composer + multi-model streaming.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type React from "react";
import ReactMarkdownBase from "react-markdown";
import { ModelSelectorManager } from "@/components/playground/ModelSelectorManager";
import { PersonaManagerModal } from "@/components/playground/PersonaManagerModal";
import { PlaygroundComposer } from "@/components/playground/PlaygroundComposer";
import { usePlaygroundState } from "@/context/PlaygroundContext";
import { usePersonaManager } from "@/hooks/usePersonaManager";
import { useMultiModelStream } from "@/hooks/useMultiModelStream";
import {
  Layers,
  Settings2,
  LayoutGrid,
  Columns2,
  UserCircle2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import type {
  AIResponseState,
  MessageTurnNode,
  ModelConfig,
  PlaygroundConversation,
} from "@/lib/types";
import { HF_MODELS } from "@/components/SettingsPanel";
import { useIsMobile } from "@/hooks/use-mobile";

const ReactMarkdown = ReactMarkdownBase as unknown as React.ComponentType<{ children?: string }>;

export default function PlaygroundPage() {
  const {
    environment,
    setLayoutMode,
    setGlobalSystemPrompt,
    conversations,
    activeConversationId,
  } = usePlaygroundState();
  const { activeModels, layoutMode, globalSystemPrompt } = environment;

  // ── Persona ──────────────────────────────────────────────────────────────
  const personaManager = usePersonaManager();
  const { activePersona } = personaManager;
  useEffect(() => {
    setGlobalSystemPrompt(activePersona?.instructions ?? "");
  }, [activePersona?.instructions, setGlobalSystemPrompt]);

  const [personaModalOpen, setPersonaModalOpen] = useState(false);

  // ── Streaming hook ───────────────────────────────────────────────────────
  const { run: runStream, abortAll } = useMultiModelStream();

  // ── Active conversation + isGenerating derivation ────────────────────────
  const activeConversation: PlaygroundConversation | undefined = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const isGenerating = useMemo(() => {
    if (!activeConversation) return false;
    return activeConversation.messageTurnNodes.some((turn) =>
      Object.values(turn.aiResponses).some(
        (r) => r.status === "streaming" || r.status === "idle"
      )
    );
  }, [activeConversation]);

  // ── Submit handler — fan out streams ─────────────────────────────────────
  // We need the conversation snapshot *before* the new turn was appended so
  // each model sees the prior history. The composer already appended the turn
  // when this fires, so we slice off the last node.
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const handleTurnSubmitted = useCallback(
    ({ conversationId, turnId, userText }: { conversationId: string; turnId: string; userText: string }) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      const fullHistory = conv?.messageTurnNodes ?? [];
      // Strip the just-appended turn from history (last node with this turnId).
      const priorHistory = fullHistory.filter((n) => n.turnId !== turnId);

      runStream({
        conversationId,
        turnId,
        models: activeModels,
        history: priorHistory,
        userText,
        systemPrompt: globalSystemPrompt || undefined,
      });
    },
    [runStream, activeModels, globalSystemPrompt]
  );

  const handleStopGenerating = useCallback(() => abortAll(), [abortAll]);

  // ── Auto-scroll to latest turn ───────────────────────────────────────────
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeConversation?.messageTurnNodes.length]);

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] text-zinc-200 overflow-hidden">

      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="
        flex items-center gap-3 px-5 py-3 flex-wrap
        border-b border-zinc-800/60 bg-zinc-950/50 backdrop-blur-sm
        shrink-0
      ">
        <div className="flex-1 min-w-0">
          <ModelSelectorManager />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setPersonaModalOpen(true)}
            aria-label="Manage system personas"
            title={activePersona ? `Active persona: ${activePersona.name}` : "No active persona"}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold mr-1.5
              border transition-all duration-200
              ${activePersona
                ? "border-indigo-500/40 bg-indigo-600/10 text-indigo-300 hover:bg-indigo-600/20"
                : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
              }
            `}
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {activePersona ? activePersona.name : "Persona"}
            </span>
            {activePersona && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
            )}
          </button>

          <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest mr-1.5 hidden md:block">
            Layout
          </span>
          <button
            onClick={() => setLayoutMode("columns")}
            aria-label="Columns layout"
            aria-pressed={layoutMode === "columns"}
            className={`
              p-2 rounded-lg transition-colors duration-150
              ${layoutMode === "columns"
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"}
            `}
          >
            <Columns2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode("masonry")}
            aria-label="Masonry layout"
            aria-pressed={layoutMode === "masonry"}
            className={`
              p-2 rounded-lg transition-colors duration-150
              ${layoutMode === "masonry"
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"}
            `}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            aria-label="Playground settings"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors duration-150"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active persona banner */}
      {activePersona && (
        <div className="
          shrink-0 flex items-center gap-2 px-5 py-1.5
          border-b border-indigo-900/30 bg-indigo-950/20
        ">
          <UserCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-[11px] text-indigo-400 font-medium">
            {activePersona.name}
          </span>
          <span className="text-[11px] text-indigo-700 truncate hidden sm:block">
            — {activePersona.description || activePersona.instructions.slice(0, 80) + "…"}
          </span>
        </div>
      )}

      {/* ── Scrollable content area ──────────────────────────────────────── */}
      <div ref={scrollAreaRef} className="flex-1 overflow-auto p-5">
        {activeModels.length === 0 ? (
          <EmptyState
            onPickPersona={() => setPersonaModalOpen(true)}
            hasPersona={!!activePersona}
          />
        ) : !activeConversation || activeConversation.messageTurnNodes.length === 0 ? (
          <ReadyState models={activeModels} />
        ) : (
          <div className="space-y-6">
            {activeConversation.messageTurnNodes.map((turn) => (
              <TurnRow
                key={turn.turnId}
                turn={turn}
                models={activeModels}
                layoutMode={layoutMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Composer ─────────────────────────────────────────────────────── */}
      <PlaygroundComposer
        isGenerating={isGenerating}
        onStopGenerating={handleStopGenerating}
        onTurnSubmitted={handleTurnSubmitted}
      />

      <PersonaManagerModal
        isOpen={personaModalOpen}
        onClose={() => setPersonaModalOpen(false)}
        manager={personaManager}
      />
    </div>
  );
}

// ─── Empty / ready states ────────────────────────────────────────────────────

function EmptyState({ onPickPersona, hasPersona }: { onPickPersona: () => void; hasPersona: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center mx-auto">
          <Layers className="w-8 h-8 text-purple-400/70" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-200">
          Start by selecting models
        </h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Use the <span className="text-zinc-300 font-medium">+ Add Model</span> button above to pick one
          or more AI models. Each will get its own response column so you can compare outputs side-by-side.
        </p>
        {!hasPersona && (
          <button
            onClick={onPickPersona}
            className="
              inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
              border border-indigo-800/50 bg-indigo-950/40 text-indigo-400
              hover:bg-indigo-900/40 hover:text-indigo-300 transition-all duration-150
            "
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            Set a system persona (optional)
          </button>
        )}
      </div>
    </div>
  );
}

function ReadyState({ models }: { models: ModelConfig[] }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3 max-w-md">
        <div className="flex justify-center -space-x-2">
          {models.slice(0, 5).map((m) => (
            <span
              key={m.id}
              className="w-8 h-8 rounded-full border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: `${m.colorTheme}30`, color: m.colorTheme }}
            >
              {m.name.charAt(0)}
            </span>
          ))}
        </div>
        <h2 className="text-base font-semibold text-zinc-300">
          {models.length} model{models.length === 1 ? "" : "s"} ready
        </h2>
        <p className="text-xs text-zinc-600">
          Type a message below — each model will respond in its own column.
        </p>
      </div>
    </div>
  );
}

// ─── Turn row: user prompt + per-model response cards ───────────────────────

function TurnRow({
  turn,
  models,
  layoutMode,
}: {
  turn: MessageTurnNode;
  models: ModelConfig[];
  layoutMode: "columns" | "masonry";
}) {
  // ── Mobile: collapse the side-by-side cards into a single, full-width
  //    column so each model's response is fully readable on small screens.
  const isMobile = useIsMobile();
  return (
    <div className="space-y-3">
      {/* User prompt bubble */}
      <div className="flex justify-end">
        <div className="max-w-[90%] md:max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600/15 border border-indigo-500/30 px-4 py-2.5">
          <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words">
            {turn.userMessage.content}
          </p>
          {turn.userMessage.attachments && turn.userMessage.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {turn.userMessage.attachments.map((a) => (
                <span
                  key={a.id}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/40"
                >
                  {a.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Response cards grid — single column on mobile, masonry/columns on md+. */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: isMobile
            ? "1fr"
            : layoutMode === "masonry"
              ? "repeat(auto-fill, minmax(280px, 1fr))"
              : `repeat(${Math.min(models.length, 3)}, minmax(0, 1fr))`,
        }}
      >
        {models.map((cfg) => {
          const resp = turn.aiResponses[cfg.id];
          return <ModelResponseCard key={cfg.id} config={cfg} response={resp} />;
        })}
      </div>
    </div>
  );
}

// ─── Model response card with markdown + status + metrics ────────────────────

function ModelResponseCard({
  config,
  response,
}: {
  config: ModelConfig;
  response?: AIResponseState;
}) {
  const meta = HF_MODELS.find((m) => m.id === config.id);
  const displayName = meta?.label ?? config.name.split("/").pop() ?? config.name;
  const status = response?.status ?? "idle";
  const content = response?.content ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [content]);

  return (
    <div
      className="flex flex-col rounded-2xl border bg-zinc-900/50 overflow-hidden min-h-[180px]"
      style={{ borderColor: `${config.colorTheme}30` }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: `${config.colorTheme}20` }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: config.colorTheme }}
        />
        <span
          className="text-xs font-semibold truncate"
          style={{ color: config.colorTheme }}
          title={config.id}
        >
          {displayName}
        </span>
        <StatusBadge status={status} />
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {response?.latencyMs != null && (
            <span className="text-[10px] text-zinc-600 tabular-nums" title="Time to first token">
              {response.latencyMs}ms
            </span>
          )}
          {response?.tokensPerSecond != null && response.tokensPerSecond > 0 && (
            <span className="text-[10px] text-zinc-600 tabular-nums" title="Tokens per second">
              ~{response.tokensPerSecond} t/s
            </span>
          )}
          {content && (
            <button
              onClick={handleCopy}
              aria-label="Copy response"
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3 overflow-auto">
        {status === "error" ? (
          <div className="flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">Stream failed</div>
              <div className="text-red-500/80">{response?.errorDetail ?? "Unknown error"}</div>
            </div>
          </div>
        ) : !content && status === "idle" ? (
          <div className="flex items-center gap-2 text-[11px] text-zinc-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting…
          </div>
        ) : !content && status === "streaming" ? (
          <div className="flex items-center gap-2 text-[11px] text-zinc-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            Waiting for first token…
          </div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-code:text-indigo-300">
            <ReactMarkdown>{content}</ReactMarkdown>
            {status === "streaming" && (
              <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-zinc-400 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AIResponseState["status"] }) {
  if (status === "streaming") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        streaming
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-emerald-500/80">
        <CheckCircle2 className="w-2.5 h-2.5" />
        done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-400">
        <AlertCircle className="w-2.5 h-2.5" />
        error
      </span>
    );
  }
  return null;
}
