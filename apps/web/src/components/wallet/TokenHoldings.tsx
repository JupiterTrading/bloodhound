"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { walletApi, type TokenHolding } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

const DUST_THRESHOLD = 2; // Hide tokens worth less than $2 by default

interface Props {
  address: string;
}

export function TokenHoldings({ address }: Props) {
  const [showDust, setShowDust] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "holdings", address],
    queryFn: () => walletApi.holdings(address),
    staleTime: 60_000,
  });

  // Deduplicate by mint address (combine amounts if same token appears twice)
  const deduped = (data?.holdings ?? []).reduce((acc, h) => {
    const existing = acc.get(h.mint);
    if (existing) {
      existing.amount += h.amount;
      existing.usd_value = (existing.usd_value ?? 0) + (h.usd_value ?? 0);
    } else {
      acc.set(h.mint, { ...h });
    }
    return acc;
  }, new Map<string, TokenHolding>());

  const allHoldings = Array.from(deduped.values()).sort(
    (a, b) => (b.usd_value ?? 0) - (a.usd_value ?? 0)
  );

  const totalPortfolioUsd = allHoldings.reduce(
    (sum, h) => sum + (h.usd_value ?? 0),
    0
  );

  const visibleHoldings = showDust
    ? allHoldings
    : allHoldings.filter((h) => (h.usd_value ?? 0) >= DUST_THRESHOLD);

  const dustCount = allHoldings.length - visibleHoldings.length;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h2
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Token Holdings
            {visibleHoldings.length > 0 && (
              <span style={{ marginLeft: "8px", fontWeight: 400 }}>
                ({visibleHoldings.length})
              </span>
            )}
          </h2>
          {totalPortfolioUsd > 0 && (
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              ${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {dustCount > 0 && (
          <button
            onClick={() => setShowDust(!showDust)}
            style={{
              background: showDust ? "var(--accent)" : "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 500,
              color: showDust ? "white" : "var(--text-muted)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {showDust ? "Hide Dust" : `Show Dust (${dustCount})`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1px",
            background: "var(--border)",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: "var(--bg-surface)", padding: "16px" }}>
              <Skeleton height={32} width={32} borderRadius={8} style={{ marginBottom: 8 }} />
              <Skeleton height={12} width="60%" style={{ marginBottom: 6 }} />
              <Skeleton height={14} width="80%" />
            </div>
          ))}
        </div>
      ) : allHoldings.length === 0 ? (
        <p
          style={{
            padding: "24px 20px",
            color: "var(--text-muted)",
            fontSize: "13px",
            margin: 0,
          }}
        >
          No token holdings found.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "1px",
            background: "var(--border)",
          }}
        >
          {visibleHoldings.map((h) => (
            <TokenCard key={h.mint} holding={h} />
          ))}
        </div>
      )}
    </section>
  );
}

function TokenCard({ holding }: { holding: TokenHolding }) {
  return (
    <Link
      href={`/token/${holding.mint}`}
      style={{
        background: "var(--bg-surface)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        textDecoration: "none",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
    >
      {/* Logo + symbol */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "4px",
        }}
      >
        <TokenLogo uri={holding.logo_uri} symbol={holding.symbol} />
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {holding.symbol}
        </span>
      </div>

      {/* Amount */}
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "13px",
          color: "var(--text-primary)",
          fontWeight: 500,
        }}
      >
        {formatAmount(holding.amount)}
      </div>

      {/* USD value */}
      {holding.usd_value != null && (
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          ${holding.usd_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}
    </Link>
  );
}

function TokenLogo({ uri, symbol }: { uri: string | null; symbol: string }) {
  if (uri) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={uri}
        alt={symbol}
        width={28}
        height={28}
        style={{ borderRadius: "50%", objectFit: "cover" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontWeight: 700,
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(n < 1 ? 6 : 4);
}
