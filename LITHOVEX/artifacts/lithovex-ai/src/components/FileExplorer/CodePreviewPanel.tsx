import React, { useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import { downloadSingleFile } from '../../lib/fileDownload';
import type { ExplorerNode } from '../../lib/fileExplorerState';

export interface CodePreviewPanelProps {
  node: ExplorerNode | null;
  onClose?: () => void;
  onUpdateContent?: (nodeId: string, content: string) => void;
}

const SAVE_DEBOUNCE_MS = 350;

export function CodePreviewPanel({
  node,
  onClose,
  onUpdateContent,
}: CodePreviewPanelProps) {
  const [draft, setDraft] = useState<string>(node?.content ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const lastNodeIdRef = useRef<string | null>(node?.id ?? null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineGutterRef = useRef<HTMLDivElement | null>(null);

  // When the active file changes, drop pending saves and reload the draft
  // from the new node's stored content.
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    lastNodeIdRef.current = node?.id ?? null;
    setDraft(node?.content ?? '');
    setDirty(false);
    setSavedAt(null);
  }, [node?.id]);

  // If the node's content gets externally updated (e.g. AI added a new
  // version of the same file) and we have no unsaved edits, sync the draft.
  useEffect(() => {
    if (!node) return;
    if (dirty) return;
    setDraft(node.content ?? '');
  }, [node, node?.content, dirty]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const lineCount = useMemo(() => {
    const text = draft ?? '';
    const n = text.split('\n').length;
    return Math.max(1, n);
  }, [draft]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');
  }, [lineCount]);

  if (!node || node.type !== 'file') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background.secondary,
          color: theme.text.muted,
          fontSize: '12px',
        }}
      >
        Select a file to preview
      </div>
    );
  }

  const editable = typeof onUpdateContent === 'function';

  const scheduleSave = (next: string) => {
    if (!editable) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const targetNodeId = lastNodeIdRef.current;
    if (!targetNodeId) return;
    saveTimerRef.current = setTimeout(() => {
      onUpdateContent?.(targetNodeId, next);
      setSavedAt(Date.now());
      setDirty(false);
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDraft(next);
    setDirty(true);
    scheduleSave(next);
  };

  // Keep gutter scroll in sync with the textarea.
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineGutterRef.current) {
      lineGutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
    }
  };

  // Tab inserts two spaces instead of changing focus.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = draft.slice(0, start) + '  ' + draft.slice(end);
      setDraft(next);
      setDirty(true);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
      scheduleSave(next);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!editable) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      onUpdateContent?.(node.id, draft);
      setSavedAt(Date.now());
      setDirty(false);
    }
  };

  const statusLabel = !editable
    ? 'read-only'
    : dirty
      ? 'editing…'
      : savedAt
        ? 'saved'
        : 'no changes';

  const statusColor = !editable
    ? theme.text.muted
    : dirty
      ? '#fbbf24'
      : savedAt
        ? '#34d399'
        : theme.text.muted;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.background.secondary,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.surface.border}`,
          backgroundColor: theme.surface.elevated,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: theme.text.primary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={node.name}
          >
            {node.name}
            {dirty && (
              <span style={{ color: '#fbbf24', marginLeft: 6 }}>•</span>
            )}
          </span>
          {node.language && (
            <span
              style={{
                fontSize: '10px',
                color: theme.text.muted,
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: theme.surface.hover,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {node.language}
            </span>
          )}
          <span
            style={{
              fontSize: '10px',
              color: statusColor,
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: 'transparent',
              letterSpacing: '0.3px',
            }}
            title={editable ? 'Auto-saves while you type · Ctrl/⌘+S to save now' : 'Read-only file'}
          >
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => downloadSingleFile(draft || '', node.name)}
            title="Download File"
            style={iconBtn}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = theme.surface.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            ↓
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close Preview"
              style={iconBtn}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = theme.surface.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace",
          fontSize: '12px',
          lineHeight: '20px',
          minHeight: 0,
        }}
      >
        <div
          ref={lineGutterRef}
          aria-hidden
          style={{
            width: '48px',
            minWidth: '48px',
            textAlign: 'right',
            paddingTop: '8px',
            paddingBottom: '8px',
            paddingRight: '12px',
            paddingLeft: '8px',
            color: theme.text.muted,
            fontSize: '11px',
            lineHeight: '20px',
            userSelect: 'none',
            borderRight: `1px solid ${theme.surface.border}`,
            backgroundColor: theme.background.secondary,
            overflow: 'hidden',
            whiteSpace: 'pre',
            boxSizing: 'border-box',
          }}
        >
          {lineNumbers}
        </div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          readOnly={!editable}
          wrap="off"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            border: 'none',
            outline: 'none',
            resize: 'none',
            paddingTop: '8px',
            paddingBottom: '8px',
            paddingLeft: '12px',
            paddingRight: '12px',
            backgroundColor: theme.background.secondary,
            color: theme.text.primary,
            fontFamily: 'inherit',
            fontSize: '12px',
            lineHeight: '20px',
            tabSize: 2,
            whiteSpace: 'pre',
            overflow: 'auto',
            caretColor: '#a78bfa',
          }}
        />
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '4px',
  backgroundColor: 'transparent',
  color: '#a0a0a0',
  cursor: 'pointer',
  fontSize: '13px',
  transition: 'background-color 100ms',
  padding: 0,
};
