import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme } from '../../lib/theme';
import { useCodeBlocksFromMessage } from '../../hooks/useCodeBlocks';
import { generateSuggestedFilePath } from '../../lib/codeExtractor';

export interface AddToFileExplorerFile {
  path: string;
  code: string;
  language: string;
}

interface AddToFileExplorerButtonProps {
  messageContent: string;
  onAddFiles: (files: AddToFileExplorerFile[]) => void;
  onOpenExplorer?: () => void;
}

type Status = 'idle' | 'adding' | 'added' | 'error';

export function AddToFileExplorerButton({
  messageContent,
  onAddFiles,
  onOpenExplorer,
}: AddToFileExplorerButtonProps) {
  const codeBlocks = useCodeBlocksFromMessage(messageContent);
  const [status, setStatus] = useState<Status>('idle');

  if (codeBlocks.length === 0) return null;

  const handleAdd = async () => {
    if (status === 'adding') return;
    setStatus('adding');
    try {
      const files: AddToFileExplorerFile[] = codeBlocks.map((block) => ({
        path: generateSuggestedFilePath(block),
        code: block.code,
        language: block.language,
      }));
      onAddFiles(files);
      onOpenExplorer?.();
      setStatus('added');
      setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const buttonLabel = (() => {
    switch (status) {
      case 'adding':
        return 'Adding...';
      case 'added':
        return `Added ${codeBlocks.length} file${codeBlocks.length !== 1 ? 's' : ''} ✓`;
      case 'error':
        return 'Failed ✕';
      default:
        return `Add to File Explorer (${codeBlocks.length} file${codeBlocks.length !== 1 ? 's' : ''})`;
    }
  })();

  const buttonColor = (() => {
    switch (status) {
      case 'adding':
        return theme.accent.muted;
      case 'added':
        return theme.status.success;
      case 'error':
        return theme.status.error;
      default:
        return theme.accent.primary;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      style={{
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: `1px solid ${theme.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={handleAdd}
        disabled={status === 'adding'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          borderRadius: '6px',
          border: `1px solid ${buttonColor}40`,
          backgroundColor: `${buttonColor}15`,
          color: buttonColor,
          fontSize: '12px',
          fontWeight: 500,
          cursor: status === 'adding' ? 'wait' : 'pointer',
          transition: 'all 150ms ease',
          fontFamily: 'inherit',
          lineHeight: '1',
        }}
        onMouseEnter={(e) => {
          if (status === 'idle') {
            e.currentTarget.style.backgroundColor = `${buttonColor}25`;
            e.currentTarget.style.borderColor = `${buttonColor}60`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `${buttonColor}15`;
          e.currentTarget.style.borderColor = `${buttonColor}40`;
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: '1' }}>
          {status === 'added' ? '✓' : status === 'error' ? '✕' : '↓'}
        </span>
        {buttonLabel}
      </button>
      <span
        style={{
          fontSize: '11px',
          color: theme.text.muted,
        }}
      >
        {codeBlocks.length} code block{codeBlocks.length !== 1 ? 's' : ''} detected
      </span>
    </motion.div>
  );
}
