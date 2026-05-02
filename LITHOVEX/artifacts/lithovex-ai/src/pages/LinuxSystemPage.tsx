// ============================================================
// LinuxSystemPage.tsx — Embeds the "Build Linux System" OS app
// into LITHOVEX as a dedicated full-screen page at /linux-system
// ============================================================

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import LinuxApp from '@/linux-system/LinuxApp';

// ── Scoped CSS for the Linux OS (avoids polluting LITHOVEX global styles) ──
const LINUX_OS_STYLES = `
.linux-os-root {
  --bg-desktop: #000000;
  --bg-panel: #0a0a0a;
  --bg-window: #0d0d0d;
  --bg-window-active: #111111;
  --bg-titlebar: #000000;
  --bg-app-grid: rgba(0,0,0,0.97);
  --bg-context-menu: #0d0d0d;
  --bg-notification: #0d0d0d;
  --bg-tooltip: #000000;
  --bg-input: #0a0a0a;
  --bg-hover: rgba(255,255,255,0.06);
  --bg-active: rgba(255,255,255,0.10);
  --bg-selected: rgba(255,255,255,0.08);

  --accent-primary: #ffffff;
  --accent-primary-hover: #cccccc;
  --accent-primary-active: #999999;
  --accent-secondary: #888888;
  --accent-secondary-hover: #aaaaaa;
  --accent-success: #4CAF50;
  --accent-error: #F44336;
  --accent-warning: #FF9800;
  --accent-info: #aaaaaa;

  --text-primary: #E0E0E0;
  --text-secondary: #888888;
  --text-disabled: #444444;
  --text-inverse: #000000;

  --border-subtle: rgba(255,255,255,0.05);
  --border-default: rgba(255,255,255,0.08);
  --border-focus: #ffffff;

  --shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.6);

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);

  --duration-instant: 50ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  background: #000;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}

.linux-os-root.light {
  --bg-desktop: #FAFAFA;
  --bg-panel: #FFFFFF;
  --bg-window: #FFFFFF;
  --bg-titlebar: #F0F0F0;
  --bg-app-grid: rgba(250,250,250,0.95);
  --bg-context-menu: #FFFFFF;
  --bg-input: #F5F5F5;
  --bg-hover: rgba(0,0,0,0.06);
  --bg-active: rgba(0,0,0,0.10);
  --bg-selected: rgba(124,77,255,0.10);
  --text-primary: #212121;
  --text-secondary: #757575;
  --text-disabled: #BDBDBD;
  --border-subtle: rgba(0,0,0,0.06);
  --border-default: rgba(0,0,0,0.10);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.15);
}

.linux-os-root .custom-scrollbar::-webkit-scrollbar { width: 8px; }
.linux-os-root .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.linux-os-root .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
.linux-os-root .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

.linux-os-root .line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@keyframes linux-fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes linux-slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes linux-slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes linux-scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes linux-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

/* Back button overlay */
.linux-back-btn {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(20,20,20,0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.12);
  color: #e0e0e0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.02em;
}
.linux-back-btn:hover {
  background: rgba(40,40,40,0.95);
  border-color: rgba(255,255,255,0.25);
  color: #fff;
}
`;

export default function LinuxSystemPage() {
  const [, navigate] = useLocation();
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject scoped CSS on mount, clean up on unmount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = LINUX_OS_STYLES;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  return (
    <div className="linux-os-root">
      {/* Back to Agent Co-Work button */}
      <button
        className="linux-back-btn"
        onClick={() => navigate('/agent-cowork')}
        title="Back to Agent Co-Work"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Co-Work
      </button>

      {/* The full Linux OS app */}
      <LinuxApp />
    </div>
  );
}
