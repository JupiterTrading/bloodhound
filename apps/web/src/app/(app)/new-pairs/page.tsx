"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { newPairsApi, type NewPair } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

type SourceFilter = "all" | "pump_fun" | "raydium" | "meteora" | "moonshot" | "bags" | "letsbonk" | "believe" | "boop" | "launchlab";
type SortField = "time" | "mcap" | "liquidity" | "volume" | "change";
type SortDir = "asc" | "desc";

const SOURCE_LABELS: Record<string, string> = {
  pump_fun: "Pump.fun",
  raydium: "Raydium",
  meteora: "Meteora",
  moonshot: "Moonshot",
  bags: "Bags.fm",
  letsbonk: "LetsBonk",
  believe: "Believe",
  boop: "Boop.fun",
  launchlab: "LaunchLab",
};

const SOURCE_COLORS: Record<string, string> = {
  pump_fun: "#f59e0b",
  raydium: "#8b5cf6",
  meteora: "#06b6d4",
  moonshot: "#ec4899",
  bags: "#10b981",
  letsbonk: "#facc15",
  believe: "#3b82f6",
  boop: "#f43f5e",
  launchlab: "#a855f7",
  dex: "#22c55e",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function shortMint(mint: string): string {
  if (!mint || mint.length < 8) return mint ?? "—";
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function formatPrice(n: number): string {
  if (!n || n === 0) return "$0";
  if (n < 0.00000001) return `$${n.toExponential(1)}`;
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatCompact(n: number): string {
  if (!n || n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export default function NewPairsPage() {
  const [source, setSource] = useState<SourceFilter>("all");
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showEnriched, setShowEnriched] = useState(true);

  const { data, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["new-pairs", source, showEnriched],
    queryFn: () =>
      newPairsApi.list({ 
        limit: 100, 
        enrich: showEnriched,
        ...(source !== "all" ? { source } : {}) 
      }),
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: false,
  });

  const pairs = useMemo(() => {
    const list = data?.pairs ?? [];
    return [...list].sort((a, b) => {
      let aVal = 0, bVal = 0;
      switch (sortField) {
        case "time":
          aVal = new Date(a.detected_at).getTime();
          bVal = new Date(b.detected_at).getTime();
          break;
        case "mcap":
          aVal = a.market?.market_cap ?? 0;
          bVal = b.market?.market_cap ?? 0;
          break;
        case "liquidity":
          aVal = a.market?.liquidity_usd ?? 0;
          bVal = b.market?.liquidity_usd ?? 0;
          break;
        case "volume":
          aVal = a.market?.volume_5m ?? 0;
          bVal = b.market?.volume_5m ?? 0;
          break;
        case "change":
          aVal = a.market?.price_change_5m ?? 0;
          bVal = b.market?.price_change_5m ?? 0;
          break;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data?.pairs, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", animation: "pulse 2s ease-in-out infinite", boxShadow: "0 0 8px #22c55e" }} />
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              New Pairs Scanner
            </h1>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "3px 8px", borderRadius: "4px" }}>
            {pairs.length} pairs
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showEnriched}
              onChange={(e) => setShowEnriched(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Live Data
          </label>
          <button
            onClick={() => refetch()}
            style={{ fontSize: "11px", color: "var(--text-muted)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
          {lastUpdated && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
              {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
        {/* Source tabs */}
        <div style={{ display: "flex", gap: "2px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "3px", flexWrap: "wrap" }}>
          {(["all", "pump_fun", "bags", "letsbonk", "believe", "boop", "launchlab", "raydium", "meteora", "moonshot"] as SourceFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: source === s ? 600 : 400,
                background: source === s ? "var(--bg-elevated)" : "transparent",
                color: source === s ? "var(--text-primary)" : "var(--text-muted)",
                fontFamily: "inherit",
                transition: "all 80ms",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              {s !== "all" && (
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SOURCE_COLORS[s] }} />
              )}
              {s === "all" ? "All" : SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px 180px 1fr 100px 100px 90px 80px 70px 100px",
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
            gap: "8px",
          }}
        >
          <span>Age</span>
          <span>Token</span>
          <span>Contract</span>
          <SortHeader label="Price" field="change" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortHeader label="MCap" field="mcap" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortHeader label="Liq" field="liquidity" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortHeader label="Vol 5m" field="volume" current={sortField} dir={sortDir} onClick={handleSort} />
          <span style={{ textAlign: "center" }}>Txns</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} height={48} borderRadius={6} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && pairs.length === 0 && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
              No pairs detected
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Monitors run in the background and populate this feed as tokens launch
            </div>
          </div>
        )}

        {/* Pair rows */}
        {!isLoading && pairs.map((pair, i) => (
          <PairRow key={`${pair.token_mint}-${i}`} pair={pair} index={i} />
        ))}
      </div>
    </div>
  );
}

function SortHeader({ 
  label, field, current, dir, onClick 
}: { 
  label: string; 
  field: SortField; 
  current: SortField; 
  dir: SortDir; 
  onClick: (f: SortField) => void 
}) {
  const isActive = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: "3px",
        textAlign: "right",
        justifyContent: "flex-end",
      }}
    >
      {label}
      {isActive && <span style={{ fontSize: "8px" }}>{dir === "desc" ? "▼" : "▲"}</span>}
    </button>
  );
}

function PairRow({ pair, index }: { pair: NewPair; index: number }) {
  const meta = pair.metadata ?? {};
  const market = pair.market;
  const symbol = meta.symbol || meta.name || "???";
  const sourceColor = SOURCE_COLORS[pair.source] || SOURCE_COLORS.dex;
  const priceChange = market?.price_change_5m ?? 0;
  const isPositive = priceChange >= 0;
  const txnsBuys = market?.txns_5m_buys ?? 0;
  const txnsSells = market?.txns_5m_sells ?? 0;
  const totalTxns = txnsBuys + txnsSells;

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(pair.token_mint);
  }, [pair.token_mint]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "50px 180px 1fr 100px 100px 90px 80px 70px 100px",
        padding: "10px 12px",
        borderBottom: "1px solid var(--border)",
        alignItems: "center",
        gap: "8px",
        transition: "background 60ms",
        background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}
    >
      {/* Age */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: sourceColor, flexShrink: 0 }} />
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-muted)" }}>
          {pair.detected_at ? timeAgo(pair.detected_at) : "—"}
        </span>
      </div>

      {/* Token info */}
      <div style={{ minWidth: 0 }}>
        <Link
          href={`/token/${pair.token_mint}`}
          style={{ textDecoration: "none", display: "block" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {meta.icon && (
              <img 
                src={meta.icon} 
                alt="" 
                style={{ width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {symbol}
            </span>
          </div>
        </Link>
        <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
          {pair.source === "pump_fun" ? "PUMP" : pair.source.toUpperCase()}
        </span>
      </div>

      {/* Contract address */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <Link
          href={`/token/${pair.token_mint}`}
          style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-secondary)", textDecoration: "none" }}
          title={pair.token_mint}
        >
          {shortMint(pair.token_mint)}
        </Link>
        <button
          onClick={copyAddress}
          style={{ background: "none", border: "none", padding: "2px", cursor: "pointer", color: "var(--text-muted)", fontSize: "10px" }}
          title="Copy address"
        >
          📋
        </button>
      </div>

      {/* Price + Change */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-primary)" }}>
          {market?.price_usd ? formatPrice(market.price_usd) : "—"}
        </div>
        {market?.price_change_5m !== undefined && (
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10px", color: isPositive ? "#22c55e" : "#ef4444" }}>
            {formatPct(priceChange)}
          </div>
        )}
      </div>

      {/* Market Cap */}
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-secondary)", textAlign: "right" }}>
        {market?.market_cap ? formatCompact(market.market_cap) : "—"}
      </div>

      {/* Liquidity */}
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-secondary)", textAlign: "right" }}>
        {market?.liquidity_usd ? formatCompact(market.liquidity_usd) : "—"}
      </div>

      {/* Volume 5m */}
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-secondary)", textAlign: "right" }}>
        {market?.volume_5m ? formatCompact(market.volume_5m) : "—"}
      </div>

      {/* Txns (buys/sells) */}
      <div style={{ textAlign: "center" }}>
        {totalTxns > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px", fontFamily: "JetBrains Mono, monospace", fontSize: "10px" }}>
            <span style={{ color: "#22c55e" }}>{txnsBuys}</span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <span style={{ color: "#ef4444" }}>{txnsSells}</span>
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
        <Link
          href={`/token/${pair.token_mint}`}
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: "var(--accent)",
            textDecoration: "none",
            padding: "4px 8px",
            border: "1px solid var(--accent)",
            borderRadius: "4px",
            transition: "all 80ms",
          }}
        >
          View
        </Link>
        <a
          href={`https://dexscreener.com/solana/${pair.token_mint}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: "var(--text-muted)",
            textDecoration: "none",
            padding: "4px 8px",
            border: "1px solid var(--border)",
            borderRadius: "4px",
          }}
        >
          DS
        </a>
      </div>
    </div>
  );
}
