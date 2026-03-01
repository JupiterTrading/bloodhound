"use client";

import { useQuery } from "@tanstack/react-query";

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

  // Slot is "synced" if we fetched it within the last 15 seconds
  const slotFresh = slotData && Date.now() - slotData.ts < 15_000;
  const indexerColor = slotFresh ? "#22c55e" : slotData ? "#f59e0b" : "var(--text-muted)";
  const indexerLabel = slotFresh ? "Indexer: synced" : slotData ? "Indexer: lagging" : "Indexer: connecting";

  const apiColor = apiOk === undefined ? "var(--text-muted)" : apiOk ? "#22c55e" : "#b30000";
  const apiLabel = apiOk === undefined ? "API: connecting" : apiOk ? "API: operational" : "API: degraded";

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "32px",
        background: "var(--bg-base)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: "24px",
        gap: "24px",
        zIndex: 100,
      }}
    >
      <StatusPill color="#22c55e" label="Mainnet" />
      <StatusPill color={indexerColor} label={indexerLabel} />
      <StatusPill color={apiColor} label={apiLabel} />
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          marginLeft: "auto",
        }}
      >
        {slotData ? `Slot #${slotData.slot.toLocaleString()}` : "Slot: connecting..."}
      </span>
    </footer>
  );
}

function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "11px",
        color: "var(--text-muted)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          animation: "pulse 2s infinite",
        }}
      />
      {label}
    </div>
  );
}
