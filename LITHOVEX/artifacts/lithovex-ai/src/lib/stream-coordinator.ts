// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Stream Coordinator
// Prompt 3 / Layer 3: Concurrent multi-model orchestration with state machine,
// metadata tracking, AbortController integration, backpressure, and event
// emission. Provider-agnostic via the ProviderStreamAdapter interface.
// ─────────────────────────────────────────────────────────────────────────────

import { TypedEventEmitter } from "@/lib/event-emitter";
import { BackpressureController } from "@/lib/backpressure-controller";
import { classifyStreamError } from "@/lib/stream-errors";
import {
  DEFAULT_ORCHESTRATION_CONFIG,
  type ChatTurnRequest,
  type OrchestrationConfig,
  type ProviderStreamAdapter,
  type StreamChunk,
  type StreamEvents,
  type StreamState,
} from "@/types/streaming";

// The FastAPI backend is mounted at the workspace root (not under the
// artifact's BASE_URL prefix), so we hit /api/chat/completions directly.
const API_ENDPOINT = "/api/chat/completions";

interface StartStreamOptions {
  modelId: string;
  providerId: string;
  request: ChatTurnRequest;
  /** Backend model identifier (HF model id like "Qwen/Qwen3-8B"). */
  backendModel: string;
  adapter: ProviderStreamAdapter;
}

export class StreamCoordinator extends TypedEventEmitter<StreamEvents> {
  private readonly config: OrchestrationConfig;
  private readonly activeStreams = new Map<string, StreamState>();
  private readonly abortControllers = new Map<string, AbortController>();
  private readonly backpressure = new Map<string, BackpressureController>();

  constructor(config: Partial<OrchestrationConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ORCHESTRATION_CONFIG, ...config };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async startStream(opts: StartStreamOptions): Promise<void> {
    const { modelId, providerId, request, backendModel, adapter } = opts;

    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error(
        `Maximum concurrent streams (${this.config.maxConcurrentStreams}) reached`
      );
    }

    const abort = new AbortController();
    this.abortControllers.set(modelId, abort);

    const initialState: StreamState = {
      status: "connecting",
      modelId,
      providerId,
      content: "",
      chunks: [],
      metadata: {
        ttft: null,
        totalDuration: null,
        tokenCount: 0,
        promptTokens: null,
        completionTokens: null,
        finishReason: null,
        error: null,
      },
      startedAt: performance.now(),
      completedAt: null,
    };
    this.activeStreams.set(modelId, initialState);
    this.emit("stream:status", { modelId, status: "connecting" });
    this.emit("stream:state", { modelId, state: initialState });

    // Wire backpressure: batch chunks then re-emit for UI.
    if (this.config.enableBackpressure) {
      const bp = new BackpressureController(
        this.config.uiUpdateThrottleMs,
        (chunks) => this.emit("stream:batch", { modelId, chunks })
      );
      this.backpressure.set(modelId, bp);
    }

    // Optional timeout watchdog.
    const timeoutHandle = this.config.timeoutMs
      ? setTimeout(() => abort.abort(), this.config.timeoutMs)
      : null;

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          model: backendModel,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.9,
          max_tokens: request.maxTokens ?? 4096,
          hf_key_index: request.hfKeyIndex ?? 1,
          use_web_search: request.useWebSearch ?? false,
          project_context: request.projectContext ?? "",
          stream: true,
        }),
      });

      if (!response.ok) {
        const parsedError = await adapter.parseError(response);
        throw classifyStreamError(parsedError, response);
      }

      this.updateState(modelId, { status: "streaming" });
      this.emit("stream:status", { modelId, status: "streaming" });

      let isFirstChunk = true;
      for await (const chunk of adapter.normalizeStream(
        response,
        modelId,
        this.config,
        abort.signal
      )) {
        if (abort.signal.aborted) break;

        if (isFirstChunk && chunk.content) {
          const ttft = Math.round(performance.now() - initialState.startedAt);
          this.updateMetadata(modelId, { ttft });
          isFirstChunk = false;
        }

        this.appendChunk(modelId, chunk);

        if (this.config.enableBackpressure) {
          this.backpressure.get(modelId)?.push(chunk);
        } else {
          this.emit("stream:chunk", { modelId, chunk });
        }

        if (chunk.finishReason) {
          this.updateMetadata(modelId, { finishReason: chunk.finishReason });
        }
      }

      // Drain any buffered chunks before marking complete.
      this.backpressure.get(modelId)?.flush();

      const final = this.activeStreams.get(modelId)!;
      const totalDuration = Math.round(performance.now() - final.startedAt);
      this.updateState(modelId, {
        status: "completed",
        completedAt: performance.now(),
        metadata: {
          ...final.metadata,
          totalDuration,
          finishReason: final.metadata.finishReason ?? "stop",
        },
      });
      this.emit("stream:status", { modelId, status: "completed" });
      this.emit("stream:complete", { modelId, state: this.activeStreams.get(modelId)! });
    } catch (error: unknown) {
      this.backpressure.get(modelId)?.clear();
      const classified = classifyStreamError(error);
      const isCancel = classified.code === "ABORTED" || abort.signal.aborted;
      const status = isCancel ? "cancelled" : "error";

      const current = this.activeStreams.get(modelId);
      if (current) {
        this.updateState(modelId, {
          status,
          completedAt: performance.now(),
          metadata: { ...current.metadata, error: classified },
        });
      }
      this.emit("stream:status", { modelId, status });
      if (!isCancel) this.emit("stream:error", { modelId, error: classified });
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      this.abortControllers.delete(modelId);
      this.backpressure.delete(modelId);
      // Note: we keep activeStreams entry so caller can still inspect final state.
    }
  }

  cancelStream(modelId: string): void {
    this.abortControllers.get(modelId)?.abort();
  }

  cancelAllStreams(): void {
    for (const ctrl of this.abortControllers.values()) ctrl.abort();
  }

  getStreamState(modelId: string): StreamState | undefined {
    return this.activeStreams.get(modelId);
  }

  getAllStreamStates(): ReadonlyMap<string, StreamState> {
    return this.activeStreams;
  }

  /** Drop all state and listeners. Call on unmount. */
  cleanup(): void {
    this.cancelAllStreams();
    for (const bp of this.backpressure.values()) bp.clear();
    this.backpressure.clear();
    this.activeStreams.clear();
    this.removeAllListeners();
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private updateState(modelId: string, patch: Partial<StreamState>): void {
    const current = this.activeStreams.get(modelId);
    if (!current) return;
    const next = { ...current, ...patch };
    this.activeStreams.set(modelId, next);
    this.emit("stream:state", { modelId, state: next });
  }

  private updateMetadata(
    modelId: string,
    patch: Partial<StreamState["metadata"]>
  ): void {
    const current = this.activeStreams.get(modelId);
    if (!current) return;
    this.updateState(modelId, { metadata: { ...current.metadata, ...patch } });
  }

  private appendChunk(modelId: string, chunk: StreamChunk): void {
    const current = this.activeStreams.get(modelId);
    if (!current) return;
    // Thinking tokens accumulate in metadata only — not in displayed content.
    const content = chunk.metadata.isThinking
      ? current.content
      : current.content + chunk.content;
    const tokenCount = current.metadata.tokenCount + chunk.metadata.estimatedTokens;
    this.updateState(modelId, {
      content,
      chunks: [...current.chunks, chunk],
      metadata: { ...current.metadata, tokenCount },
    });
  }
}
