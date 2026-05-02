import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  ArrowLeft,
  Search, Plus, X, Send,
  Box, Database, MonitorPlay,
  User,
  Check, Zap, BrainCircuit,
  Terminal, Move, ZoomIn, ZoomOut, Focus,
  CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX,
  Copy, ClipboardCheck, Users, ExternalLink, Sparkles, Link
} from 'lucide-react';

// ==========================================
// REAL MODELS — pulled from the same catalog used in the main chat (HF_MODELS).
// ==========================================
import { HF_MODELS, ProviderLogo, SettingsPanel } from "@/components/SettingsPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildMessageContent, getSmartParams } from "@/lib/smartRouter";
import type { ProcessedFile } from "@/lib/smartRouter";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type Model = {
  id: string;
  name: string;
  provider: string;
  tier: "fast" | "expert";
  description: string;
};

const AVAILABLE_MODELS: Model[] = HF_MODELS.map((m) => ({
  id: m.id,
  name: m.label,
  provider: m.category,
  tier: m.tier,
  description: m.description,
}));

const BASE_URL = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

const DEFAULT_SETTINGS = { temperature: 0.5, maxTokens: 15872, topP: 0.5, hfKeyIndex: 1 };

// Node widths are responsive. On mobile (<768px) we cap them to viewport-32 so
// nodes never overflow horizontally. These helpers are read fresh on every
// render of nodes / handlers so a window resize automatically picks up the new
// widths once the parent re-renders (BattleMode tracks windowWidth in state).
const BASE_NODE_WIDTH = 480;
const BASE_PROMPT_NODE_WIDTH = 500;
const MOBILE_BREAKPOINT_PX = 768;
function getNodeWidth(): number {
  if (typeof window === 'undefined') return BASE_NODE_WIDTH;
  if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
    return Math.min(BASE_NODE_WIDTH, Math.max(220, window.innerWidth - 32));
  }
  return BASE_NODE_WIDTH;
}
function getPromptNodeWidth(): number {
  if (typeof window === 'undefined') return BASE_PROMPT_NODE_WIDTH;
  if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
    return Math.min(BASE_PROMPT_NODE_WIDTH, Math.max(220, window.innerWidth - 32));
  }
  return BASE_PROMPT_NODE_WIDTH;
}
const BASE_COWORK_NODE_WIDTH = 620;
function getCoWorkNodeWidth(): number {
  if (typeof window === 'undefined') return BASE_COWORK_NODE_WIDTH;
  if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
    return Math.min(BASE_COWORK_NODE_WIDTH, Math.max(260, window.innerWidth - 32));
  }
  return BASE_COWORK_NODE_WIDTH;
}
const BASE_CHATBOX_WIDTH = 480;
function getChatBoxWidth(): number {
  if (typeof window === 'undefined') return BASE_CHATBOX_WIDTH;
  if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
    return Math.min(BASE_CHATBOX_WIDTH, Math.max(280, window.innerWidth - 24));
  }
  return BASE_CHATBOX_WIDTH;
}
// Back-compat references — keep the old names so existing call-sites continue
// to read the (now responsive) values without churn.
const NODE_WIDTH = BASE_NODE_WIDTH; // legacy non-reactive fallback (unused at runtime)
const PROMPT_NODE_WIDTH = BASE_PROMPT_NODE_WIDTH; // legacy non-reactive fallback (unused at runtime)
const HORIZONTAL_SPACING = 60;
const VERTICAL_SPACING = 150;

const generateId = () => Math.random().toString(36).substr(2, 9);

async function callRealModel(
  modelId: string,
  prompt: string,
  settings: { temperature: number; maxTokens: number; topP: number; hfKeyIndex?: number },
  files: ProcessedFile[] = [],
): Promise<{
  content: string;
  tokens: number;
  runtimeSec: number;
  autoSwitched: boolean;
  switchReason: string | null;
  finalModel: string;
}> {
  const sp = getSmartParams(
    prompt,
    files,
    modelId,
    settings.temperature,
    settings.maxTokens,
    settings.topP,
  );
  const messageContent = buildMessageContent(prompt, files);

  const start = performance.now();
  const resp = await fetch(`${BASE_URL}/api/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: sp.model,
      messages: [{ role: "user", content: messageContent }],
      temperature: sp.temperature,
      top_p: sp.topP,
      max_tokens: sp.maxTokens,
      hf_key_index: settings.hfKeyIndex ?? 1,
      stream: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${text.slice(0, 200)}`);
  }
  const data = await resp.json().catch(() => null);
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.delta?.content ??
    data?.content ??
    "";
  const tokens = data?.usage?.total_tokens ?? data?.usage?.completion_tokens ?? Math.ceil(String(content).length / 4);
  const runtimeSec = (performance.now() - start) / 1000;
  if (!content) throw new Error("Empty response from model");
  return {
    content: String(content),
    tokens,
    runtimeSec,
    autoSwitched: sp.autoSwitched,
    switchReason: sp.switchReason,
    finalModel: sp.model,
  };
}

// ==========================================
// AGENT PLAN COMPONENT
// ==========================================
type Subtask = { id: string; title: string; description: string; status: string; priority: string; tools?: string[] };
type Task = { id: string; title: string; description: string; status: string; priority: string; level: number; dependencies: string[]; subtasks: Subtask[] };

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Parse & Analyze Request",
    description: "Gather contextual data from the prompt and establish execution parameters.",
    status: "pending", priority: "high", level: 0, dependencies: [],
    subtasks: [
      { id: "1.1", title: "Tokenize input string", description: "Break down the prompt into processable tokens.", status: "pending", priority: "high", tools: ["tokenizer", "nlp-engine"] },
      { id: "1.2", title: "Identify intent", description: "Map tokens to execution behaviors.", status: "pending", priority: "medium", tools: ["intent-classifier"] },
      { id: "1.3", title: "Retrieve context", description: "Fetch conversational history.", status: "pending", priority: "medium", tools: ["vector-db", "memory-bus"] },
    ],
  },
  {
    id: "2",
    title: "Generate Reasoning Pathways",
    description: "Formulate multiple logical approaches to satisfy the prompt.",
    status: "pending", priority: "high", level: 0, dependencies: ["1"],
    subtasks: [
      { id: "2.1", title: "Branch logic trees", description: "Create decision nodes based on intent.", status: "pending", priority: "high", tools: ["logic-synthesizer"] },
      { id: "2.2", title: "Evaluate confidence scores", description: "Score each logic branch for accuracy.", status: "pending", priority: "medium", tools: ["scorer-module"] },
    ],
  },
  {
    id: "3",
    title: "Synthesize Final Output",
    description: "Construct the human-readable response from the highest confidence pathway.",
    status: "pending", priority: "medium", level: 1, dependencies: ["1", "2"],
    subtasks: [
      { id: "3.1", title: "Draft content", description: "Write the raw response text.", status: "pending", priority: "medium", tools: ["text-generator"] },
      { id: "3.2", title: "Apply formatting", description: "Add markdown and styling.", status: "pending", priority: "high", tools: ["markdown-processor"] },
      { id: "3.3", title: "Final safety check", description: "Ensure output meets safety guidelines.", status: "pending", priority: "medium", tools: ["safety-filter"] },
    ],
  }
];

