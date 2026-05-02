// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — useMultiModelStream
// Prompt 3 / Layer 5 (React binding): Owns a StreamCoordinator instance for
// the component tree, subscribes to its events, and bridges them into the
// PlaygroundContext reducer (init/streamChunk/finalize). Exposes a clean
// run() / abortAll() API for the page.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef } from "react";
import { OpenAIStreamAdapter } from "@/adapters/openai-stream-adapter";
import { StreamCoordinator } from "@/lib/stream-coordinator";
import { usePlaygroundState } from "@/context/PlaygroundContext";
import {
  getSystemPromptForModel,
  getParameterOverridesForModel,
} from "@/lib/ai-models-config";
import type {
  ChatTurnRequest,
  StreamChunk,
  StreamState,
} from "@/types/streaming";
import type { MessageTurnNode, ModelConfig } from "@/lib/types";

interface RunOptions {
  conversationId: string;
  turnId: string;
  models: ModelConfig[];
  /** Conversation history *before* the current turn (for per-model context). */
  history: MessageTurnNode[];
  userText: string;
  systemPrompt?: string;
  hfKeyIndex?: number;
  useWebSearch?: boolean;
}

/** Build per-model history: shared user turns + this model's own assistant replies. */
function buildHistoryForModel(
  history: MessageTurnNode[],
  modelId: string,
  upcomingUserText: string,
  systemPrompt?: string
): ChatTurnRequest["messages"] {
  const msgs: ChatTurnRequest["messages"] = [];

  // Use provided systemPrompt, or auto-fetch from Premium 9 model config
  const finalSystemPrompt = systemPrompt || getSystemPromptForModel(modelId);

  if (finalSystemPrompt && finalSystemPrompt.trim().length > 0) {
    msgs.push({ role: "system", content: finalSystemPrompt });
  }
  for (const turn of history) {
    if (turn.userMessage.content) {
      msgs.push({ role: "user", content: turn.userMessage.content });
    }
    const resp = turn.aiResponses[modelId];
    if (resp && resp.content && resp.status === "complete") {
      msgs.push({ role: "assistant", content: resp.content });
    }
  }
  msgs.push({ role: "user", content: upcomingUserText });
  return msgs;
}

export function useMultiModelStream() {
  const { initResponseShell, streamChunk, finalizeResponse } = usePlaygroundState();

  // Single coordinator + adapter instance for the lifetime of the component.
  const coordinator = useMemo(() => new StreamCoordinator(), []);
  const adapter = useMemo(() => new OpenAIStreamAdapter(), []);

  // Mapping from coordinator's modelId → (conversationId, turnId) so chunk
  // events can dispatch into the correct response shell. Keys are
  // `${conversationId}::${turnId}::${modelId}` to avoid collisions across turns.
  const routeRef = useRef(
    new Map<string, { conversationId: string; turnId: string; modelId: string }>()
  );

  // ── Subscribe to coordinator events once ────────────────────────────────
  useEffect(() => {
    const onBatch = ({
      modelId,
      chunks,
    }: {
      modelId: string;
      chunks: StreamChunk[];
    }) => {
      const route = routeRef.current.get(modelId);
      if (!route) return;
      // Concatenate displayable (non-thinking) content from the batch.
      const text = chunks
        .filter((c) => !c.metadata.isThinking && c.content)
        .map((c) => c.content)
        .join("");
      if (text) {
        streamChunk(route.conversationId, route.turnId, route.modelId, text);
      }
    };

    const onChunk = ({ modelId, chunk }: { modelId: string; chunk: StreamChunk }) => {
      // Fallback path when backpressure is disabled.
      if (chunk.metadata.isThinking || !chunk.content) return;
      const route = routeRef.current.get(modelId);
      if (!route) return;
      streamChunk(route.conversationId, route.turnId, route.modelId, chunk.content);
    };

    const onComplete = ({ state }: { modelId: string; state: StreamState }) => {
      const route = routeRef.current.get(state.modelId);
      if (!route) return;
      const tps =
        state.metadata.totalDuration && state.metadata.tokenCount
          ? Math.round(state.metadata.tokenCount / (state.metadata.totalDuration / 1000))
          : 0;
      finalizeResponse(route.conversationId, route.turnId, route.modelId, {
        status: "complete",
        latencyMs: state.metadata.ttft ?? state.metadata.totalDuration ?? 0,
        tokensPerSecond: tps,
      });
      routeRef.current.delete(state.modelId);
    };

    const onError = ({ modelId, error }: { modelId: string; error: Error }) => {
      const route = routeRef.current.get(modelId);
      if (!route) return;
      finalizeResponse(route.conversationId, route.turnId, route.modelId, {
        status: "error",
        errorDetail: error.message,
      });
      routeRef.current.delete(modelId);
    };

    const onStatus = ({
      modelId,
      status,
    }: {
      modelId: string;
      status: StreamState["status"];
    }) => {
      // Map cancelled to a finalized state too.
      if (status === "cancelled") {
        const route = routeRef.current.get(modelId);
        if (route) {
          finalizeResponse(route.conversationId, route.turnId, route.modelId, {
            status: "error",
            errorDetail: "Stopped by user",
          });
          routeRef.current.delete(modelId);
        }
      }
    };

    const offBatch = coordinator.on("stream:batch", onBatch);
    const offChunk = coordinator.on("stream:chunk", onChunk);
    const offComplete = coordinator.on("stream:complete", onComplete);
    const offError = coordinator.on("stream:error", onError);
    const offStatus = coordinator.on("stream:status", onStatus);

    return () => {
      offBatch();
      offChunk();
      offComplete();
      offError();
      offStatus();
      coordinator.cleanup();
    };
  }, [coordinator, streamChunk, finalizeResponse]);

  // ── Public run() — fan out N parallel streams ───────────────────────────
  const run = useCallback(
    (opts: RunOptions) => {
      const { conversationId, turnId, models, history, userText, systemPrompt, hfKeyIndex, useWebSearch } =
        opts;

      // Initialise idle shells so cards render immediately.
      models.forEach((m) => {
        const provider = m.name.split("/")[0] ?? m.name;
        initResponseShell(conversationId, turnId, m.id, provider);
      });

      models.forEach((m) => {
        // Coordinator key = our model.id (HF model path) — unique per turn ok
        // because we register the route before starting and cleanup after end.
        routeRef.current.set(m.id, { conversationId, turnId, modelId: m.id });

        const messages = buildHistoryForModel(history, m.id, userText, systemPrompt);

        // Apply parameter overrides if model is one of the Premium 9
        const paramOverrides = getParameterOverridesForModel(m.id);
        const finalTemp = paramOverrides?.temperature ?? m.parameters.temperature;
        const finalTopP = paramOverrides?.topP ?? m.parameters.topP;
        const finalMaxTokens = paramOverrides?.maxTokens ?? m.parameters.maxTokens;

        coordinator.startStream({
          modelId: m.id,
          providerId: adapter.providerId,
          backendModel: m.id,
          adapter,
          request: {
            messages,
            temperature: finalTemp,
            topP: finalTopP,
            maxTokens: finalMaxTokens,
            hfKeyIndex,
            useWebSearch,
          },
        }).catch(() => {
          // Errors are surfaced via the stream:error event listener — swallow
          // here so unhandled rejections never bubble.
        });
      });
    },
    [coordinator, adapter, initResponseShell]
  );

  const abortAll = useCallback(() => coordinator.cancelAllStreams(), [coordinator]);
  const abort = useCallback(
    (modelId: string) => coordinator.cancelStream(modelId),
    [coordinator]
  );

  return { run, abort, abortAll, coordinator };
}
