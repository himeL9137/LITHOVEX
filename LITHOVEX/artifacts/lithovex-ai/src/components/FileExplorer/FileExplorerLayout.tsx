import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { theme } from '../../lib/theme';
import { FileExplorerPanel } from './FileExplorerPanel';
import { CodePreviewPanel } from './CodePreviewPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type {
  FileExplorerState,
  FileTreeNode,
  ExplorerNode,
} from '../../lib/fileExplorerState';
import type { CodeBlock } from '../../lib/codeExtractor';
import type { UploadedFile } from '../../lib/fileUpload';
import type { TreeNode } from '../../types/workspace';

export interface FileExplorerLayoutProps {
  isOpen: boolean;
  onClose?: () => void;
  state: FileExplorerState;
  tree: FileTreeNode[];
  selectedNode: ExplorerNode | null;
  fileCount: number;
  folderCount: number;
  addCodeBlocks: (blocks: CodeBlock[]) => void;
  addSingleFile: (filePath: string, content: string) => void;
  addMultipleFiles: (files: Array<{ path: string; content: string }>) => void;
  remove: (nodeId: string) => void;
  updateContent: (nodeId: string, content: string) => void;
  rename: (nodeId: string, newName: string) => void;
  move: (nodeId: string, newParentId: string | null) => void;
  toggleExpand: (folderId: string) => void;
  select: (nodeId: string | null) => void;
  createFolder: (name: string, parentId?: string | null) => void;
  clearAll: () => void;
}

