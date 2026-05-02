import { useState } from "react";
import { Switch } from "./ui/switch";
import {
  Settings,
  FolderGit2,
  ChevronDown,
  AlignLeft,
  Users,
  MoreHorizontal,
  LifeBuoy,
} from "lucide-react";
import { HF_MODELS } from "./SettingsPanel";
import { LithovexStatusChip } from "./LithovexStatusChip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ContactSupportModal } from "./ContactSupportModal";

interface TopBarProps {
  model: string;
  /** Web search and code-mode toggles now live in the in-chat Tools popover. */
  webSearchEnabled?: boolean;
  setWebSearchEnabled?: (v: boolean) => void;
  autoScroll?: boolean;
  setAutoScroll?: (v: boolean) => void;
  autoDecisionMode?: boolean;
  setAutoDecisionMode?: (v: boolean) => void;
  autoCodeMode?: boolean;
  setAutoCodeMode?: (v: boolean) => void;
  expertMode?: boolean;
  setExpertMode?: (v: boolean) => void;
  coWorkMode?: boolean;
  setCoWorkMode?: (v: boolean) => void;
  onOpenExplorer: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  activeChatTitle: string;
}

export function TopBar({
  model,
  coWorkMode, setCoWorkMode,
  onOpenExplorer,
  onOpenSettings,
  onToggleSidebar,
}: TopBarProps) {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const activeModel = HF_MODELS.find((m) => m.id === model);
  const modelLabel = activeModel?.label ?? model.split("/").pop() ?? model;

  return (
    <>
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-[#111111]/90 backdrop-blur-xl flex-shrink-0 z-10 h-12">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/6 transition-colors flex-shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <AlignLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/6 transition-colors group min-h-11"
          title="Change model"
          aria-label={`Active model: ${modelLabel}. Tap to change.`}
        >
          {/* Tighter truncation on mobile so the model name never crowds the
              status chip; reverts to the original 140px cap from md+ up. */}
          <span className="text-sm text-gray-200 font-medium truncate max-w-[80px] md:max-w-[140px]">
            {modelLabel}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" />
        </button>

        <LithovexStatusChip />
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 shrink-0">
        {/* DESKTOP: Co-work + Explorer (Web/Code moved to in-chat Tools menu). */}
        <div className="hidden md:flex items-center gap-1 mr-1">
          {setCoWorkMode && (
            <ToggleChip
              id="cowork-mode"
              label="Co-work"
              icon={<Users className="w-3 h-3" />}
              checked={!!coWorkMode}
              onChange={setCoWorkMode}
              activeColor="text-indigo-400"
              pulse={!!coWorkMode}
            />
          )}
          <button
            onClick={onOpenExplorer}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-200 hover:bg-white/6 transition-colors min-h-11"
            aria-label="Open file explorer"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Explorer</span>
          </button>
          <button
            onClick={() => setIsSupportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-purple-300 hover:bg-purple-500/10 transition-colors min-h-11"
            aria-label="Contact support"
            title="Contact support"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Support</span>
          </button>
        </div>

        {/* MOBILE: collapsed overflow popover (< md). */}
        <div className="flex md:hidden items-center mr-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="More options"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/6 transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-60 p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-100"
            >
              {setCoWorkMode && (
                <ToggleRow
                  id="cowork-mode-m"
                  label="LITHOVEX Co-work"
                  description="Run multiple agents on a shared canvas"
                  icon={<Users className="w-4 h-4" />}
                  checked={!!coWorkMode}
                  onChange={setCoWorkMode}
                  activeColor="text-indigo-400"
                />
              )}

              {setCoWorkMode && <div className="my-1 border-t border-zinc-800" />}

              <button
                onClick={onOpenExplorer}
                className="
                  w-full flex items-center gap-3 px-3 rounded-lg
                  text-sm text-zinc-300 hover:text-zinc-100 hover:bg-white/6
                  transition-colors min-h-11
                "
              >
                <FolderGit2 className="w-4 h-4 text-zinc-400" />
                <span>Explorer</span>
              </button>
              <button
                onClick={() => setIsSupportOpen(true)}
                className="
                  w-full flex items-center gap-3 px-3 rounded-lg
                  text-sm text-zinc-300 hover:text-purple-300 hover:bg-purple-500/10
                  transition-colors min-h-11
                "
              >
                <LifeBuoy className="w-4 h-4 text-purple-400" />
                <span>Contact support</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/6 transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <ContactSupportModal
      isOpen={isSupportOpen}
      onClose={() => setIsSupportOpen(false)}
    />
    </>
  );
}

function ToggleChip({
  id, label, icon, checked, onChange, activeColor, pulse,
}: {
  id: string; label: string; icon: React.ReactNode;
  checked: boolean; onChange: (v: boolean) => void;
  activeColor: string; pulse?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150
        min-h-11
        ${checked ? `${activeColor} bg-white/8` : "text-gray-600 hover:text-gray-400 hover:bg-white/5"}
      `}
    >
      {pulse && checked && (
        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-current animate-ping opacity-60" />
      )}
      {icon}
      {label}
    </button>
  );
}

/** Mobile-overflow row: full label + Switch, comfortable 44px tap target. */
function ToggleRow({
  id, label, description, icon, checked, onChange, activeColor,
}: {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  activeColor: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`
        w-full flex items-center gap-3 px-3 rounded-lg cursor-pointer
        transition-colors duration-150 min-h-11
        ${checked ? "bg-white/5" : "hover:bg-white/5"}
      `}
    >
      <span className={checked ? activeColor : "text-zinc-400"}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span
          className={`block text-sm font-medium ${
            checked ? "text-zinc-100" : "text-zinc-200"
          }`}
        >
          {label}
        </span>
        {description && (
          <span className="block text-[11px] text-zinc-500 truncate">
            {description}
          </span>
        )}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
