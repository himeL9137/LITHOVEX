/**
 * LITHOVEX Agent Swarm System - Type Definitions
 * Inspired by Kimi 2.6 multi-agent architecture
 * Supports 6 specialized AI models working in concert
 */

export type AgentRole = 
  | 'architect'      // System design & planning
  | 'engineer'       // Implementation & code generation
  | 'reviewer'       // Quality & security checks
  | 'optimizer'      // Performance & efficiency
  | 'translator'     // Multi-language & format conversion
  | 'debugger';      // Troubleshooting & problem-solving

export interface AgentConfig {
  role: AgentRole;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  capabilities: string[];
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface AgentTask {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  context: Record<string, unknown>;
  assignedAgent?: AgentRole;
  dependencies?: string[];
  deadline?: number;
}

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

export interface SwarmOrchestration {
  taskId: string;
  initialRequest: string;
  agents: AgentResponse[];
  synthesis: string;
  finalOutput: string;
  totalProcessingTime: number;
  qualityScore: number;
}

export interface AgentMemory {
  contextWindow: AgentMessage[];
  shortTermMemory: Map<string, unknown>;
  longTermMemory: Array<{
    key: string;
    value: unknown;
    importance: number;
    timestamp: number;
  }>;
}

export type AgentModelProvider = 'huggingface' | 'openrouter' | 'gemini' | 'blackbox';

export interface ModelRegistry {
  [key: string]: {
    provider: AgentModelProvider;
    name: string;
    contextLimit: number;
    costPer1kTokens: number;
    strengths: string[];
  };
}
