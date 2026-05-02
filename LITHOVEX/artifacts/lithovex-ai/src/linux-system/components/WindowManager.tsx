// ============================================================
// WindowManager — Renders all open windows, manages z-index
// ============================================================

import { memo } from 'react';
import { useOS } from '@linux/hooks/useOSStore';
import WindowFrame from './WindowFrame';
import AppRouter from '@linux/apps/AppRouter';

const WindowManager = memo(function WindowManager() {
  const { state } = useOS();
  const visibleWindows = state.windows.filter((w) => w.state !== 'minimized');

  return (
    <>
      {visibleWindows.map((win) => (
        <WindowFrame key={win.id} window={win}>
          <AppRouter appId={win.appId} windowId={win.id} />
        </WindowFrame>
      ))}
    </>
  );
});

export default WindowManager;
