import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileExplorerState,
  INITIAL_FILE_EXPLORER_STATE,
  addFileFromPath,
  addNode,
  buildTree,
  clearAllFiles,
  countFiles,
  countFolders,
  createFolderNode,
  getSelectedNode,
  moveNode,
  removeNode,
  renameNode,
  selectNode,
  toggleFolderExpanded,
  updateNodeContent,
} from '../lib/fileExplorerState';
import { generateSuggestedFilePath, type CodeBlock } from '../lib/codeExtractor';

const storageKey = (chatId: string) => `lithovex.fileExplorer.chat.${chatId}`;

interface PersistedState {
  nodes: FileExplorerState['nodes'];
  rootChildrenIds: string[];
  selectedNodeId: string | null;
  expandedFolderIds: string[];
}

function loadState(chatId: string | null): FileExplorerState {
  if (!chatId || typeof window === 'undefined') return INITIAL_FILE_EXPLORER_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(chatId));
    if (!raw) return INITIAL_FILE_EXPLORER_STATE;
    const parsed: PersistedState = JSON.parse(raw);
    return {
      nodes: parsed.nodes || {},
      rootChildrenIds: parsed.rootChildrenIds || [],
      selectedNodeId: parsed.selectedNodeId || null,
      expandedFolderIds: new Set(parsed.expandedFolderIds || []),
    };
  } catch {
    return INITIAL_FILE_EXPLORER_STATE;
  }
}

function persistState(chatId: string, state: FileExplorerState) {
  if (typeof window === 'undefined') return;
  try {
    const persisted: PersistedState = {
      nodes: state.nodes,
      rootChildrenIds: state.rootChildrenIds,
      selectedNodeId: state.selectedNodeId,
      expandedFolderIds: Array.from(state.expandedFolderIds),
    };
    window.localStorage.setItem(storageKey(chatId), JSON.stringify(persisted));
  } catch {
    // ignore quota errors
  }
}

export function useFileExplorer(chatId: string | null) {
  const [state, setState] = useState<FileExplorerState>(() => loadState(chatId));
  const stateRef = useRef(state);
  stateRef.current = state;

  // Reload state whenever the active chat changes
  useEffect(() => {
    setState(loadState(chatId));
  }, [chatId]);

  // Persist state whenever it changes (only if we have a real chat)
  useEffect(() => {
    if (chatId) {
      persistState(chatId, state);
    }
  }, [state, chatId]);

  const save = useCallback((newState: FileExplorerState) => {
    setState(newState);
  }, []);

  const tree = useMemo(() => buildTree(state), [state]);
  const selectedNode = useMemo(() => getSelectedNode(state), [state]);
  const fileCount = useMemo(() => countFiles(state), [state]);
  const folderCount = useMemo(() => countFolders(state), [state]);

  const addCodeBlocks = useCallback(
    (blocks: CodeBlock[]) => {
      let newState = stateRef.current;
      for (const block of blocks) {
        const path = generateSuggestedFilePath(block);
        newState = addFileFromPath(newState, path, block.code);
      }
      save(newState);
    },
    [save]
  );

  const addSingleFile = useCallback(
    (filePath: string, content: string) => {
      const newState = addFileFromPath(stateRef.current, filePath, content);
      save(newState);
    },
    [save]
  );

  const remove = useCallback(
    (nodeId: string) => {
      const newState = removeNode(stateRef.current, nodeId);
      save(newState);
    },
    [save]
  );

  const updateContent = useCallback(
    (nodeId: string, content: string) => {
      const newState = updateNodeContent(stateRef.current, nodeId, content);
      save(newState);
    },
    [save]
  );

  const rename = useCallback(
    (nodeId: string, newName: string) => {
      const newState = renameNode(stateRef.current, nodeId, newName);
      save(newState);
    },
    [save]
  );

  const move = useCallback(
    (nodeId: string, newParentId: string | null) => {
      const newState = moveNode(stateRef.current, nodeId, newParentId);
      save(newState);
    },
    [save]
  );

  const toggleExpand = useCallback(
    (folderId: string) => {
      const newState = toggleFolderExpanded(stateRef.current, folderId);
      save(newState);
    },
    [save]
  );

  const select = useCallback(
    (nodeId: string | null) => {
      const newState = selectNode(stateRef.current, nodeId);
      save(newState);
    },
    [save]
  );

  const createFolder = useCallback(
    (name: string, parentId: string | null = null) => {
      const folder = createFolderNode(name, parentId);
      const newState = addNode(stateRef.current, folder);
      save(newState);
    },
    [save]
  );

  const clearAll = useCallback(() => {
    save(clearAllFiles(stateRef.current));
  }, [save]);

  const addMultipleFiles = useCallback(
    (files: Array<{ path: string; content: string }>) => {
      let newState = stateRef.current;
      for (const file of files) {
        newState = addFileFromPath(newState, file.path, file.content);
      }
      save(newState);
    },
    [save]
  );

  return {
    state,
    tree,
    selectedNode,
    fileCount,
    folderCount,
    addCodeBlocks,
    addSingleFile,
    addMultipleFiles,
    remove,
    updateContent,
    rename,
    move,
    toggleExpand,
    select,
    createFolder,
    clearAll,
  };
}

export type FileExplorerActions = ReturnType<typeof useFileExplorer>;
