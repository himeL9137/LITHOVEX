// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — OpenAI-compatible SSE Stream Adapter
// Prompt 3 / Layer 2: Parses the `data: {...}` newline-delimited SSE format
// emitted by /api/chat/completions (proxying the HF Inference Router).
//
// Handles: incremental text deltas, [DONE] sentinel, key_switch markers,
// thinking-token detection, and finish_reason propagation.
// ─────────────────────────────────────────────────────────────────────────────

import { BaseStreamNormalizer } from "@/lib/stream-normalizer";
import type { OrchestrationConfig, StreamChunk } from "@/types/streaming";

export class OpenAIStreamAdapter extends BaseStreamNormalizer {
  providerId = "openai-compat";
  supportsStreaming = true;

  async *normalizeStream(
    response: Response,
    modelId: string,
    _config: OrchestrationConfig,
    signal: AbortSignal
  ): AsyncIterable<StreamChunk> {
    if (!response.body) throw new Error("Response body is null");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let tokenIndex = 0;

    try {
      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const raw = trimmed.slice(5).trim();
          if (raw === "[DONE]") {
            yield this.createChunk(modelId, "", {
              finishReason: "stop",
              metadata: {
                tokenIndex,
                estimatedTokens: 0,
                timestamp: Date.now(),
                isThinking: false,
              },
            });
            continue;
          }

          let json: any;
          try {
            json = JSON.parse(raw);
          } catch {
            continue;
          }

          // Backend may emit transient {error}, {key_switch}, etc. — tolerate.
          if (json?.error) {
            throw new Error(String(json.error));
          }
          if (json?.key_switch) continue;

          const choice = json?.choices?.[0];
          const delta = choice?.delta;
          const finish = choice?.finish_reason as StreamChunk["finishReason"] | undefined;
          const content: string | undefined = delta?.content;
          const reasoning: string | undefined = delta?.reasoning;

          if (content) {
            tokenIndex += 1;
            yield this.createChunk(modelId, content, {
              metadata: {
                tokenIndex,
                estimatedTokens: this.getEstimatedTokenCount(content),
                timestamp: Date.now(),
                isThinking: false,
              },
              ...(finish ? { finishReason: finish } : {}),
            });
          } else if (reasoning) {
            // Reasoning model "thinking" tokens (Qwen-Thinking, R1, etc.)
            tokenIndex += 1;
            yield this.createChunk(modelId, reasoning, {
              metadata: {
                tokenIndex,
                estimatedTokens: this.getEstimatedTokenCount(reasoning),
                timestamp: Date.now(),
                isThinking: true,
              },
            });
          } else if (finish) {
            yield this.createChunk(modelId, "", {
              finishReason: finish,
              metadata: {
                tokenIndex,
                estimatedTokens: 0,
                timestamp: Date.now(),
                isThinking: false,
              },
            });
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* already released */
      }
    }
  }

  async parseError(response: Response): Promise<Error> {
    try {
      const data = await response.json();
      return new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`);
    } catch {
      return new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
}