export function FileExplorerLayout({
  isOpen,
  onClose,
  state,
  tree,
  selectedNode,
  fileCount,
  folderCount,
  addMultipleFiles,
  remove,
  updateContent,
  rename,
  toggleExpand,
  select,
  createFolder,
  clearAll,
}: FileExplorerLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'files' | 'preview'>('files');

  const handleUploaded = useCallback(
    (files: UploadedFile[]) => {
      const items = files
        .filter((f) => !f.isBinary)
        .map((f) => ({ path: f.path, content: f.content }));
      if (items.length > 0) addMultipleFiles(items);
    },
    [addMultipleFiles]
  );

  const handleCreateFolder = useCallback(
    (parentId: string | null) => {
      const name = window.prompt('Folder name:', 'New Folder');
      if (!name) return;
      createFolder(name, parentId);
    },
    [createFolder]
  );

  // On mobile, jump to the Preview tab whenever the user picks a new file.
  useEffect(() => {
    if (!isMobile) return;
    if (selectedNode?.type === 'file') {
      setMobileTab('preview');
    }
  }, [isMobile, selectedNode?.id, selectedNode?.type]);

  // Reset to Files tab when the drawer closes so it reopens at the tree.
  useEffect(() => {
    if (!isOpen) setMobileTab('files');
  }, [isOpen]);

  /* ─────────────────── Mobile: bottom Drawer with Tabs ─────────────────── */
  if (isMobile) {
    const previewDisabled = !selectedNode || selectedNode.type !== 'file';
    return (
      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && onClose) onClose();
        }}
      >
        <DrawerContent
          className="h-[90dvh] max-h-[90dvh] p-0 bg-[#0e0e10] border-zinc-800 flex flex-col"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header */}
          <DrawerHeader className="px-4 pt-2 pb-3 border-b border-zinc-800 flex-shrink-0 flex flex-row items-center justify-between gap-3 text-left">
            <div className="flex flex-col min-w-0">
              <DrawerTitle className="text-base font-semibold text-white">
                Project Explorer
              </DrawerTitle>
              <DrawerDescription className="text-[12px] text-zinc-500 truncate">
                {fileCount} file{fileCount !== 1 ? 's' : ''}
                {folderCount > 0
                  ? ` · ${folderCount} folder${folderCount !== 1 ? 's' : ''}`
                  : ''}
              </DrawerDescription>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close Explorer"
                className="inline-flex items-center justify-center h-11 w-11 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </DrawerHeader>

          {/* Tabs */}
          <Tabs
            value={mobileTab}
            onValueChange={(v) => setMobileTab(v as 'files' | 'preview')}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="mx-3 mt-2 grid grid-cols-2 bg-white/5 h-11 shrink-0 rounded-lg p-1">
              <TabsTrigger
                value="files"
                className="h-9 text-sm rounded-md data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400"
              >
                Files
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                disabled={previewDisabled}
                className="h-9 text-sm rounded-md data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 disabled:opacity-40"
              >
                Preview
                {selectedNode?.type === 'file' && (
                  <span className="ml-1 max-w-[120px] truncate">· {selectedNode.name}</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="files"
              forceMount
              className="flex-1 min-h-0 m-0 mt-2 p-0 data-[state=inactive]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              <FileExplorerPanel
                mobile
                tree={tree as unknown as TreeNode[]}
                selectedNodeId={selectedNode?.id ?? null}
                expandedFolderIds={state.expandedFolderIds}
                fileCount={fileCount}
                folderCount={folderCount}
                onSelect={select}
                onToggleExpand={toggleExpand}
                onRename={rename}
                onDelete={remove}
                onCreateFolder={handleCreateFolder}
                onClearAll={clearAll}
                onUploadedFiles={handleUploaded}
              />
            </TabsContent>

            <TabsContent
              value="preview"
              forceMount
              className="flex-1 min-h-0 m-0 mt-2 p-0 data-[state=inactive]:hidden lvx-mobile-codeview"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {selectedNode && selectedNode.type === 'file' ? (
                <div className="h-full flex flex-col">
                  <CodePreviewPanel
                    node={selectedNode}
                    onClose={() => {
                      setMobileTab('files');
                      select(null);
                    }}
                    onUpdateContent={updateContent}
                  />
                </div>
              ) : (
                <div
                  className="h-full flex items-center justify-center text-sm text-zinc-500 px-4 text-center"
                  style={{ backgroundColor: theme.background.secondary }}
                >
                  Pick a file from the Files tab to preview it here.
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Mobile-only style overrides for the embedded code editor:
              larger font, 1.6 line-height, horizontal scroll. */}
          <style>{`
            .lvx-mobile-codeview textarea {
              font-size: 13px !important;
              line-height: 1.6 !important;
              white-space: pre !important;
              overflow-x: auto !important;
              -webkit-overflow-scrolling: touch;
            }
            .lvx-mobile-codeview [aria-hidden="true"] {
              font-size: 12px !important;
              line-height: 1.6 !important;
            }
          `}</style>
        </DrawerContent>
      </Drawer>
    );
  }

  /* ─────────────────── Desktop: original side-panel (unchanged) ─────────────────── */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: selectedNode?.type === 'file' ? 720 : 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            backgroundColor: theme.background.secondary,
            borderLeft: `1px solid ${theme.surface.border}`,
            position: 'relative',
            zIndex: 30,
            flexShrink: 0,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: '300px',
              minWidth: '260px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
              borderRight: `1px solid ${theme.surface.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: theme.surface.elevated,
                borderBottom: `1px solid ${theme.surface.border}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: theme.text.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                LITHOVEX AI Project Explorer
              </span>
              {onClose && (
                <button
                  onClick={onClose}
                  title="Close Explorer"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.text.tertiary,
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <FileExplorerPanel
                tree={tree as unknown as TreeNode[]}
                selectedNodeId={selectedNode?.id ?? null}
                expandedFolderIds={state.expandedFolderIds}
                fileCount={fileCount}
                folderCount={folderCount}
                onSelect={select}
                onToggleExpand={toggleExpand}
                onRename={rename}
                onDelete={remove}
                onCreateFolder={handleCreateFolder}
                onClearAll={clearAll}
                onUploadedFiles={handleUploaded}
              />
            </div>
          </div>
          {selectedNode?.type === 'file' && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', minHeight: 0 }}>
              <CodePreviewPanel
                node={selectedNode}
                onClose={() => select(null)}
                onUpdateContent={updateContent}
              />
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