function AgentPlan({ onComplete }: { onComplete?: () => void }) {
  const [tasks, setTasks] = useState<Task[]>(JSON.parse(JSON.stringify(initialTasks)));
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["1"]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    let currentTaskIdx = 0;
    let currentSubtaskIdx = 0;

    const interval = setInterval(() => {
      if (!isMounted) return;

      setTasks(prevTasks => {
        const newTasks = JSON.parse(JSON.stringify(prevTasks)) as Task[];
        const task = newTasks[currentTaskIdx];

        if (!task) {
          clearInterval(interval);
          return prevTasks;
        }

        if (task.status === "pending") {
          task.status = "in-progress";
        } else if (task.status === "in-progress") {
          const subtask = task.subtasks[currentSubtaskIdx];
          if (subtask) {
            if (subtask.status === "pending") {
              subtask.status = "in-progress";
            } else if (subtask.status === "in-progress") {
              subtask.status = "completed";
              currentSubtaskIdx++;
            }
          } else {
            task.status = "completed";
            currentTaskIdx++;
            currentSubtaskIdx = 0;
          }
        }
        return newTasks;
      });
    }, 400);

    // Separately track expanded state without nesting setState calls
    const expandInterval = setInterval(() => {
      if (!isMounted) return;
      setTasks(current => {
        const task = current[currentTaskIdx];
        if (task && task.status === "in-progress") {
          const subtask = task.subtasks[currentSubtaskIdx];
          if (subtask && subtask.status === "pending") {
            setExpandedSubtasks(prev => ({ ...prev, [`${task.id}-${subtask.id}`]: true }));
          }
          if (current[currentTaskIdx + 1]) {
            setExpandedTasks(prev =>
              prev.includes(current[currentTaskIdx + 1].id)
                ? prev
                : [...prev, current[currentTaskIdx + 1].id]
            );
          }
        }
        return current;
      });
    }, 800);

    const onCompleteTimer = setTimeout(() => {
      if (isMounted && onComplete) onComplete();
    }, (currentTaskIdx + 10) * 1600 + 500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(expandInterval);
      clearTimeout(onCompleteTimer);
    };
  }, [onComplete]);

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const taskVariants = {
    hidden: { opacity: 0, x: -100, rotateX: 45 },
    visible: { opacity: 1, x: 0, rotateX: 0, transition: { type: "spring" as const, stiffness: 400, damping: 15, mass: 0.8 } },
    exit: { opacity: 0, scale: 0.5, transition: { duration: 0.2 } }
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { opacity: 1, height: "auto", overflow: "visible", transition: { duration: 0.4, staggerChildren: 0.1, type: "spring" as const, bounce: 0.4 } },
    exit: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.3 } }
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: -50, scale: 0.8 },
    visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 500, damping: 20 } },
    exit: { opacity: 0, x: 50, transition: { duration: 0.2 } }
  };

  const subtaskDetailsVariants = {
    hidden: { opacity: 0, height: 0, scaleY: 0, transformOrigin: "top" },
    visible: { opacity: 1, height: "auto", scaleY: 1, transition: { type: "spring" as const, bounce: 0.5 } }
  };

  const statusBadgeVariants = {
    initial: { scale: 0, rotate: -180 },
    animate: { scale: [1, 1.5, 1], rotate: 0, transition: { duration: 0.6, type: "spring" as const, stiffness: 300, damping: 10 } }
  };

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] h-full overflow-auto p-2 rounded-xl custom-scrollbar">
      <motion.div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-[var(--shadow)] overflow-hidden"
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", bounce: 0.6, duration: 0.8 } }}
      >
        <LayoutGroup>
          <div className="p-3 overflow-hidden">
            <div className="flex items-center gap-3 mb-4 border-b border-[var(--border-light)] pb-2">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent animate-spin"></div>
              <span className="font-bold text-[var(--text-secondary)] text-sm uppercase tracking-widest">Cognitive Processing...</span>
            </div>
            <ul className="space-y-2 overflow-hidden">
              {tasks.map((task) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li key={task.id} initial="hidden" animate="visible" variants={taskVariants} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-1 shadow-[var(--shadow)]">
                    <motion.div className="group flex items-center px-3 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={() => toggleTaskExpansion(task.id)}>
                      <motion.div className="mr-3 flex-shrink-0">
                        <AnimatePresence mode="wait">
                          <motion.div key={task.status} initial={{ opacity: 0, scale: 0.5, rotate: -90 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5, rotate: 90 }} transition={{ type: "spring", bounce: 0.6 }}>
                            {task.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-[var(--success)]" /> :
                              task.status === "in-progress" ? <CircleDotDashed className="h-5 w-5 text-[var(--accent-blue)] animate-spin-slow" /> :
                                task.status === "need-help" ? <CircleAlert className="h-5 w-5 text-yellow-500" /> :
                                  task.status === "failed" ? <CircleX className="h-5 w-5 text-[var(--danger)]" /> :
                                    <Circle className="text-[var(--text-muted)] h-5 w-5" />}
                          </motion.div>
                        </AnimatePresence>
                      </motion.div>
                      <div className="flex min-w-0 flex-grow items-center justify-between">
                        <div className="mr-2 flex-1 truncate">
                          <span className={`font-semibold text-[15px] ${isCompleted ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{task.title}</span>
                        </div>
                        <motion.span className={`rounded px-2 py-0.5 text-xs font-bold shadow-sm ${task.status === "completed" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                            task.status === "in-progress" ? "bg-[var(--chip-bg)] text-[var(--accent-blue)] border border-[var(--chip-border)]" :
                              "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-light)]"
                          }`} variants={statusBadgeVariants} initial="initial" animate="animate" key={task.status}>
                          {task.status}
                        </motion.span>
                      </div>
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div className="relative overflow-hidden ml-2" variants={subtaskListVariants} initial="hidden" animate="visible" exit="hidden" layout>
                          <div className="absolute top-0 bottom-0 left-[22px] border-l-2 border-dashed border-[var(--border-light)]/50" />
                          <ul className="mt-2 mb-2 ml-4 space-y-1">
                            {task.subtasks.map((subtask) => {
                              const isSubtaskExpanded = expandedSubtasks[`${task.id}-${subtask.id}`];
                              return (
                                <motion.li key={subtask.id} className="group flex flex-col py-1 pl-6" variants={subtaskVariants} layout>
                                  <motion.div className="flex flex-1 items-center rounded-md p-1.5 hover:bg-[var(--bg-hover)] cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSubtaskExpansion(task.id, subtask.id); }} layout>
                                    <motion.div className="mr-3 flex-shrink-0">
                                      <AnimatePresence mode="wait">
                                        <motion.div key={subtask.status} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
                                          {subtask.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-[var(--success)]" /> :
                                            subtask.status === "in-progress" ? <CircleDotDashed className="h-4 w-4 text-[var(--accent-blue)] animate-pulse" /> :
                                              <Circle className="text-[var(--text-muted)] h-4 w-4" />}
                                        </motion.div>
                                      </AnimatePresence>
                                    </motion.div>
                                    <span className={`text-sm ${subtask.status === "completed" ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>{subtask.title}</span>
                                  </motion.div>
                                  <AnimatePresence mode="wait">
                                    {isSubtaskExpanded && (
                                      <motion.div className="mt-1 ml-2 border-l-2 border-[var(--border-color)] pl-4 text-xs text-[var(--text-secondary)] overflow-hidden bg-[var(--bg-tertiary)] p-2 rounded-r-md" variants={subtaskDetailsVariants} initial="hidden" animate="visible" exit="hidden" layout>
                                        <p className="py-1 italic">{subtask.description}</p>
                                        {subtask.tools && (
                                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                                            <span className="font-semibold text-[var(--accent-blue)]">Tools:</span>
                                            {subtask.tools.map((tool, idx) => (
                                              <motion.span key={idx} className="bg-[var(--chip-bg)] text-[var(--text-primary)] border border-[var(--chip-border)] rounded px-2 py-1 text-[10px] uppercase tracking-wide font-mono shadow-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.1 } }}>
                                                {tool}
                                              </motion.span>
                                            ))}
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}

// ==========================================
// MAIN APPLICATION
// ==========================================
type PromptNode = { id: string; type: 'prompt'; x: number; y: number; data: { content: string } };
type ResponseNode = {
  id: string; type: 'response'; parentId: string; model: Model;
  x: number; y: number;
  status: 'loading' | 'complete' | 'error';
  data: { content: string };
  prompt: string;
  files?: ProcessedFile[];
  settings: { temperature: number; maxTokens: number; topP: number };
  _tokens?: number; _runtime?: string;
};
type CoWorkStage = {
  modelId: string;
  modelName: string;
  provider: string;
  status: 'pending' | 'active' | 'done' | 'error';
  content: string;
  tokens?: number;
  runtimeSec?: number;
};
type CoWorkResponseNode = {
  id: string; type: 'cowork'; parentId: string;
  models: Model[];
  x: number; y: number;
  status: 'loading' | 'complete' | 'error';
  data: { content: string };
  prompt: string;
  stages: CoWorkStage[];
  _tokens?: number; _runtime?: string;
};
type Node = PromptNode | ResponseNode | CoWorkResponseNode;
type Edge = { id: string; source: string; target: string };

const canvasNodeVariants = {
  initial: { scale: 0, opacity: 0, y: -200, rotateX: 60, rotateZ: -10 },
  animate: { scale: 1, opacity: 1, y: 0, rotateX: 0, rotateZ: 0, transition: { type: "spring" as const, stiffness: 200, damping: 15, mass: 1.2, bounce: 0.7 } }
};

const EdgesLayer = memo(function EdgesLayer({ edges, nodes }: { edges: Edge[]; nodes: Node[] }) {
  const nodeById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  return (
    <svg className="absolute top-0 left-0 overflow-visible pointer-events-none z-0">
      {edges.map(edge => {
        const sourceNode = nodeById.get(edge.source);
        const targetNode = nodeById.get(edge.target);
        if (!sourceNode || !targetNode) return null;

        const x1 = sourceNode.x + getPromptNodeWidth() / 2;
        const y1 = sourceNode.y + 120;
        // Cowork nodes are left-aligned (x = left edge) — anchor edge to their top center.
        const x2 = targetNode.type === 'cowork'
          ? targetNode.x + getCoWorkNodeWidth() / 2
          : targetNode.x;
        const y2 = targetNode.y - 15;

        const cp1y = y1 + Math.abs(y2 - y1) / 2 + 50;
        const cp2y = y2 - Math.abs(y2 - y1) / 2 - 50;
        const d = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;

        return (
          <g key={edge.id}>
            <path d={d} fill="none" stroke="url(#edge-gradient)" strokeWidth="2" strokeOpacity="0.8" />
          </g>
        );
      })}
      <defs>
        <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
});

const PromptNodeView = memo(function PromptNodeView({ node }: { node: PromptNode }) {
  return (
    <motion.div data-id={node.id} variants={canvasNodeVariants} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0, transition: { duration: 0.2 } }}
      className="node-element absolute bg-gradient-to-br from-[#16161a] to-[#0a0a0b] border-2 border-purple-500/50 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(139,92,246,0.3)] p-4 md:p-6 cursor-grab active:cursor-grabbing hover:border-purple-400 transition-colors z-10"
      style={{ left: node.x, top: node.y, width: getPromptNodeWidth(), willChange: 'transform', transform: 'translateZ(0)', touchAction: 'none' }}
    >
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700/50 text-purple-400 font-bold text-sm tracking-wider uppercase">
        <User className="w-6 h-6 bg-purple-500/20 p-1 rounded-md" /> User Directive Origin
      </div>
      <div className="text-white text-[18px] leading-relaxed whitespace-pre-wrap font-medium font-serif">
        {node.data.content}
      </div>
      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-purple-500 rounded-full border-4 border-[#0a0a0b] shadow-[0_0_15px_#a855f7]"></div>
    </motion.div>
  );
});

const ResponseNodeView = memo(function ResponseNodeView({
  node,
  onAgentComplete,
}: {
  node: ResponseNode;
  onAgentComplete: (id: string, result: { content: string; tokens: number; runtimeSec: number; error?: boolean; autoSwitched?: boolean; switchReason?: string | null; finalModel?: string }) => void;
}) {
  const [copied, setCopied] = useState(false);
  const fetchedRef = useRef(false);

  const handleCopy = useCallback(() => {
    if (!node.data.content) return;
    navigator.clipboard.writeText(node.data.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = node.data.content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node.data.content]);
  useEffect(() => {
    if (node.status !== 'loading' || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    callRealModel(node.model.id, node.prompt, node.settings, node.files ?? [])
      .then((res) => {
        if (cancelled) return;
        onAgentComplete(node.id, res);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        onAgentComplete(node.id, {
          content: `**⚠ Model error**\n\n\`${node.model.id}\` failed: ${err.message}`,
          tokens: 0,
          runtimeSec: 0,
          error: true,
        });
      });
    return () => { cancelled = true; };
  }, [node.id, node.status, node.model.id, node.prompt, node.settings, node.files, onAgentComplete]);
  const handleComplete = useCallback(() => {
    // AgentPlan visual completion is decoupled from real fetch — no-op
  }, []);
  return (
    <motion.div data-id={node.id} variants={canvasNodeVariants} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0 }}
      className="node-element absolute bg-[#16161a] border-2 border-[#6366f1]/30 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col cursor-grab active:cursor-grabbing hover:border-[#6366f1]/60 transition-colors overflow-hidden z-20"
      style={{ left: node.x - getNodeWidth() / 2, top: node.y, width: getNodeWidth(), willChange: 'transform', transform: 'translateZ(0)', touchAction: 'none' }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 rounded-full border-4 border-[#16161a] shadow-[0_0_15px_#3b82f6] z-30"></div>

      <div className="flex items-center justify-between bg-gradient-to-r from-[#1a1a1e] to-[#121214] px-5 py-4 border-b border-gray-800 shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          <span className="bg-[#0a0a0b] p-2 rounded-xl border border-gray-700/50 inline-flex items-center justify-center"><ProviderLogo category={node.model.provider} size={28} /></span>
          <div>
            <div className="font-extrabold text-white text-[16px] tracking-wide">{node.model.name}</div>
            <div className="text-blue-400 text-xs font-mono tracking-widest uppercase mt-0.5">{node.model.provider}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {node.status === 'complete' && (
            <button
              onClick={handleCopy}
              className="nodrag no-min-touch flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer"
              title="Copy response"
              style={copied
                ? { minHeight: 0, minWidth: 0, background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }
                : { minHeight: 0, minWidth: 0, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }
              }
            >
              {copied ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          )}
          {node.status === 'loading' ? (
            <span className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs font-bold uppercase tracking-wider animate-pulse">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span> Computing
            </span>
          ) : node.status === 'error' ? (
            <span className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <CircleX className="w-3.5 h-3.5" /> Failed
            </span>
          ) : (
            <span className="bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
            </span>
          )}
        </div>
      </div>

      <div className="p-1 flex-1 nodrag cursor-text select-text bg-[#0a0a0b] relative z-10">
        {node.status === 'loading' ? (
          <div className="h-full min-h-[400px]">
            <AgentPlan onComplete={handleComplete} />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-invert prose-blue max-w-none p-6 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-gray-200">
            {node.data.content}
          </motion.div>
        )}
      </div>

      {node.status === 'complete' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-3 border-t border-gray-800 bg-[#0a0a0b] flex justify-between items-center text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800"><Terminal className="w-3.5 h-3.5 text-purple-400" /> {node._tokens ?? 0} tok</span>
            <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800 text-green-400 font-bold">{node._runtime ?? '0.00'}s runtime</span>
          </div>
          <button
            onClick={handleCopy}
            className="nodrag no-min-touch flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all duration-200 cursor-pointer"
            title="Copy full response"
            style={copied
              ? { minHeight: 0, minWidth: 0, background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }
              : { minHeight: 0, minWidth: 0, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
            }
          >
            {copied
              ? <><ClipboardCheck className="w-3 h-3" /> Copied</>
              : <><Copy className="w-3 h-3" /> Copy Response</>
            }
          </button>
        </motion.div>
      )}
    </motion.div>
  );
});

// ==========================================
// CO-WORK RESPONSE NODE — single node showing collaborative output from
// multiple models that worked sequentially on the same task.
// ==========================================
const CoWorkResponseNodeView = memo(function CoWorkResponseNodeView({
  node,
}: {
  node: CoWorkResponseNode;
}) {
  const [copied, setCopied] = useState(false);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const handleCopy = useCallback(() => {
    if (!node.data.content) return;
    navigator.clipboard.writeText(node.data.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = node.data.content;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [node.data.content]);

  const activeStage = node.stages.findIndex(s => s.status === 'active');
  const completedCount = node.stages.filter(s => s.status === 'done').length;

  return (
    <motion.div data-id={node.id} variants={canvasNodeVariants} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0 }}
      className="node-element absolute bg-[#16161a] border-2 border-indigo-500/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(99,102,241,0.18)] flex flex-col cursor-grab active:cursor-grabbing hover:border-indigo-400/60 transition-colors overflow-hidden z-20"
      style={{ left: node.x, top: node.y, width: getCoWorkNodeWidth(), willChange: 'transform', transform: 'translateZ(0)', touchAction: 'none' }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-indigo-500 rounded-full border-4 border-[#16161a] shadow-[0_0_15px_#6366f1] z-30"></div>

      {/* HEADER */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#1a1a2e] to-[#121214] px-5 py-4 border-b border-indigo-500/20 relative z-20">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-500/15 p-2 rounded-xl border border-indigo-500/30 inline-flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-300" />
          </span>
          <div>
            <div className="font-extrabold text-white text-[16px] tracking-wide">Collaborative Response</div>
            <div className="text-indigo-300 text-xs font-mono tracking-widest uppercase mt-0.5">
              {node.models.length} agents · {completedCount}/{node.stages.length} stages done
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {node.status === 'complete' && (
            <button
              onClick={handleCopy}
              className="nodrag no-min-touch flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer"
              title="Copy response"
              style={copied
                ? { minHeight: 0, minWidth: 0, background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }
                : { minHeight: 0, minWidth: 0, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }
              }
            >
              {copied ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          )}
          {node.status === 'loading' ? (
            <span className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 text-xs font-bold uppercase tracking-wider animate-pulse">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>
              Co-working
            </span>
          ) : node.status === 'error' ? (
            <span className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <CircleX className="w-3.5 h-3.5" /> Failed
            </span>
          ) : (
            <span className="bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synthesized
            </span>
          )}
        </div>
      </div>

      {/* STAGE TIMELINE */}
      <div className="bg-[#0d0d10] px-5 py-3 border-b border-gray-800 nodrag">
        <div className="flex items-center gap-1 flex-wrap">
          {node.stages.map((stage, idx) => {
            const isLast = idx === node.stages.length - 1;
            const isExpanded = expandedStage === idx;
            return (
              <React.Fragment key={`${stage.modelId}-${idx}`}>
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : idx)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all cursor-pointer no-min-touch ${
                    stage.status === 'done'
                      ? 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20'
                      : stage.status === 'active'
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 animate-pulse'
                      : stage.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-white/5 border-white/10 text-zinc-500'
                  }`}
                  style={{ minHeight: 0, minWidth: 0 }}
                  title={`${isLast ? 'Final synthesizer' : `Step ${idx + 1}`}: ${stage.modelName}`}
                >
                  {stage.status === 'done' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : stage.status === 'active' ? (
                    <CircleDotDashed className="w-3 h-3 animate-spin" />
                  ) : stage.status === 'error' ? (
                    <CircleX className="w-3 h-3" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  <span className="truncate max-w-[120px]">
                    {isLast ? '★ ' : ''}{stage.modelName}
                  </span>
                </button>
                {!isLast && (
                  <span className="text-zinc-700 text-xs px-0.5">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Expanded per-stage preview */}
        <AnimatePresence mode="wait">
          {expandedStage !== null && node.stages[expandedStage] && (
            <motion.div
              key={`stage-${expandedStage}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2"
            >
              <div className="bg-[#16161a] border border-indigo-500/20 rounded-md p-3 text-[12px] text-gray-300 max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold mb-1.5">
                  {expandedStage === node.stages.length - 1 ? 'Final synthesis' : `Stage ${expandedStage + 1} draft`} · {node.stages[expandedStage].modelName}
                </div>
                {node.stages[expandedStage].content || (node.stages[expandedStage].status === 'active' ? 'Working…' : 'Waiting…')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FINAL CONTENT */}
      <div className="p-1 flex-1 nodrag cursor-text select-text bg-[#0a0a0b] relative z-10">
        {node.status === 'loading' && !node.data.content ? (
          <div className="flex items-center justify-center min-h-[200px] text-sm text-indigo-300/70 font-mono">
            {activeStage >= 0
              ? `${node.stages[activeStage]?.modelName ?? 'Agent'} is ${activeStage === node.stages.length - 1 ? 'synthesizing the final answer' : 'contributing'}…`
              : 'Coordinating agents…'}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-invert prose-indigo max-w-none p-6 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-gray-200">
            {node.data.content || (node.status === 'error' ? 'Co-work failed — check the stage timeline above for details.' : '')}
          </motion.div>
        )}
      </div>

      {/* FOOTER */}
      {node.status === 'complete' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-3 border-t border-gray-800 bg-[#0a0a0b] flex justify-between items-center text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800"><Terminal className="w-3.5 h-3.5 text-indigo-400" /> {node._tokens ?? 0} tok</span>
            <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800 text-green-400 font-bold">{node._runtime ?? '0.00'}s total</span>
          </div>
          <button
            onClick={handleCopy}
            className="nodrag no-min-touch flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] font-semibold transition-all duration-200 cursor-pointer"
            title="Copy full response"
            style={copied
              ? { minHeight: 0, minWidth: 0, background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', color: '#4ade80' }
              : { minHeight: 0, minWidth: 0, background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
            }
          >
            {copied
              ? <><ClipboardCheck className="w-3 h-3" /> Copied</>
              : <><Copy className="w-3 h-3" /> Copy Response</>
            }
          </button>
        </motion.div>
      )}
    </motion.div>
  );
});

const AGENT_COWORK_CSS = `
.agent-cowork-root {
  --bg-primary: #0a0a0b;
  --bg-secondary: #111114;
  --bg-tertiary: #16161a;
  --bg-card: #121214;
  --bg-hover: #1a1a1e;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --border-color: #2a2a2e;
  --border-light: #1f1f24;
  --shadow: 0 8px 32px rgba(0,0,0,0.4);
  --accent-blue: #6366f1;
  --success: #22c55e;
  --danger: #ef4444;
  --chip-bg: rgba(99,102,241,0.12);
  --chip-border: rgba(99,102,241,0.35);
}
.agent-cowork-root .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.agent-cowork-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.agent-cowork-root .custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2a2e; border-radius: 4px; }
.agent-cowork-root .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3a3a40; }
@keyframes cowork-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.agent-cowork-root .animate-spin-slow { animation: cowork-spin-slow 2.4s linear infinite; }
`;

interface AgentCoWorkProps {
  onExit?: () => void;
}

export default function AgentCoWork({ onExit }: AgentCoWorkProps = {}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedModels, setSelectedModels] = useState<Model[]>(() =>
    AVAILABLE_MODELS.slice(0, 2).filter(Boolean)
  );
  const [modelSettings, setModelSettings] = useState<Record<string, typeof DEFAULT_SETTINGS>>(() =>
    Object.fromEntries(AVAILABLE_MODELS.slice(0, 2).map(m => [m.id, { ...DEFAULT_SETTINGS }]))
  );

  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [settingsModalModel, setSettingsModalModel] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'fast' | 'expert'>('all');

  // ─── CO-WORK MODE ─────────────────────────────────────────────────────────
  // When enabled, selected models work TOGETHER sequentially: each agent
  // builds on the previous agent's output, and the final agent synthesizes
  // a single combined response. Persisted to localStorage so the toggle
  // sticks across reloads.
  const [coWorkEnabled, setCoWorkEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('lithovex.cowork.enabled') === '1'; }
    catch { return false; }
  });
  const toggleCoWork = useCallback(() => {
    setCoWorkEnabled(prev => {
      const next = !prev;
      try { window.localStorage.setItem('lithovex.cowork.enabled', next ? '1' : '0'); } catch {}
      return next;
    });
  }, []);

  // Mobile responsive — useIsMobile fires on resize via matchMedia.
  const isMobile = useIsMobile();
  // windowWidth state forces a re-render on resize so node widths (computed
  // via getNodeWidth() / getPromptNodeWidth()) update visually.
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Mobile model-picker sheet (replaces the inline dropdown on mobile).
  const [mobileModelSheetOpen, setMobileModelSheetOpen] = useState(false);
  // Dismissible mobile-first-load hint banner.
  const [showMobileHint, setShowMobileHint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('lithovex.cowork.mobileHintDismissed') !== '1';
    } catch {
      return true;
    }
  });
  const dismissMobileHint = useCallback(() => {
    setShowMobileHint(false);
    try { window.localStorage.setItem('lithovex.cowork.mobileHintDismissed', '1'); } catch {}
  }, []);

  // ─── CUSTOM PROJECTS (Co-work showcase) ─────────────────────────────────
  interface CustomProject {
    id: string;
    name: string;
    description: string;
    url: string;
    emoji: string;
    status: 'live' | 'soon';
  }
  const [customProjects, setCustomProjects] = useState<CustomProject[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem('lithovex.cowork.customProjects');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', url: '', emoji: '🚀', status: 'live' as 'live' | 'soon' });
  const [newProjectError, setNewProjectError] = useState('');

  const saveCustomProject = useCallback(() => {
    if (!newProject.name.trim()) { setNewProjectError('Project name is required'); return; }
    if (!newProject.description.trim()) { setNewProjectError('Description is required'); return; }
    const proj: CustomProject = {
      id: `custom-${Date.now()}`,
      name: newProject.name.trim(),
      description: newProject.description.trim(),
      url: newProject.url.trim(),
      emoji: newProject.emoji || '🚀',
      status: newProject.status,
    };
    setCustomProjects(prev => {
      const next = [...prev, proj];
      try { window.localStorage.setItem('lithovex.cowork.customProjects', JSON.stringify(next)); } catch {}
      return next;
    });
    setNewProject({ name: '', description: '', url: '', emoji: '🚀', status: 'live' });
    setNewProjectError('');
    setAddProjectOpen(false);
  }, [newProject]);

  const removeCustomProject = useCallback((id: string) => {
    setCustomProjects(prev => {
      const next = prev.filter(p => p.id !== id);
      try { window.localStorage.setItem('lithovex.cowork.customProjects', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const CHATBOX_WIDTH = getChatBoxWidth();
  const [chatBoxPos, setChatBoxPos] = useState({ x: -getChatBoxWidth() / 2, y: -40 });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const transformContainerRef = useRef<HTMLDivElement | null>(null);
  const grid1Ref = useRef<HTMLDivElement | null>(null);
  const draggedElRef = useRef<HTMLElement | null>(null);
  const draggedIsResponseRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragCurrentPosRef = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef({ dx: 0, dy: 0 });
  const draggedNodeRef = useRef<string | null>(null);
  const isPanningRef = useRef(false);

  const cameraRef = useRef({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
    y: 200,
    scale: 1,
  });

  const applyCameraToDOM = useCallback(() => {
    const c = cameraRef.current;
    const t = transformContainerRef.current;
    if (t) t.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${c.scale})`;
    const g1 = grid1Ref.current;
    if (g1) {
      const sz = 50 * c.scale;
      g1.style.backgroundSize = `${sz}px ${sz}px`;
      g1.style.backgroundPosition = `${c.x}px ${c.y}px`;
    }
  }, []);

  useLayoutEffect(() => { applyCameraToDOM(); }, [applyCameraToDOM]);

  const handleWheel = useCallback((e: WheelEvent) => {
    // If the pointer is over a scrollable overlay (e.g. model picker dropdown),
    // let the browser scroll it natively — don't zoom the canvas.
    const target = e.target as HTMLElement;
    if (target.closest('.no-canvas-zoom')) return;
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    const c = cameraRef.current;
    const newScale = Math.min(Math.max(c.scale * Math.exp(delta), 0.1), 3);
    const ratio = newScale / c.scale;
    cameraRef.current = {
      x: mouseX - (mouseX - c.x) * ratio,
      y: mouseY - (mouseY - c.y) * ratio,
      scale: newScale,
    };
    applyCameraToDOM();
  }, [applyCameraToDOM]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.nodrag')) return;
    const nodeEl = target.closest('.node-element') as HTMLElement | null;
    if (nodeEl) {
      const id = nodeEl.dataset.id || null;
      draggedNodeRef.current = id;
      draggedElRef.current = nodeEl;
      if (id === 'chatbox') {
        draggedIsResponseRef.current = false;
        dragStartPosRef.current = { ...chatBoxPos };
      } else {
        const node = nodes.find(n => n.id === id);
        if (node) {
          draggedIsResponseRef.current = node.type === 'response';
          dragStartPosRef.current = { x: node.x, y: node.y };
        }
      }
      dragCurrentPosRef.current = { ...dragStartPosRef.current };
    } else {
      isPanningRef.current = true;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [nodes, chatBoxPos]);

  const flushDelta = useCallback(() => {
    rafIdRef.current = null;
    const { dx, dy } = pendingDeltaRef.current;
    pendingDeltaRef.current = { dx: 0, dy: 0 };
    if (dx === 0 && dy === 0) return;

    if (isPanningRef.current) {
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      applyCameraToDOM();
      return;
    }

    if (draggedNodeRef.current && draggedElRef.current) {
      const scale = cameraRef.current.scale || 1;
      dragCurrentPosRef.current.x += dx / scale;
      dragCurrentPosRef.current.y += dy / scale;
      const el = draggedElRef.current;
      const offsetX = draggedIsResponseRef.current ? getNodeWidth() / 2 : 0;
      el.style.left = `${dragCurrentPosRef.current.x - offsetX}px`;
      el.style.top = `${dragCurrentPosRef.current.y}px`;
    }
  }, [applyCameraToDOM]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggedNodeRef.current && !isPanningRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    pendingDeltaRef.current.dx += dx;
    pendingDeltaRef.current.dy += dy;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushDelta);
    }
  }, [flushDelta]);

  const handlePointerUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      flushDelta();
    }
    const draggedId = draggedNodeRef.current;
    if (draggedId) {
      const finalPos = { ...dragCurrentPosRef.current };
      if (draggedId === 'chatbox') {
        setChatBoxPos(finalPos);
      } else {
        setNodes(prev => prev.map(n => n.id === draggedId ? { ...n, x: finalPos.x, y: finalPos.y } : n));
      }
    }
    isPanningRef.current = false;
    draggedNodeRef.current = null;
    draggedElRef.current = null;
  }, [flushDelta]);

  // -------------------------------------------------------------------------
  // TOUCH SUPPORT — pinch-to-zoom + two-finger pan on the canvas.
  // Single-finger drag of nodes / single-finger pan are already handled by
  // the existing pointer-event handlers above (pointer events fire for touch
  // input automatically). The handlers below kick in only for 2+ touches and
  // override any in-flight single-finger pan/drag so pinch wins cleanly.
  // -------------------------------------------------------------------------
  const pinchStateRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const getDist = (t1: Touch, t2: Touch) => {
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      return Math.hypot(dx, dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        // Cancel any pan/drag started by the first touch's pointerdown.
        isPanningRef.current = false;
        draggedNodeRef.current = null;
        draggedElRef.current = null;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pendingDeltaRef.current = { dx: 0, dy: 0 };

        const rect = canvasEl.getBoundingClientRect();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        pinchStateRef.current = {
          dist: getDist(t1, t2),
          midX: (t1.clientX + t2.clientX) / 2 - rect.left,
          midY: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // While a node is being dragged with a single finger, suppress page
      // scroll so the drag feels native (pointer move handler updates pos).
      if (draggedNodeRef.current && e.touches.length === 1) {
        e.preventDefault();
        return;
      }
      if (e.touches.length >= 2 && pinchStateRef.current) {
        e.preventDefault();
        const rect = canvasEl.getBoundingClientRect();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = getDist(t1, t2);
        const newMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const newMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

        const prev = pinchStateRef.current;
        const c = cameraRef.current;
        const scaleRatio = newDist / prev.dist;
        const newScale = Math.min(Math.max(c.scale * scaleRatio, 0.1), 3);
        const ratio = newScale / c.scale;

        // Two-finger pan delta from midpoint movement.
        const panDX = newMidX - prev.midX;
        const panDY = newMidY - prev.midY;

        cameraRef.current = {
          x: newMidX - (newMidX - c.x) * ratio + panDX,
          y: newMidY - (newMidY - c.y) * ratio + panDY,
          scale: newScale,
        };
        applyCameraToDOM();
        pinchStateRef.current = { dist: newDist, midX: newMidX, midY: newMidY };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStateRef.current = null;
      }
    };

    canvasEl.addEventListener('touchstart', onTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onTouchEnd, { passive: true });
    canvasEl.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      canvasEl.removeEventListener('touchstart', onTouchStart);
      canvasEl.removeEventListener('touchmove', onTouchMove);
      canvasEl.removeEventListener('touchend', onTouchEnd);
      canvasEl.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyCameraToDOM]);

  const centerCamera = () => {
    if (nodes.length === 0) {
      cameraRef.current = { x: window.innerWidth / 2, y: 100, scale: 1 };
      applyCameraToDOM();
      return;
    }
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const centerX = (Math.min(...xs) + Math.max(...xs) + getPromptNodeWidth()) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys) + 300) / 2;

    const c = cameraRef.current;
    cameraRef.current = {
      x: window.innerWidth / 2 - centerX * c.scale,
      y: window.innerHeight / 2 - centerY * c.scale,
      scale: c.scale,
    };
    applyCameraToDOM();
  };

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (canvasEl) {
      canvasEl.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvasEl.removeEventListener('wheel', handleWheel);
    }
    return;
  }, [handleWheel]);

  // ─── CO-WORK RUNNER ───────────────────────────────────────────────────────
  // Sequentially runs the selected models on the same prompt, where each
  // model receives the previous model's draft as context. The final model
  // is asked to synthesize a polished, unified answer. The single cowork
  // node's `stages` array is updated after each step so the UI shows
  // live progress.
  const runCoWork = useCallback(async (
    nodeId: string,
    models: Model[],
    promptText: string,
  ) => {
    const totalStart = performance.now();
    let totalTokens = 0;
    let lastDraft = '';

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const isFirst = i === 0;
      const isLast = i === models.length - 1;

      // Mark this stage as active.
      setNodes(prev => prev.map(n => {
        if (n.id !== nodeId || n.type !== 'cowork') return n;
        const stages = n.stages.map((s, idx) => idx === i ? { ...s, status: 'active' as const } : s);
        return { ...n, stages };
      }));

      // Build the per-stage instruction.
      let stagePrompt: string;
      if (isFirst && !isLast) {
        stagePrompt = `You are Agent 1 of ${models.length} in a collaborative team. Provide a thoughtful, well-structured initial draft response to the user's task. Other agents will review and refine your work, so focus on covering the core ideas clearly — don't worry about being final.\n\n=== USER TASK ===\n${promptText}`;
      } else if (isFirst && isLast) {
        // Single model selected — just answer normally.
        stagePrompt = promptText;
      } else if (!isLast) {
        stagePrompt = `You are Agent ${i + 1} of ${models.length} in a collaborative team. The previous agent produced a draft. Build on it: correct any mistakes, add missing details, improve clarity, and strengthen weak sections. Preserve what's good. Don't add a preface — just output the improved version.\n\n=== USER TASK ===\n${promptText}\n\n=== PREVIOUS AGENT'S DRAFT ===\n${lastDraft}`;
      } else {
        stagePrompt = `You are the final synthesizer (Agent ${i + 1} of ${models.length}) in a collaborative team. Read the team's progressive work and produce ONE polished, cohesive final answer for the user. Merge the best ideas, resolve any contradictions, fix remaining errors, and present it cleanly. Output ONLY the final answer — no meta-commentary, no "here is the synthesized response" preface.\n\n=== USER TASK ===\n${promptText}\n\n=== TEAM'S LATEST WORK ===\n${lastDraft}`;
      }

      const settings = modelSettings[model.id] ?? DEFAULT_SETTINGS;
      try {
        const res = await callRealModel(model.id, stagePrompt, settings, []);
        lastDraft = res.content;
        totalTokens += res.tokens || 0;

        setNodes(prev => prev.map(n => {
          if (n.id !== nodeId || n.type !== 'cowork') return n;
          const stages = n.stages.map((s, idx) => idx === i
            ? { ...s, status: 'done' as const, content: res.content, tokens: res.tokens, runtimeSec: res.runtimeSec }
            : s);
          // If this is the final stage, also write the unified content + complete.
          if (isLast) {
            return {
              ...n,
              stages,
              status: 'complete' as const,
              data: { content: res.content },
              _tokens: totalTokens,
              _runtime: ((performance.now() - totalStart) / 1000).toFixed(2),
            };
          }
          return { ...n, stages };
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setNodes(prev => prev.map(n => {
          if (n.id !== nodeId || n.type !== 'cowork') return n;
          const stages = n.stages.map((s, idx) => idx === i
            ? { ...s, status: 'error' as const, content: `⚠ ${model.name} failed: ${message}` }
            : s);
          return {
            ...n,
            stages,
            status: 'error' as const,
            data: { content: `**⚠ Co-work failed at stage ${i + 1} (${model.name})**\n\n${message}\n\n${lastDraft ? `Latest draft before failure:\n\n${lastDraft}` : ''}` },
            _tokens: totalTokens,
            _runtime: ((performance.now() - totalStart) / 1000).toFixed(2),
          };
        }));
        toast({ title: 'Co-work stopped', description: `${model.name} failed: ${message}`, variant: 'destructive' });
        setIsGenerating(false);
        return;
      }
    }

    setIsGenerating(false);
  }, [modelSettings, toast]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isGenerating || selectedModels.length === 0) return;

    setIsGenerating(true);
    const promptId = generateId();

    const lastNodeY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y + (n.type === 'prompt' ? 150 : 500))) : 0;
    const promptY = lastNodeY + VERTICAL_SPACING;

    const newPromptNode: PromptNode = {
      id: promptId,
      type: 'prompt',
      x: -getPromptNodeWidth() / 2,
      y: promptY,
      data: { content: inputValue }
    };

    setNodes(prev => [...prev, newPromptNode]);
    setInputValue('');

    cameraRef.current = { ...cameraRef.current, y: (window.innerHeight / 3) - (promptY * cameraRef.current.scale) };
    applyCameraToDOM();

    const responsesY = promptY + 250;
    const promptText = inputValue;

    // ─── CO-WORK PATH ──────────────────────────────────────────────────────
    // Single combined node showing sequential agent collaboration.
    if (coWorkEnabled) {
      const coWorkNodeId = generateId();
      const coWorkW = getCoWorkNodeWidth();
      const coWorkNode: CoWorkResponseNode = {
        id: coWorkNodeId,
        type: 'cowork',
        parentId: promptId,
        models: [...selectedModels],
        x: -coWorkW / 2,
        y: responsesY,
        status: 'loading',
        data: { content: '' },
        prompt: promptText,
        stages: selectedModels.map(m => ({
          modelId: m.id,
          modelName: m.name,
          provider: m.provider,
          status: 'pending',
          content: '',
        })),
      };
      setNodes(prev => [...prev, coWorkNode]);
      setEdges(prev => [...prev, { id: `e-${promptId}-${coWorkNodeId}`, source: promptId, target: coWorkNodeId }]);
      // Kick off the sequential run (fire and forget — runner manages state).
      void runCoWork(coWorkNodeId, [...selectedModels], promptText);
      return;
    }

    // ─── PARALLEL (DEFAULT) PATH ──────────────────────────────────────────
    const _nw = getNodeWidth();
    const totalWidth = selectedModels.length * _nw + (selectedModels.length - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2;

    const newResponseNodes: ResponseNode[] = selectedModels.map((model, idx) => ({
      id: generateId(),
      type: 'response',
      parentId: promptId,
      model: model,
      x: startX + idx * (_nw + HORIZONTAL_SPACING) + (_nw / 2),
      y: responsesY,
      status: 'loading',
      data: { content: '' },
      prompt: promptText,
      settings: modelSettings[model.id] ?? DEFAULT_SETTINGS,
    }));

    setNodes(prev => [...prev, ...newResponseNodes]);
    setEdges(prev => [...prev, ...newResponseNodes.map(rn => ({ id: `e-${promptId}-${rn.id}`, source: promptId, target: rn.id }))]);
  };

  const handleAgentComplete = useCallback((nodeId: string, result: { content: string; tokens: number; runtimeSec: number; error?: boolean; autoSwitched?: boolean; switchReason?: string | null; finalModel?: string }) => {
    if (!result.error && result.autoSwitched && result.switchReason) {
      toast({
        title: "Auto-switched model",
        description: result.switchReason,
      });
    }
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'response') {
        return {
          ...n,
          status: (result.error ? 'error' : 'complete') as 'complete' | 'error',
          data: { content: result.content },
          _tokens: result.tokens,
          _runtime: result.runtimeSec.toFixed(2),
        };
      }
      return n;
    }));
    setTimeout(() => {
      setNodes(currentNodes => {
        const anyLoading = currentNodes.some(n => n.type === 'response' && n.status === 'loading');
        if (!anyLoading) setIsGenerating(false);
        return currentNodes;
      });
    }, 100);
  }, []);

  const toggleModelSelection = (model: Model) => {
    if (selectedModels.find(m => m.id === model.id)) {
      setSelectedModels(prev => prev.filter(m => m.id !== model.id));
      if (settingsModalModel?.id === model.id) setSettingsModalModel(null);
    } else {
      if (selectedModels.length >= 6) {
        toast({
          title: "Model limit reached",
          description: "Maximum 6 models allowed for visual branching. Remove one to add another.",
          variant: "destructive",
        });
        return;
      }
      setSelectedModels(prev => [...prev, model]);
      setModelSettings(prev => ({ ...prev, [model.id]: { ...DEFAULT_SETTINGS } }));
    }
    setActiveDropdown(null);
  };

  const updateSetting = (modelId: string, setting: keyof typeof DEFAULT_SETTINGS, value: number) => {
    setModelSettings(prev => ({ ...prev, [modelId]: { ...prev[modelId], [setting]: value } }));
  };

  const filteredModels = AVAILABLE_MODELS.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q
      || m.name.toLowerCase().includes(q)
      || m.id.toLowerCase().includes(q)
      || m.provider.toLowerCase().includes(q)
      || m.description.toLowerCase().includes(q);
    const matchTier = tierFilter === 'all' || m.tier === tierFilter;
    return matchSearch && matchTier;
  });

  return (
    <div className="agent-cowork-root dark h-[100dvh] w-screen bg-[#0f0f0f] text-gray-100 font-sans flex flex-col overflow-hidden selection:bg-indigo-500/30">
      <style dangerouslySetInnerHTML={{ __html: AGENT_COWORK_CSS }} />

      {/* BACK TO CHAT */}
      {onExit ? (
        <button
          onClick={onExit}
          className="fixed top-4 left-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1d]/90 backdrop-blur border border-[#2a2a2e] text-gray-200 hover:text-white hover:bg-[#26262a] hover:border-purple-500/50 transition-all shadow-lg text-sm font-medium"
          title="Back to chat"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Chat</span>
        </button>
      ) : (
        <a
          href="/"
          className="fixed top-4 left-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1d]/90 backdrop-blur border border-[#2a2a2e] text-gray-200 hover:text-white hover:bg-[#26262a] hover:border-purple-500/50 transition-all shadow-lg text-sm font-medium"
          title="Back to LITHOVEX AI Home"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </a>
      )}

      {/* MOBILE HINT BANNER — first-load, dismissible, persists via localStorage */}
      {isMobile && showMobileHint && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[95] md:hidden flex items-center gap-2 px-3 py-2 rounded-full bg-[#1a1a1d]/95 backdrop-blur border border-purple-500/40 text-[11px] text-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-w-[calc(100vw-96px)]"
          role="status"
        >
          <Move className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="truncate">Drag nodes · Pinch to zoom · Two-finger pan</span>
          <button
            onClick={dismissMobileHint}
            className="no-min-touch ml-1 p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
            style={{ minHeight: 0, minWidth: 0 }}
            aria-label="Dismiss hint"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* INFINITE CANVAS */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0a0a0b] cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >

          <div ref={grid1Ref} className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: `linear-gradient(to right, #1e1e22 1px, transparent 1px), linear-gradient(to bottom, #1e1e22 1px, transparent 1px)` }} />

          <div ref={transformContainerRef} className="absolute origin-top-left will-change-transform">

            {/* SVG EDGES */}
            <EdgesLayer edges={edges} nodes={nodes} />

            {/* NODES */}
            <AnimatePresence>
              {nodes.map(node => {
                if (node.type === 'prompt') return <PromptNodeView key={node.id} node={node} />;
                if (node.type === 'response') return <ResponseNodeView key={node.id} node={node} onAgentComplete={handleAgentComplete} />;
                if (node.type === 'cowork') return <CoWorkResponseNodeView key={node.id} node={node} />;
                return null;
              })}
            </AnimatePresence>

            {/* CHAT BOX (inside infinite canvas) */}
            <motion.div
              data-id="chatbox"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="node-element absolute bg-[#16161a] border border-[#2a2a2e] focus-within:border-[#3a3a40] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-colors overflow-visible flex flex-col cursor-grab active:cursor-grabbing z-30"
              style={{ left: chatBoxPos.x, top: chatBoxPos.y, width: getChatBoxWidth() }}
            >
              {/* Drag handle */}
              <div className="nodrag flex items-center justify-center pt-2 pb-0.5 cursor-grab active:cursor-grabbing select-none" title="Drag to move">
                <div className="w-10 h-1 rounded-full bg-[#2a2a2e]" />
              </div>
              {/* Model chips row - acts as drag handle; individual chips/buttons are nodrag */}
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-1 flex-wrap relative cursor-grab active:cursor-grabbing">
                <AnimatePresence>
                  {selectedModels.map((model) => (
                    <motion.div
                      key={model.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      layout
                      className="nodrag group flex items-center gap-1.5 bg-[#1c1c20] border border-[#2a2a2e] hover:border-[#3a3a40] rounded-md pl-2 pr-1 py-1 text-xs text-[#e4e4e7] transition-colors cursor-pointer"
                    >
                      <ProviderLogo category={model.provider} size={14} />
                      <span className="nodrag font-medium tracking-tight cursor-pointer" onClick={() => setSettingsModalModel(model)}>{model.name}</span>
                      <button
                        onClick={() => toggleModelSelection(model)}
                        className="nodrag no-min-touch ml-0.5 p-0.5 rounded text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#2a2a2e] transition-colors"
                        style={{ minHeight: 0, minWidth: 0 }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="relative nodrag flex items-center gap-1.5">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (isMobile) {
                        setMobileModelSheetOpen(true);
                      } else {
                        setActiveDropdown(activeDropdown === 'add' ? null : 'add');
                      }
                    }}
                    className="no-min-touch flex items-center justify-center w-6 h-6 rounded-md bg-[#1c1c20] border border-[#2a2a2e] hover:border-[#3a3a40] hover:bg-[#1e1e22] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors cursor-pointer"
                    style={{ minHeight: 0, minWidth: 0 }}
                    title="Add model"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </motion.button>
                  <span className={`text-[10px] font-mono tabular-nums select-none ${selectedModels.length >= 6 ? 'text-amber-400' : 'text-[#52525a]'}`}>
                    {selectedModels.length}/6
                  </span>

                  <AnimatePresence>
                    {!isMobile && activeDropdown === 'add' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.25 }}
                        className="no-canvas-zoom absolute top-full mt-2 left-0 w-80 bg-[#0e0e10] border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-50 overflow-hidden flex flex-col max-h-[380px]"
                      >
                        <div className="p-2.5 border-b border-white/8 space-y-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                              type="text"
                              placeholder="Search models"
                              style={{ minHeight: 0 }}
                              className="no-min-touch w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-1">
                            {(['all', 'fast', 'expert'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setTierFilter(t)}
                                style={{ minHeight: 0, minWidth: 0 }}
                                className={`no-min-touch flex-1 h-7 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                                  tierFilter === t
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                    : 'bg-white/5 text-zinc-500 border border-white/8 hover:border-white/15'
                                }`}
                              >
                                {t === 'all' ? `All ${AVAILABLE_MODELS.length}` : t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-1.5 space-y-0.5" onWheel={(e) => e.stopPropagation()}>
                          {filteredModels.map(model => {
                            const isSelected = selectedModels.some(m => m.id === model.id);
                            return (
                              <button
                                key={model.id}
                                disabled={isSelected}
                                onClick={() => !isSelected && toggleModelSelection(model)}
                                title={model.id}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                  isSelected
                                    ? 'opacity-40 cursor-not-allowed bg-indigo-600/10'
                                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <ProviderLogo category={model.provider} size={18} />
                                <span className="text-xs font-medium truncate flex-1">
                                  {model.id.split('/')[0]}/ {model.name}
                                </span>
                                {model.tier === 'fast' ? (
                                  <Zap className="w-3 h-3 text-blue-400/70 shrink-0" />
                                ) : (
                                  <BrainCircuit className="w-3 h-3 text-purple-400/70 shrink-0" />
                                )}
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />}
                              </button>
                            );
                          })}
                          {filteredModels.length === 0 && (
                            <p className="text-center text-xs text-zinc-600 py-6">No models match.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Input row */}
              <div className="px-4 pt-2 nodrag">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Ask anything..."
                  className="w-full bg-transparent border-none text-[#e4e4e7] placeholder-[#71717a] resize-none outline-none py-1 max-h-60 min-h-[56px] custom-scrollbar text-base md:text-sm"
                  style={{ fontSize: isMobile ? 16 : undefined }}
                />
                <p className="text-[10px] text-[#52525a] mt-0.5 select-none">
                  <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
                </p>
              </div>

              {/* Bottom action row */}
              <div className="flex items-center justify-between px-3 pb-3 pt-2 nodrag gap-2">
                <div className="flex items-center gap-1.5">
                  {/* CO-WORK TOGGLE — when ON, the selected models collaborate
                      sequentially to produce a single combined response.    */}
                  <button
                    onClick={toggleCoWork}
                    disabled={isGenerating}
                    title={
                      coWorkEnabled
                        ? 'Co-work mode ON — selected models will collaborate to produce one combined response. Click to disable.'
                        : 'Co-work mode OFF — selected models will respond in parallel. Click to enable collaboration.'
                    }
                    style={{ minHeight: 0, minWidth: 0 }}
                    className={`no-min-touch flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-semibold transition-all ${
                      coWorkEnabled
                        ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
                        : 'bg-[#1c1c20] border-[#2a2a2e] text-[#71717a] hover:text-[#e4e4e7] hover:border-[#3a3a40]'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Co-work</span>
                    <span className={`ml-0.5 inline-flex items-center justify-center w-7 h-3.5 rounded-full transition-colors ${coWorkEnabled ? 'bg-indigo-500' : 'bg-[#2a2a2e]'}`}>
                      <span className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${coWorkEnabled ? 'translate-x-1.5' : '-translate-x-1.5'}`}></span>
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {selectedModels.length === 0 && (
                    <span className="text-[10px] text-[#71717a]">Add a model first</span>
                  )}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isGenerating || selectedModels.length === 0}
                    style={{ minHeight: 0, minWidth: 0 }}
                    className={`no-min-touch p-2 rounded-md transition-colors ${inputValue.trim() && !isGenerating && selectedModels.length > 0 ? 'bg-indigo-600 border border-indigo-500/50 text-white hover:bg-indigo-500' : 'bg-[#1c1c20] border border-[#2a2a2e] text-[#52525a] cursor-not-allowed'}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* CONTROLS */}
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-40 nodrag">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={centerCamera} className="bg-[#1a1a1e] text-[#a1a1aa] p-3.5 rounded-2xl border border-[#2a2a2e] transition-colors hover:text-[#e4e4e7] hover:border-[#6366f1]" title="Recenter View">
              <Focus className="w-6 h-6" />
            </motion.button>
            <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-2xl flex flex-col overflow-hidden">
              <motion.button whileHover={{ backgroundColor: "rgba(55,65,81,1)" }} whileTap={{ scale: 0.9 }} onClick={() => { cameraRef.current = { ...cameraRef.current, scale: Math.min(cameraRef.current.scale * 1.3, 3) }; applyCameraToDOM(); }} className="p-3.5 text-gray-300 transition-colors border-b border-gray-700 flex justify-center hover:text-blue-400">
                <ZoomIn className="w-6 h-6" />
              </motion.button>
              <motion.button whileHover={{ backgroundColor: "rgba(55,65,81,1)" }} whileTap={{ scale: 0.9 }} onClick={() => { cameraRef.current = { ...cameraRef.current, scale: Math.max(cameraRef.current.scale / 1.3, 0.1) }; applyCameraToDOM(); }} className="p-3.5 text-gray-300 transition-colors flex justify-center hover:text-blue-400">
                <ZoomOut className="w-6 h-6" />
              </motion.button>
            </div>
          </div>

          {/* ── LITHOVEX CO-WORK SUCCESSFUL PROJECTS ──────────────────── */}
          <AnimatePresence>
            {nodes.length === 0 && coWorkEnabled && inputValue === '' && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, transition: { duration: 0.12 } }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 nodrag w-full max-w-3xl px-4"
              >
                <div className="bg-[#111114]/90 backdrop-blur-xl border border-[#2a2a2e] rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-widest text-purple-300">LITHOVEX Co-work successful projects made</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setAddProjectOpen(true); setNewProjectError(''); }}
                      className="nodrag flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 text-[11px] font-semibold hover:bg-purple-600/35 hover:border-purple-400 transition-all"
                      style={{ minHeight: 0, minWidth: 0 }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add App
                    </motion.button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-0.5">
                    {/* Build Linux System — LIVE running npm app */}
                    <motion.div
                      whileHover={{ scale: 1.02, borderColor: 'rgba(139,92,246,0.6)' }}
                      className="group relative bg-[#0d0d10] border border-[#2a2a2e] rounded-xl overflow-hidden cursor-default"
                    >
                      <div className="h-28 bg-gradient-to-br from-[#0a0a0b] to-[#16161a] flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 flex flex-col">
                          <div className="h-4 bg-[#000] flex items-center px-2 gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                            <div className="w-16 h-1 rounded bg-white/5 ml-auto" />
                          </div>
                          <div className="flex-1 flex items-center justify-center gap-3 py-1">
                            {['\uD83D\uDCC1','\u2328','\uD83C\uDF10','\u2699','\uD83D\uDCC4'].map((icon, i) => (
                              <div key={i} className="flex flex-col items-center gap-0.5">
                                <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-white/5 flex items-center justify-center text-xs">{icon}</div>
                              </div>
                            ))}
                          </div>
                          <div className="h-7 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-center gap-2 px-2">
                            {['\u2328','\uD83C\uDF10','\uD83D\uDCC1','\uD83D\uDCC4','\u2699'].map((icon, i) => (
                              <div key={i} className="w-5 h-5 rounded-md bg-[#1a1a1a] flex items-center justify-center text-[9px]">{icon}</div>
                            ))}
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-300 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          Live
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-white text-xs font-bold mb-0.5">Build Linux System</p>
                        <p className="text-zinc-500 text-[10px] leading-snug mb-3">Full Ubuntu-style OS in browser — apps, terminal, file manager &amp; more.</p>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => navigate('/linux-system')}
                          className="nodrag w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/50 text-purple-200 text-[11px] font-semibold hover:bg-purple-600/35 hover:border-purple-400 transition-all"
                        >
                          <MonitorPlay className="w-3.5 h-3.5" />
                          View &amp; Run
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                        </motion.button>
                      </div>
                    </motion.div>

                    {/* Global Bar Survey — placeholder */}
                    <div className="group bg-[#0d0d10] border border-[#2a2a2e] rounded-xl overflow-hidden opacity-70">
                      <div className="h-28 bg-gradient-to-br from-[#0a1a10] to-[#0d150d] flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-2 flex items-end justify-around pb-1">
                          {[70, 45, 85, 60, 55, 90].map((h, i) => (
                            <div key={i} className="w-4 rounded-t" style={{ height: `${h * 0.65}%`, background: `rgba(99,255,120,${0.18 + i * 0.04})` }} />
                          ))}
                        </div>
                        <div className="absolute top-2 left-2 text-[10px] text-green-300/70 font-bold uppercase tracking-widest">Survey</div>
                        <div className="absolute top-2 right-2 bg-zinc-800/70 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700">Soon</div>
                      </div>
                      <div className="p-3">
                        <p className="text-white text-xs font-bold mb-0.5">Global Bar Survey</p>
                        <p className="text-zinc-500 text-[10px] leading-snug mb-3">AI-powered multi-agent data collection and analysis pipeline.</p>
                        <div className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50 text-zinc-500 text-[11px] font-semibold cursor-not-allowed select-none">
                          <Box className="w-3.5 h-3.5" /> Coming Soon
                        </div>
                      </div>
                    </div>

                    {/* Job Matching System — placeholder */}
                    <div className="group bg-[#0d0d10] border border-[#2a2a2e] rounded-xl overflow-hidden opacity-70">
                      <div className="h-28 bg-gradient-to-br from-[#0f0a1a] to-[#100d18] flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-2 space-y-1.5 pt-1">
                          {[85, 70, 60, 45].map((w, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded bg-purple-500/20 border border-purple-500/20 flex-shrink-0" />
                              <div className="h-1.5 rounded" style={{ width: `${w}%`, background: `rgba(139,92,246,${0.15 + i * 0.04})` }} />
                            </div>
                          ))}
                        </div>
                        <div className="absolute top-2 right-2 bg-zinc-800/70 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700">Soon</div>
                      </div>
                      <div className="p-3">
                        <p className="text-white text-xs font-bold mb-0.5">Job Matching System</p>
                        <p className="text-zinc-500 text-[10px] leading-snug mb-3">Swarm agents matching candidates to roles using multi-model reasoning.</p>
                        <div className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50 text-zinc-500 text-[11px] font-semibold cursor-not-allowed select-none">
                          <Database className="w-3.5 h-3.5" /> Coming Soon
                        </div>
                      </div>
                    </div>

                    {/* Custom user-added projects */}
                    {customProjects.map(proj => (
                      <motion.div
                        key={proj.id}
                        whileHover={{ scale: 1.02, borderColor: 'rgba(139,92,246,0.6)' }}
                        className="group relative bg-[#0d0d10] border border-[#2a2a2e] rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => removeCustomProject(proj.id)}
                          className="nodrag absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ minHeight: 0, minWidth: 0 }}
                          title="Remove project"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="h-28 bg-gradient-to-br from-[#120a1f] to-[#0d0d18] flex items-center justify-center relative overflow-hidden">
                          <span className="text-4xl">{proj.emoji}</span>
                          {proj.status === 'live' && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-300 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                              Live
                            </div>
                          )}
                          {proj.status === 'soon' && (
                            <div className="absolute top-2 right-2 bg-zinc-800/70 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700">Soon</div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-white text-xs font-bold mb-0.5 truncate">{proj.name}</p>
                          <p className="text-zinc-500 text-[10px] leading-snug mb-3 line-clamp-2">{proj.description}</p>
                          {proj.url ? (
                            <a
                              href={proj.url}
                              target="_blank"
                              rel="noreferrer"
                              className="nodrag w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/50 text-purple-200 text-[11px] font-semibold hover:bg-purple-600/35 hover:border-purple-400 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View App
                            </a>
                          ) : (
                            <div className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-zinc-800/30 border border-zinc-700/50 text-zinc-500 text-[11px] font-semibold select-none">
                              <Box className="w-3.5 h-3.5" /> No URL set
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── ADD PROJECT MODAL ─────────────────────────────────────────── */}
          <AnimatePresence>
            {addProjectOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm nodrag"
                onClick={(e) => { if (e.target === e.currentTarget) setAddProjectOpen(false); }}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 20 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="w-full max-w-md bg-[#111114] border border-[#2a2a2e] rounded-2xl p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold text-white">Add App to Showcase</span>
                    </div>
                    <button
                      onClick={() => setAddProjectOpen(false)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/8 transition-colors"
                      style={{ minHeight: 0, minWidth: 0 }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-shrink-0">
                        <p className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Emoji</p>
                        <input
                          type="text"
                          value={newProject.emoji}
                          onChange={e => setNewProject(p => ({ ...p, emoji: e.target.value }))}
                          className="w-14 text-center bg-[#1a1a1e] border border-[#2a2a2e] focus:border-purple-500/50 rounded-lg px-2 py-2 text-xl outline-none transition-colors"
                          maxLength={2}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Project Name *</p>
                        <input
                          type="text"
                          placeholder="My Awesome App"
                          value={newProject.name}
                          onChange={e => { setNewProject(p => ({ ...p, name: e.target.value })); setNewProjectError(''); }}
                          className="w-full bg-[#1a1a1e] border border-[#2a2a2e] focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">Description *</p>
                      <textarea
                        placeholder="What does this app do?"
                        value={newProject.description}
                        onChange={e => { setNewProject(p => ({ ...p, description: e.target.value })); setNewProjectError(''); }}
                        rows={2}
                        className="w-full bg-[#1a1a1e] border border-[#2a2a2e] focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none resize-none transition-colors"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 mb-1 font-semibold uppercase tracking-wider">App URL (optional)</p>
                      <div className="flex items-center gap-2 bg-[#1a1a1e] border border-[#2a2a2e] focus-within:border-purple-500/50 rounded-lg px-3 py-2 transition-colors">
                        <Link className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                        <input
                          type="url"
                          placeholder="https://myapp.example.com"
                          value={newProject.url}
                          onChange={e => setNewProject(p => ({ ...p, url: e.target.value }))}
                          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 mb-1.5 font-semibold uppercase tracking-wider">Status</p>
                      <div className="flex gap-2">
                        {(['live', 'soon'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => setNewProject(p => ({ ...p, status: s }))}
                            style={{ minHeight: 0 }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${newProject.status === s ? (s === 'live' ? 'bg-green-500/15 border-green-500/40 text-green-300' : 'bg-zinc-700/30 border-zinc-600/50 text-zinc-300') : 'bg-[#1a1a1e] border-[#2a2a2e] text-zinc-600 hover:border-zinc-600'}`}
                          >
                            {s === 'live' ? '🟢 Live' : '⏳ Coming Soon'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {newProjectError && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                        {newProjectError}
                      </motion.p>
                    )}
                    <button
                      onClick={saveCustomProject}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Add to Showcase
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* MOBILE MODEL PICKER SHEET — replaces the inline dropdown on small screens */}
      <Sheet open={isMobile && mobileModelSheetOpen} onOpenChange={setMobileModelSheetOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#0e0e10] border-t border-white/10 p-0 h-[85dvh] max-h-[85dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-white/8 text-left">
            <SheetTitle className="text-white text-base font-semibold">Add a model</SheetTitle>
          </SheetHeader>
          <div className="p-3 space-y-2 border-b border-white/8">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search models"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none"
                style={{ fontSize: 16 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'fast', 'expert'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  style={{ minHeight: 0, minWidth: 0 }}
                  className={`no-min-touch flex-1 h-10 rounded-md text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    tierFilter === t
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-white/5 text-zinc-500 border border-white/8 hover:border-white/15'
                  }`}
                >
                  {t === 'all' ? `All ${AVAILABLE_MODELS.length}` : t}
                </button>
              ))}
            </div>
          </div>
          <div
            className="overflow-y-auto flex-1 p-2 space-y-0.5"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredModels.map(model => {
              const isSelected = selectedModels.some(m => m.id === model.id);
              return (
                <button
                  key={model.id}
                  disabled={isSelected}
                  onClick={() => {
                    if (!isSelected) {
                      toggleModelSelection(model);
                      setMobileModelSheetOpen(false);
                    }
                  }}
                  title={model.id}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors min-h-[52px] ${
                    isSelected
                      ? 'opacity-40 cursor-not-allowed bg-indigo-600/10'
                      : 'text-zinc-300 hover:bg-white/5 active:bg-white/10 hover:text-white'
                  }`}
                >
                  <ProviderLogo category={model.provider} size={22} />
                  <span className="text-sm font-medium truncate flex-1">
                    {model.id.split('/')[0]}/ {model.name}
                  </span>
                  {model.tier === 'fast' ? (
                    <Zap className="w-4 h-4 text-blue-400/70 shrink-0" />
                  ) : (
                    <BrainCircuit className="w-4 h-4 text-purple-400/70 shrink-0" />
                  )}
                  {isSelected && <Check className="w-4 h-4 text-[#22c55e] shrink-0" />}
                </button>
              );
            })}
            {filteredModels.length === 0 && (
              <p className="text-center text-sm text-zinc-600 py-8">No models match.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* MODEL SETTINGS — same component as the home page Settings panel */}
      {settingsModalModel && (() => {
        const id = settingsModalModel.id;
        const cfg = modelSettings[id] ?? DEFAULT_SETTINGS;
        const replaceModelInSelection = (newId: string) => {
          const newModel = AVAILABLE_MODELS.find(m => m.id === newId);
          if (!newModel) return;
          setSelectedModels(prev => {
            if (prev.some(m => m.id === newId)) {
              return prev.filter(m => m.id !== id);
            }
            return prev.map(m => (m.id === id ? newModel : m));
          });
          setModelSettings(prev => {
            const next = { ...prev };
            if (!next[newId]) next[newId] = { ...DEFAULT_SETTINGS, ...(next[id] ?? {}) };
            return next;
          });
          setSettingsModalModel(null);
        };
        return (
          <SettingsPanel
            isOpen={true}
            onClose={() => setSettingsModalModel(null)}
            model={id}
            setModel={replaceModelInSelection}
            hfKeyIndex={cfg.hfKeyIndex ?? 1}
            setHfKeyIndex={(k) => updateSetting(id, 'hfKeyIndex', k)}
            temperature={cfg.temperature}
            setTemperature={(t) => updateSetting(id, 'temperature', t)}
            topP={cfg.topP}
            setTopP={(p) => updateSetting(id, 'topP', p)}
            maxTokens={cfg.maxTokens}
            setMaxTokens={(n) => updateSetting(id, 'maxTokens', n)}
            webSearchEnabled={false}
            setWebSearchEnabled={() => {}}
            autoCodeMode={false}
            setAutoCodeMode={() => {}}
            autoDecisionMode={false}
            setAutoDecisionMode={() => {}}
            expertMode={false}
            setExpertMode={() => {}}
            onClearAll={() => {
              toggleModelSelection(settingsModalModel);
              setSettingsModalModel(null);
            }}
          />
        );
      })()}

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.3); border-radius: 10px; border: 2px solid #0a0a0b; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.6); }

        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
          border: 4px solid #fff;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.8), inset 0 0 5px rgba(0,0,0,0.5);
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        input[type=range]::-webkit-slider-thumb:hover {
          transform: scale(1.3);
          background: #8b5cf6;
        }

        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}} />
    </div>
  );
}
