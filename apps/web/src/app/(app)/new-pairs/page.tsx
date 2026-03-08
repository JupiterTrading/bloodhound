"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { newPairsApi, type NewPair } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

type SourceFilter = "all" | "pump_fun" | "dex";

const SOURCE_LABELS: Record<string, string> = {
  pump_fun: "Pump.fun",
  dex: "Raydium / DEX",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function shortMint(mint: string): string {
  if (!mint || mint.length < 8) return mint ?? "—";
  return `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export default function NewPairsPage() {
  const [source, setSource] = useState<SourceFilter>("all");

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["new-pairs", source],
    queryFn: () =>
      newPairsApi.list({ limit: 100, ...(source !== "all" ? { source } : {}) }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const pairs = data?.pairs ?? [];
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s ease-in-out infinite",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <h1
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              New Pairs
            </h1>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Live feed of newly launched Solana tokens — Pump.fun + Raydium DEX
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastUpdated && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Source filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "4px",
          width: "fit-content",
        }}
      >
        {(["all", "pump_fun", "dex"] as SourceFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            style={{
              padding: "5px 14px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: source === s ? 600 : 400,
              background: source === s ? "var(--bg-elevated)" : "transparent",
              color: source === s ? "var(--text-primary)" : "var(--text-muted)",
              fontFamily: "inherit",
              transition: "background 80ms, color 80ms",
              whiteSpace: "nowrap",
            }}
          >
            {s === "all" ? "All" : SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="table-scroll"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Column header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 120px 90px 80px",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
          }}
        >
          <span>Source</span>
          <span>Token</span>
          <span>Mint</span>
          <span>Detected</span>
          <span style={{ textAlign: "right" }}>Links</span>
        </div>

        {isLoading && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} height={36} borderRadius={4} />
            ))}
          </div>
        )}

        {!isLoading && pairs.length === 0 && (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            No new pairs detected yet — monitors run in the background and populate this feed as tokens launch.
          </div>
        )}

        {!isLoading && pairs.map((pair, i) => (
          <PairRow key={`${pair.token_mint}-${i}`} pair={pair} />
        ))}
      </div>

      {!isLoading && pairs.length > 0 && (
        <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
          {pairs.length} tokens detected · refreshes every 30s
        </div>
      )}
    </div>
  );
}

function PairRow({ pair }: { pair: NewPair }) {
  const meta = pair.metadata ?? {};
  const symbol = meta.symbol || meta.name || null;
  const isPump = pair.source === "pump_fun";
  const dexUrl = meta.dexscreener_url || null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 120px 90px 80px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        alignItems: "center",
        gap: "8px",
        transition: "background 60ms",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
    >
      {/* Source badge */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isPump ? "#f59e0b" : "var(--text-secondary)",
        }}
      >
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: isPump ? "#f59e0b" : "#22c55e",
            flexShrink: 0,
          }}
        />
        {isPump ? "Pump.fun" : "DEX"}
      </span>

      {/* Token name/description */}
      <div style={{ minWidth: 0 }}>
        {symbol ? (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {symbol}
          </span>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
        )}
        {meta.description && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meta.description.slice(0, 60)}
          </span>
        )}
      </div>

      {/* Mint (clickable → token page) */}
      <Link
        href={pair.token_mint ? `/token/${pair.token_mint}` : "#"}
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: pair.token_mint ? "var(--text-secondary)" : "var(--text-muted)",
          textDecoration: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "block",
        }}
        title={pair.token_mint}
      >
        {shortMint(pair.token_mint)}
      </Link>

      {/* Time */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {pair.detected_at ? timeAgo(pair.detected_at) : "—"}
      </span>

      {/* Links */}
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
        {pair.token_mint && (
          <Link
            href={`/token/${pair.token_mint}`}
            style={{
              fontSize: "11px",
              color: "var(--accent)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              padding: "2px 6px",
              border: "1px solid var(--accent)",
              borderRadius: "4px",
            }}
          >
            View
          </Link>
        )}
        {dexUrl && (
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              padding: "2px 6px",
              border: "1px solid var(--border)",
              borderRadius: "4px",
            }}
          >
            DS ↗
          </a>
        )}
      </div>
    </div>
  );
}
