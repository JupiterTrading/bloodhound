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
    <section className="card overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-[var(--border)] flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
            Token Holdings
            {visibleHoldings.length > 0 && (
              <span className="ml-2 font-normal">({visibleHoldings.length})</span>
            )}
          </h2>
          {totalPortfolioUsd > 0 && (
            <span className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">
              ${totalPortfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {dustCount > 0 && (
          <button
            onClick={() => setShowDust(!showDust)}
            className={`border border-[var(--border)] rounded px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-all ${showDust ? 'bg-[var(--accent)] text-white' : 'bg-transparent text-[var(--text-muted)]'}`}
          >
            {showDust ? "Hide Dust" : `Show Dust (${dustCount})`}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-px bg-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-surface)] p-4">
              <Skeleton height={32} width={32} borderRadius={8} style={{ marginBottom: 8 }} />
              <Skeleton height={12} width="60%" style={{ marginBottom: 6 }} />
              <Skeleton height={14} width="80%" />
            </div>
          ))}
        </div>
      ) : allHoldings.length === 0 ? (
        <p className="px-5 py-6 text-[var(--text-muted)] text-[13px]">
          No token holdings found.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-px bg-[var(--border)]">
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
      className="bg-[var(--bg-surface)] p-4 flex flex-col gap-1 no-underline hover:bg-[var(--bg-elevated)] transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <TokenLogo uri={holding.logo_uri} symbol={holding.symbol} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
          {holding.symbol}
        </span>
      </div>

      <div className="font-mono text-[13px] text-[var(--text-primary)] font-medium">
        {formatAmount(holding.amount)}
      </div>

      {holding.usd_value != null && (
        <div className="font-mono text-[11px] text-[var(--text-muted)]">
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
        className="rounded-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)] shrink-0">
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
