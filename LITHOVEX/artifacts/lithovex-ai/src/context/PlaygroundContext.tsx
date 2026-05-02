// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Playground Context
// Phase 1: N-Dimensional Multi-Model Concurrency State Manager
//
// NON-DESTRUCTIVE: This file is entirely additive. It does not touch or import
// any logic from the existing single-model chat flow in src/pages/Home.tsx.
// The legacy 1-to-1 conversation paradigm continues to operate independently.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type {
  AIResponseState,
  LayoutMode,
  MessageTurnNode,
  ModelConfig,
  ModelParameters,
  PlaygroundContextValue,
  PlaygroundConversation,
  PlaygroundEnvironment,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Default colour themes assigned round-robin when adding models
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLOUR_THEMES = [
  "#a78bfa", // purple-400
  "#34d399", // emerald-400
  "#60a5fa", // blue-400
  "#f87171", // red-400
  "#fbbf24", // amber-400
  "#38bdf8", // sky-400
  "#fb7185", // rose-400
  "#4ade80", // green-400
];

// ─────────────────────────────────────────────────────────────────────────────
// State shape managed by useReducer
// ─────────────────────────────────────────────────────────────────────────────

interface PlaygroundState {
  environment: PlaygroundEnvironment;
  conversations: PlaygroundConversation[];
  activeConversationId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action union type
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: "ADD_MODEL"; payload: ModelConfig }
  | { type: "REMOVE_MODEL"; payload: { modelId: string } }
  | { type: "UPDATE_MODEL_PARAMS"; payload: { modelId: string; params: Partial<ModelParameters> } }
  | { type: "SET_MODEL_PROVIDER"; payload: { modelId: string; provider: string } }
  | { type: "REORDER_MODELS"; payload: { from: number; to: number } }
  | { type: "SET_PERSONA_ENABLED"; payload: boolean }
  | { type: "SET_GLOBAL_SYSTEM_PROMPT"; payload: string }
  | { type: "SET_LAYOUT_MODE"; payload: LayoutMode }
  | { type: "SET_ACTIVE_CONVERSATION"; payload: { id: string | null } }
  | { type: "CREATE_CONVERSATION"; payload: PlaygroundConversation }
  | { type: "DELETE_CONVERSATION"; payload: { id: string } }
  | { type: "APPEND_TURN_NODE"; payload: { conversationId: string; node: MessageTurnNode } }
  | {
      type: "INIT_RESPONSE_SHELL";
      payload: { conversationId: string; turnId: string; modelId: string; provider: string };
    }
  | {
      type: "STREAM_CHUNK";
      payload: { conversationId: string; turnId: string; modelId: string; chunk: string };
    }
  | {
      type: "FINALIZE_RESPONSE";
      payload: {
        conversationId: string;
        turnId: string;
        modelId: string;
        outcome: Pick<AIResponseState, "status" | "latencyMs" | "tokensPerSecond" | "errorDetail">;
      };
    };

// ─────────────────────────────────────────────────────────────────────────────
// Pure reducer — all state mutations are immutable
// ─────────────────────────────────────────────────────────────────────────────

function updateConversationTurn(
  conversations: PlaygroundConversation[],
  conversationId: string,
  turnId: string,
  updateFn: (turn: MessageTurnNode) => MessageTurnNode
): PlaygroundConversation[] {
  return conversations.map((conv) => {
    if (conv.id !== conversationId) return conv;
    return {
      ...conv,
      messageTurnNodes: conv.messageTurnNodes.map((turn) =>
        turn.turnId === turnId ? updateFn(turn) : turn
      ),
    };
  });
}

