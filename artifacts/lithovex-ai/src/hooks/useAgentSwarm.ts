/**
 * LITHOVEX Agent Swarm React Hook
 * Frontend integration for multi-agent task execution
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AgentRole } from '@workspace/api-types';

export interface AgentResponse {
  agentRole: AgentRole;
  model: string;
  content: string;
  confidence: number;
  metadata: {
    processingTime: number;
    tokensUsed: number;
    executedAt: number;
  };
}

export interface SwarmResult {
  taskId: string;
  initialRequest: string;
  agents: AgentResponse[];
  synthesis: string;
  finalOutput: string;
  totalProcessingTime: number;
  qualityScore: number;
}

export interface SwarmExecutionOptions {
  agents?: AgentRole[];
  sequential?: boolean;
  maxRounds?: number;
}

/**
 * Hook for executing tasks through the Agent Swarm
 */
export function useAgentSwarm() {
  const [result, setResult] = useState<SwarmResult | null>(null);
  const [taskHistory, setTaskHistory] = useState<SwarmResult[]>([]);

  // Execute task mutation
  const executeMutation = useMutation({
    mutationFn: async (
      request: string,
      options?: SwarmExecutionOptions
    ) => {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request,
          agents: options?.agents || ['architect', 'engineer', 'reviewer', 'optimizer'],
          sequential: options?.sequential ?? true,
          maxRounds: options?.maxRounds ?? 2,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to execute swarm task');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      setTaskHistory((prev) => [data, ...prev].slice(0, 10)); // Keep last 10
    },
  });

  // Get task status query
  const getTaskQuery = useCallback(
    (taskId: string) => {
      return useQuery({
        queryKey: ['agentTask', taskId],
        queryFn: async () => {
          const response = await fetch(`/api/agents/task/${taskId}`);

          if (!response.ok) {
            throw new Error('Failed to fetch task');
          }

          const data = await response.json();
          return data.data;
        },
      });
    },
    []
  );

  // Get swarm status query
  const statusQuery = useQuery({
    queryKey: ['swarmStatus'],
    queryFn: async () => {
      const response = await fetch('/api/agents/status');

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      return data.data;
    },
    refetchInterval: 30000, // Refetch every 30s
  });

  // Get available agents query
  const availableAgentsQuery = useQuery({
    queryKey: ['availableAgents'],
    queryFn: async () => {
      const response = await fetch('/api/agents/available');

      if (!response.ok) {
        throw new Error('Failed to fetch available agents');
      }

      const data = await response.json();
      return data.data;
    },
  });

  // Execute batch tasks
  const executeBatchMutation = useMutation({
    mutationFn: async (
      tasks: Array<{ request: string; options?: SwarmExecutionOptions }>
    ) => {
      const response = await fetch('/api/agents/execute-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: tasks.map((t) => ({
            request: t.request,
            agents: t.options?.agents,
            sequential: t.options?.sequential ?? true,
            maxRounds: t.options?.maxRounds ?? 2,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to execute batch');
      }

      return response.json();
    },
  });

  // Reset agents
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/agents/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset agents');
      }

      return response.json();
    },
  });

  return {
    // Results
    result,
    taskHistory,

    // Execution
    execute: (request: string, options?: SwarmExecutionOptions) =>
      executeMutation.mutate([request, options]),
    executeBatch: (tasks: Array<{ request: string; options?: SwarmExecutionOptions }>) =>
      executeBatchMutation.mutate(tasks),
    getTask: getTaskQuery,

    // Status & Info
    status: statusQuery.data,
    availableAgents: availableAgentsQuery.data,

    // Control
    reset: () => resetMutation.mutate(),

    // Loading & Error states
    isLoading: executeMutation.isPending,
    isExecutingBatch: executeBatchMutation.isPending,
    isResetting: resetMutation.isPending,
    error: executeMutation.error,
    batchError: executeBatchMutation.error,
    resetError: resetMutation.error,
  };
}

/**
 * Hook for displaying and formatting swarm results
 */
export function useSwarmResultsDisplay(result: SwarmResult | null) {
  const getAgentResponse = useCallback(
    (role: AgentRole) => {
      return result?.agents.find((a) => a.agentRole === role);
    },
    [result]
  );

  const getAgentConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  }, []);

  const formatProcessingTime = useCallback((ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }, []);

  return {
    getAgentResponse,
    getAgentConfidenceColor,
    formatProcessingTime,
  };
}
