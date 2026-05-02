import { CodeExtraction } from '../types/workspace';

export class CodeExtractor {
  private static codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  private static inlineCodeRegex = /`([^`]+)`/g;

  static extractFromText(text: string): CodeExtraction[] {
    const extractions: CodeExtraction[] = [];
    let match;
    this.codeBlockRegex.lastIndex = 0;

    while ((match = this.codeBlockRegex.exec(text)) !== null) {
      const [, language, content] = match;
      extractions.push({
        filename: this.generateFilename(language || 'text', extractions.length),
        language: language || 'text',
        content: content.trim(),
      });
    }

    return extractions;
  }

  static extractWithFilenames(text: string, suggestedNames?: string[]): CodeExtraction[] {
    const extractions = this.extractFromText(text);
    if (suggestedNames) {
      return extractions.map((ext, idx) => ({
        ...ext,
        filename: suggestedNames[idx] || ext.filename,
      }));
    }
    return extractions;
  }

  private static generateFilename(language: string, index: number): string {
    const extensions: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
      sql: 'sql',
      bash: 'sh',
      shell: 'sh',
    };
    const ext = extensions[language.toLowerCase()] || 'txt';
    return `file_${index + 1}.${ext}`;
  }

  static detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const languages: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      sql: 'sql',
      sh: 'bash',
    };
    return languages[ext] || 'text';
  }
}
