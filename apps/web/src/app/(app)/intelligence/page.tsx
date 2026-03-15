"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  trendingApi,
  newPairsApi,
  kolApi,
  type TrendingToken,
  type NewPair,
  type KolRanking,
} from "@/lib/api";

export default function LiveFeedPage() {
  const [activePanel, setActivePanel] = useState<"launches" | "trending" | "kols">("launches");
  const feedRef = useRef<HTMLDivElement>(null);

  const { data: pairsData, isLoading: pairsLoading } = useQuery({
    queryKey: ["live-pairs"],
    queryFn: () => newPairsApi.list({ limit: 30, enrich: true }),
    refetchInterval: 8000,
    staleTime: 5000,
  });

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["live-trending"],
    queryFn: () => trendingApi.tokens(12),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: kolData, isLoading: kolLoading } = useQuery({
    queryKey: ["live-kols"],
    queryFn: () => kolApi.rankings({ period: "daily", limit: 10, sort_by: "pnl" }),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const pairs = pairsData?.pairs ?? [];
  const trending = trendingData?.tokens ?? [];
  const kols = kolData?.rankings ?? [];

  return (
    <div className="page-container py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-3">
            <span className="status-dot status-dot-live" />
            Live Feed
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1 font-mono uppercase tracking-wider">
            Real-time market intelligence
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-faint)]">
          <span className="status-dot status-dot-live" />
          {pairs.length} signals
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg w-fit mb-6">
        {([
          { id: "launches" as const, label: "New Launches", count: pairs.length },
          { id: "trending" as const, label: "Trending", count: trending.length },
          { id: "kols" as const, label: "Top KOLs", count: kols.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activePanel === tab.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-[10px] opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      <div ref={feedRef} className="card overflow-hidden">
        {activePanel === "launches" && <LaunchFeed pairs={pairs} isLoading={pairsLoading} />}
        {activePanel === "trending" && <TrendingFeed tokens={trending} isLoading={trendingLoading} />}
        {activePanel === "kols" && <KolFeed kols={kols} isLoading={kolLoading} />}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function LaunchFeed({ pairs, isLoading }: { pairs: NewPair[]; isLoading: boolean }) {
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const prevCountRef = useRef(pairs.length);

  useEffect(() => {
    if (pairs.length > prevCountRef.current) {
      setHighlightIdx(0);
      const t = setTimeout(() => setHighlightIdx(-1), 1500);
      prevCountRef.current = pairs.length;
      return () => clearTimeout(t);
    }
    prevCountRef.current = pairs.length;
  }, [pairs.length]);

  return (
    <>
      <div className="grid grid-cols-[1fr_90px_90px_80px] gap-4 px-4 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
        <div>Token</div>
        <div className="text-right">Source</div>
        <div className="text-right">Price</div>
        <div className="text-right">Time</div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)] max-h-[600px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[52px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.08 }} />
          ))
        ) : pairs.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
            Waiting for new launches...
          </div>
        ) : (
          pairs.map((pair, i) => {
            const isNew = i === highlightIdx;
            const symbol = pair.metadata?.symbol || "???";
            const name = pair.metadata?.name || "";
            const price = pair.market?.price_usd;
            const source = pair.source === "pump_fun" ? "Pump.fun" : pair.source === "dex" ? "DEX" : pair.source;
            return (
              <Link
                key={pair.token_mint + i}
                href={`/token/${pair.token_mint}`}
                className={`grid grid-cols-[1fr_90px_90px_80px] gap-4 px-4 py-3 items-center transition-all hover:bg-[var(--bg-hover)] group ${
                  isNew ? "animate-data-flash-green" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)] shrink-0">
                    {symbol.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      ${symbol}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{name}</div>
                  </div>
                  {isNew && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-[var(--success-subtle)] text-[var(--success)] rounded animate-pulse-glow">
                      NEW
                    </span>
                  )}
                </div>
                <div className="text-right text-[11px] font-mono text-[var(--text-muted)]">{source}</div>
                <div className="text-right text-[12px] font-mono font-medium text-[var(--text-primary)]">
                  {price ? formatUsd(price) : "\u2014"}
                </div>
                <div className="text-right text-[10px] font-mono text-[var(--text-faint)]">
                  {timeAgo(pair.detected_at)}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}

function TrendingFeed({ tokens, isLoading }: { tokens: TrendingToken[]; isLoading: boolean }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_90px_90px_100px] gap-4 px-4 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
        <div>Token</div>
        <div className="text-right">Price</div>
        <div className="text-right">24h</div>
        <div className="text-right">Volume</div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[52px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.1 }} />
          ))
        ) : tokens.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">No trending data</div>
        ) : (
          tokens.map((token) => {
            const isPositive = token.price_change_pct >= 0;
            return (
              <Link
                key={token.mint}
                href={`/token/${token.mint}`}
                className="grid grid-cols-[1fr_90px_90px_100px] gap-4 px-4 py-3 items-center hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {token.logo_uri ? (
                    <img src={token.logo_uri} alt={token.symbol} className="w-8 h-8 rounded-full border border-[var(--border)]" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)]">
                      {(token.symbol || "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {token.symbol || "\u2014"}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{token.name}</div>
                  </div>
                </div>
                <div className="text-right text-[12px] font-mono font-medium text-[var(--text-primary)]">
                  {formatUsd(token.price_usd)}
                </div>
                <div className={`text-right text-[12px] font-mono font-semibold ${isPositive ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                  {isPositive ? "+" : ""}{token.price_change_pct.toFixed(1)}%
                </div>
                <div className="text-right text-[12px] font-mono text-[var(--text-muted)]">
                  {formatUsd(token.volume_24h_usd)}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}

function KolFeed({ kols, isLoading }: { kols: KolRanking[]; isLoading: boolean }) {
  return (
    <>
      <div className="grid grid-cols-[40px_1fr_100px_80px_80px] gap-4 px-4 py-3 bg-[var(--bg-elevated)] border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
        <div>#</div>
        <div>Trader</div>
        <div className="text-right">PnL</div>
        <div className="text-right">Win Rate</div>
        <div className="text-right">ROI</div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[56px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.1 }} />
          ))
        ) : kols.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">No KOL data</div>
        ) : (
          kols.map((kol, i) => {
            const rank = i + 1;
            const isProfitable = kol.pnl_usd >= 0;
            const rankColors = ["text-[#FFD700]", "text-[#C0C0C0]", "text-[#CD7F32]"];
            const rankClass = rank <= 3 ? rankColors[rank - 1] : "text-[var(--text-muted)]";
            return (
              <Link
                key={kol.profile.id}
                href={`/kols/${kol.profile.twitter_handle || kol.profile.id}`}
                className="grid grid-cols-[40px_1fr_100px_80px_80px] gap-4 px-4 py-3 items-center hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <div className={`text-sm font-bold ${rankClass}`}>
                  {rank <= 3 ? ["1st", "2nd", "3rd"][rank - 1] : `#${rank}`}
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  {kol.profile.twitter_pfp_url ? (
                    <img
                      src={kol.profile.twitter_pfp_url}
                      alt={kol.profile.display_name}
                      className="w-9 h-9 rounded-full border-2 border-[var(--border)] group-hover:border-[var(--accent)] transition-colors object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] border-2 border-[var(--border)] flex items-center justify-center text-white text-sm font-bold">
                      {kol.profile.display_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                      {kol.profile.display_name}
                    </div>
                    {kol.profile.twitter_handle && (
                      <div className="text-[10px] text-[var(--text-muted)] truncate font-mono">@{kol.profile.twitter_handle}</div>
                    )}
                  </div>
                </div>
                <div className={`text-right text-sm font-mono font-bold ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                  {isProfitable ? "+" : ""}{formatUsd(kol.pnl_usd)}
                </div>
                <div className="text-right text-sm font-mono text-[var(--text-primary)]">
                  {kol.win_rate > 0 ? `${kol.win_rate.toFixed(1)}%` : "\u2014"}
                </div>
                <div className={`text-right text-sm font-mono ${(kol.roi ?? 0) >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                  {kol.roi ? `${kol.roi.toFixed(1)}%` : "\u2014"}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
