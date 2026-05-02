// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Base Stream Normalizer
// Prompt 3 / Layer 2: Abstract base class implemented by every provider
// adapter. Centralises chunk validation and id generation so concrete adapters
// only worry about parsing their wire protocol.
// ─────────────────────────────────────────────────────────────────────────────

import {
  StreamChunkSchema,
  type OrchestrationConfig,
  type ProviderStreamAdapter,
  type StreamChunk,
} from "@/types/streaming";

export abstract class BaseStreamNormalizer implements ProviderStreamAdapter {
  abstract providerId: string;
  abstract supportsStreaming: boolean;

  protected validateChunk(chunk: unknown): StreamChunk {
    return StreamChunkSchema.parse(chunk);
  }

  /**
   * Construct a validated StreamChunk. Concrete adapters call this for every
   * delta so any malformed chunks are caught before reaching the coordinator.
   */
  protected createChunk(
    modelId: string,
    content: string,
    options: Partial<StreamChunk> = {}
  ): StreamChunk {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    return this.validateChunk({
      id,
      modelId,
      providerId: this.providerId,
      content,
      role: options.role ?? "assistant",
      finishReason: options.finishReason,
      metadata: {
        tokenIndex: 0,
        estimatedTokens: this.getEstimatedTokenCount(content),
        timestamp: Date.now(),
        isThinking: false,
        ...(options.metadata ?? {}),
      },
    });
  }

  /** ~4 chars per token approximation for English text. */
  getEstimatedTokenCount(content: string): number {
    return Math.max(1, Math.ceil(content.length / 4));
  }

  abstract normalizeStream(
    response: Response,
    modelId: string,
    config: OrchestrationConfig,
    signal: AbortSignal
  ): AsyncIterable<StreamChunk>;

  abstract parseError(response: Response): Promise<Error>;
}
