import JSZip from 'jszip';

export interface UploadedFile {
  path: string;
  content: string;
  isBinary: boolean;
  size: number;
}

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php',
  'swift', 'kt', 'dart', 'lua', 'scala', 'pl', 'r', 'm',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'jsonc', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv',
  'sql', 'graphql', 'gql', 'proto',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'md', 'mdx', 'rst', 'txt', 'log',
  'env', 'ini', 'conf', 'cfg', 'properties',
  'vue', 'svelte', 'astro',
  'tf', 'hcl', 'dockerfile', 'makefile', 'gitignore',
  'prettierrc', 'eslintrc', 'editorconfig', 'babelrc',
]);

const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'Rakefile', 'Gemfile', 'Procfile',
  '.gitignore', '.dockerignore', '.npmrc', '.nvmrc',
  '.env', '.env.local', '.env.example',
  'LICENSE', 'README', 'CHANGELOG',
]);

export function isTextFile(path: string): boolean {
  const name = path.split('/').pop() || '';
  if (TEXT_FILENAMES.has(name)) return true;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return TEXT_EXTENSIONS.has(ext);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0));
    reader.onerror = () => reject(reader.error || new Error('Failed to read binary file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function processFileList(files: FileList | File[]): Promise<UploadedFile[]> {
  const list = Array.from(files);
  const results: UploadedFile[] = [];
  for (const file of list) {
    const path = file.name;
    const text = isTextFile(path);
    if (text) {
      try {
        const content = await readFileAsText(file);
        results.push({ path, content, isBinary: false, size: file.size });
      } catch (err) {
        console.error(`Failed to read file ${path}:`, err);
      }
    } else {
      results.push({
        path,
        content: `[Binary file: ${path} (${formatSize(file.size)})]`,
        isBinary: true,
        size: file.size,
      });
    }
  }
  return results;
}

export async function processDirectory(files: FileList | File[]): Promise<UploadedFile[]> {
  const list = Array.from(files);
  const results: UploadedFile[] = [];
  for (const file of list) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const path = rel && rel.length > 0 ? rel : file.name;
    const text = isTextFile(path);
    if (text) {
      try {
        const content = await readFileAsText(file);
        results.push({ path, content, isBinary: false, size: file.size });
      } catch (err) {
        console.error(`Failed to read file ${path}:`, err);
      }
    } else {
      results.push({
        path,
        content: `[Binary file: ${path.split('/').pop()} (${formatSize(file.size)})]`,
        isBinary: true,
        size: file.size,
      });
    }
  }
  return results;
}

export async function processZipFile(file: File): Promise<UploadedFile[]> {
  const buffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buffer);
  const results: UploadedFile[] = [];

  const entries = Object.entries(zip.files).sort(([a], [b]) => a.localeCompare(b));

  for (const [relativePath, zipEntry] of entries) {
    if (zipEntry.dir) continue;

    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    if (!cleanPath) continue;

    const text = isTextFile(cleanPath);

    if (text) {
      const content = await zipEntry.async('string');
      const internal = (zipEntry as unknown as { _data?: { uncompressedSize?: number } })._data;
      results.push({
        path: cleanPath,
        content,
        isBinary: false,
        size: internal?.uncompressedSize || content.length,
      });
    } else {
      const blob = await zipEntry.async('blob');
      results.push({
        path: cleanPath,
        content: `[Binary file: ${cleanPath.split('/').pop()} (${formatSize(blob.size)})]`,
        isBinary: true,
        size: blob.size,
      });
    }
  }

  return results;
}

export async function processUpload(
  files: FileList | File[],
  isDirectory: boolean = false,
  isZip: boolean = false
): Promise<UploadedFile[]> {
  if (isZip && files.length > 0) {
    return processZipFile(Array.from(files)[0]);
  }
  if (isDirectory) {
    return processDirectory(files);
  }
  return processFileList(files);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function filterSkippableFiles(files: UploadedFile[]): UploadedFile[] {
  const skipPatterns = [
    /^node_modules\//,
    /\/node_modules\//,
    /^\.git\//,
    /\/\.git\//,
    /^dist\//,
    /^build\//,
    /^\.next\//,
    /^__pycache__\//,
    /\/__pycache__\//,
    /^\.DS_Store$/,
    /\/\.DS_Store$/,
    /^Thumbs\.db$/,
    /^\.svn\//,
  ];
  return files.filter((f) => !skipPatterns.some((p) => p.test(f.path)));
}
