// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Playground Layout Shell
// Phase 2: App Shell Redesign – PlaygroundLayout.tsx
//
// Mode-aware CSS Grid shell:
//   • "playground" mode  → TopNav + collapsible sidebar + main content area
//   • "legacy" mode      → transparent pass-through (Home.tsx manages its own layout)
//
// Mobile pass (PROMPT 04):
//   • Mobile (< md): sidebar becomes a fixed off-canvas overlay with a
//     tap-dismiss backdrop; the main content does NOT shift (overlay pattern).
//   • Desktop (≥ md): the original Framer-Motion width animation is preserved
//     verbatim — the sidebar still occupies layout space and pushes content.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  PanelLeftOpen,
  PanelLeftClose,
  MessageSquare,
  Layers,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Sidebar width constants ──────────────────────────────────────────────────

const SIDEBAR_OPEN_WIDTH = 260;
const TOP_NAV_HEIGHT = 56; // 14 * 4 = 56px (h-14)

// ─── Utility: detect if the current location is a playground route ────────────

function isPlaygroundRoute(location: string): boolean {
  return location.startsWith("/playground");
}

// ─── Sidebar item shape ────────────────────────────────────────────────────────

interface SidebarNavItem {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

// ─── Playground sidebar content ───────────────────────────────────────────────

interface PlaygroundSidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

function PlaygroundSidebar({
  isOpen,
  isMobile,
  onClose,
  onOpenSettings,
}: PlaygroundSidebarProps) {
  const [location] = useLocation();

  const navItems: SidebarNavItem[] = [
    {
      icon: <MessageSquare className="w-4 h-4" />,
      label: "Chat",
      href: "/",
      active: location === "/" || location === "",
    },
    {
      icon: <Layers className="w-4 h-4" />,
      label: "Playground",
      href: "/playground",
      active: location.startsWith("/playground"),
    },
  ];

  // ── Inner navigation list — shared by both layouts. Items hit min-h-12
  //    (48px) on mobile to satisfy the 44×44 touch target floor; type sits
  //    at 15px on mobile for thumb-friendly readability.
  const InnerContent = (
    <div
      className="flex flex-col h-full"
      style={{ width: SIDEBAR_OPEN_WIDTH, minWidth: SIDEBAR_OPEN_WIDTH }}
    >
      {/* Mobile-only header with close button. Hidden on desktop because the
          desktop toggle lives in the content top bar. */}
      {isMobile && (
        <div className="flex items-center justify-between px-3 h-12 border-b border-zinc-800 flex-shrink-0">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Menu
          </p>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="
              rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
              transition-colors min-h-11 min-w-11 inline-flex items-center justify-center
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Section: Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 pt-1 pb-2">
          Navigation
        </p>
        {navItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={() => {
              if (isMobile) onClose();
            }}
            className={`
              flex items-center gap-3 px-3 rounded-xl
              text-sm md:text-sm
              transition-colors duration-150 cursor-pointer
              min-h-12 md:min-h-0 md:py-2.5
              ${isMobile ? "text-[15px]" : ""}
              ${
                item.active
                  ? "bg-purple-600/15 text-purple-300 border border-purple-500/20"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }
            `}
            aria-current={item.active ? "page" : undefined}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </a>
        ))}
      </div>

      {/* Section: Footer */}
      <div className="border-t border-zinc-800 px-2 py-3 safe-bottom">
        <button
          onClick={() => {
            onOpenSettings?.();
            if (isMobile) onClose();
          }}
          aria-label="Open settings panel"
          className={`
            w-full flex items-center gap-3 px-3 rounded-xl
            text-sm text-zinc-400
            hover:bg-zinc-800 hover:text-white
            transition-colors duration-200
            min-h-12 md:min-h-0 md:py-2.5
            ${isMobile ? "text-[15px]" : ""}
          `}
        >
          <SettingsIcon className="w-4 h-4 flex-shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );

  // ── MOBILE: fixed off-canvas overlay (translateX). Sits below the TopNav
  //    and above the main content / desktop overlays.
  if (isMobile) {
    return (
      <aside
        id="playground-sidebar"
        aria-label="Playground navigation sidebar"
        aria-hidden={!isOpen}
        className={`
          fixed left-0 bottom-0 z-[60]
          bg-zinc-950 border-r border-zinc-800
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          shadow-2xl shadow-black/60
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          top: TOP_NAV_HEIGHT,
          width: SIDEBAR_OPEN_WIDTH,
        }}
      >
        {InnerContent}
      </aside>
    );
  }

  // ── DESKTOP: original Framer-Motion width animation (in-flow, pushes content).
  return (
    <motion.aside
      id="playground-sidebar"
      aria-label="Playground navigation sidebar"
      aria-hidden={!isOpen}
      initial={false}
      animate={{ width: isOpen ? SIDEBAR_OPEN_WIDTH : 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.8 }}
      className="
        relative flex-shrink-0 overflow-hidden
        bg-zinc-950 border-r border-zinc-800
        flex flex-col h-full
      "
      style={{ minWidth: 0 }}
    >
      {InnerContent}
    </motion.aside>
  );
}

// ─── Sidebar toggle button ────────────────────────────────────────────────────

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarToggle({ isOpen, onToggle }: SidebarToggleProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  return (
    <button
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      aria-expanded={isOpen}
      aria-controls="playground-sidebar"
      className="
        p-2 rounded-lg
        text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800
        transition-colors duration-200
        flex-shrink-0
        min-h-11 min-w-11 inline-flex items-center justify-center
      "
    >
      {isOpen ? (
        <PanelLeftClose className="w-4 h-4" />
      ) : (
        <PanelLeftOpen className="w-4 h-4" />
      )}
    </button>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface PlaygroundLayoutProps {
  children: ReactNode;
  onOpenSettings?: () => void;
}

export function PlaygroundLayout({
  children,
  onOpenSettings,
}: PlaygroundLayoutProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  // Default: closed on every viewport. The user opens the panel via the toggle
  // in the top bar. We no longer auto-open it on desktop on first load.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // When the viewport crosses into mobile range, collapse the drawer so it
  // doesn't cover the chat. Don't open it back on resize-up — let the user
  // decide via the toggle.
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // ── LEGACY MODE: let Home.tsx manage its own full layout ──────────────────
  // The root "/" route already has TopBar + ChatSidebar inside Home.tsx.
  // In legacy mode we are a transparent pass-through to avoid double navigation.
  if (!isPlaygroundRoute(location)) {
    return <>{children}</>;
  }

  // ── PLAYGROUND MODE: full grid shell ──────────────────────────────────────
  return (
    <div
      className="grid bg-zinc-950 text-zinc-200"
      style={{
        gridTemplateRows: `${TOP_NAV_HEIGHT}px 1fr`,
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Row 1: Top Navigation */}
      <TopNav onOpenSettings={onOpenSettings} />

      {/* Row 2: Sidebar + Main content */}
      <div
        className="flex overflow-hidden relative"
        style={{ height: `calc(100dvh - ${TOP_NAV_HEIGHT}px)` }}
      >
        {/* Mobile backdrop — only when the drawer is open on mobile. Sits
            beneath the sidebar (z-50) but above the main content. */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm md:hidden"
            style={{ top: TOP_NAV_HEIGHT }}
            onClick={closeSidebar}
            onTouchEnd={closeSidebar}
            aria-hidden="true"
            data-testid="playground-sidebar-backdrop"
          />
        )}

        {/* Collapsible sidebar.
            • Desktop: in-flow Framer-Motion width animation (pushes content).
            • Mobile : fixed off-canvas overlay (does NOT push content). */}
        <PlaygroundSidebar
          isOpen={sidebarOpen}
          isMobile={isMobile}
          onClose={closeSidebar}
          onOpenSettings={onOpenSettings}
        />

        {/* Main content area — never shifts on mobile; original flex layout on desktop. */}
        <main
          aria-label="Main content"
          className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0b0f19]"
        >
          {/* Content top bar with sidebar toggle */}
          <div
            className="
              flex items-center gap-2 px-3 h-10 flex-shrink-0
              border-b border-zinc-800/60 bg-[#0b0f19]
            "
          >
            <SidebarToggle isOpen={sidebarOpen} onToggle={toggleSidebar} />
            <AnimatePresence mode="wait">
              <motion.span
                key={sidebarOpen ? "open" : "closed"}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 4 }}
                transition={{ duration: 0.15 }}
                className="hidden sm:inline text-xs text-zinc-600 font-medium"
              >
                {sidebarOpen ? "Hide panel" : "Show panel"}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Scrollable content — momentum scrolling enabled for iOS. */}
          <div
            className="flex-1 overflow-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
