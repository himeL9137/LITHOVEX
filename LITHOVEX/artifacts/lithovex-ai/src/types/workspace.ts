export interface FileNode {
  id: string;
  name: string;
  type: 'file';
  content: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
  size: number;
  path: string;
  parentId: string | null;
}

export interface FolderNode {
  id: string;
  name: string;
  type: 'folder';
  children: (FileNode | FolderNode)[];
  createdAt: Date;
  updatedAt: Date;
  path: string;
  parentId: string | null;
  isExpanded?: boolean;
}

export type TreeNode = FileNode | FolderNode;

export interface WorkspaceState {
  root: FolderNode;
  activeFileId: string | null;
  openFiles: string[];
  recentFiles: string[];
  collapsedFolders: Set<string>;
}

export interface CodeExtraction {
  filename: string;
  language: string;
  content: string;
  description?: string;
}

export interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'copy';
  nodeId: string;
  timestamp: Date;
  undoData?: any;
}
