import { useQuery } from "@tanstack/react-query";

// Public-facing status shape. Deliberately omits underlying model names,
// token slot details, and the "206 models / 9 tokens" counts so that nothing
// in the UI reveals the meta-router architecture behind LITHOVEX.
export interface LithovexStatus {
  online: boolean;
  repo: { connected: boolean; login: string | null; name: string | null };
  failover: "armed" | "degraded" | "down";
}

async function fetchStatus(): Promise<LithovexStatus> {
  const res = await fetch("/api/status");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const raw = await res.json();
  return {
    online: !!raw.online,
    repo: raw.repo ?? { connected: false, login: null, name: null },
    failover: raw.failover ?? "armed",
  };
}

export function useLithovexStatus() {
  return useQuery({
    queryKey: ["lithovex-status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
