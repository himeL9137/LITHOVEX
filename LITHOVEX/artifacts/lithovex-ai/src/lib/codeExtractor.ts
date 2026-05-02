export interface CodeBlock {
  id: string;
  language: string;
  filename: string | null;
  code: string;
  startLine: number;
  endLine: number;
  precedingText: string;
}

const LANGUAGE_DEFAULT_FILES: Record<string, string> = {
  typescript: 'index.ts',
  ts: 'index.ts',
  tsx: 'App.tsx',
  javascript: 'index.js',
  js: 'index.js',
  jsx: 'App.jsx',
  python: 'main.py',
  py: 'main.py',
  html: 'index.html',
  css: 'styles.css',
  scss: 'styles.scss',
  json: 'data.json',
  yaml: 'config.yaml',
  yml: 'config.yml',
  markdown: 'README.md',
  md: 'README.md',
  bash: 'script.sh',
  shell: 'script.sh',
  sh: 'script.sh',
  zsh: 'script.sh',
  go: 'main.go',
  rust: 'main.rs',
  rs: 'main.rs',
  java: 'Main.java',
  c: 'main.c',
  cpp: 'main.cpp',
  'c++': 'main.cpp',
  cs: 'Program.cs',
  csharp: 'Program.cs',
  ruby: 'main.rb',
  rb: 'main.rb',
  php: 'index.php',
  swift: 'main.swift',
  kotlin: 'Main.kt',
  kt: 'Main.kt',
  sql: 'query.sql',
  xml: 'data.xml',
  toml: 'config.toml',
  ini: 'config.ini',
  env: '.env',
  dockerfile: 'Dockerfile',
  docker: 'Dockerfile',
};

function simpleHash(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const out = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return 'cb_' + out.toString(36);
}

