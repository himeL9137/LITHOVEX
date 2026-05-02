import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// useKeySlots — live per-key health for the API Keys settings panel.
//
// Hits /api/status (same endpoint the public banner uses) but reads the
// `tokens.slots` array, which gives us per-slot status, lastUsed timestamp,
// and error/success counters. We derive `activeIndex` = the slot whose
// `lastUsed` is the most recent and within the last 60 seconds, so the UI
// can highlight whichever key the server is *actually* using right now —
// even when automatic failover swaps it under the hood.
// ─────────────────────────────────────────────────────────────────────────────

export type KeyStatus =
  | "active"
  | "rate_limited"
  | "cooling_down"
  | "expired"
  | "degraded";

export interface KeySlot {
  index: number;
  alias: string;
  status: KeyStatus;
  errorCount: number;
  successCount: number;
  lastUsed: number | null;
  lastError: string | null;
  cooldownRemainingMs: number | null;
  configured: boolean;
}

export type ProviderId = "huggingface" | "openrouter" | "gemini";

interface ProviderBlock {
  total?: number;
  max?: number;
  active?: number;
  rate_limited?: number;
  cooling_down?: number;
  degraded?: number;
  expired?: number;
  slots?: KeySlot[];
}

interface RawStatus {
  tokens?: {
    slots?: KeySlot[];
    providers?: Partial<Record<ProviderId, ProviderBlock>>;
  };
}

interface FetchedStatus {
  /** HuggingFace slots — kept for back-compat with the existing UI. */
  hfSlots: KeySlot[];
  /** Per-provider slots (huggingface / openrouter / gemini). */
  byProvider: Record<ProviderId, KeySlot[]>;
}

async function fetchStatus(): Promise<FetchedStatus> {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const raw = (await res.json()) as RawStatus;
  const hfSlots = Array.isArray(raw.tokens?.slots) ? raw.tokens!.slots! : [];
  const providers = raw.tokens?.providers ?? {};
  const byProvider: Record<ProviderId, KeySlot[]> = {
    huggingface: Array.isArray(providers.huggingface?.slots)
      ? providers.huggingface!.slots!
      : hfSlots,
    openrouter: Array.isArray(providers.openrouter?.slots)
      ? providers.openrouter!.slots!
      : [],
    gemini: Array.isArray(providers.gemini?.slots) ? providers.gemini!.slots! : [],
  };
  return { hfSlots, byProvider };
}

const ACTIVE_WINDOW_MS = 60_000;

export interface UseKeySlotsResult {
  /** HuggingFace slots — back-compat field used by existing UI bits. */
  slots: KeySlot[];
  /** All slots grouped by provider. */
  byProvider: Record<ProviderId, KeySlot[]>;
  /**
   * HuggingFace slot index currently in active use (most recent lastUsed
   * within 60s). Back-compat field — prefer `activeByProvider` for new UI.
   */
  activeIndex: number | null;
  /** Per-provider "currently-in-use" slot index. */
  activeByProvider: Record<ProviderId, number | null>;
  /** Tick that re-renders consumers every second so "Xs ago" stays fresh. */
  now: number;
  isLoading: boolean;
  isError: boolean;
}

function pickActiveIndex(slots: KeySlot[], now: number): number | null {
  let best: KeySlot | null = null;
  for (const s of slots) {
    if (!s.configured || s.lastUsed == null) continue;
    if (now - s.lastUsed > ACTIVE_WINDOW_MS) continue;
    if (!best || (s.lastUsed ?? 0) > (best.lastUsed ?? 0)) best = s;
  }
  return best ? best.index : null;
}

const EMPTY_BY_PROVIDER: Record<ProviderId, KeySlot[]> = {
  huggingface: [],
  openrouter: [],
  gemini: [],
};

export function useKeySlots(enabled = true): UseKeySlotsResult {
  const query = useQuery({
    queryKey: ["lithovex-key-slots"],
    queryFn: fetchStatus,
    enabled,
    refetchInterval: enabled ? 3_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 1_500,
    retry: 1,
  });

  // Re-render every second while enabled so the "last used Xs ago" label
  // and the "Currently in use" highlight (which expires after 60s of no
  // activity) stay in sync without needing a server round-trip.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  const data = query.data;
  const slots = data?.hfSlots ?? [];
  const byProvider = data?.byProvider ?? EMPTY_BY_PROVIDER;

  const activeIndex = useMemo<number | null>(
    () => pickActiveIndex(slots, now),
    [slots, now],
  );
  const activeByProvider = useMemo<Record<ProviderId, number | null>>(
    () => ({
      huggingface: pickActiveIndex(byProvider.huggingface, now),
      openrouter: pickActiveIndex(byProvider.openrouter, now),
      gemini: pickActiveIndex(byProvider.gemini, now),
    }),
    [byProvider, now],
  );

  return {
    slots,
    byProvider,
    activeIndex,
    activeByProvider,
    now,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// Helper: turn a timestamp into a short "12s ago" / "3m ago" / "—" label.
export function formatAgo(ts: number | null, now: number): string {
  if (ts == null) return "Never used";
  const diff = Math.max(0, now - ts);
  if (diff < 1_500) return "just now";
  const sec = Math.floor(diff / 1_000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export interface KeyStatusStyle {
  label: string;
  /** Tailwind class for the small dot. */
  dot: string;
  /** Tailwind class for the text color. */
  text: string;
}

export function describeStatus(slot: KeySlot | undefined): KeyStatusStyle {
  if (!slot || !slot.configured) {
    return {
      label: "Not configured",
      dot: "bg-zinc-600",
      text: "text-zinc-500",
    };
  }
  switch (slot.status) {
    case "active":
      return {
        label: "Active",
        dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
        text: "text-emerald-400",
      };
    case "rate_limited":
      return {
        label: "Rate limited",
        dot: "bg-amber-500",
        text: "text-amber-400",
      };
    case "cooling_down":
      return {
        label: "Cooling down",
        dot: "bg-sky-500",
        text: "text-sky-400",
      };
    case "degraded":
      return {
        label: "Degraded",
        dot: "bg-orange-500",
        text: "text-orange-400",
      };
    case "expired":
      return {
        label: "Expired",
        dot: "bg-red-500",
        text: "text-red-400",
      };
    default:
      return { label: slot.status, dot: "bg-zinc-500", text: "text-zinc-400" };
  }
}
