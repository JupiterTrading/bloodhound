"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchSlot(): Promise<number> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
  });
  const json = await res.json() as { result: number };
  return json.result;
}

export function StatusBar() {
  const { data: slot } = useQuery({
    queryKey: ["solana-slot"],
    queryFn: fetchSlot,
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  });

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
      <StatusPill color="#22c55e" label="Indexer: synced" />
      <StatusPill color="#22c55e" label="API: operational" />
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          marginLeft: "auto",
        }}
      >
        {slot ? `Slot #${slot.toLocaleString()}` : "Slot: connecting..."}
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
