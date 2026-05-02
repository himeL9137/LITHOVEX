export const theme = {
  background: {
    primary: '#0a0a0a',
    secondary: '#111111',
    tertiary: '#161616',
  },
  surface: {
    base: '#0a0a0a',
    panel: '#111111',
    elevated: '#161616',
    hover: '#1d1d1d',
    selected: '#1f2937',
    border: '#2a2a2a',
    borderStrong: '#333333',
  },
  text: {
    primary: '#f5f5f5',
    secondary: '#c8c8c8',
    tertiary: '#9a9a9a',
    muted: '#6b6b6b',
    inverse: '#0a0a0a',
  },
  accent: {
    primary: '#3b82f6',
    primarySoft: 'rgba(59, 130, 246, 0.15)',
    primaryBorder: 'rgba(59, 130, 246, 0.35)',
    muted: '#6b7280',
  },
  border: {
    subtle: '#1f1f1f',
    default: '#2a2a2a',
    strong: '#333333',
  },
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
  fileColors: {
    typescript: '#3b82f6',
    javascript: '#eab308',
    python: '#22c55e',
    html: '#f97316',
    css: '#a855f7',
    json: '#06b6d4',
    markdown: '#94a3b8',
    text: '#737373',
  } as Record<string, string>,
} as const;

export type Theme = typeof theme;
