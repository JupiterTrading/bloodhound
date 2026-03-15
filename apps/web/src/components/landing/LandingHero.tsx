"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { kolFeedApi, newPairsApi, signalsApi, trendingApi, type KolTrade, type NewPair, type Signal, type TrendingToken } from "@/lib/api";

// Feed tabs configuration
const FEED_TABS = [
  { id: "kol", label: "KOL Activity", icon: "👤" },
  { id: "pairs", label: "New Pairs", icon: "🪙" },
  { id: "signals", label: "Signals", icon: "⚡" },
  { id: "trending", label: "Trending", icon: "📈" },
] as const;

type FeedTab = typeof FEED_TABS[number]["id"];

interface KolRow {
  label: string;
  action: string;
  amount: string;
  token: string;
  dex: string;
  time: string;
  type: string;
  pfp?: string;
}

// Fallback data - only shown while real data loads
const FALLBACK_KOL: KolRow[] = [];

// Empty fallbacks - show loading states instead of fake data
const FALLBACK_PAIRS: never[] = [];
const FALLBACK_SIGNALS: never[] = [];
const FALLBACK_TRENDING: never[] = [];

const DEX_LABELS: Record<string, string> = {
  raydium: "Raydium",
  pump_fun: "Pump.fun",
  jupiter_agg: "Jupiter",
  orca: "Orca",
  meteora: "Meteora",
};

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}

function tradeToRow(t: KolTrade) {
  return {
    label: t.kol_label ?? `${t.trader.slice(0, 4)}…${t.trader.slice(-4)}`,
    action: t.direction === "buy" ? "bought" : "sold",
    amount: formatUsd(t.amount_usd),
    token: t.token_out_mint?.slice(0, 4) ?? "TOKEN",
    dex: DEX_LABELS[t.dex] ?? t.dex ?? "DEX",
    time: timeAgo(t.block_time),
    type: t.direction,
  };
}

