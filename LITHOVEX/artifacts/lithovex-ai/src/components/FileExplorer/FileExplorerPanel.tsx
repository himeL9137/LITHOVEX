import React from 'react';
import { theme } from '../../lib/theme';
import { TreeNode } from '../../types/workspace';
import { FileExplorerTree } from './FileExplorerTree';
import { FileUploadTrigger } from './FileUploadTrigger';
import { downloadAsZip } from '../../lib/fileDownload';
import type { FileTreeNode } from '../../lib/fileExplorerState';
import type { UploadedFile } from '../../lib/fileUpload';

export interface FileExplorerPanelProps {
  tree: TreeNode[];
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
  fileCount: number;
  folderCount: number;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onAddFiles?: () => void;
  onClearAll: () => void;
  onUploadedFiles?: (files: UploadedFile[]) => void;
  /** When true, renders larger touch targets and applies mobile-friendly tree styles. */
  mobile?: boolean;
}

export function FileExplorerPanel({
  tree,
  selectedNodeId,
  expandedFolderIds,
  fileCount,
  folderCount,
  onSelect,
  onToggleExpand,
  onRename,
  onDelete,
  onCreateFolder,
  onAddFiles,
  onClearAll,
  onUploadedFiles,
  mobile = false,
}: FileExplorerPanelProps) {
  return (
    <div
      data-mobile={mobile ? 'true' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.surface.panel,
        borderRight: mobile ? 'none' : `1px solid ${theme.surface.border}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: mobile ? '10px 12px' : '8px 10px',
          borderBottom: `1px solid ${theme.surface.border}`,
          backgroundColor: theme.surface.elevated,
          flexShrink: 0,
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: mobile ? '13px' : '11px',
              fontWeight: 600,
              color: theme.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Explorer
          </span>
          <span
            style={{
              fontSize: mobile ? '12px' : '10px',
              color: theme.text.muted,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {fileCount} file{fileCount !== 1 ? 's' : ''}
            {folderCount > 0
              ? ` · ${folderCount} folder${folderCount !== 1 ? 's' : ''}`
              : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: mobile ? '4px' : '2px', alignItems: 'center', flexShrink: 0 }}>
          {onAddFiles && (
            <ToolbarButton onClick={onAddFiles} title="Add Files" mobile={mobile}>
              +
            </ToolbarButton>
          )}
          <ToolbarButton onClick={() => onCreateFolder(null)} title="New Folder" mobile={mobile}>
            📁+
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              downloadAsZip(tree as unknown as FileTreeNode[], 'lithovex-project.zip')
            }
            title="Download All as ZIP"
            mobile={mobile}
          >
            📥
          </ToolbarButton>
          <ToolbarButton onClick={onClearAll} title="Clear All" danger mobile={mobile}>
            ✕
          </ToolbarButton>
        </div>
      </div>
      {onUploadedFiles && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: mobile ? '8px 12px' : '6px 10px',
            borderBottom: `1px solid ${theme.surface.border}`,
            backgroundColor: theme.surface.panel,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          <FileUploadTrigger onFilesUploaded={onUploadedFiles} />
        </div>
      )}
      <div
        style={{ flex: 1, overflow: 'hidden' }}
        className={mobile ? 'lvx-mobile-tree' : ''}
      >
        <FileExplorerTree
          tree={tree}
          selectedNodeId={selectedNodeId}
          expandedFolderIds={expandedFolderIds}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onRename={onRename}
          onDelete={onDelete}
          onCreateFolder={onCreateFolder}
        />
      </div>
      {mobile && (
        <style>{`
          /* Mobile: enlarge file/folder rows for thumb-friendly tapping. */
          .lvx-mobile-tree > div > div > div {
            min-height: 44px !important;
            height: auto !important;
            font-size: 14px !important;
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }
        `}</style>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  danger = false,
  mobile = false,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  mobile?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = React.useState(false);
  const size = mobile ? 44 : 26;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: mobile ? '8px' : '4px',
        cursor: 'pointer',
        fontSize: mobile ? '18px' : '13px',
        backgroundColor: hovered
          ? danger
            ? theme.status.error + '20'
            : theme.surface.hover
          : 'transparent',
        color: danger ? theme.status.error : theme.text.tertiary,
        transition: 'background-color 100ms, color 100ms',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
