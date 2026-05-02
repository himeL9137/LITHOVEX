import React, { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import {
  filterSkippableFiles,
  processUpload,
  type UploadedFile,
} from '../../lib/fileUpload';

interface FileUploadTriggerProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
}

type UploadKind = 'files' | 'folder' | 'zip';

interface UploadError {
  kind: UploadKind;
  message: string;
}

export function FileUploadTrigger({ onFilesUploaded }: FileUploadTriggerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [error, setError] = useState<UploadError | null>(null);

  // Auto-dismiss the error banner after 6s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const runUpload = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      kind: UploadKind,
      isDir: boolean,
      isZip: boolean
    ) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setUploading(kind);
      setError(null);
      try {
        const raw = await processUpload(files, isDir, isZip);
        const filtered = filterSkippableFiles(raw);
        if (filtered.length === 0) {
          setError({
            kind,
            message:
              isZip
                ? 'ZIP contained no readable files (or all files were skipped).'
                : 'No readable files found in selection.',
          });
        } else {
          onFilesUploaded(filtered);
        }
      } catch (err) {
        console.error(`${kind} upload error:`, err);
        const detail =
          err instanceof Error && err.message
            ? err.message
            : 'Unknown error while reading files.';
        const prefix =
          kind === 'zip'
            ? 'ZIP read failed'
            : kind === 'folder'
            ? 'Folder upload failed'
            : 'File upload failed';
        setError({ kind, message: `${prefix}: ${detail}` });
      } finally {
        setUploading(null);
        e.target.value = '';
      }
    },
    [onFilesUploaded]
  );

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => runUpload(e, 'files', false, false),
    [runUpload]
  );
  const handleFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => runUpload(e, 'folder', true, false),
    [runUpload]
  );
  const handleZip = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => runUpload(e, 'zip', false, true),
    [runUpload]
  );

  const isBusy = uploading !== null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.cpp,.c,.h,.hpp,.cs,.php,.html,.css,.scss,.less,.json,.yaml,.yml,.toml,.xml,.sql,.sh,.bash,.md,.txt,.env,.vue,.svelte,.swift,.kt,.dart,.lua,.graphql,.proto,.tf,.dockerfile,.makefile,.gitignore,.prettierrc,.eslintrc"
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        style={{ display: 'none' }}
        onChange={handleFolder}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handleZip}
      />
      <div
        style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', gap: '4px' }}
        aria-busy={isBusy}
      >
        <div style={{ display: 'inline-flex', gap: '2px' }}>
          <UploadButton
            label="Files"
            icon="📄"
            busy={uploading === 'files'}
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            title="Upload Files"
          />
          <UploadButton
            label="Folder"
            icon="📂"
            busy={uploading === 'folder'}
            disabled={isBusy}
            onClick={() => folderInputRef.current?.click()}
            title="Upload Folder"
          />
          <UploadButton
            label="ZIP"
            icon="📦"
            busy={uploading === 'zip'}
            disabled={isBusy}
            onClick={() => zipInputRef.current?.click()}
            title="Upload ZIP"
          />
        </div>
        {error && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid #5b1d1d',
              backgroundColor: '#2a1414',
              color: '#fca5a5',
              fontSize: '11px',
              lineHeight: 1.4,
              maxWidth: '320px',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
              {error.message}
            </span>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              style={{
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
  );
}

interface UploadButtonProps {
  label: string;
  icon: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
}

function UploadButton({ label, icon, busy, disabled, onClick, title }: UploadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...uploadButtonStyle,
        cursor: disabled ? (busy ? 'wait' : 'not-allowed') : 'pointer',
        opacity: disabled && !busy ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = theme.surface.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={busy ? `${title} — uploading…` : title}
      aria-label={busy ? `${title}, uploading` : title}
    >
      {busy ? (
        <>
          <span
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              border: '1.5px solid #707070',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'fileUploadSpin 0.7s linear infinite',
              marginRight: 4,
              verticalAlign: '-1px',
            }}
          />
          {label}…
        </>
      ) : (
        <>
          {icon} {label}
        </>
      )}
    </button>
  );
}

const uploadButtonStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: '4px',
  border: '1px solid #2a2a2a',
  backgroundColor: 'transparent',
  color: '#707070',
  fontSize: '11px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background-color 100ms',
};

if (typeof document !== 'undefined' && !document.getElementById('file-upload-trigger-keyframes')) {
  const style = document.createElement('style');
  style.id = 'file-upload-trigger-keyframes';
  style.textContent = `@keyframes fileUploadSpin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
