import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { PenSquare, Trash2, Settings, MessageSquare, X, Users, Github, AlertTriangle, Sparkles } from "lucide-react";
import type { ChatHistory } from "@workspace/api-client-react";
import lithovexLogo from "@/assets/lithovex-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { PricingModal } from "@/components/PricingModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatSidebarProps {
  chats: ChatHistory[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

// Swipe-left distance (px) required to dismiss the drawer.
const SWIPE_CLOSE_THRESHOLD = 60;
// Vertical drift tolerance — past this we treat the gesture as a scroll.
const SWIPE_VERTICAL_TOLERANCE = 40;

export function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isOpen,
  onToggle,
  onOpenSettings,
}: ChatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatHistory | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const isCoWork = location === "/agent-cowork" || location === "/battle";
  const isGitHub = location === "/lithovex-coder";
  const isMobile = useIsMobile();

  // ─── Swipe-to-close gesture ──────────────────────────────────────────────
  // Native (non-React) listeners on the <aside> root so we can use the
  // {passive:true} option for smooth scrolling on iOS, and so the listeners
  // are reliably cleaned up on unmount / when `isOpen` flips false.
  const asideRef = useRef<HTMLElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const node = asideRef.current;
    if (!node) return;
    // Only wire up swipe-to-close while the drawer is actually open AND we
    // are on a touch-class viewport. Avoids the pointer→toggle race on
    // desktop where users can click-drag on the sidebar.
    if (!isOpen || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartXRef.current = t.clientX;
      touchStartYRef.current = t.clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (startX == null || startY == null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // A real swipe-left dismiss: large horizontal travel left, small vertical drift.
      if (dx <= -SWIPE_CLOSE_THRESHOLD && dy <= SWIPE_VERTICAL_TOLERANCE) {
        onToggle();
      }
    };

    node.addEventListener("touchstart", handleTouchStart, { passive: true });
    node.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", handleTouchStart);
      node.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, isMobile, onToggle]);

  // Helper: close the drawer after a tap, but only on mobile widths. Reusing
  // useIsMobile keeps every site of this check in lockstep with the layout.
  const closeOnMobile = useCallback(() => {
    if (isMobile) onToggle();
  }, [isMobile, onToggle]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={onToggle}
          onTouchEnd={onToggle}
          aria-hidden="true"
          data-testid="sidebar-backdrop"
        />
      )}

      <aside
        ref={asideRef}
        aria-label="Conversations sidebar"
        aria-hidden={!isOpen}
        className={`
          fixed top-0 left-0 bottom-0 z-50
          flex flex-col bg-[#111111] border-r border-white/6
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          w-screen max-w-[280px] md:w-[260px] md:max-w-[260px]
          ${isOpen ? "translate-x-0 shadow-2xl shadow-black/60" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={lithovexLogo} alt="LITHOVEX" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-white tracking-wide">LITHOVEX AI</span>
          </div>
          <button
            onClick={onToggle}
            aria-label="Close sidebar"
            className="
              p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/6
              transition-colors
              min-h-11 min-w-11 inline-flex items-center justify-center
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat + LITHOVEX Co-work + LITHOVEX Coder */}
        <div className="px-3 py-3 shrink-0 space-y-1">
          <button
            onClick={() => {
              if (location === "/agent-cowork" || location === "/battle") setLocation("/");
              onNewChat();
              closeOnMobile();
            }}
            className="
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
              text-sm text-gray-300 hover:bg-white/6 hover:text-white
              transition-all duration-150 group
              min-h-12
            "
          >
            <PenSquare className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors flex-shrink-0" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => {
              setLocation("/agent-cowork");
              closeOnMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group min-h-12 ${
              isCoWork
                ? "bg-gradient-to-r from-indigo-600/25 to-purple-600/25 text-white border border-indigo-500/40 shadow-[0_0_18px_rgba(99,102,241,0.18)]"
                : "text-gray-300 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Users className={`w-5 h-5 flex-shrink-0 transition-colors ${isCoWork ? "text-indigo-300" : "text-gray-500 group-hover:text-indigo-400"}`} />
            <span className="flex-1 text-left">LITHOVEX Co-work</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              New
            </span>
          </button>
          <button
            onClick={() => {
              setLocation("/lithovex-coder");
              closeOnMobile();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 group min-h-12 ${
              isGitHub
                ? "bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-white border border-green-500/40 shadow-[0_0_18px_rgba(34,197,94,0.12)]"
                : "text-gray-300 hover:bg-white/6 hover:text-white"
            }`}
          >
            <Github className={`w-5 h-5 flex-shrink-0 transition-colors ${isGitHub ? "text-green-300" : "text-gray-500 group-hover:text-green-400"}`} />
            <span className="flex-1 text-left">LITHOVEX Coder</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">
              AI
            </span>
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-8 h-8 text-gray-700 mb-3" />
              <p className="text-xs text-gray-600">No conversations yet</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 pt-1 pb-2">Recent</p>
              {chats.map((chat) => {
                // Delete button visibility: always visible on mobile (no hover
                // semantics on touch), hover/active on desktop only.
                const showDelete =
                  isMobile || hoveredId === chat.id || activeChatId === chat.id;
                return (
                  <div
                    key={chat.id}
                    className={`
                      group relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer mb-0.5
                      transition-all duration-150
                      min-h-12
                      ${activeChatId === chat.id
                        ? "bg-white/8 text-white"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}
                    `}
                    onClick={() => { onSelectChat(chat.id); closeOnMobile(); }}
                    onMouseEnter={() => setHoveredId(chat.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <span className="flex-1 text-sm truncate leading-snug">
                      {chat.title || "Untitled"}
                    </span>
                    {showDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete(chat);
                        }}
                        aria-label={`Delete chat ${chat.title || "Untitled"}`}
                        className="
                          rounded-md text-gray-500 hover:bg-white/10 hover:text-red-400
                          transition-colors flex-shrink-0
                          min-h-11 min-w-11 inline-flex items-center justify-center
                        "
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/6 px-3 py-3 shrink-0 safe-bottom space-y-1">
          <button
            onClick={() => { setPricingOpen(true); closeOnMobile(); }}
            className="
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
              text-sm text-gray-300 hover:bg-white/6 hover:text-white
              transition-all duration-150 group
              min-h-12
            "
          >
            <Sparkles className="w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-purple-400 transition-colors" />
            <span className="flex-1 text-left">Upgrade</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Pro
            </span>
          </button>
          <button
            onClick={() => { onOpenSettings(); closeOnMobile(); }}
            className="
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
              text-sm text-gray-400 hover:text-gray-100 hover:bg-white/6
              transition-all duration-150
              min-h-12
            "
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Delete-chat confirmation — replaces native window.confirm() */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
      >
        <AlertDialogContent
          className="
            border border-white/10 bg-[#0f0d18]/95 backdrop-blur-xl
            text-gray-100 shadow-2xl shadow-black/50
            sm:max-w-md rounded-2xl
          "
        >
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div
                className="
                  flex h-10 w-10 shrink-0 items-center justify-center
                  rounded-full bg-red-500/15 ring-1 ring-red-500/30
                "
              >
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1 space-y-1.5">
                <AlertDialogTitle className="text-base font-semibold text-white">
                  Delete this chat?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-gray-400 leading-relaxed">
                  <span className="block">
                    “<span className="text-gray-200 font-medium">
                      {pendingDelete?.title || "Untitled"}
                    </span>” and all of its messages will be permanently removed.
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    This action can’t be undone.
                  </span>
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-2">
            <AlertDialogCancel
              className="
                bg-white/5 border-white/10 text-gray-200
                hover:bg-white/10 hover:text-white
                rounded-xl
              "
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDeleteChat(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="
                bg-red-500/90 hover:bg-red-500 text-white
                border border-red-400/40
                rounded-xl
              "
            >
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}
