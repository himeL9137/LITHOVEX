import JSZip from 'jszip';
import type { FileTreeNode } from './fileExplorerState';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSingleFile(content: string, filename: string): void {
  const ext = getFileExtension(filename);
  const mime = getMimeType(ext);
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, filename);
}

export function collectFilePaths(
  node: FileTreeNode,
  prefix: string = ''
): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  if (node.type === 'file') {
    out.push({ path: prefix ? `${prefix}/${node.name}` : node.name, content: node.content });
    return out;
  }
  const folderPrefix = prefix ? `${prefix}/${node.name}` : node.name;
  for (const child of node.children) {
    out.push(...collectFilePaths(child, folderPrefix));
  }
  return out;
}

function collectFromTree(tree: FileTreeNode[]): Array<{ path: string; content: string }> {
  const out: Array<{ path: string; content: string }> = [];
  for (const node of tree) {
    out.push(...collectFilePaths(node));
  }
  return out;
}

export async function downloadAsZip(
  tree: FileTreeNode[],
  zipFilename: string = 'lithovex-project.zip'
): Promise<void> {
  const zip = new JSZip();
  const files = collectFromTree(tree);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(blob, zipFilename);
}

export async function downloadFolderAsZip(
  folderNode: FileTreeNode,
  zipFilename?: string
): Promise<void> {
  if (folderNode.type !== 'folder') {
    downloadSingleFile(folderNode.content, folderNode.name);
    return;
  }

  const zip = new JSZip();
  const files: Array<{ path: string; content: string }> = [];
  for (const child of folderNode.children) {
    files.push(...collectFilePaths(child));
  }

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const finalName = zipFilename || `${folderNode.name}.zip`;
  downloadBlob(blob, finalName);
}

export async function downloadFilesAsZip(
  files: Array<{ path: string; content: string }>,
  zipFilename: string = 'lithovex-files.zip'
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(blob, zipFilename);
}

export function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getMimeType(extension: string): string {
  const types: Record<string, string> = {
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    py: 'text/x-python',
    rb: 'text/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    java: 'text/x-java',
    cpp: 'text/x-c++',
    c: 'text/x-c',
    h: 'text/x-c',
    hpp: 'text/x-c++',
    cs: 'text/x-csharp',
    php: 'text/x-php',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    scss: 'text/x-scss',
    less: 'text/x-less',
    json: 'application/json',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    toml: 'text/x-toml',
    xml: 'text/xml',
    sql: 'text/x-sql',
    sh: 'text/x-shellscript',
    bash: 'text/x-shellscript',
    md: 'text/markdown',
    mdx: 'text/markdown',
    txt: 'text/plain',
    svg: 'image/svg+xml',
  };
  return types[extension] || 'text/plain';
}
