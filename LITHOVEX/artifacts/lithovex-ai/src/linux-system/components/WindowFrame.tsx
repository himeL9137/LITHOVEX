// ============================================================
// WindowFrame — Draggable, resizable window chrome
// ============================================================

import { useCallback, useRef, useState, memo, useEffect } from 'react';
import type { Window } from '@linux/types';
import { useOS } from '@linux/hooks/useOSStore';
import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const TOP_PANEL_HEIGHT = 28;
const RESIZE_HANDLE = 8;
const MIN_W = 320;
const MIN_H = 200;

const DynamicIcon = ({ name, ...props }: { name: string } & LucideProps) => {
  const IconComp = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  return IconComp ? <IconComp {...props} /> : <Icons.HelpCircle {...props} />;
};

interface WindowFrameProps {
  window: Window;
  children: React.ReactNode;
}

const WindowFrame = memo(function WindowFrame({ window: win, children }: WindowFrameProps) {
  const { dispatch } = useOS();
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ isResizing: boolean; edge: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const isMaximized = win.state === 'maximized';
  const isMinimized = win.state === 'minimized';
  const isFocused = win.isFocused;

  // Focus on click anywhere on window
  const handleFrameMouseDown = useCallback(() => {
    if (!win.isFocused && win.state !== 'minimized') {
      dispatch({ type: 'FOCUS_WINDOW', windowId: win.id });
    }
  }, [dispatch, win.id, win.isFocused, win.state]);

  // ---- Drag: start on title bar mousedown ----
  const handleTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMaximized) return;
      if (e.button !== 0) return;
      e.preventDefault();
      dragRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        origX: win.position.x,
        origY: win.position.y,
      };
      setIsDragging(true);
    },
    [isMaximized, win.position.x, win.position.y]
  );

  // ---- Resize: start on edge mousedown ----
  const startResize = useCallback(
    (e: React.MouseEvent, edge: string) => {
      if (isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        isResizing: true,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        origW: win.size.width,
        origH: win.size.height,
        origX: win.position.x,
        origY: win.position.y,
      };
      setIsResizing(true);
    },
    [isMaximized, win.size, win.position]
  );

  // ---- Global mouse events for drag/resize ----
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current?.isDragging) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        let nx = dragRef.current.origX + dx;
        let ny = dragRef.current.origY + dy;
        const vw = window.innerWidth;
        ny = Math.max(TOP_PANEL_HEIGHT, ny);
        nx = Math.min(Math.max(nx, -(win.size.width - 100)), vw - 100);
        dispatch({ type: 'MOVE_WINDOW', windowId: win.id, position: { x: nx, y: ny } });
      }
      if (resizeRef.current?.isResizing) {
        const { edge, startX, startY, origW, origH, origX, origY } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let nx = origX, ny = origY, nw = origW, nh = origH;
        if (edge.includes('e')) nw = Math.max(MIN_W, origW + dx);
        if (edge.includes('s')) nh = Math.max(MIN_H, origH + dy);
        if (edge.includes('w')) {
          nw = Math.max(MIN_W, origW - dx);
          nx = origX + (origW - nw);
        }
        if (edge.includes('n')) {
          nh = Math.max(MIN_H, origH - dy);
          ny = origY + (origH - nh);
          ny = Math.max(TOP_PANEL_HEIGHT, ny);
        }
        dispatch({ type: 'MOVE_WINDOW', windowId: win.id, position: { x: nx, y: ny } });
        dispatch({ type: 'RESIZE_WINDOW', windowId: win.id, size: { width: nw, height: nh } });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      setIsDragging(false);
      setIsResizing(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dispatch, win.id, win.size.width, win.size.height]);

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({ type: 'MINIMIZE_WINDOW', windowId: win.id });
    },
    [dispatch, win.id]
  );

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isMaximized) {
        dispatch({ type: 'RESTORE_WINDOW', windowId: win.id });
      } else {
        dispatch({ type: 'MAXIMIZE_WINDOW', windowId: win.id });
      }
    },
    [dispatch, win.id, isMaximized]
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({ type: 'CLOSE_WINDOW', windowId: win.id });
    },
    [dispatch, win.id]
  );

  const handleDoubleClickTitle = useCallback(() => {
    if (isMaximized) {
      dispatch({ type: 'RESTORE_WINDOW', windowId: win.id });
    } else {
      dispatch({ type: 'MAXIMIZE_WINDOW', windowId: win.id });
    }
  }, [dispatch, win.id, isMaximized]);

  if (isMinimized) return null;

  const H = RESIZE_HANDLE;
  const C = RESIZE_HANDLE * 2; // corner size

  return (
    <div
      ref={frameRef}
      className="absolute flex flex-col"
      style={{
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
        borderRadius: isMaximized ? 0 : 12,
        border: `1px solid ${isFocused ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        boxShadow: isFocused
          ? '0 8px 32px rgba(0,0,0,0.8)'
          : '0 2px 8px rgba(0,0,0,0.5)',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 150ms ease, border-color 150ms ease',
        overflow: 'hidden',
        userSelect: isDragging || isResizing ? 'none' : undefined,
      }}
      onMouseDown={handleFrameMouseDown}
    >
      {/* ── Resize handles (only at edges, never over title/content) ── */}
      {!isMaximized && (
        <>
          {/* Edges */}
          <div onMouseDown={(e) => startResize(e, 'n')}  style={{ position:'absolute', top:0, left:C, right:C, height:H, cursor:'n-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 's')}  style={{ position:'absolute', bottom:0, left:C, right:C, height:H, cursor:'s-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 'w')}  style={{ position:'absolute', left:0, top:C, bottom:C, width:H, cursor:'w-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 'e')}  style={{ position:'absolute', right:0, top:C, bottom:C, width:H, cursor:'e-resize', zIndex:60 }} />
          {/* Corners — top corners stay below titlebar button area */}
          <div onMouseDown={(e) => startResize(e, 'nw')} style={{ position:'absolute', top:0, left:0, width:C, height:C, cursor:'nw-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 'ne')} style={{ position:'absolute', top:0, right:40, width:C, height:C, cursor:'ne-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 'sw')} style={{ position:'absolute', bottom:0, left:0, width:C, height:C, cursor:'sw-resize', zIndex:60 }} />
          <div onMouseDown={(e) => startResize(e, 'se')} style={{ position:'absolute', bottom:0, right:0, width:C, height:C, cursor:'se-resize', zIndex:60 }} />
        </>
      )}

      {/* ── Title bar ── */}
      <div
        className="relative flex items-center justify-between shrink-0"
        style={{
          height: 36,
          background: isFocused ? '#111111' : '#0a0a0a',
          borderRadius: isMaximized ? 0 : '12px 12px 0 0',
          transition: 'background 150ms ease',
          cursor: isMaximized ? 'default' : isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          flexShrink: 0,
        }}
        onMouseDown={handleTitleMouseDown}
        onDoubleClick={handleDoubleClickTitle}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2 px-3 overflow-hidden pointer-events-none">
          <DynamicIcon name={win.icon} size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
          <span
            className="text-xs font-medium truncate"
            style={{
              color: isFocused ? '#E0E0E0' : '#666666',
              transition: 'color 150ms ease',
            }}
          >
            {win.title}
          </span>
        </div>

        {/* Right: window controls at z-70 so they're always above resize handles */}
        <div className="flex items-center shrink-0" style={{ zIndex: 70, position: 'relative' }}>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleMinimize}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            title="Minimize"
          >
            <Icons.Minus size={14} />
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleMaximize}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Icons.Copy size={11} /> : <Icons.Square size={11} />}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center transition-colors"
            style={{
              color: 'rgba(255,255,255,0.4)',
              borderRadius: isMaximized ? 0 : '0 12px 0 0',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e74c3c'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            title="Close"
          >
            <Icons.X size={14} />
          </button>
        </div>
      </div>

      {/* ── Window body ── */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          background: 'var(--bg-window)',
          borderRadius: isMaximized ? 0 : '0 0 12px 12px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
});

export default WindowFrame;
