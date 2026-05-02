import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@workspace/api-client-react";
import ReactMarkdownBase from "react-markdown";
import type { Options as ReactMarkdownOptions } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import lithovexLogo from "@/assets/lithovex-logo.png";
import { MessageAttachments } from "@/components/MessageAttachments";
import { parseMessageContent } from "@/lib/messageAttachments";

const ReactMarkdown = ReactMarkdownBase as unknown as React.ComponentType<ReactMarkdownOptions>;

interface ChatMessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  streamingContent?: string | null;
  autoScroll: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-white/8 text-gray-600 hover:text-gray-400 transition-colors"
      title="Copy"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Reasoning parsing
 *  Models emit their chain of thought between <think>…</think> tags. We split
 *  it out from the answer so we can show it in a dedicated collapsible panel
 *  (instead of stripping it silently like the old UI did).
 * ────────────────────────────────────────────────────────────────────────── */
function parseReasoning(text: string): { reasoning: string; answer: string; closed: boolean } {
  if (!text) return { reasoning: "", answer: "", closed: true };
  const open = text.indexOf("<think>");
  if (open < 0) return { reasoning: "", answer: text, closed: true };
  const close = text.indexOf("</think>", open);
  if (close < 0) {
    // Still streaming the reasoning, no answer yet.
    return { reasoning: text.slice(open + 7), answer: "", closed: false };
  }
  return {
    reasoning: text.slice(open + 7, close),
    answer: text.slice(close + 8).replace(/^\s+/, ""),
    closed: true,
  };
}

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} minute${m === 1 ? "" : "s"}` : `${m}m ${r}s`;
}

/* ──────────────────────────────────────────────────────────────────────────
 *  ReasoningPanel — collapsible "Thought for Xs" panel
 *  Replaces the old shimmer-bar ThinkingBubble.
 * ────────────────────────────────────────────────────────────────────────── */
function ReasoningPanel({
  reasoning,
  thinking,
  elapsedMs,
  defaultOpen = false,
}: {
  reasoning: string;
  thinking: boolean;
  elapsedMs: number | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen || thinking);
  const wasThinkingRef = useRef(thinking);

  // Auto-open while thinking
  useEffect(() => {
    if (thinking) setOpen(true);
  }, [thinking]);

  // Auto-collapse a moment after thinking finishes (user can re-open)
  useEffect(() => {
    if (wasThinkingRef.current && !thinking) {
      const t = setTimeout(() => setOpen(false), 1400);
      wasThinkingRef.current = thinking;
      return () => clearTimeout(t);
    }
    wasThinkingRef.current = thinking;
    return;
  }, [thinking]);

  const lines = useMemo(() => {
    if (!reasoning) return [] as string[];
    // Split into sentences/lines for the bullet-style fade-in cascade.
    return reasoning
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [reasoning]);

  const headerLabel = thinking
    ? elapsedMs && elapsedMs > 1500
      ? `Thinking · ${formatDuration(elapsedMs)}`
      : "Thinking…"
    : elapsedMs
    ? `Thought for ${formatDuration(elapsedMs)}`
    : "Show reasoning";

  return (
    <div className="reasoning-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-open={open}
        className="reasoning-header group"
      >
        <svg className="brain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 3a3 3 0 00-3 3v0a3 3 0 00-3 3v2a3 3 0 002 2.83V16a3 3 0 003 3h1V3H9zM15 3a3 3 0 013 3v0a3 3 0 013 3v2a3 3 0 01-2 2.83V16a3 3 0 01-3 3h-1V3h0z" />
        </svg>
        {thinking && <span className="reasoning-thinking-dot" aria-hidden />}
        <span className="reasoning-label">{headerLabel}</span>
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (lines.length > 0 || thinking) && (
          <motion.div
            key="rbody"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="reasoning-body">
              {lines.length === 0 && thinking ? (
                <div className="reasoning-line reasoning-line-placeholder">
                  Working on your request…
                </div>
              ) : (
                lines.map((line, i) => (
                  <div
                    key={`${i}:${line.slice(0, 40)}`}
                    className="reasoning-line"
                    style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  CodeBlock — extracted + memoized so syntax highlighting only runs when
 *  the actual code/language changes. Without this, every word-reveal tick
 *  during streaming would re-highlight every code block in the message.
 * ────────────────────────────────────────────────────────────────────────── */
const CodeBlock = memo(function CodeBlock({
  language,
  codeStr,
}: {
  language: string;
  codeStr: string;
}) {
  return (
    <div className="relative rounded-xl overflow-hidden my-4 border border-white/10 bg-[#161616]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
        <span className="text-[11px] text-gray-500 font-mono uppercase tracking-widest">{language}</span>
        <CopyButton text={codeStr} />
      </div>
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={language}
          PreTag="div"
          customStyle={{ margin: 0, background: "#161616", padding: "16px", fontSize: "12.5px", lineHeight: "1.6", whiteSpace: "pre" }}
        >
          {codeStr}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

// Stable component map for ReactMarkdown so React doesn't rebuild the
// renderer pipeline on every render.
const MARKDOWN_COMPONENTS = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const codeStr = String(children).replace(/\n$/, "");
    return !inline && match ? (
      <CodeBlock language={match[1]} codeStr={codeStr} />
    ) : (
      <code {...props} className={className}>{children}</code>
    );
  },
  pre({ children }: any) {
    return <>{children}</>;
  },
};

/* ──────────────────────────────────────────────────────────────────────────
 *  AssistantBody — markdown renderer for the answer text only.
 *  Memoized so old messages don't re-parse markdown on every streaming tick.
 * ────────────────────────────────────────────────────────────────────────── */
const AssistantBody = memo(function AssistantBody({ content }: { content: string }) {
  return (
    <div className="text-[13.5px] leading-[1.75] text-gray-200 prose prose-invert max-w-none
      [&_p]:mb-3 [&_p:last-child]:mb-0
      [&_strong]:text-white [&_strong]:font-semibold
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-3
      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-3
      [&_li]:mb-1.5
      [&_h1]:text-white [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-5 [&_h1]:mb-2
      [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
      [&_h3]:text-white [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5
      [&_blockquote]:border-l-2 [&_blockquote]:border-purple-500/60 [&_blockquote]:pl-4 [&_blockquote]:text-gray-400 [&_blockquote]:italic [&_blockquote]:my-3
      [&_code]:bg-white/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-purple-300 [&_code]:font-mono [&_code]:text-[0.82em]
      [&_hr]:border-white/10 [&_hr]:my-4
    ">
      <ReactMarkdown components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 *  WordRevealAssistant — replaces the old char-by-char typewriter.
 *  Paces the visible answer one word at a time so the text glides in
 *  smoothly instead of slamming in all at once.
 *
 *  Works for BOTH committed messages (content is fully known) and live
 *  streaming (content keeps growing as chunks arrive). When streaming, the
 *  reveal naturally lags a few words behind the server, which gives that
 *  smooth "fade in" feel even though chunks themselves arrive instantly.
 * ────────────────────────────────────────────────────────────────────────── */
function WordRevealAssistant({
  content,
  onDone,
  finished = true,
}: {
  content: string;
  onDone?: () => void;
  finished?: boolean;
}) {
  // Tokenize on whitespace boundaries while preserving the whitespace.
  const tokens = useMemo(() => content.split(/(\s+)/).filter((t) => t.length > 0), [content]);
  const [shown, setShown] = useState(0);
  const doneCalledRef = useRef(false);

  // For committed (non-streaming) messages, restart the reveal whenever the
  // full content changes. For streaming, content keeps growing — we DON'T
  // reset, we just keep advancing.
  const lastLenRef = useRef(0);
  useEffect(() => {
    if (finished && content.length < lastLenRef.current) {
      // Brand-new shorter content (different message): reset.
      setShown(0);
      doneCalledRef.current = false;
    }
    lastLenRef.current = content.length;
  }, [content, finished]);

  useEffect(() => {
    if (shown >= tokens.length) {
      // Only fire onDone for committed messages (final length is known).
      if (finished && !doneCalledRef.current) {
        doneCalledRef.current = true;
        onDone?.();
      }
      return;
    }
    const tok = tokens[shown] ?? "";
    const isWs = /^\s+$/.test(tok);
    // Whitespace passes instantly; punctuation pauses a touch longer for
    // a natural reading rhythm.
    const endsWithBreak = /[.!?\n]$/.test(tok);
    const delay = isWs ? 0 : endsWithBreak ? 70 + Math.random() * 40 : 22 + Math.random() * 12;
    const t = setTimeout(() => setShown((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [shown, tokens, finished, onDone]);

  const visible = tokens.slice(0, shown).join("");
  const done = shown >= tokens.length && finished;

  return (
    <div className={done ? "word-reveal-done" : "word-reveal-streaming streaming-mask"}>
      <AssistantBody content={visible} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Per-message reasoning metadata cache (so previously-thought messages keep
 *  their elapsed time when re-rendered).
 * ────────────────────────────────────────────────────────────────────────── */
type MessageMeta = { reasoning: string; elapsedMs: number | null };

/* ──────────────────────────────────────────────────────────────────────────
 *  MessageRow — memoized per-message renderer.
 *  The big perf trick: by hoisting each message into its own memoized
 *  component, old messages do NOT re-render when `streamingContent` ticks.
 *  Without this, every word arriving from the server forced React to
 *  re-render every prior message (markdown + Prism syntax highlight = slow).
 * ────────────────────────────────────────────────────────────────────────── */
interface MessageRowProps {
  msg: ChatMessage;
  isNew: boolean;
  isLastTyping: boolean;
  cachedReasoning: string | null;
  cachedElapsedMs: number | null;
  onTypingDone: () => void;
}

const MessageRow = memo(function MessageRow({
  msg,
  isNew,
  isLastTyping,
  cachedReasoning,
  cachedElapsedMs,
  onTypingDone,
}: MessageRowProps) {
  const parsed = useMemo(
    () => (msg.role === "assistant" ? parseReasoning(msg.content) : null),
    [msg.role, msg.content],
  );
  const userParsed = useMemo(
    () =>
      msg.role === "user"
        ? parseMessageContent(msg.content)
        : { text: "", attachments: [] as ReturnType<typeof parseMessageContent>["attachments"] },
    [msg.role, msg.content],
  );

  const reasoningText = cachedReasoning ?? parsed?.reasoning ?? "";
  const answerText = parsed?.answer ?? msg.content;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 16, filter: "blur(6px)" } : false}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {msg.role === "user" ? (
        <div className="flex flex-col items-end gap-2">
          {userParsed.attachments.length > 0 && (
            <MessageAttachments
              attachments={userParsed.attachments}
              align="right"
            />
          )}
          {userParsed.text.trim() && (
            <div className="max-w-[90%] md:max-w-[70%] bg-[#2a2a2a] border border-white/8 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl rounded-br-md text-sm leading-relaxed text-gray-100 whitespace-pre-wrap break-words">
              {userParsed.text}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg overflow-hidden mt-0.5">
            <img src={lithovexLogo} alt="LITHOVEX" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            {reasoningText && (
              <ReasoningPanel
                reasoning={reasoningText}
                thinking={false}
                elapsedMs={cachedElapsedMs}
                defaultOpen={false}
              />
            )}
            {isLastTyping ? (
              <WordRevealAssistant
                content={answerText}
                onDone={onTypingDone}
              />
            ) : (
              <AssistantBody content={answerText} />
            )}
            <div className="flex items-center gap-2 mt-2.5">
              <CopyButton text={answerText} />
              <span className="text-[11px] text-gray-600">LITHOVEX AI</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
});

export function ChatMessageList({ messages, isTyping, streamingContent, autoScroll }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const [newMessageIndices, setNewMessageIndices] = useState<Set<number>>(new Set());
  const [typingMsgIdx, setTypingMsgIdx] = useState<number | null>(null);
  const usedStreamingRef = useRef(false);

  // Stable callback so memoized MessageRow doesn't re-render on every parent
  // render just because of an inline arrow function.
  const onTypingDone = useMemo(() => () => setTypingMsgIdx(null), []);

  // Reasoning timer for the in-flight turn.
  const thinkStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [thinkEndedAt, setThinkEndedAt] = useState<number | null>(null);

  // Cache reasoning + elapsed for each committed assistant message.
  const messageMetaRef = useRef<Map<number, MessageMeta>>(new Map());

  const isStreaming = streamingContent !== null && streamingContent !== undefined;
  const streamReasoning = useMemo(
    () => (streamingContent ? parseReasoning(streamingContent) : null),
    [streamingContent],
  );

  // Start thinking timer when the turn begins
  useEffect(() => {
    if ((isTyping || isStreaming) && thinkStartRef.current === null) {
      thinkStartRef.current = Date.now();
      setElapsedMs(0);
      setThinkEndedAt(null);
    }
  }, [isTyping, isStreaming]);

  // Live timer
  useEffect(() => {
    if (!isStreaming && !isTyping) return;
    if (thinkEndedAt !== null) return;
    const t = setInterval(() => {
      if (thinkStartRef.current) {
        setElapsedMs(Date.now() - thinkStartRef.current);
      }
    }, 200);
    return () => clearInterval(t);
  }, [isStreaming, isTyping, thinkEndedAt]);

  // Freeze timer when </think> arrives, OR when answer text starts (for models
  // that don't emit <think> tags but still have a "thinking" gap).
  useEffect(() => {
    if (thinkEndedAt !== null || thinkStartRef.current === null) return;
    if (!streamReasoning) return;
    const reasoningClosed = streamReasoning.closed && streamReasoning.reasoning.length > 0;
    const answerStarted = streamReasoning.answer.length > 0;
    if (reasoningClosed || answerStarted) {
      setThinkEndedAt(Date.now() - thinkStartRef.current);
    }
  }, [streamReasoning, thinkEndedAt]);

  // Track that streaming was used so we don't re-typewriter committed messages.
  useEffect(() => {
    if (isStreaming) usedStreamingRef.current = true;
  }, [isStreaming]);

  // Detect new messages → cache reasoning meta + trigger word reveal for non-streamed responses.
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const newIndices = new Set<number>();
      for (let i = prevLengthRef.current; i < messages.length; i++) {
        newIndices.add(i);
      }
      setNewMessageIndices(newIndices);
      setTimeout(() => setNewMessageIndices(new Set()), 800);

      const lastIdx = messages.length - 1;
      const last = messages[lastIdx];

      // Cache reasoning + elapsed for the just-committed assistant message.
      if (last && last.role === "assistant") {
        const parsed = parseReasoning(last.content);
        if (parsed.reasoning) {
          messageMetaRef.current.set(lastIdx, {
            reasoning: parsed.reasoning,
            elapsedMs: thinkEndedAt ?? elapsedMs,
          });
        }
      }

      if (last && last.role === "assistant" && !usedStreamingRef.current) {
        setTypingMsgIdx(lastIdx);
      }
      if (last && last.role === "assistant") {
        usedStreamingRef.current = false;
        // Reset the thinking timer for the next turn.
        thinkStartRef.current = null;
        setElapsedMs(null);
        setThinkEndedAt(null);
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, thinkEndedAt, elapsedMs]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, streamingContent, autoScroll, typingMsgIdx]);

  // While the in-flight turn is "thinking": either we're still waiting for the
  // first chunk, or we have <think> open (un-closed), or there's reasoning but
  // no answer yet.
  const inflightThinking =
    isTyping || (isStreaming && !!streamReasoning && !streamReasoning.answer);

  // Always show the panel during the in-flight turn so the user sees
  // "Thinking → Thought for Xs" even on models that don't emit <think> tags.
  const showInflightPanel = isTyping || isStreaming;

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="max-w-3xl mx-auto px-3 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isNew = newMessageIndices.has(idx);
            const isLastTyping = idx === typingMsgIdx && msg.role === "assistant";
            const cached = messageMetaRef.current.get(idx);
            return (
              <MessageRow
                key={idx}
                msg={msg}
                isNew={isNew}
                isLastTyping={isLastTyping}
                cachedReasoning={cached?.reasoning ?? null}
                cachedElapsedMs={cached?.elapsedMs ?? null}
                onTypingDone={onTypingDone}
              />
            );
          })}

          {/* In-flight assistant bubble (streaming or thinking) */}
          {(isStreaming || (isTyping && !isStreaming)) && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-3 items-start"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg overflow-hidden mt-0.5">
                <img src={lithovexLogo} alt="LITHOVEX" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                {showInflightPanel && (
                  <ReasoningPanel
                    reasoning={streamReasoning?.reasoning ?? ""}
                    thinking={inflightThinking}
                    elapsedMs={thinkEndedAt ?? elapsedMs}
                    defaultOpen={true}
                  />
                )}
                {streamReasoning?.answer ? (
                  <WordRevealAssistant content={streamReasoning.answer} finished={false} />
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} className="h-2" />
      </div>
    </div>
  );
}
