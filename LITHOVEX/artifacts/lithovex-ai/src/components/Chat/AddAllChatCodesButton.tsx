import React, { useState } from 'react';
import { theme } from '../../lib/theme';
import { useCodeBlocksFromChat } from '../../hooks/useCodeBlocks';
import { generateSuggestedFilePath } from '../../lib/codeExtractor';
import type { AddToFileExplorerFile } from './AddToFileExplorerButton';

interface AddAllChatCodesButtonProps {
  messages: Array<{ role: string; content: string }>;
  onAddFiles: (files: AddToFileExplorerFile[]) => void;
  onOpenExplorer?: () => void;
}

export function AddAllChatCodesButton({
  messages,
  onAddFiles,
  onOpenExplorer,
}: AddAllChatCodesButtonProps) {
  const [status, setStatus] = useState<'idle' | 'added'>('idle');
  const allBlocks = useCodeBlocksFromChat(messages);

  if (allBlocks.length === 0) return null;

  const handleAddAll = () => {
    const files: AddToFileExplorerFile[] = allBlocks.map((block) => ({
      path: generateSuggestedFilePath(block),
      code: block.code,
      language: block.language,
    }));
    onAddFiles(files);
    onOpenExplorer?.();
    setStatus('added');
    setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <button
      onClick={handleAddAll}
      style={{
        padding: '4px 10px',
        borderRadius: '6px',
        border: `1px solid ${
          status === 'added' ? theme.status.success + '40' : theme.border.default
        }`,
        backgroundColor:
          status === 'added' ? theme.status.success + '15' : theme.surface.elevated,
        color: status === 'added' ? theme.status.success : theme.text.secondary,
        fontSize: '11px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 150ms',
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'added'
        ? `Added ${allBlocks.length} files ✓`
        : `Add All Codes (${allBlocks.length})`}
    </button>
  );
}