function reducer(state: PlaygroundState, action: Action): PlaygroundState {
  switch (action.type) {
    // ── Model management ───────────────────────────────────────────────────
    case "ADD_MODEL": {
      const already = state.environment.activeModels.some(
        (m) => m.id === action.payload.id
      );
      if (already) return state;
      return {
        ...state,
        environment: {
          ...state.environment,
          activeModels: [...state.environment.activeModels, action.payload],
        },
      };
    }

    case "REMOVE_MODEL": {
      return {
        ...state,
        environment: {
          ...state.environment,
          activeModels: state.environment.activeModels.filter(
            (m) => m.id !== action.payload.modelId
          ),
        },
      };
    }

    case "UPDATE_MODEL_PARAMS": {
      return {
        ...state,
        environment: {
          ...state.environment,
          activeModels: state.environment.activeModels.map((m) =>
            m.id === action.payload.modelId
              ? { ...m, parameters: { ...m.parameters, ...action.payload.params } }
              : m
          ),
        },
      };
    }

    case "SET_MODEL_PROVIDER": {
      return {
        ...state,
        environment: {
          ...state.environment,
          activeModels: state.environment.activeModels.map((m) =>
            m.id === action.payload.modelId
              ? { ...m, inferenceProvider: action.payload.provider }
              : m
          ),
        },
      };
    }

    case "REORDER_MODELS": {
      const { from, to } = action.payload;
      const models = [...state.environment.activeModels];
      const [moved] = models.splice(from, 1);
      models.splice(to, 0, moved);
      return {
        ...state,
        environment: { ...state.environment, activeModels: models },
      };
    }

    // ── Environment ────────────────────────────────────────────────────────
    case "SET_PERSONA_ENABLED":
      return {
        ...state,
        environment: { ...state.environment, isPersonaEnabled: action.payload },
      };

    case "SET_GLOBAL_SYSTEM_PROMPT":
      return {
        ...state,
        environment: { ...state.environment, globalSystemPrompt: action.payload },
      };

    case "SET_LAYOUT_MODE":
      return {
        ...state,
        environment: { ...state.environment, layoutMode: action.payload },
      };

    // ── Conversation management ────────────────────────────────────────────
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversationId: action.payload.id };

    case "CREATE_CONVERSATION":
      return {
        ...state,
        conversations: [...state.conversations, action.payload],
        activeConversationId: action.payload.id,
      };

    case "DELETE_CONVERSATION": {
      const remaining = state.conversations.filter(
        (c) => c.id !== action.payload.id
      );
      const nextActive =
        state.activeConversationId === action.payload.id
          ? (remaining[remaining.length - 1]?.id ?? null)
          : state.activeConversationId;
      return { ...state, conversations: remaining, activeConversationId: nextActive };
    }

    // ── Turn node management ───────────────────────────────────────────────
    case "APPEND_TURN_NODE": {
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.payload.conversationId
            ? {
                ...conv,
                messageTurnNodes: [...conv.messageTurnNodes, action.payload.node],
              }
            : conv
        ),
      };
    }

    case "INIT_RESPONSE_SHELL": {
      const { conversationId, turnId, modelId, provider } = action.payload;
      const shell: AIResponseState = {
        modelId,
        provider,
        status: "idle",
        content: "",
      };
      return {
        ...state,
        conversations: updateConversationTurn(
          state.conversations,
          conversationId,
          turnId,
          (turn) => ({
            ...turn,
            aiResponses: { ...turn.aiResponses, [modelId]: shell },
          })
        ),
      };
    }

    case "STREAM_CHUNK": {
      const { conversationId, turnId, modelId, chunk } = action.payload;
      return {
        ...state,
        conversations: updateConversationTurn(
          state.conversations,
          conversationId,
          turnId,
          (turn) => {
            const prev = turn.aiResponses[modelId];
            if (!prev) return turn;
            return {
              ...turn,
              aiResponses: {
                ...turn.aiResponses,
                [modelId]: {
                  ...prev,
                  status: "streaming" as const,
                  content: prev.content + chunk,
                },
              },
            };
          }
        ),
      };
    }

    case "FINALIZE_RESPONSE": {
      const { conversationId, turnId, modelId, outcome } = action.payload;
      return {
        ...state,
        conversations: updateConversationTurn(
          state.conversations,
          conversationId,
          turnId,
          (turn) => {
            const prev = turn.aiResponses[modelId];
            if (!prev) return turn;
            return {
              ...turn,
              aiResponses: {
                ...turn.aiResponses,
                [modelId]: {
                  ...prev,
                  ...outcome,
                },
              },
            };
          }
        ),
      };
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────

const initialState: PlaygroundState = {
  environment: {
    activeModels: [],
    isPersonaEnabled: false,
    globalSystemPrompt: "",
    layoutMode: "columns",
  },
  conversations: [],
  activeConversationId: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Context + hook
// ─────────────────────────────────────────────────────────────────────────────

const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export function usePlaygroundState(): PlaygroundContextValue {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) {
    throw new Error(
      "usePlaygroundState must be used inside <PlaygroundProvider>. " +
        "Wrap your app (or the Playground page) with <PlaygroundProvider>."
    );
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: nanoid-lite (avoids adding a dep for simple IDs)
// ─────────────────────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Ref to track colour theme index without triggering re-renders
  const colourIndexRef = useRef(0);

  // ── Model management ──────────────────────────────────────────────────────

  const addModel = useCallback((config: ModelConfig) => {
    const colourTheme =
      config.colorTheme ||
      DEFAULT_COLOUR_THEMES[colourIndexRef.current % DEFAULT_COLOUR_THEMES.length];
    colourIndexRef.current += 1;
    dispatch({ type: "ADD_MODEL", payload: { ...config, colorTheme: colourTheme } });
  }, []);

  const removeModel = useCallback((modelId: string) => {
    dispatch({ type: "REMOVE_MODEL", payload: { modelId } });
  }, []);

  const updateModelParameters = useCallback(
    (modelId: string, params: Partial<ModelParameters>) => {
      dispatch({ type: "UPDATE_MODEL_PARAMS", payload: { modelId, params } });
    },
    []
  );

  const setModelProvider = useCallback(
    (modelId: string, provider: string) => {
      dispatch({ type: "SET_MODEL_PROVIDER", payload: { modelId, provider } });
    },
    []
  );

  const reorderModels = useCallback((from: number, to: number) => {
    dispatch({ type: "REORDER_MODELS", payload: { from, to } });
  }, []);

  // ── Environment controls ──────────────────────────────────────────────────

  const setPersonaEnabled = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_PERSONA_ENABLED", payload: enabled });
  }, []);

  const setGlobalSystemPrompt = useCallback((prompt: string) => {
    dispatch({ type: "SET_GLOBAL_SYSTEM_PROMPT", payload: prompt });
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    dispatch({ type: "SET_LAYOUT_MODE", payload: mode });
  }, []);

  // ── Conversation management ───────────────────────────────────────────────

  const setActiveConversationId = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE_CONVERSATION", payload: { id } });
  }, []);

  const createConversation = useCallback((title?: string): PlaygroundConversation => {
    const conv: PlaygroundConversation = {
      id: uid(),
      title: title ?? `Playground — ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      messageTurnNodes: [],
    };
    dispatch({ type: "CREATE_CONVERSATION", payload: conv });
    return conv;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: "DELETE_CONVERSATION", payload: { id } });
  }, []);

  // ── Turn node management ──────────────────────────────────────────────────

  const appendTurnNode = useCallback(
    (conversationId: string, node: MessageTurnNode) => {
      dispatch({ type: "APPEND_TURN_NODE", payload: { conversationId, node } });
    },
    []
  );

  const initResponseShell = useCallback(
    (conversationId: string, turnId: string, modelId: string, provider: string) => {
      dispatch({
        type: "INIT_RESPONSE_SHELL",
        payload: { conversationId, turnId, modelId, provider },
      });
    },
    []
  );

  /**
   * High-frequency streaming chunk appender.
   * Uses dispatch with a pure action so React batches the updates correctly.
   * Never reads stale state because the reducer receives the latest state snapshot.
   */
  const streamChunk = useCallback(
    (conversationId: string, turnId: string, modelId: string, chunk: string) => {
      dispatch({
        type: "STREAM_CHUNK",
        payload: { conversationId, turnId, modelId, chunk },
      });
    },
    []
  );

  const finalizeResponse = useCallback(
    (
      conversationId: string,
      turnId: string,
      modelId: string,
      outcome: Pick<
        AIResponseState,
        "status" | "latencyMs" | "tokensPerSecond" | "errorDetail"
      >
    ) => {
      dispatch({
        type: "FINALIZE_RESPONSE",
        payload: { conversationId, turnId, modelId, outcome },
      });
    },
    []
  );

  // ── Memoized context value ────────────────────────────────────────────────
  // Memoised on the full state object. Since the reducer always returns new
  // references on mutation, this will only re-compute when something actually
  // changed — preventing spurious context re-renders from parent components.

  const value = useMemo<PlaygroundContextValue>(
    () => ({
      environment: state.environment,
      addModel,
      removeModel,
      updateModelParameters,
      setModelProvider,
      reorderModels,
      setPersonaEnabled,
      setGlobalSystemPrompt,
      setLayoutMode,
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      setActiveConversationId,
      createConversation,
      deleteConversation,
      appendTurnNode,
      streamChunk,
      finalizeResponse,
      initResponseShell,
    }),
    [
      state,
      addModel,
      removeModel,
      updateModelParameters,
      setModelProvider,
      reorderModels,
      setPersonaEnabled,
      setGlobalSystemPrompt,
      setLayoutMode,
      setActiveConversationId,
      createConversation,
      deleteConversation,
      appendTurnNode,
      streamChunk,
      finalizeResponse,
      initResponseShell,
    ]
  );

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
}