export function LandingHero() {
  return (
    <section className="min-h-screen pt-14 flex flex-col justify-center relative">
      {/* Centered content */}
      <div className="landing-hero-grid container grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center py-10 lg:py-16 relative z-10">
        {/* Left: headline + CTAs */}
        <div className="animate-fade-up">
          {/* Terminal-style header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
              </span>
              <span className="font-mono text-[11px] text-[var(--accent)] font-medium">
                LIVE
              </span>
            </div>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              Solana Mainnet
            </span>
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-extrabold tracking-tight leading-[1.05] mb-6">
            <span className="text-[var(--text-primary)]">On-Chain </span>
            <span className="text-[var(--accent)]">
              Intelligence
            </span>
            <br />
            <span className="text-[var(--text-primary)]">for Solana.</span>
          </h1>

          <p className="text-[16px] leading-relaxed text-[var(--text-secondary)] mb-8 max-w-[420px]">
            Track wallets. Map relationships. Follow the money. 
            <span className="text-[var(--text-primary)] font-medium"> The intelligence layer</span> Solana traders actually need.
          </p>

          <div className="flex gap-3 flex-wrap mb-10">
            <Link
              href="/explorer"
              className="btn btn-primary btn-lg group"
            >
              Launch App
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              Read Docs
            </Link>
          </div>

          {/* Trust indicators - terminal style */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
            <div className="text-center">
              <div className="font-mono text-xl font-bold text-[var(--accent)]">100K+</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Wallets</div>
            </div>
            <div className="text-center border-x border-[var(--border)]">
              <div className="font-mono text-xl font-bold text-[var(--accent)]">5M+</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Transactions</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-xl font-bold text-[var(--accent)]">&lt;50ms</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Latency</div>
            </div>
          </div>
        </div>

        {/* Right: Multi-tab live intelligence feed */}
        <div className="animate-fade-up stagger-2">
          <LiveIntelligenceFeed />
        </div>
      </div>
    </section>
  );
}

function LiveIntelligenceFeed() {
  const [activeTab, setActiveTab] = useState<FeedTab>("kol");

  const { data: kolData } = useQuery({
    queryKey: ["kol-feed-hero"],
    queryFn: () => kolFeedApi.feed({ limit: 20, min_usd: 1000 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: pairsData } = useQuery({
    queryKey: ["new-pairs-hero"],
    queryFn: () => newPairsApi.list({ limit: 10, enrich: true }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: signalsData } = useQuery({
    queryKey: ["signals-hero"],
    queryFn: () => signalsApi.feed({ limit: 10 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: trendingData } = useQuery({
    queryKey: ["trending-hero"],
    queryFn: () => trendingApi.tokens(10),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const kolRows = kolData?.trades?.length
    ? kolData.trades.map(tradeToRow)
    : FALLBACK_KOL;

  return (
    <div className="card overflow-hidden relative border-[var(--accent-muted)] animate-terminal-glow" style={{ minHeight: "420px" }}>
      {/* Header with tabs */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        {/* Title bar */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
            </span>
            <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Live Intelligence
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            STREAMING
          </span>
        </div>

        {/* Tab buttons */}
        <div className="flex">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--bg-surface)]"
                  : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      <div className="h-[320px] overflow-hidden relative">
        {/* Fade overlays */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[var(--bg-surface)] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--bg-surface)] to-transparent z-10 pointer-events-none" />

        <div className="h-full overflow-y-auto scrollbar-none">
          {activeTab === "kol" && <KolFeedContent rows={kolRows} />}
          {activeTab === "pairs" && <PairsFeedContent data={pairsData?.pairs} />}
          {activeTab === "signals" && <SignalsFeedContent data={signalsData?.signals} />}
          {activeTab === "trending" && <TrendingFeedContent data={trendingData?.tokens} />}
        </div>
      </div>
    </div>
  );
}

// KOL Activity Feed
function KolFeedContent({ rows }: { rows: KolRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <div className="animate-pulse mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <span className="text-[var(--accent)]">📡</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">Connecting to live feed...</p>
        <p className="text-[10px] text-[var(--text-faint)] mt-1">Real KOL trades will appear here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center px-4 py-2.5 gap-3 text-[12px] hover:bg-[var(--bg-hover)] transition-colors">
          {row.pfp && (
            <img src={row.pfp} alt="" className="w-6 h-6 rounded-full shrink-0" />
          )}
          <span className="font-medium text-[var(--text-primary)] min-w-[70px] truncate">
            {row.label}
          </span>
          <span className={`text-[11px] ${row.type === "buy" ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {row.action}
          </span>
          <span className={`font-mono font-semibold ${row.type === "buy" ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {row.amount}
          </span>
          <span className="text-[var(--text-muted)] text-[11px]">{row.token}</span>
          <span className="text-[10px] text-[var(--text-faint)] ml-auto">{row.dex}</span>
          <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 text-right">{row.time}</span>
        </div>
      ))}
    </div>
  );
}

// New Pairs Feed
function PairsFeedContent({ data }: { data?: NewPair[] }) {
  const pairs = data?.length ? data.map(p => ({
    symbol: p.metadata?.symbol ?? "???",
    name: p.metadata?.name ?? "Unknown",
    mc: p.market?.market_cap ? formatUsd(p.market.market_cap) : "N/A",
    change: p.market?.price_change_5m ? `${p.market.price_change_5m > 0 ? "+" : ""}${p.market.price_change_5m.toFixed(0)}%` : "N/A",
    time: timeAgo(p.detected_at),
    source: p.source,
  })) : [];

  if (!pairs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <div className="animate-pulse mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <span className="text-[var(--accent)]">🪙</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">Scanning for new pairs...</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center px-4 py-2.5 gap-3 text-[12px] hover:bg-[var(--bg-hover)] transition-colors">
          <span className="font-mono font-bold text-[var(--accent)] min-w-[60px]">{pair.symbol}</span>
          <span className="text-[var(--text-secondary)] truncate max-w-[80px]">{pair.name}</span>
          <span className="font-mono text-[var(--text-primary)] font-medium">{pair.mc}</span>
          <span className={`font-mono text-[11px] font-semibold ${pair.change.startsWith("+") ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {pair.change}
          </span>
          <span className="text-[10px] text-[var(--text-faint)] ml-auto">{pair.source}</span>
          <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 text-right">{pair.time}</span>
        </div>
      ))}
    </div>
  );
}

// Signals Feed
function SignalsFeedContent({ data }: { data?: Signal[] }) {
  const signals = data?.length ? data.map(s => ({
    type: s.signal_type,
    wallet: (s.metadata?.wallet_label as string) ?? s.wallet_address.slice(0, 8),
    desc: (s.metadata?.description as string) ?? s.signal_type,
    confidence: s.confidence === "CONFIRMED" ? "HIGH" : s.confidence === "PROBABLE" ? "MED" : "LOW",
    time: timeAgo(s.detected_at),
  })) : [];

  if (!signals.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <div className="animate-pulse mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <span className="text-[var(--accent)]">⚡</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">Monitoring for signals...</p>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    WHALE_ALERT: "text-[var(--accent)]",
    INSIDER: "text-[var(--warning)]",
    BUNDLE: "text-[var(--error)]",
    SMART_MONEY: "text-[var(--success)]",
  };

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {signals.map((signal, i) => (
        <div key={i} className="flex items-center px-4 py-2.5 gap-3 text-[12px] hover:bg-[var(--bg-hover)] transition-colors">
          <span className={`font-mono text-[10px] font-bold uppercase ${typeColors[signal.type] ?? "text-[var(--text-muted)]"}`}>
            {signal.type.replace("_", " ")}
          </span>
          <span className="text-[var(--text-primary)] font-medium truncate max-w-[70px]">{signal.wallet}</span>
          <span className="text-[var(--text-muted)] truncate flex-1">{signal.desc}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            signal.confidence === "HIGH" ? "bg-[var(--success-subtle)] text-[var(--success)]" :
            signal.confidence === "MED" ? "bg-[var(--warning-subtle)] text-[var(--warning)]" :
            "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          }`}>
            {signal.confidence}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 text-right">{signal.time}</span>
        </div>
      ))}
    </div>
  );
}

// Trending Tokens Feed
function TrendingFeedContent({ data }: { data?: TrendingToken[] }) {
  const tokens = data?.length ? data.map(t => ({
    symbol: t.symbol,
    name: t.name,
    price: `$${t.price_usd < 0.01 ? t.price_usd.toFixed(6) : t.price_usd.toFixed(2)}`,
    change: `${t.price_change_pct >= 0 ? "+" : ""}${t.price_change_pct.toFixed(1)}%`,
    volume: formatUsd(t.volume_24h_usd),
  })) : [];

  if (!tokens.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center">
        <div className="animate-pulse mb-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <span className="text-[var(--accent)]">📈</span>
          </div>
        </div>
        <p className="text-[12px] text-[var(--text-muted)]">Loading trending tokens...</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {tokens.map((token, i) => (
        <div key={i} className="flex items-center px-4 py-2.5 gap-3 text-[12px] hover:bg-[var(--bg-hover)] transition-colors">
          <span className="font-mono text-[11px] text-[var(--text-faint)] w-4">#{i + 1}</span>
          <span className="font-bold text-[var(--text-primary)] min-w-[50px]">{token.symbol}</span>
          <span className="text-[var(--text-muted)] truncate max-w-[70px]">{token.name}</span>
          <span className="font-mono text-[var(--text-primary)] ml-auto">{token.price}</span>
          <span className={`font-mono text-[11px] font-semibold min-w-[50px] text-right ${
            token.change.startsWith("+") ? "text-[var(--success)]" : "text-[var(--error)]"
          }`}>
            {token.change}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-faint)] min-w-[45px] text-right">{token.volume}</span>
        </div>
      ))}
    </div>
  );
}
