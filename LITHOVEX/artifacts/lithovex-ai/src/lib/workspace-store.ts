import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WorkspaceState, TreeNode, FileNode, FolderNode } from '../types/workspace';
import { v4 as uuidv4 } from 'uuid';

interface WorkspaceActions {
  createFile: (name: string, content: string, parentId?: string) => FileNode;
  createFolder: (name: string, parentId?: string) => FolderNode;
  updateFile: (id: string, content: string) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, newParentId: string) => void;
  findNodeById: (id: string) => TreeNode | null;
  findNodeByPath: (path: string) => TreeNode | null;
  setActiveFile: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  importFromZip: (zipData: ArrayBuffer) => Promise<void>;
  exportToZip: () => Promise<Blob>;
  addFilesFromChat: (files: Array<{ name: string; content: string }>) => void;
}

const initialState: WorkspaceState = {
  root: {
    id: 'root',
    name: 'Project',
    type: 'folder',
    children: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    path: '/',
    parentId: null,
    isExpanded: true,
  },
  activeFileId: null,
  openFiles: [],
  recentFiles: [],
  collapsedFolders: new Set(),
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      createFile: (name, content, parentId = 'root') => {
        const newFile: FileNode = {
          id: uuidv4(),
          name,
          type: 'file',
          content,
          language: name.split('.').pop() || 'text',
          createdAt: new Date(),
          updatedAt: new Date(),
          size: new Blob([content]).size,
          path: '',
          parentId,
        };

        const updateNode = (node: TreeNode): TreeNode => {
          if (node.id === parentId && node.type === 'folder') {
            return {
              ...node,
              children: [...node.children, newFile],
              updatedAt: new Date(),
            };
          }
          if (node.type === 'folder') {
            return { ...node, children: node.children.map(updateNode) };
          }
          return node;
        };

        set((state) => ({
          root: updateNode(state.root) as FolderNode,
          openFiles: [...state.openFiles, newFile.id],
          recentFiles: [newFile.id, ...state.recentFiles].slice(0, 10),
        }));

        return newFile;
      },

      createFolder: (name, parentId = 'root') => {
        const newFolder: FolderNode = {
          id: uuidv4(),
          name,
          type: 'folder',
          children: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          path: '',
          parentId,
          isExpanded: true,
        };

        const updateNode = (node: TreeNode): TreeNode => {
          if (node.id === parentId && node.type === 'folder') {
            return {
              ...node,
              children: [...node.children, newFolder],
              updatedAt: new Date(),
            };
          }
          if (node.type === 'folder') {
            return { ...node, children: node.children.map(updateNode) };
          }
          return node;
        };

        set((state) => ({ root: updateNode(state.root) as FolderNode }));
        return newFolder;
      },

      updateFile: (id, content) => {
        const updateNode = (node: TreeNode): TreeNode => {
          if (node.id === id && node.type === 'file') {
            return {
              ...node,
              content,
              updatedAt: new Date(),
              size: new Blob([content]).size,
            };
          }
          if (node.type === 'folder') {
            return { ...node, children: node.children.map(updateNode) };
          }
          return node;
        };
        set((state) => ({ root: updateNode(state.root) as FolderNode }));
      },

      deleteNode: (id) => {
        if (id === 'root') return;
        const deleteFromNode = (node: TreeNode): TreeNode => {
          if (node.type === 'folder') {
            const filtered: TreeNode[] = node.children.filter(
              (child: TreeNode) => child.id !== id
            );
            return {
              ...node,
              children: filtered.map(deleteFromNode),
              updatedAt: new Date(),
            };
          }
          return node;
        };
        set((state) => ({
          root: deleteFromNode(state.root) as FolderNode,
          openFiles: state.openFiles.filter((fid) => fid !== id),
          activeFileId: state.activeFileId === id ? null : state.activeFileId,
        }));
      },

      moveNode: (id, newParentId) => {
        let nodeToMove: TreeNode | null = null;

        const findAndRemove = (node: TreeNode): TreeNode | null => {
          if (node.id === id) {
            nodeToMove = node;
            return null;
          }
          if (node.type === 'folder') {
            return {
              ...node,
              children: node.children
                .map(findAndRemove)
                .filter(Boolean) as TreeNode[],
            };
          }
          return node;
        };

        const addToParent = (node: TreeNode): TreeNode => {
          if (node.id === newParentId && node.type === 'folder' && nodeToMove) {
            return {
              ...node,
              children: [...node.children, nodeToMove],
              updatedAt: new Date(),
            };
          }
          if (node.type === 'folder') {
            return { ...node, children: node.children.map(addToParent) };
          }
          return node;
        };

        set((state) => ({
          root: addToParent(findAndRemove(state.root) as FolderNode) as FolderNode,
        }));
      },

      findNodeById: (id) => {
        const find = (node: TreeNode): TreeNode | null => {
          if (node.id === id) return node;
          if (node.type === 'folder') {
            for (const child of node.children) {
              const found = find(child);
              if (found) return found;
            }
          }
          return null;
        };
        return find(get().root);
      },

      findNodeByPath: (path) => {
        const parts = path.split('/').filter(Boolean);
        let current: TreeNode = get().root;
        for (const part of parts) {
          if (current.type !== 'folder') return null;
          const folder: FolderNode = current;
          const child: TreeNode | undefined = folder.children.find(
            (c: TreeNode) => c.name === part
          );
          if (!child) return null;
          current = child;
        }
        return current;
      },

      setActiveFile: (id) => set({ activeFileId: id }),

      toggleFolder: (id) => {
        const toggle = (node: TreeNode): TreeNode => {
          if (node.id === id && node.type === 'folder') {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.type === 'folder') {
            return { ...node, children: node.children.map(toggle) };
          }
          return node;
        };
        set((state) => ({ root: toggle(state.root) as FolderNode }));
      },

      importFromZip: async (zipData) => {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(zipData);

        for (const filename of Object.keys(zip.files)) {
          const file = zip.files[filename];
          if (file.dir) continue;
          const parts = filename.split('/');
          const name = parts.pop()!;
          let parentId = 'root';

          parts.forEach((folder) => {
            const existing = get().findNodeByPath(`/${parts.join('/')}`);
            if (!existing || existing.type !== 'folder') {
              const newFolder = get().createFolder(folder, parentId);
              parentId = newFolder.id;
            } else {
              parentId = existing.id;
            }
          });

          const content = await file.async('text');
          get().createFile(name, content, parentId);
        }
      },

      exportToZip: async () => {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        const addToZip = (node: TreeNode, path: string) => {
          if (node.type === 'file') {
            zip.file(path + node.name, node.content);
          } else {
            zip.folder(path + node.name);
            node.children.forEach((child) => {
              addToZip(child, path + node.name + '/');
            });
          }
        };

        get().root.children.forEach((child) => addToZip(child, ''));
        return await zip.generateAsync({ type: 'blob' });
      },

      addFilesFromChat: (files) => {
        files.forEach(({ name, content }) => {
          get().createFile(name, content);
        });
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        root: state.root,
        openFiles: state.openFiles,
        recentFiles: state.recentFiles,
      }) as any,
    }
  )
);
