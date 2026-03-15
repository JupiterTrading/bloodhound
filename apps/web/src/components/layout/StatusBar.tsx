"use client";

import { useQuery } from "@tanstack/react-query";

type StatusType = "success" | "warning" | "error" | "muted";

async function fetchSlot(): Promise<{ slot: number; ts: number }> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
  });
  const json = (await res.json()) as { result: number };
  return { slot: json.result, ts: Date.now() };
}

async function fetchApiHealth(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export function StatusBar() {
  const { data: slotData } = useQuery({
    queryKey: ["solana-slot"],
    queryFn: fetchSlot,
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

  const { data: apiOk } = useQuery({
    queryKey: ["api-health"],
    queryFn: fetchApiHealth,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const slotFresh = slotData && Date.now() - slotData.ts < 15_000;
  const indexerStatus: StatusType = slotFresh ? "success" : slotData ? "warning" : "muted";
  const indexerLabel = slotFresh ? "Indexer: synced" : slotData ? "Indexer: lagging" : "Indexer: connecting";

  const apiStatus: StatusType = apiOk === undefined ? "muted" : apiOk ? "success" : "error";
  const apiLabel = apiOk === undefined ? "API: connecting" : apiOk ? "API: operational" : "API: degraded";

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 bg-[var(--bg-base)] border-t border-[var(--border)] flex items-center px-6 gap-6 z-[100]">
      <StatusPill status="success" label="Mainnet" />
      <StatusPill status={indexerStatus} label={indexerLabel} />
      <StatusPill status={apiStatus} label={apiLabel} />
      <span className="font-mono text-[11px] text-[var(--text-muted)] ml-auto">
        {slotData?.slot != null ? `Slot #${slotData.slot.toLocaleString()}` : "Slot: connecting..."}
      </span>
    </footer>
  );
}

function StatusPill({ status, label }: { status: StatusType; label: string }) {
  const dotClass = {
    success: "status-dot-live",
    warning: "status-dot-warning",
    error: "status-dot-error",
    muted: "status-dot-muted",
  }[status];

  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
      <span className={`status-dot ${dotClass}`} />
      {label}
    </div>
  );
}