function extractFilenameFromComments(code: string): string | null {
  const lines = code.split('\n').slice(0, 5);
  const patterns: RegExp[] = [
    /^\s*(?:\/\/|#|--|;)\s*(?:filename|file|path)\s*[:=]\s*([^\s]+)/i,
    /^\s*(?:\/\/|#|--|;)\s*([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)\s*$/,
    /^\s*<!--\s*(?:filename|file|path)?\s*[:=]?\s*([^\s>]+)\s*-->/i,
    /^\s*\/\*\s*(?:filename|file|path)?\s*[:=]?\s*([^\s*]+)\s*\*\//i,
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim().replace(/^["']|["']$/g, '');
        if (/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+/.test(candidate) || candidate === 'Dockerfile') {
          return candidate;
        }
      }
    }
  }
  return null;
}

function extractFilenameFromContext(precedingText: string): string | null {
  if (!precedingText) return null;
  const tail = precedingText.split('\n').slice(-4).join('\n');
  const patterns: RegExp[] = [
    /(?:filename|file|path|create(?:\s+a)?(?:\s+new)?\s+file(?:\s+at)?|save(?:\s+(?:as|to))?|in)\s*[:`]?\s*[`"']?([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)[`"']?/i,
    /[`"']([A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)[`"']/,
    /\b((?:src|app|lib|components|pages|hooks|utils)\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+)\b/,
  ];
  for (const pattern of patterns) {
    const match = tail.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  if (!text || typeof text !== 'string') return blocks;

  const lines = text.split('\n');
  let i = 0;
  let inCodeBlock = false;
  let currentLanguage = '';
  let currentCodeLines: string[] = [];
  let currentBlockStartLine = 0;
  let currentPrecedingText = '';
  let currentFence = '';
  let lastBlockEndLine = -1;

  while (i < lines.length) {
    const line = lines[i];

    if (!inCodeBlock) {
      const openMatch = line.match(/^(`{3,}|~{3,})\s*([A-Za-z0-9_+\-#.]*)\s*(.*)$/);
      if (openMatch) {
        inCodeBlock = true;
        currentFence = openMatch[1];
        currentLanguage = (openMatch[2] || '').trim();
        currentCodeLines = [];
        currentBlockStartLine = i;
        const precedingLines = lines.slice(lastBlockEndLine + 1, i);
        currentPrecedingText = precedingLines.join('\n').trim();
        i++;
        continue;
      }
      i++;
      continue;
    }

    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*$/);
    if (fenceMatch && fenceMatch[1][0] === currentFence[0] && fenceMatch[1].length >= currentFence.length) {
      inCodeBlock = false;
      const code = currentCodeLines.join('\n');
      const filename =
        extractFilenameFromComments(code) || extractFilenameFromContext(currentPrecedingText);
      const blockId = simpleHash(`${currentBlockStartLine}-${code.slice(0, 200)}`);

      blocks.push({
        id: blockId,
        language: currentLanguage,
        filename,
        code,
        startLine: currentBlockStartLine,
        endLine: i,
        precedingText: currentPrecedingText,
      });

      lastBlockEndLine = i;
      currentLanguage = '';
      currentCodeLines = [];
      currentFence = '';
      i++;
      continue;
    } else {
      currentCodeLines.push(line);
    }
    i++;
  }

  if (inCodeBlock && currentCodeLines.length > 0) {
    const code = currentCodeLines.join('\n');
    const filename =
      extractFilenameFromComments(code) || extractFilenameFromContext(currentPrecedingText);
    const blockId = simpleHash(`${currentBlockStartLine}-${code.slice(0, 200)}`);
    blocks.push({
      id: blockId,
      language: currentLanguage,
      filename,
      code,
      startLine: currentBlockStartLine,
      endLine: lines.length - 1,
      precedingText: currentPrecedingText,
    });
  }

  return blocks;
}

export function generateSuggestedFilePath(block: CodeBlock): string {
  if (block.filename) {
    return block.filename;
  }
  const lang = block.language.toLowerCase().replace(/\s+/g, '');
  if (LANGUAGE_DEFAULT_FILES[lang]) {
    return LANGUAGE_DEFAULT_FILES[lang];
  }
  if (lang === 'dockerfile' || lang === 'docker') return 'Dockerfile';
  return 'untitled.txt';
}

interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatCodeBlock extends CodeBlock {
  messageIndex: number;
  blockIndex: number;
}

export interface StreamingExtractionResult {
  complete: CodeBlock[];
  inProgress: { language: string; code: string; hasOpening: boolean } | null;
}

export function extractCodeBlocksFromStream(messageText: string): StreamingExtractionResult {
  const complete = extractCodeBlocks(messageText);
  if (!messageText) return { complete, inProgress: null };

  const lastFenceIndex = messageText.lastIndexOf('```');
  if (lastFenceIndex === -1) {
    return { complete, inProgress: null };
  }

  const fenceCount = (messageText.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    const afterLastFence = messageText.slice(lastFenceIndex + 3);
    const languageMatch = afterLastFence.match(/^([A-Za-z0-9_+\-#.]*)/);
    const language = languageMatch ? languageMatch[1].toLowerCase() : '';
    const codeStart = languageMatch ? languageMatch[0].length : 0;
    const code = afterLastFence.slice(codeStart).replace(/^\n/, '').replace(/\n$/, '');
    return {
      complete,
      inProgress: { language, code, hasOpening: true },
    };
  }

  return { complete, inProgress: null };
}

export function extractAllCodeFromChat(messages: ChatMessage[]): ChatCodeBlock[] {
  const allBlocks: ChatCodeBlock[] = [];
  if (!Array.isArray(messages)) return allBlocks;

  messages.forEach((message, messageIndex) => {
    if (message.role !== 'assistant') return;
    if (!message.content || typeof message.content !== 'string') return;

    const blocks = extractCodeBlocks(message.content);
    blocks.forEach((block, blockIndex) => {
      allBlocks.push({
        ...block,
        messageIndex,
        blockIndex,
      });
    });
  });

  return allBlocks;
}
