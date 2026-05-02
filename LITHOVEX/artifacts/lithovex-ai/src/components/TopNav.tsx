// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Global Top Navigation Bar
// Phase 2: App Shell Redesign – TopNav.tsx
// Mobile pass (PROMPT 02): hide text nav-links < md, add hamburger drawer.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  ChevronDown,
  User,
  LogOut,
  HelpCircle,
  Layers,
  Menu,
  MessageSquare,
} from "lucide-react";
import lithovexLogo from "@/assets/lithovex-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

// ─── Nav link definitions ─────────────────────────────────────────────────────

interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const NAV_LINKS: NavLink[] = [
  { label: "Chat", href: "/", icon: <MessageSquare className="w-4 h-4" /> },
  { label: "Playground", href: "/playground", icon: <Layers className="w-4 h-4" /> },
];

// ─── Profile dropdown item ────────────────────────────────────────────────────

interface DropdownItem {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TopNavProps {
  onOpenSettings?: () => void;
}

export function TopNav({ onOpenSettings }: TopNavProps) {
  const [location] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isCoWork = location === "/agent-cowork" || location === "/battle";
  const profileRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Close profile dropdown on outside click (desktop only)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus first item when desktop dropdown opens
  useEffect(() => {
    if (profileOpen) {
      requestAnimationFrame(() => firstItemRef.current?.focus());
    }
  }, [profileOpen]);

  // Auto-close the mobile drawer if the viewport grows past mobile.
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false);
  }, [isMobile, mobileMenuOpen]);

  const handleProfileKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setProfileOpen((o) => !o);
      }
    },
    []
  );

  const handleDropdownKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const items = profileRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-dropdown-item]"
        );
        if (!items) return;
        const focused = document.activeElement;
        const idx = Array.from(items).indexOf(focused as HTMLButtonElement);
        items[(idx + 1) % items.length]?.focus();
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const items = profileRef.current?.querySelectorAll<HTMLButtonElement>(
          "[data-dropdown-item]"
        );
        if (!items) return;
        const focused = document.activeElement;
        const idx = Array.from(items).indexOf(focused as HTMLButtonElement);
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    },
    []
  );

  const dropdownItems: DropdownItem[] = [
    {
      icon: <User className="w-3.5 h-3.5" />,
      label: "Profile",
      onClick: () => setProfileOpen(false),
    },
    {
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      label: "Help & Docs",
      onClick: () => setProfileOpen(false),
    },
    {
      icon: <LogOut className="w-3.5 h-3.5" />,
      label: "Sign out",
      onClick: () => setProfileOpen(false),
      danger: true,
    },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="
        sticky top-0 z-50 h-14 w-full
        flex items-center justify-between px-4
        bg-zinc-950 border-b border-zinc-800
        backdrop-blur-xl
      "
    >
      {/* ── Left: Logo + (desktop) Nav Links ───────────────────────────── */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <Link href="/" aria-label="LITHOVEX AI home">
          <span className="flex items-center gap-2.5 select-none">
            <img
              src={lithovexLogo}
              alt="LITHOVEX"
              className="w-7 h-7 object-contain"
              draggable={false}
            />
            <span className="hidden sm:block text-sm font-semibold text-zinc-100 tracking-wider">
              LITHOVEX
            </span>
          </span>
        </Link>

        {/* Nav links — hidden on mobile (< md), shown md+ */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? location === "/" || location === ""
                : location.startsWith(link.href);

            return (
              <li key={link.href}>
                <Link href={link.href}>
                  <span
                    className={`
                      relative px-3 py-1.5 rounded-lg text-sm font-medium
                      transition-colors duration-200 cursor-pointer inline-flex items-center gap-1.5
                      ${isActive
                        ? "text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                      }
                    `}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {link.label === "Playground" && (
                      <Layers className="w-3.5 h-3.5 opacity-70" />
                    )}
                    {link.label}
                    {isActive && (
                      <motion.span
                        layoutId="topnav-active-underline"
                        className="absolute inset-x-2 -bottom-px h-px bg-purple-500 rounded-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                      />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Right: Utility cluster ─────────────────────────────────────── */}
      {/* DESKTOP cluster — hidden on mobile to give the hamburger room. */}
      <div className="hidden md:flex items-center gap-1">
        {!isCoWork && (
          <button
            onClick={onOpenSettings}
            aria-label="Open settings"
            className="
              p-2 rounded-lg text-zinc-500
              hover:text-zinc-200 hover:bg-zinc-800
              transition-colors duration-200
              min-h-11 min-w-11 inline-flex items-center justify-center
            "
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {!isCoWork && (
          <div className="relative" ref={profileRef} onKeyDown={handleDropdownKeyDown}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              onKeyDown={handleProfileKeyDown}
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={profileOpen}
              className="
                flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800
                transition-colors duration-200
                min-h-11
              "
            >
              {/* Avatar circle */}
              <span
                className="
                  w-7 h-7 rounded-full
                  bg-gradient-to-br from-purple-600 to-indigo-700
                  flex items-center justify-center
                  text-white text-xs font-bold shrink-0
                  select-none
                "
                aria-hidden="true"
              >
                L
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  profileOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  role="menu"
                  aria-label="User account menu"
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                  className="
                    absolute right-0 top-full mt-2 w-52
                    bg-zinc-900 border border-zinc-700
                    rounded-xl shadow-2xl shadow-black/60
                    overflow-hidden z-[60] py-1
                  "
                >
                  {/* User info header */}
                  <div className="px-3 py-2.5 border-b border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-200">LITHOVEX User</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      lithovex@ai.local
                    </p>
                  </div>

                  {/* Items */}
                  {dropdownItems.map((item, idx) => (
                    <button
                      key={item.label}
                      ref={idx === 0 ? firstItemRef : undefined}
                      data-dropdown-item
                      role="menuitem"
                      onClick={item.onClick}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2
                        text-sm transition-colors duration-150
                        outline-none focus-visible:bg-zinc-800
                        ${item.danger
                          ? "text-red-400 hover:bg-red-950/40 hover:text-red-300"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        }
                      `}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* MOBILE cluster — hamburger that opens a full-height side drawer. */}
      <div className="flex md:hidden items-center">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              aria-label="Open navigation menu"
              aria-haspopup="dialog"
              aria-expanded={mobileMenuOpen}
              className="
                p-2 rounded-lg text-zinc-300
                hover:text-zinc-100 hover:bg-zinc-800
                transition-colors duration-200
                min-h-11 min-w-11 inline-flex items-center justify-center
              "
            >
              <Menu className="w-5 h-5" />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="
              w-[85vw] max-w-sm p-0
              bg-zinc-950 border-l border-zinc-800
              text-zinc-100 flex flex-col
            "
          >
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-zinc-800">
              <SheetTitle className="flex items-center gap-2.5 text-zinc-100">
                <img
                  src={lithovexLogo}
                  alt=""
                  className="w-6 h-6 object-contain"
                  draggable={false}
                />
                <span className="text-sm font-semibold tracking-wider">LITHOVEX</span>
              </SheetTitle>
            </SheetHeader>

            {/* Scrollable list of all primary nav + utility actions. */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {/* NAV_LINKS */}
              <p className="px-2 pb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                Navigate
              </p>
              <ul className="flex flex-col" role="list">
                {NAV_LINKS.map((link) => {
                  const isActive =
                    link.href === "/"
                      ? location === "/" || location === ""
                      : location.startsWith(link.href);
                  return (
                    <li key={link.href}>
                      <SheetClose asChild>
                        <Link href={link.href}>
                          <span
                            className={`
                              w-full flex items-center gap-3 px-3 rounded-lg
                              text-sm font-medium cursor-pointer
                              transition-colors duration-150
                              min-h-11
                              ${isActive
                                ? "bg-purple-500/15 text-purple-200"
                                : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                              }
                            `}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <span className="text-zinc-400 group-hover:text-zinc-200">
                              {link.icon}
                            </span>
                            {link.label}
                          </span>
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>

              {/* Settings + Profile actions are only relevant outside LITHOVEX Co-work mode,
                  matching the desktop behavior. */}
              {!isCoWork && (
                <>
                  <div className="my-3 border-t border-zinc-800" />
                  <p className="px-2 pb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                    Account
                  </p>

                  {/* User identity row */}
                  <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                    <span
                      className="
                        w-9 h-9 rounded-full
                        bg-gradient-to-br from-purple-600 to-indigo-700
                        flex items-center justify-center
                        text-white text-sm font-bold shrink-0
                        select-none
                      "
                      aria-hidden="true"
                    >
                      L
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100 truncate">
                        LITHOVEX User
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        lithovex@ai.local
                      </p>
                    </div>
                  </div>

                  <ul className="flex flex-col" role="list">
                    <li>
                      <SheetClose asChild>
                        <button
                          onClick={() => onOpenSettings?.()}
                          className="
                            w-full flex items-center gap-3 px-3 rounded-lg
                            text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800
                            transition-colors duration-150
                            min-h-11
                          "
                        >
                          <Settings className="w-4 h-4 text-zinc-400" />
                          Settings
                        </button>
                      </SheetClose>
                    </li>
                    {dropdownItems.map((item) => (
                      <li key={item.label}>
                        <SheetClose asChild>
                          <button
                            onClick={item.onClick}
                            className={`
                              w-full flex items-center gap-3 px-3 rounded-lg
                              text-sm transition-colors duration-150
                              min-h-11
                              ${item.danger
                                ? "text-red-400 hover:bg-red-950/40 hover:text-red-300"
                                : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                              }
                            `}
                          >
                            <span
                              className={item.danger ? "text-red-400" : "text-zinc-400"}
                            >
                              {item.icon}
                            </span>
                            {item.label}
                          </button>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
