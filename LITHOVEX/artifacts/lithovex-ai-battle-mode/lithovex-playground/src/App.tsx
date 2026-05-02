import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Search, Settings, Plus, X, Send, Paperclip,
  Box, Database, MonitorPlay,
  FolderDot, FileText,
  User,
  Check, SlidersHorizontal,
  MessageSquare, Terminal, MousePointer2, Move, ZoomIn, ZoomOut, Focus,
  CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX
} from 'lucide-react';

// ==========================================
// MOCK DATA & CONSTANTS
// ==========================================
type Model = { id: string; name: string; provider: string; icon: string };

const AVAILABLE_MODELS: Model[] = [
  { id: 'lithovex-core', name: 'Lithovex-Core-V3', provider: 'Lithovex', icon: '🪨' },
  { id: 'lithovex-quartz', name: 'Lithovex-Quartz-70B', provider: 'Lithovex', icon: '💠' },
  { id: 'lithovex-obsidian', name: 'Lithovex-Obsidian-72B', provider: 'Lithovex', icon: '🖤' },
  { id: 'lithovex-granite', name: 'Lithovex-Granite-824B-PT', provider: 'Lithovex', icon: '🗿' },
  { id: 'lithovex-flint', name: 'Lithovex-Flint-K2.5', provider: 'Lithovex', icon: '✨' },
  { id: 'lithovex-pumice', name: 'Lithovex-Pumice-9B-it', provider: 'Lithovex', icon: '🌋' },
  { id: 'lithovex-basalt', name: 'Lithovex-Basalt-M0.7', provider: 'Lithovex', icon: '🌪️' },
  { id: 'lithovex-marble', name: 'Lithovex-Marble-Haiku', provider: 'Lithovex', icon: '🧠' },
];

const DEFAULT_SETTINGS = { temperature: 0.5, maxTokens: 15872, topP: 0.5 };
const NODE_WIDTH = 480;
const PROMPT_NODE_WIDTH = 500;
const HORIZONTAL_SPACING = 60;
const VERTICAL_SPACING = 150;

const generateId = () => Math.random().toString(36).substr(2, 9);

