import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { theme } from '../../lib/theme';
import { TreeNode, FileNode, FolderNode } from '../../types/workspace';
import { CodeExtractor } from '../../lib/code-extractor';
import { downloadSingleFile, downloadFolderAsZip } from '../../lib/fileDownload';
import type { FileTreeNode } from '../../lib/fileExplorerState';
import { useIsMobile } from '../../hooks/use-mobile';

export interface FileExplorerTreeProps {
  tree: TreeNode[];
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeType: 'file' | 'folder';
}

function fileColorFor(node: FileNode): string {
  const lang = (node.language || CodeExtractor.detectLanguage(node.name)).toLowerCase();
  const map: Record<string, string> = {
    ts: theme.fileColors.typescript,
    tsx: theme.fileColors.typescript,
    typescript: theme.fileColors.typescript,
    js: theme.fileColors.javascript,
    jsx: theme.fileColors.javascript,
    javascript: theme.fileColors.javascript,
    py: theme.fileColors.python,
    python: theme.fileColors.python,
    html: theme.fileColors.html,
    css: theme.fileColors.css,
    json: theme.fileColors.json,
    md: theme.fileColors.markdown,
    markdown: theme.fileColors.markdown,
  };
  return map[lang] || theme.fileColors.text;
}

function TreeItem({
  node,
  depth,
  isSelected,
  isExpanded,
  selectedNodeId,
  expandedFolderIds,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onCreateFolder,
}: TreeItemProps) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const isFolder = node.type === 'folder';
  const indent = depth * 16;

  const handleRowClick = () => {
    if (isFolder) onToggleExpand(node.id);
    else onSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      nodeId: node.id,
      nodeType: node.type,
    });
  };

  const commitRename = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      onRename(node.id, renameValue.trim());
    } else {
      setRenameValue(node.name);
    }
    setRenaming(false);
  };

  const rowBg = isSelected
    ? theme.accent.primarySoft
    : hovered
    ? theme.surface.hover
    : 'transparent';
  const rowColor = isSelected ? theme.text.primary : theme.text.secondary;

  return (
    <>
      <div
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: `${8 + indent}px`,
          paddingRight: '8px',
          cursor: 'pointer',
          backgroundColor: rowBg,
          color: rowColor,
          fontSize: '13px',
          userSelect: 'none',
          borderLeft: isSelected
            ? `2px solid ${theme.accent.primary}`
            : '2px solid transparent',
          transition: 'background-color 80ms',
        }}
      >
        {isFolder ? (
          <span
            style={{
              width: '12px',
              fontSize: '9px',
              color: theme.text.tertiary,
              marginRight: '4px',
              transition: 'transform 120ms',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              display: 'inline-flex',
              justifyContent: 'center',
            }}
          >
            ▼
          </span>
        ) : (
          <span style={{ width: '12px', marginRight: '4px' }} />
        )}

        {isFolder ? (
          <span style={{ marginRight: '6px', fontSize: '12px' }}>
            {isExpanded ? '📂' : '📁'}
          </span>
        ) : (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: fileColorFor(node as FileNode),
              marginRight: '8px',
              opacity: 0.85,
              flexShrink: 0,
            }}
          />
        )}

        {renaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setRenameValue(node.name);
                setRenaming(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              backgroundColor: theme.surface.elevated,
              border: `1px solid ${theme.accent.primaryBorder}`,
              borderRadius: '3px',
              color: theme.text.primary,
              fontSize: '12px',
              padding: '2px 6px',
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.name}
          </span>
        )}
      </div>

      {isFolder && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              {(node as FolderNode).children.map((child) => (
                <TreeItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  isSelected={child.id === selectedNodeId}
                  isExpanded={
                    child.type === 'folder' ? expandedFolderIds.has(child.id) : false
                  }
                  selectedNodeId={selectedNodeId}
                  expandedFolderIds={expandedFolderIds}
                  onSelect={onSelect}
                  onToggleExpand={onToggleExpand}
                  onRename={onRename}
                  onDelete={onDelete}
                  onCreateFolder={onCreateFolder}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {menu && (
        <ContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onRename={() => {
            setRenameValue(node.name);
            setRenaming(true);
            setMenu(null);
          }}
          onDelete={() => {
            onDelete(node.id);
            setMenu(null);
          }}
          onCreateFolder={() => {
            onCreateFolder(isFolder ? node.id : node.parentId);
            setMenu(null);
          }}
          onDownload={() => {
            if (node.type === 'file') {
              downloadSingleFile((node as FileNode).content || '', node.name);
            } else {
              downloadFolderAsZip(node as unknown as FileTreeNode);
            }
            setMenu(null);
          }}
        />
      )}
    </>
  );
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCreateFolder: () => void;
  onDownload: () => void;
}

function ContextMenu({
  state,
  onClose,
  onRename,
  onDelete,
  onCreateFolder,
  onDownload,
}: ContextMenuProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  if (isMobile) {
    return (
      <>
        <div
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            zIndex: 999,
          }}
        />
        <div
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          role="menu"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxHeight: '85dvh',
            overflowY: 'auto',
            backgroundColor: theme.surface.elevated,
            borderTop: `1px solid ${theme.surface.border}`,
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
            paddingTop: '8px',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              paddingBottom: '8px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '9999px',
                backgroundColor: theme.surface.border,
              }}
            />
          </div>
          <MenuItem label="Rename" onClick={onRename} />
          <MenuItem label="New Folder" onClick={onCreateFolder} />
          <MenuItem
            label={state.nodeType === 'folder' ? 'Download as ZIP' : 'Download File'}
            onClick={onDownload}
          />
          <MenuItem label="Delete" onClick={onDelete} danger />
        </div>
      </>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: state.y,
        left: state.x,
        backgroundColor: theme.surface.elevated,
        border: `1px solid ${theme.surface.border}`,
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 1000,
      }}
    >
      <MenuItem label="Rename" onClick={onRename} />
      <MenuItem label="New Folder" onClick={onCreateFolder} />
      <MenuItem
        label={state.nodeType === 'folder' ? 'Download as ZIP' : 'Download File'}
        onClick={onDownload}
      />
      <MenuItem label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        color: danger ? theme.status.error : theme.text.secondary,
        backgroundColor: hovered ? theme.surface.hover : 'transparent',
        transition: 'background-color 80ms',
      }}
    >
      {label}
    </div>
  );
}

export function FileExplorerTree({
  tree,
  selectedNodeId,
  expandedFolderIds,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onCreateFolder,
}: FileExplorerTreeProps) {
  return (
    <div
      style={{
        backgroundColor: theme.surface.panel,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {tree.length === 0 ? (
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: theme.text.muted,
            fontSize: '12px',
          }}
        >
          No files in workspace
        </div>
      ) : (
        tree.map((node) => (
          <TreeItem
            key={node.id}
            node={node}
            depth={0}
            isSelected={node.id === selectedNodeId}
            isExpanded={
              node.type === 'folder' ? expandedFolderIds.has(node.id) : false
            }
            selectedNodeId={selectedNodeId}
            expandedFolderIds={expandedFolderIds}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onRename={onRename}
            onDelete={onDelete}
            onCreateFolder={onCreateFolder}
          />
        ))
      )}
    </div>
  );
}
