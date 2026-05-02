import { useMemo } from 'react';
import {
  extractCodeBlocks,
  extractAllCodeFromChat,
  type CodeBlock,
  type ChatCodeBlock,
} from '../lib/codeExtractor';

interface Message {
  role: string;
  content: string;
}

export function useCodeBlocksFromMessage(
  messageContent: string | undefined | null
): CodeBlock[] {
  return useMemo(() => {
    if (!messageContent) return [];
    return extractCodeBlocks(messageContent);
  }, [messageContent]);
}

export function useCodeBlocksFromChat(
  messages: Message[] | undefined | null
): ChatCodeBlock[] {
  return useMemo(() => {
    if (!messages || !Array.isArray(messages)) return [];
    return extractAllCodeFromChat(messages);
  }, [messages]);
}

export function useHasCodeInChat(messages: Message[] | undefined | null): boolean {
  const blocks = useCodeBlocksFromChat(messages);
  return blocks.length > 0;
}
