import React from 'react';
import { AddToFileExplorerButton, type AddToFileExplorerFile } from './AddToFileExplorerButton';

interface MessageWithFileAddProps {
  message: {
    role: string;
    content: string;
    id?: string;
  };
  children: React.ReactNode;
  onAddFiles: (files: AddToFileExplorerFile[]) => void;
  onOpenExplorer?: () => void;
}

export function MessageWithFileAdd({
  message,
  children,
  onAddFiles,
  onOpenExplorer,
}: MessageWithFileAddProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div style={{ position: 'relative' }}>
      {children}
      {isAssistant && (
        <AddToFileExplorerButton
          messageContent={message.content}
          onAddFiles={onAddFiles}
          onOpenExplorer={onOpenExplorer}
        />
      )}
    </div>
  );
}