function formatMockResponse(model: Model, prompt: string) {
  const p = prompt.toLowerCase();
  if (p.includes('life')) {
    return `<div class="space-y-4">
      <p>That's a profound and fascinating question! Life can be described in many ways, depending on the perspective—biological, philosophical, or even spiritual.</p>
      <div class="bg-[#1a1a1e] p-4 rounded-xl border border-gray-700 shadow-inner">
        <h4 class="font-bold text-blue-400 mb-2 text-lg">The ${model.provider} Perspective</h4>
        <ul class="list-disc pl-5 space-y-2 text-gray-300">
          <li><strong>Growth and development:</strong> Continuous biological evolution.</li>
          <li><strong>Reproduction:</strong> The continuation of genetic legacy.</li>
          <li><strong>Metabolism:</strong> Converting energy into action.</li>
          <li><strong>Adaptation:</strong> Surviving the harshest of environments.</li>
        </ul>
      </div>
      <p>In simpler terms, life is a journey of continuous change and processing of information. How may I assist you further on this topic?</p>
    </div>`;
  }
  return `<p>I am <strong>${model.name}</strong>, initialized and ready.</p><p>Processing request: "<em>${prompt}</em>"</p><p>My cognitive systems have successfully parsed your directive. Awaiting further input.</p>`;
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
        const newTasks = [...prevTasks];
        const task = newTasks[currentTaskIdx];

        if (!task) {
          clearInterval(interval);
          if (onComplete) setTimeout(onComplete, 500);
          return prevTasks;
        }

        if (task.status === "pending") {
          task.status = "in-progress";
        } else if (task.status === "in-progress") {
          const subtask = task.subtasks[currentSubtaskIdx];
          if (subtask) {
            if (subtask.status === "pending") {
              subtask.status = "in-progress";
              setExpandedSubtasks(prev => ({ ...prev, [`${task.id}-${subtask.id}`]: true }));
            } else if (subtask.status === "in-progress") {
              subtask.status = "completed";
              currentSubtaskIdx++;
            }
          } else {
            task.status = "completed";
            currentTaskIdx++;
            currentSubtaskIdx = 0;
            if (newTasks[currentTaskIdx]) {
              setExpandedTasks(prev => [...prev, newTasks[currentTaskIdx].id]);
            }
          }
        }
        return newTasks;
      });
    }, 400);

    return () => {
      isMounted = false;
      clearInterval(interval);
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
type ResponseNode = { id: string; type: 'response'; parentId: string; model: Model; x: number; y: number; status: 'loading' | 'complete'; data: { content: string }; _tokens?: number; _runtime?: string };
type Node = PromptNode | ResponseNode;
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

        const x1 = sourceNode.x + PROMPT_NODE_WIDTH / 2;
        const y1 = sourceNode.y + 120;
        const x2 = targetNode.x;
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
      className="node-element absolute bg-gradient-to-br from-[#16161a] to-[#0a0a0b] border-2 border-purple-500/50 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(139,92,246,0.3)] p-6 cursor-grab active:cursor-grabbing hover:border-purple-400 transition-colors z-10"
      style={{ left: node.x, top: node.y, width: PROMPT_NODE_WIDTH, willChange: 'transform', transform: 'translateZ(0)' }}
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

const ResponseNodeView = memo(function ResponseNodeView({ node, onAgentComplete }: { node: ResponseNode; onAgentComplete: (id: string) => void }) {
  const handleComplete = useCallback(() => onAgentComplete(node.id), [onAgentComplete, node.id]);
  return (
    <motion.div data-id={node.id} variants={canvasNodeVariants} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0 }}
      className="node-element absolute bg-[#16161a] border-2 border-[#6366f1]/30 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex flex-col cursor-grab active:cursor-grabbing hover:border-[#6366f1]/60 transition-colors overflow-hidden z-20"
      style={{ left: node.x - NODE_WIDTH / 2, top: node.y, width: NODE_WIDTH, willChange: 'transform', transform: 'translateZ(0)' }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 rounded-full border-4 border-[#16161a] shadow-[0_0_15px_#3b82f6] z-30"></div>

      <div className="flex items-center justify-between bg-gradient-to-r from-[#1a1a1e] to-[#121214] px-5 py-4 border-b border-gray-800 shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] bg-[#0a0a0b] p-2 rounded-xl border border-gray-700/50">{node.model.icon}</span>
          <div>
            <div className="font-extrabold text-white text-[16px] tracking-wide">{node.model.name}</div>
            <div className="text-blue-400 text-xs font-mono tracking-widest uppercase mt-0.5">{node.model.provider}</div>
          </div>
        </div>
        {node.status === 'loading' ? (
          <span className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs font-bold uppercase tracking-wider animate-pulse">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span> Computing
          </span>
        ) : (
          <span className="bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </span>
        )}
      </div>

      <div className="p-1 flex-1 nodrag cursor-text select-text bg-[#0a0a0b] relative z-10">
        {node.status === 'loading' ? (
          <div className="h-full min-h-[400px]">
            <AgentPlan onComplete={handleComplete} />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-invert prose-blue max-w-none p-6 text-[16px] leading-relaxed" dangerouslySetInnerHTML={{ __html: node.data.content }} />
        )}
      </div>

      {node.status === 'complete' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-3 border-t border-gray-800 bg-[#0a0a0b] flex justify-between items-center text-xs text-gray-400 font-mono">
          <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800"><Terminal className="w-3.5 h-3.5 text-purple-400" /> {node._tokens ?? 0} tok</span>
          <span className="flex items-center gap-2 bg-gray-900 px-3 py-1 rounded-md border border-gray-800 text-green-400 font-bold">{node._runtime ?? '0.00'}s runtime</span>
        </motion.div>
      )}
    </motion.div>
  );
});

export default function App() {
  const [selectedModels, setSelectedModels] = useState<Model[]>([
    AVAILABLE_MODELS.find(m => m.id === 'lithovex-granite')!,
    AVAILABLE_MODELS.find(m => m.id === 'lithovex-flint')!
  ]);
  const [modelSettings, setModelSettings] = useState<Record<string, typeof DEFAULT_SETTINGS>>({
    'lithovex-granite': { ...DEFAULT_SETTINGS },
    'lithovex-flint': { ...DEFAULT_SETTINGS }
  });

  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [settingsModalModel, setSettingsModalModel] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const CHATBOX_WIDTH = 480;
  const [chatBoxPos, setChatBoxPos] = useState({ x: -CHATBOX_WIDTH / 2, y: -40 });

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
      const offsetX = draggedIsResponseRef.current ? NODE_WIDTH / 2 : 0;
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

  const centerCamera = () => {
    if (nodes.length === 0) {
      cameraRef.current = { x: window.innerWidth / 2, y: 100, scale: 1 };
      applyCameraToDOM();
      return;
    }
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const centerX = (Math.min(...xs) + Math.max(...xs) + PROMPT_NODE_WIDTH) / 2;
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
  }, [handleWheel]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isGenerating || selectedModels.length === 0) return;

    setIsGenerating(true);
    const promptId = generateId();

    const lastNodeY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y + (n.type === 'prompt' ? 150 : 500))) : 0;
    const promptY = lastNodeY + VERTICAL_SPACING;

    const newPromptNode: PromptNode = {
      id: promptId,
      type: 'prompt',
      x: -PROMPT_NODE_WIDTH / 2,
      y: promptY,
      data: { content: inputValue }
    };

    setNodes(prev => [...prev, newPromptNode]);
    setInputValue('');

    cameraRef.current = { ...cameraRef.current, y: (window.innerHeight / 3) - (promptY * cameraRef.current.scale) };
    applyCameraToDOM();

    const totalWidth = selectedModels.length * NODE_WIDTH + (selectedModels.length - 1) * HORIZONTAL_SPACING;
    const startX = -totalWidth / 2;
    const responsesY = promptY + 250;

    const newResponseNodes: ResponseNode[] = selectedModels.map((model, idx) => ({
      id: generateId(),
      type: 'response',
      parentId: promptId,
      model: model,
      x: startX + idx * (NODE_WIDTH + HORIZONTAL_SPACING) + (NODE_WIDTH / 2),
      y: responsesY,
      status: 'loading',
      data: { content: '' }
    }));

    setNodes(prev => [...prev, ...newResponseNodes]);
    setEdges(prev => [...prev, ...newResponseNodes.map(rn => ({ id: `e-${promptId}-${rn.id}`, source: promptId, target: rn.id }))]);
  };

  const completeNodeGeneration = useCallback((nodeId: string, promptContent: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'response') {
        return {
          ...n,
          status: 'complete' as const,
          data: { content: formatMockResponse(n.model, promptContent) },
          _tokens: Math.floor(Math.random() * 800 + 200),
          _runtime: ((Math.random() * 2) + 0.5).toFixed(2),
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

  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const handleAgentComplete = useCallback((nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'response') return;
    const parent = nodesRef.current.find(n => n.id === node.parentId);
    completeNodeGeneration(nodeId, parent && parent.type === 'prompt' ? parent.data.content : '');
  }, [completeNodeGeneration]);

  const toggleModelSelection = (model: Model) => {
    if (selectedModels.find(m => m.id === model.id)) {
      setSelectedModels(prev => prev.filter(m => m.id !== model.id));
      if (settingsModalModel?.id === model.id) setSettingsModalModel(null);
    } else {
      if (selectedModels.length >= 6) {
        alert("Maximum 6 models allowed for visual branching.");
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

  const filteredModels = AVAILABLE_MODELS.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.provider.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="dark h-screen w-screen bg-[#0f0f0f] text-gray-100 font-sans flex flex-col overflow-hidden selection:bg-indigo-500/30">

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2e] bg-[#0a0a0b] z-50 shrink-0">
        <div className="flex items-center gap-6">
          <motion.div className="flex items-center gap-2 cursor-pointer group" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <span className="text-2xl">🪨</span>
            <span className="font-bold text-white text-lg tracking-tight">LITHOVEX <span className="text-blue-400 font-normal">Playground</span> <span className="text-purple-400 text-xs uppercase bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">Extreme</span></span>
          </motion.div>
        </div>
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.1, rotate: 180 }} transition={{ type: "spring", stiffness: 300 }} className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] cursor-pointer ring-2 ring-gray-800 hover:ring-purple-400 transition-all">
            <User className="w-4 h-4" />
          </motion.div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* INFINITE CANVAS */}
        <div ref={canvasRef} className="flex-1 relative overflow-hidden bg-[#0a0a0b] cursor-grab active:cursor-grabbing" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>

          <div ref={grid1Ref} className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: `linear-gradient(to right, #1e1e22 1px, transparent 1px), linear-gradient(to bottom, #1e1e22 1px, transparent 1px)` }} />

          <div ref={transformContainerRef} className="absolute origin-top-left will-change-transform">

            {/* SVG EDGES */}
            <EdgesLayer edges={edges} nodes={nodes} />

            {/* NODES */}
            <AnimatePresence>
              {nodes.map(node => {
                if (node.type === 'prompt') return <PromptNodeView key={node.id} node={node} />;
                if (node.type === 'response') return <ResponseNodeView key={node.id} node={node} onAgentComplete={handleAgentComplete} />;
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
              style={{ left: chatBoxPos.x, top: chatBoxPos.y, width: CHATBOX_WIDTH }}
            >
              {/* Drag handle */}
              <div className="flex items-center justify-center pt-2 pb-0.5 cursor-grab active:cursor-grabbing select-none" title="Drag to move">
                <div className="w-10 h-1 rounded-full bg-[#2a2a2e]" />
              </div>
              {/* Model chips row */}
              <div className="flex items-center gap-2 px-4 pt-3.5 pb-1 flex-wrap nodrag relative">
                <AnimatePresence>
                  {selectedModels.map((model) => (
                    <motion.div
                      key={model.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      layout
                      className="group flex items-center gap-1.5 bg-[#1c1c20] border border-[#2a2a2e] hover:border-[#3a3a40] rounded-md pl-2 pr-1 py-1 text-xs text-[#e4e4e7] transition-colors"
                    >
                      <span className="text-sm leading-none">{model.icon}</span>
                      <span className="font-medium tracking-tight cursor-pointer" onClick={() => setSettingsModalModel(model)}>{model.name}</span>
                      <button
                        onClick={() => toggleModelSelection(model)}
                        className="ml-0.5 p-0.5 rounded text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#2a2a2e] transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveDropdown(activeDropdown === 'add' ? null : 'add')}
                    className="flex items-center justify-center w-6 h-6 rounded-md bg-[#1c1c20] border border-[#2a2a2e] hover:border-[#3a3a40] hover:bg-[#1e1e22] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors"
                    title="Add model"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </motion.button>

                  <AnimatePresence>
                    {activeDropdown === 'add' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.25 }}
                        className="absolute top-full mt-2 left-0 w-72 bg-[#121214] border border-[#2a2a2e] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-50 overflow-hidden flex flex-col max-h-[320px]"
                      >
                        <div className="p-2 border-b border-[#2a2a2e]">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
                            <input
                              type="text"
                              placeholder="Search models..."
                              className="w-full bg-[#1c1c20] border border-[#2a2a2e] rounded-md py-1.5 pl-8 pr-3 text-xs text-[#e4e4e7] focus:border-[#6366f1] outline-none placeholder-[#71717a]"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                          {filteredModels.map(model => {
                            const isSelected = selectedModels.some(m => m.id === model.id);
                            return (
                              <button
                                key={model.id}
                                disabled={isSelected}
                                onClick={() => !isSelected && toggleModelSelection(model)}
                                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${isSelected ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#1e1e22]'}`}
                              >
                                <span className="text-base leading-none w-5 text-center">{model.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-[#e4e4e7] truncate">{model.name}</div>
                                  <div className="text-[10px] text-[#71717a] font-mono">{model.provider}</div>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#22c55e] shrink-0" />}
                              </button>
                            );
                          })}
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
                  className="w-full bg-transparent border-none text-[#e4e4e7] placeholder-[#71717a] resize-none outline-none py-1 max-h-60 min-h-[28px] custom-scrollbar text-sm"
                  rows={1}
                />
              </div>

              {/* Bottom action row */}
              <div className="flex items-center justify-between px-3 pb-3 pt-2 nodrag">
                <button className="p-1.5 rounded-md text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1e1e22] transition-colors">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isGenerating || selectedModels.length === 0}
                  className={`p-1.5 rounded-md transition-colors ${inputValue.trim() && !isGenerating && selectedModels.length > 0 ? 'bg-[#1c1c20] border border-[#2a2a2e] text-[#e4e4e7] hover:bg-[#1e1e22]' : 'bg-[#1c1c20] border border-[#2a2a2e] text-[#52525a] cursor-not-allowed'}`}
                >
                  <Send className="w-4 h-4" />
                </button>
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

        </div>
      </main>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {settingsModalModel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.8, y: 100, rotateX: 20 }} animate={{ scale: 1, y: 0, rotateX: 0 }} exit={{ scale: 0.8, y: 100, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="bg-[#16161a] border-2 border-blue-500/30 rounded-3xl w-full max-w-lg shadow-[0_0_100px_rgba(59,130,246,0.2)] flex flex-col overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

              <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gradient-to-b from-[#1a1a1e] to-transparent">
                <div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-3">
                    <SlidersHorizontal className="w-6 h-6 text-blue-400" /> Deep Configuration
                  </h3>
                  <p className="text-sm text-gray-400 mt-1 font-mono">{settingsModalModel.icon} {settingsModalModel.name}</p>
                </div>
                <motion.button whileHover={{ scale: 1.2, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setSettingsModalModel(null)} className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-xl transition-colors bg-gray-900 border border-gray-800">
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="p-8 space-y-8">
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Inference Node</label>
                  <div className="bg-[#121214] border border-gray-700 rounded-2xl p-4 text-base text-gray-200 flex justify-between items-center shadow-inner">
                    <span className="flex items-center gap-3 font-mono">🚀 {settingsModalModel.provider} Mainnet</span>
                    <span className="text-xs font-bold font-mono bg-green-500/20 border border-green-500/50 text-green-400 px-3 py-1 rounded-md animate-pulse">ONLINE</span>
                  </div>
                </div>

                {([
                  { key: 'temperature', label: 'Entropy (Temperature)', min: 0, max: 2, step: 0.1, desc: 'Controls probability matrix randomness.' },
                  { key: 'maxTokens', label: 'Maximum Generative Tokens', min: 256, max: 32000, step: 256, desc: 'Absolute threshold for inference sequence.' },
                  { key: 'topP', label: 'Top-P Sampling', min: 0, max: 1, step: 0.05, desc: 'Nucleus filtering for predictive mass.' }
                ] as const).map(slider => (
                  <div key={slider.key} className="group">
                    <div className="flex justify-between mb-2 items-end">
                      <label className="text-sm font-bold text-gray-300 group-hover:text-blue-400 transition-colors uppercase tracking-wider">{slider.label}</label>
                      <span className="text-sm font-bold font-mono bg-blue-500/10 px-3 py-1 rounded-lg text-blue-400 border border-blue-500/30 shadow-inner">
                        {slider.key === 'temperature' || slider.key === 'topP' ? modelSettings[settingsModalModel.id]?.[slider.key].toFixed(2) : modelSettings[settingsModalModel.id]?.[slider.key]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4 font-mono">{slider.desc}</p>
                    <input
                      type="range" min={slider.min} max={slider.max} step={slider.step} value={modelSettings[settingsModalModel.id]?.[slider.key]}
                      onChange={(e) => updateSetting(settingsModalModel.id, slider.key, parseFloat(e.target.value))}
                      className="w-full accent-blue-500 bg-gray-800 h-3 rounded-full appearance-none cursor-pointer outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner"
                    />
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-800 bg-[#0a0a0b] flex justify-between items-center">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => toggleModelSelection(settingsModalModel)} className="text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 px-6 py-3 rounded-xl text-sm font-extrabold transition-all border border-red-500/20 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                  TERMINATE INSTANCE
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSettingsModalModel(null)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-3 rounded-xl text-sm font-extrabold transition-all shadow-[0_10px_20px_rgba(59,130,246,0.4)] border border-blue-400/50 tracking-widest uppercase">
                  Lock Config
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
