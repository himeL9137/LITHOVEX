export type ExplorerNodeType = 'file' | 'folder';

export interface ExplorerNode {
  id: string;
  type: ExplorerNodeType;
  name: string;
  parentId: string | null;
  content: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

export interface FileTreeFolder {
  id: string;
  name: string;
  type: 'folder';
  children: FileTreeNode[];
  createdAt: number;
  updatedAt: number;
}

export interface FileTreeFile {
  id: string;
  name: string;
  type: 'file';
  content: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

export type FileTreeNode = FileTreeFolder | FileTreeFile;

export interface FileExplorerState {
  nodes: Record<string, ExplorerNode>;
  rootChildrenIds: string[];
  selectedNodeId: string | null;
  expandedFolderIds: Set<string>;
}

let _idCounter = 0;
function generateId(prefix: string): string {
  _idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}_${rand}`;
}

function detectLanguageFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    xml: 'xml',
    toml: 'toml',
    ini: 'ini',
    env: 'env',
  };
  if (name === 'Dockerfile') return 'dockerfile';
  return map[ext] || 'text';
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+$/, '_')
      .replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, '_$1')
      .trim() || 'untitled'
  );
}

export function createFileNode(
  name: string,
  content: string,
  parentId: string | null = null,
  language?: string
): ExplorerNode {
  const now = Date.now();
  const sanitizedName = sanitizeFileName(name);
  return {
    id: generateId('file'),
    type: 'file',
    name: sanitizedName,
    parentId,
    content,
    language: language || detectLanguageFromName(sanitizedName),
    createdAt: now,
    updatedAt: now,
  };
}

export function createFolderNode(name: string, parentId: string | null): ExplorerNode {
  const now = Date.now();
  const sanitizedName = sanitizeFileName(name);
  return {
    id: generateId('folder'),
    type: 'folder',
    name: sanitizedName,
    parentId,
    content: '',
    language: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function addNode(state: FileExplorerState, node: ExplorerNode): FileExplorerState {
  const nodes = { ...state.nodes, [node.id]: node };
  let rootChildrenIds = state.rootChildrenIds;
  if (node.parentId === null) {
    rootChildrenIds = [...state.rootChildrenIds, node.id];
  }
  return { ...state, nodes, rootChildrenIds };
}

function getDescendantIds(state: FileExplorerState, nodeId: string): string[] {
  const out: string[] = [];
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const n of Object.values(state.nodes)) {
      if (n.parentId === id) stack.push(n.id);
    }
  }
  return out;
}

export function removeNode(state: FileExplorerState, nodeId: string): FileExplorerState {
  if (!state.nodes[nodeId]) return state;
  const toRemove = new Set(getDescendantIds(state, nodeId));
  const nodes: Record<string, ExplorerNode> = {};
  for (const [id, n] of Object.entries(state.nodes)) {
    if (!toRemove.has(id)) nodes[id] = n;
  }
  const rootChildrenIds = state.rootChildrenIds.filter((id) => !toRemove.has(id));
  const expandedFolderIds = new Set(state.expandedFolderIds);
  toRemove.forEach((id) => expandedFolderIds.delete(id));
  const selectedNodeId = state.selectedNodeId && toRemove.has(state.selectedNodeId)
    ? null
    : state.selectedNodeId;
  return { nodes, rootChildrenIds, selectedNodeId, expandedFolderIds };
}

export function updateNodeContent(
  state: FileExplorerState,
  nodeId: string,
  content: string
): FileExplorerState {
  const node = state.nodes[nodeId];
  if (!node || node.type !== 'file') return state;
  const updated: ExplorerNode = { ...node, content, updatedAt: Date.now() };
  return { ...state, nodes: { ...state.nodes, [nodeId]: updated } };
}

export function renameNode(
  state: FileExplorerState,
  nodeId: string,
  newName: string
): FileExplorerState {
  const node = state.nodes[nodeId];
  if (!node) return state;
  const trimmed = newName.trim();
  if (!trimmed) return state;
  const updated: ExplorerNode = {
    ...node,
    name: trimmed,
    language:
      node.type === 'file' ? detectLanguageFromName(trimmed) : node.language,
    updatedAt: Date.now(),
  };
  return { ...state, nodes: { ...state.nodes, [nodeId]: updated } };
}

export function moveNode(
  state: FileExplorerState,
  nodeId: string,
  newParentId: string | null
): FileExplorerState {
  const node = state.nodes[nodeId];
  if (!node) return state;
  if (newParentId === nodeId) return state;
  if (newParentId !== null) {
    const parent = state.nodes[newParentId];
    if (!parent || parent.type !== 'folder') return state;
    const descendants = new Set(getDescendantIds(state, nodeId));
    if (descendants.has(newParentId)) return state;
  }
  const updated: ExplorerNode = { ...node, parentId: newParentId, updatedAt: Date.now() };
  const nodes = { ...state.nodes, [nodeId]: updated };
  let rootChildrenIds = state.rootChildrenIds.filter((id) => id !== nodeId);
  if (newParentId === null) rootChildrenIds = [...rootChildrenIds, nodeId];
  return { ...state, nodes, rootChildrenIds };
}

export function toggleFolderExpanded(
  state: FileExplorerState,
  folderId: string
): FileExplorerState {
  const node = state.nodes[folderId];
  if (!node || node.type !== 'folder') return state;
  const expandedFolderIds = new Set(state.expandedFolderIds);
  if (expandedFolderIds.has(folderId)) expandedFolderIds.delete(folderId);
  else expandedFolderIds.add(folderId);
  return { ...state, expandedFolderIds };
}

export function selectNode(
  state: FileExplorerState,
  nodeId: string | null
): FileExplorerState {
  if (nodeId !== null && !state.nodes[nodeId]) return state;
  return { ...state, selectedNodeId: nodeId };
}

export function buildTree(state: FileExplorerState): FileTreeNode[] {
  const childrenByParent: Record<string, ExplorerNode[]> = {};
  for (const node of Object.values(state.nodes)) {
    const key = node.parentId === null ? '__root__' : node.parentId;
    if (!childrenByParent[key]) childrenByParent[key] = [];
    childrenByParent[key].push(node);
  }
  for (const key of Object.keys(childrenByParent)) {
    childrenByParent[key].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  const buildFor = (node: ExplorerNode): FileTreeNode => {
    if (node.type === 'folder') {
      const children = (childrenByParent[node.id] || []).map(buildFor);
      return {
        id: node.id,
        type: 'folder',
        name: node.name,
        children,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
    }
    return {
      id: node.id,
      type: 'file',
      name: node.name,
      content: node.content,
      language: node.language,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  };
  const rootNodes = (childrenByParent['__root__'] || []).slice();
  rootNodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return rootNodes.map(buildFor);
}

export function countFiles(state: FileExplorerState): number {
  return Object.values(state.nodes).filter((n) => n.type === 'file').length;
}

export function countFolders(state: FileExplorerState): number {
  return Object.values(state.nodes).filter((n) => n.type === 'folder').length;
}

export function ensureFolderPath(
  state: FileExplorerState,
  folderPath: string
): { state: FileExplorerState; folderId: string | null } {
  const parts = folderPath.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) return { state, folderId: null };

  let currentState = state;
  let currentParentId: string | null = null;

  for (const part of parts) {
    const existing = Object.values(currentState.nodes).find(
      (n) => n.type === 'folder' && n.parentId === currentParentId && n.name === part
    );
    if (existing) {
      currentParentId = existing.id;
      const newExpanded = new Set(currentState.expandedFolderIds);
      newExpanded.add(existing.id);
      currentState = { ...currentState, expandedFolderIds: newExpanded };
    } else {
      const newFolder = createFolderNode(part, currentParentId);
      currentState = addNode(currentState, newFolder);
      const newExpanded = new Set(currentState.expandedFolderIds);
      newExpanded.add(newFolder.id);
      currentState = { ...currentState, expandedFolderIds: newExpanded };
      currentParentId = newFolder.id;
    }
  }

  return { state: currentState, folderId: currentParentId };
}

export function addFileFromPath(
  state: FileExplorerState,
  filePath: string,
  content: string
): FileExplorerState {
  const parts = filePath.split('/').filter((p) => p.length > 0);
  const fileName = parts.pop();
  if (!fileName || fileName.trim().length === 0) return state;
  if (!content || content.trim().length === 0) return state;

  let currentState = state;
  if (parts.length > 0) {
    const folderPath = parts.join('/');
    if (folderPath.length > 0) {
      const folderResult = ensureFolderPath(currentState, folderPath);
      currentState = folderResult.state;
      const fileNode = createFileNode(fileName, content, folderResult.folderId);
      currentState = addNode(currentState, fileNode);
    }
  } else {
    const fileNode = createFileNode(fileName, content, null);
    currentState = addNode(currentState, fileNode);
  }

  return currentState;
}

export function getSelectedNode(state: FileExplorerState): ExplorerNode | null {
  if (!state.selectedNodeId) return null;
  return state.nodes[state.selectedNodeId] || null;
}

export function clearAllFiles(_state: FileExplorerState): FileExplorerState {
  return {
    nodes: {},
    rootChildrenIds: [],
    selectedNodeId: null,
    expandedFolderIds: new Set(),
  };
}

export const INITIAL_FILE_EXPLORER_STATE: FileExplorerState = {
  nodes: {},
  rootChildrenIds: [],
  selectedNodeId: null,
  expandedFolderIds: new Set(),
};
