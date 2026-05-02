// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Streaming Pipeline Type System
// Prompt 3 / Layer 1: Strict, Zod-validated contracts for the entire streaming
// pipeline. All inter-layer communication uses these types.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Streaming chunk contract ────────────────────────────────────────────────

export const StreamChunkSchema = z
  .object({
    id: z.string(),
    modelId: z.string(),
    providerId: z.string(),
    content: z.string(),
    role: z.enum(["assistant", "tool"]),
    finishReason: z
      .enum(["stop", "length", "tool_calls", "error"])
      .optional(),
    metadata: z.object({
      tokenIndex: z.number(),
      estimatedTokens: z.number(),
      timestamp: z.number(),
      isThinking: z.boolean().default(false),
    }),
  })
  .strict();

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ─── Stream state machine ────────────────────────────────────────────────────

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "paused"
  | "completed"
  | "error"
  | "cancelled";

export interface StreamMetadata {
  /** Time to first token in ms. */
  ttft: number | null;
  /** Total stream duration in ms. */
  totalDuration: number | null;
  tokenCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  finishReason: StreamChunk["finishReason"] | null;
  error: Error | null;
}

export interface StreamState {
  status: StreamStatus;
  modelId: string;
  providerId: string;
  content: string;
  chunks: StreamChunk[];
  metadata: StreamMetadata;
  startedAt: number;
  completedAt: number | null;
}

// ─── Orchestration configuration ─────────────────────────────────────────────

export interface OrchestrationConfig {
  maxConcurrentStreams: number;
  chunkBufferSize: number;
  uiUpdateThrottleMs: number;
  enableBackpressure: boolean;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
  enableMetadataTracking: boolean;
  enableThinkingTokens: boolean;
}

export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  maxConcurrentStreams: 8,
  chunkBufferSize: 50,
  uiUpdateThrottleMs: 16, // ~60 fps
  enableBackpressure: true,
  retryAttempts: 2,
  retryDelayMs: 1000,
  timeoutMs: 60_000,
  enableMetadataTracking: true,
  enableThinkingTokens: true,
};

// ─── Provider adapter interface ──────────────────────────────────────────────

export interface ProviderStreamAdapter {
  providerId: string;
  supportsStreaming: boolean;
  normalizeStream(
    response: Response,
    modelId: string,
    config: OrchestrationConfig,
    signal: AbortSignal
  ): AsyncIterable<StreamChunk>;
  parseError(response: Response): Promise<Error>;
  getEstimatedTokenCount(content: string): number;
}

// ─── Coordinator request payload ─────────────────────────────────────────────
// Shape passed to startStream — agnostic of provider. The adapter + a
// request-builder transform this into the actual HTTP payload.

export interface ChatTurnRequest {
  /** Full message history including the new user message. */
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  hfKeyIndex?: number;
  useWebSearch?: boolean;
  /** Optional project context appended to backend payload. */
  projectContext?: string;
}

// ─── Coordinator events ──────────────────────────────────────────────────────

export type StreamEvents = {
  "stream:status": { modelId: string; status: StreamStatus };
  "stream:chunk": { modelId: string; chunk: StreamChunk };
  "stream:batch": { modelId: string; chunks: StreamChunk[] };
  "stream:state": { modelId: string; state: StreamState };
  "stream:error": { modelId: string; error: Error };
  "stream:complete": { modelId: string; state: StreamState };
};
