// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Core Type Definitions
// Phase 1: N-Dimensional Multi-Model Concurrency Architecture
// ─────────────────────────────────────────────────────────────────────────────

// ─── File Attachment Metadata ─────────────────────────────────────────────────

export interface FileMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Base64 data URL or remote URL */
  dataUrl?: string;
}

// ─── Per-Model Response State (keyed by modelId inside a turn node) ──────────

export interface AIResponseState {
  modelId: string;
  /** Human-readable provider name e.g. 'Google', 'Meta', 'Mistral', 'Qwen' */
  provider: string;
  status: "idle" | "streaming" | "complete" | "error";
  content: string;
  /** Wall-clock latency from request dispatch to first token (ms) */
  latencyMs?: number;
  /** Tokens generated per second, computed after stream completes */
  tokensPerSecond?: number;
  errorDetail?: string;
}

// ─── Turn Node: one user prompt → N parallel AI responses ────────────────────

export interface MessageTurnNode {
  turnId: string;
  userMessage: {
    id: string;
    content: string;
    attachments?: FileMeta[];
    timestamp: number;
  };
  /** Keyed by modelId — each entry is the streaming/complete response from that model */
  aiResponses: Record<string, AIResponseState>;
}

// ─── Playground Conversation (multi-model, turn-based) ───────────────────────

export interface PlaygroundConversation {
  id: string;
  title: string;
  createdAt: number;
  messageTurnNodes: MessageTurnNode[];
}

// ─── Per-Model Configuration ──────────────────────────────────────────────────

export interface ModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  parameters: ModelParameters;
  /** CSS color identifier used to visually differentiate model columns/cards */
  colorTheme: string;
  /** Optional inference provider override (e.g. "hf-serverless", "novita", "together") */
  inferenceProvider?: string;
}

// ─── Playground Environment State ────────────────────────────────────────────

export type LayoutMode = "masonry" | "columns";

export interface PlaygroundEnvironment {
  activeModels: ModelConfig[];
  isPersonaEnabled: boolean;
  globalSystemPrompt: string;
  layoutMode: LayoutMode;
}

// ─── Persona (Phase 5: System Persona & Instruction Manager) ─────────────────

export interface Persona {
  id: string;
  name: string;
  description: string;
  instructions: string;
  isDefault: boolean;
}

// ─── Playground Context Shape (exposed via usePlaygroundState) ────────────────

export interface PlaygroundContextValue {
  // ── Environment ────────────────────────────────────────────────────────────
  environment: PlaygroundEnvironment;

  // ── Model management ───────────────────────────────────────────────────────
  addModel: (config: ModelConfig) => void;
  removeModel: (modelId: string) => void;
  updateModelParameters: (modelId: string, params: Partial<ModelParameters>) => void;
  setModelProvider: (modelId: string, provider: string) => void;
  reorderModels: (from: number, to: number) => void;

  // ── Environment controls ───────────────────────────────────────────────────
  setPersonaEnabled: (enabled: boolean) => void;
  setGlobalSystemPrompt: (prompt: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;

  // ── Conversation management ─────────────────────────────────────────────────
  conversations: PlaygroundConversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  createConversation: (title?: string) => PlaygroundConversation;
  deleteConversation: (id: string) => void;

  // ── Turn node management ────────────────────────────────────────────────────
  appendTurnNode: (conversationId: string, node: MessageTurnNode) => void;

  /**
   * Stream a chunk of text into a specific model's response inside a turn.
   * Designed for high-frequency calls — uses functional state update to avoid
   * stale closure issues and never corrupts sibling model entries.
   */
  streamChunk: (conversationId: string, turnId: string, modelId: string, chunk: string) => void;

  /**
   * Transition a model response's status. Also records latency / tokensPerSecond
   * when finalising a 'complete' or 'error' transition.
   */
  finalizeResponse: (
    conversationId: string,
    turnId: string,
    modelId: string,
    outcome: Pick<AIResponseState, "status" | "latencyMs" | "tokensPerSecond" | "errorDetail">
  ) => void;

  /**
   * Set the initial idle shell for a model response inside a turn (call this
   * before you start streaming so the UI can render the loading state).
   */
  initResponseShell: (
    conversationId: string,
    turnId: string,
    modelId: string,
    provider: string
  ) => void;
}
