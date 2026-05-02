/**
 * Agent Core Implementation
 * Individual agent with memory, context management, and multi-provider support
 */

import { AgentConfig, AgentMessage, AgentResponse, AgentMemory, AgentRole } from './types';
import { AGENT_CONFIGS, MODEL_REGISTRY } from './config';

export class Agent {
  private role: AgentRole;
  private config: AgentConfig;
  private memory: AgentMemory;
  private contextWindow: AgentMessage[] = [];
  private readonly MAX_CONTEXT_MESSAGES = 10;

  constructor(role: AgentRole) {
    this.role = role;
    this.config = AGENT_CONFIGS[role];
    this.memory = {
      contextWindow: [],
      shortTermMemory: new Map(),
      longTermMemory: [],
    };
  }

  /**
   * Get agent role
   */
  getRole(): AgentRole {
    return this.role;
  }

  /**
   * Process a task through this agent
   */
  async process(
    userMessage: string,
    previousResponses?: AgentResponse[]
  ): Promise<AgentResponse> {
    const startTime = performance.now();

    try {
      // Build context from previous agent responses
      let contextContent = '';
      if (previousResponses && previousResponses.length > 0) {
        contextContent = this.buildContext(previousResponses);
      }

      // Add to context window
      const fullPrompt = contextContent 
        ? `${contextContent}\n\n[NEW TASK]\n${userMessage}`
        : userMessage;

      this.contextWindow.push({
        role: 'user',
        content: fullPrompt,
        timestamp: Date.now(),
      });

      // Call appropriate provider
      const content = await this.invokeModel(fullPrompt);

      // Store in memory
      this.updateMemory(userMessage, content);

      // Add response to context window
      this.contextWindow.push({
        role: 'assistant',
        content: content.substring(0, 500), // Store summary
        timestamp: Date.now(),
      });

      const processingTime = performance.now() - startTime;
      const tokensUsed = Math.ceil((fullPrompt.length + content.length) / 4);

      return {
        agentRole: this.role,
        model: this.config.model,
        content,
        confidence: this.calculateConfidence(content),
        metadata: {
          processingTime,
          tokensUsed,
          executedAt: Date.now(),
        },
      };
    } catch (error) {
      console.error(`[${this.role.toUpperCase()}] Error:`, error);
      const processingTime = performance.now() - startTime;

      return {
        agentRole: this.role,
        model: this.config.model,
        content: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        metadata: {
          processingTime,
          tokensUsed: 0,
          executedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Build context from previous agent responses
   */
  private buildContext(previousResponses: AgentResponse[]): string {
    const contextLines = previousResponses
      .slice(-3) // Only last 3 responses for context window
      .map((resp) => {
        const summary = resp.content.substring(0, 300);
        return `[${resp.agentRole.toUpperCase()} - Confidence: ${(resp.metadata.confidence * 100).toFixed(0)}%]\n${summary}...`;
      });

    return `## Previous Analysis:\n${contextLines.join('\n\n')}`;
  }

  /**
   * Invoke the configured model
   */
  private async invokeModel(prompt: string): Promise<string> {
    // Build messages with system prompt
    const messages: AgentMessage[] = [
      {
        role: 'system',
        content: this.config.systemPrompt,
      },
      ...this.contextWindow.filter((m) => m.role !== 'system'),
    ];

    const provider = this.getProvider();

    switch (provider) {
      case 'huggingface':
        return this.invokeHuggingFace(prompt, messages);
      case 'openrouter':
        return this.invokeOpenRouter(prompt, messages);
      case 'gemini':
        return this.invokeGemini(prompt, messages);
      case 'blackbox':
        return this.invokeBlackbox(prompt, messages);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * HuggingFace Inference API
   */
  private async invokeHuggingFace(prompt: string, messages: AgentMessage[]): Promise<string> {
    try {
      const { getNextHuggingFaceKey } = await import('../config');
      const apiKey = getNextHuggingFaceKey();

      if (!apiKey) {
        throw new Error('No HuggingFace API key available');
      }

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${this.config.model}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          method: 'POST',
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: this.config.maxTokens,
              temperature: this.config.temperature,
              top_p: 0.9,
            },
            options: {
              wait_for_model: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as Array<{ generated_text: string } | { error: string }>;
      
      if ('error' in result[0]) {
        throw new Error(`HuggingFace error: ${(result[0] as { error: string }).error}`);
      }

      const generated = (result[0] as { generated_text: string }).generated_text;
      return generated.substring(prompt.length).trim();
    } catch (error) {
      throw new Error(`HuggingFace invoke error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * OpenRouter API with fallback support
   */
  private async invokeOpenRouter(prompt: string, messages: AgentMessage[]): Promise<string> {
    try {
      const { getNextOpenRouterKey } = await import('../config');
      const apiKey = getNextOpenRouterKey();

      if (!apiKey) {
        throw new Error('No OpenRouter API key available');
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://lithovex.ai',
          'X-Title': 'LITHOVEX Agent Swarm',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        error?: { message: string };
      };

      if (result.error) {
        throw new Error(`OpenRouter error: ${result.error.message}`);
      }

      return result.choices[0]?.message.content || '';
    } catch (error) {
      throw new Error(`OpenRouter invoke error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Google Gemini API
   */
  private async invokeGemini(prompt: string, _messages: AgentMessage[]): Promise<string> {
    try {
      const { getNextGeminiKey } = await import('../config');
      const apiKey = getNextGeminiKey();

      if (!apiKey) {
        throw new Error('No Gemini API key available');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: this.config.temperature,
              maxOutputTokens: this.config.maxTokens,
              topP: 0.9,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as {
        candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
        error?: { message: string };
      };

      if (result.error) {
        throw new Error(`Gemini error: ${result.error.message}`);
      }

      return result.candidates?.[0]?.content.parts[0]?.text || '';
    } catch (error) {
      throw new Error(`Gemini invoke error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Blackbox API fallback
   */
  private async invokeBlackbox(prompt: string, messages: AgentMessage[]): Promise<string> {
    try {
      const { BLACKBOX_API_KEYS } = await import('../config');
      const apiKey = BLACKBOX_API_KEYS.lithovex || BLACKBOX_API_KEYS.default;

      if (!apiKey) {
        throw new Error('No Blackbox API key available');
      }

      const response = await fetch('https://api.blackbox.ai/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`Blackbox API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as { content: string; error?: string };

      if (result.error) {
        throw new Error(`Blackbox error: ${result.error}`);
      }

      return result.content;
    } catch (error) {
      throw new Error(`Blackbox invoke error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get provider for this agent's model
   */
  private getProvider(): string {
    for (const [, model] of Object.entries(MODEL_REGISTRY)) {
      if (model.name === this.config.model) {
        return model.provider;
      }
    }
    return 'openrouter'; // Default fallback
  }

  /**
   * Calculate confidence score based on response quality
   */
  private calculateConfidence(content: string): number {
    if (!content || content.length === 0) return 0;

    let confidence = 0.5;

    // More detailed responses = higher confidence
    if (content.length > 500) confidence += 0.15;
    if (content.length > 1500) confidence += 0.15;

    // Code blocks indicate concrete output
    if (content.includes('```')) confidence += 0.1;

    // Structured responses with line breaks
    if (content.split('\n').length > 5) confidence += 0.08;

    // Lists and structured data
    if ((content.match(/[-•*]/g) || []).length > 3) confidence += 0.05;

    return Math.min(confidence, 0.99);
  }

  /**
   * Update agent memory
   */
  private updateMemory(userMessage: string, response: string): void {
    // Add to short-term memory
    const memoryKey = `task-${Date.now()}`;
    this.memory.shortTermMemory.set(memoryKey, {
      userMessage,
      response: response.substring(0, 500),
      timestamp: Date.now(),
    });

    // Promote important items to long-term
    if (response.length > 1000 || response.includes('```')) {
      this.memory.longTermMemory.push({
        key: `important-${Date.now()}`,
        value: { userMessage, response: response.substring(0, 1000) },
        importance: Math.min(response.length / 5000, 1),
        timestamp: Date.now(),
      });
    }

    // Keep long-term memory limited (max 50 entries)
    if (this.memory.longTermMemory.length > 50) {
      this.memory.longTermMemory = this.memory.longTermMemory.slice(-50);
    }

    // Keep context window limited
    if (this.contextWindow.length > this.MAX_CONTEXT_MESSAGES) {
      this.contextWindow = this.contextWindow.slice(-this.MAX_CONTEXT_MESSAGES);
    }
  }

  /**
   * Get memory stats
   */
  getMemoryStats() {
    return {
      contextWindowSize: this.contextWindow.length,
      shortTermSize: this.memory.shortTermMemory.size,
      longTermSize: this.memory.longTermMemory.length,
    };
  }

  /**
   * Clear memory and context
   */
  reset(): void {
    this.contextWindow = [];
    this.memory.shortTermMemory.clear();
    this.memory.longTermMemory = [];
    console.log(`[${this.role.toUpperCase()}] Memory cleared`);
  }
}
