"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { tokenApi, kolFeedApi, type TokenSummary, type TokenHolder, type TopTrader, type SmartMoneyKol, type DexInfo } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TokenPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["token", mint, "summary"],
    queryFn: () => tokenApi.summary(mint),
    staleTime: 60_000,
  });

  const { data: dexInfo } = useQuery({
    queryKey: ["token", mint, "dex-info"],
    queryFn: () => tokenApi.dexInfo(mint),
    staleTime: 120_000,
  });

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <TokenHeader mint={mint} summary={summary} dexInfo={dexInfo} isLoading={isLoading} />
      <TokenStatsGrid summary={summary} isLoading={isLoading} />
      <PriceChart mint={mint} pairAddress={summary?.pair_address} />
      <SmartMoneyPanel mint={mint} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <HoldersPanel mint={mint} />
        <TopTradersPanel mint={mint} />
      </div>
    </div>
  );
}

// ── Price chart (GeckoTerminal embed) ────────────────────────────────────────

function PriceChart({ mint, pairAddress }: { mint: string; pairAddress: string | null | undefined }) {
  const embedUrl = pairAddress
    ? `https://www.geckoterminal.com/solana/pools/${pairAddress}?embed=1&info=0&swaps=0`
    : null;

  return (
    <div className="card overflow-hidden mt-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          Price History
        </span>
        {pairAddress && (
          <a
            href={`https://www.geckoterminal.com/solana/pools/${pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[var(--text-muted)] no-underline hover:text-[var(--text-secondary)] transition-colors"
          >
            GeckoTerminal ↗
          </a>
        )}
      </div>

      <div className="h-[400px]">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full border-none block"
            title="Price Chart"
            allow="clipboard-write"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <span className="text-[13px] text-[var(--text-muted)]">
              Chart not yet available
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Token may be too new or not yet listed on GeckoTerminal
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Token header ──────────────────────────────────────────────────────────────

function TokenHeader({
  mint,
  summary,
  dexInfo,
  isLoading,
}: {
  mint: string;
  summary: TokenSummary | undefined;
  dexInfo: DexInfo | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Logo */}
      {isLoading ? (
        <div className="w-11 h-11 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] shrink-0" />
      ) : summary?.logo_uri ? (
        <img
          src={summary.logo_uri}
          alt={summary.symbol ?? ""}
          width={44}
          height={44}
          className="rounded-full border border-[var(--border)] shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-lg text-[var(--text-muted)] shrink-0">
          ◈
        </div>
      )}

      {/* Name / symbol */}
      <div className="flex-1 min-w-0">
        {isLoading ? (
          <>
            <Skeleton height={20} width={160} style={{ marginBottom: 6 }} />
            <Skeleton height={14} width={100} />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {summary?.name ?? "Unknown Token"}
              </h1>
              {summary?.symbol && (
                <span className="font-mono text-[14px] text-[var(--text-muted)]">
                  {summary.symbol}
                </span>
              )}
              {summary?.is_pump_fun && (
                <span className="badge badge-accent">PUMP.FUN</span>
              )}
              {dexInfo?.dex_paid?.has_paid && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#22c55e] text-black tracking-wide" title="Token has paid for DexScreener Enhanced Info">
                  DEX PAID
                </span>
              )}
              {dexInfo?.boosts?.is_boosted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f59e0b] text-black tracking-wide" title={`Boosted ${dexInfo.boosts.boost_count}x on DexScreener`}>
                  🔥 {dexInfo.boosts.boost_count}
                </span>
              )}
            </div>
            <AddressTag address={mint} chars={8} size={12} />
          </>
        )}
      </div>

      {/* Price */}
      {summary?.price_usd != null && (
        <div className="text-right shrink-0">
          <div className="font-mono text-[22px] font-bold text-[var(--text-primary)]">
            ${formatPrice(summary.price_usd)}
          </div>
          {summary.price_change_24h_pct != null && (
            <div
              className="text-[13px] font-semibold"
              style={{ color: summary.price_change_24h_pct >= 0 ? "#22c55e" : "var(--accent)" }}
            >
              {summary.price_change_24h_pct >= 0 ? "+" : ""}
              {summary.price_change_24h_pct.toFixed(2)}% 24h
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats grid ────────────────────────────────────────────────────────────────

function TokenStatsGrid({
  summary,
  isLoading,
}: {
  summary: TokenSummary | undefined;
  isLoading: boolean;
}) {
  const stats = [
    { label: "Market Cap", value: summary?.market_cap_usd != null ? `$${formatCompact(summary.market_cap_usd)}` : null },
    { label: "24h Volume", value: summary?.volume_24h_usd != null ? `$${formatCompact(summary.volume_24h_usd)}` : null },
    { label: "Liquidity", value: summary?.liquidity_usd != null ? `$${formatCompact(summary.liquidity_usd)}` : null },
    { label: "Holders", value: summary?.holder_count != null ? summary.holder_count.toLocaleString() : null },
    { label: "Security Score", value: summary?.security_score != null ? `${(summary.security_score * 100).toFixed(0)}/100` : null },
    { label: "Supply", value: summary?.supply != null ? formatCompact(summary.supply) : null },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 card overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-3.5 border-r border-b lg:border-b-0 border-[var(--border)] last:border-r-0">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">
            {s.label}
          </div>
          {isLoading ? (
            <Skeleton height={18} width={60} />
          ) : (
            <div className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">
              {s.value ?? "—"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Holders panel ─────────────────────────────────────────────────────────────

function HoldersPanel({ mint }: { mint: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["token", mint, "holders"],
    queryFn: () => tokenApi.holders(mint, 20),
    staleTime: 120_000,
  });

  const holders = data?.holders ?? [];
  const top10Pct = data?.top10_pct ?? 0;
  const holderCount = data?.holder_count ?? 0;

  return (
    <Panel 
      title="Top Holders" 
      subtitle={holderCount > 0 ? `${holderCount} holders · Top 10 own ${top10Pct.toFixed(1)}%` : undefined}
    >
      {isLoading ? (
        <RowSkeleton count={6} />
      ) : holders.length === 0 ? (
        <EmptyPanel text="No holder data available." />
      ) : (
        <div>
          {holders.slice(0, 15).map((h, i) => (
            <HolderRow key={`${h.owner}-${i}`} holder={h} rank={i + 1} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function HolderRow({ holder, rank }: { holder: TokenHolder; rank: number }) {
  const ownerAddress = holder?.owner ?? "";
  
  if (!ownerAddress) return null;
  
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: "12px",
      }}
    >
      <span
        style={{
          width: "20px",
          color: "var(--text-muted)",
          flexShrink: 0,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
        }}
      >
        {rank}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {holder.known_wallet?.label ? (
          <Link
            href={`/wallet/${ownerAddress}`}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")
            }
          >
            {holder.known_wallet.label}
          </Link>
        ) : (
          <Link
            href={`/wallet/${ownerAddress}`}
            style={{ textDecoration: "none" }}
          >
            <AddressTag address={ownerAddress} chars={5} size={11} />
          </Link>
        )}
      </div>

      {/* USD Value */}
      {holder.value_usd != null && holder.value_usd > 0 && (
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-muted)",
            flexShrink: 0,
            minWidth: "70px",
            textAlign: "right",
          }}
        >
          ${formatCompact(holder.value_usd)}
        </span>
      )}

      {/* Percentage */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-secondary)",
          flexShrink: 0,
          minWidth: "50px",
          textAlign: "right",
        }}
      >
        {holder.percentage?.toFixed(2) ?? "—"}%
      </span>
    </div>
  );
}

// ── Top traders panel ─────────────────────────────────────────────────────────

function TopTradersPanel({ mint }: { mint: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["token", mint, "top-traders"],
    queryFn: () => tokenApi.topTraders(mint),
    staleTime: 120_000,
  });

  const traders = data?.traders ?? [];
  const totalValue = traders.reduce((sum, t) => sum + (t.value_usd || 0), 0);

  return (
    <Panel 
      title="Top Positions" 
      subtitle={totalValue > 0 ? `$${formatCompact(totalValue)} total` : undefined}
    >
      {isLoading ? (
        <RowSkeleton count={6} />
      ) : traders.length === 0 ? (
        <EmptyPanel text="No position data available." />
      ) : (
        <div>
          {traders.slice(0, 15).map((t, i) => (
            <TraderRow key={t.address} trader={t} rank={i + 1} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function TraderRow({ trader, rank }: { trader: TopTrader; rank: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          width: "20px",
          color: "var(--text-muted)",
          flexShrink: 0,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
        }}
      >
        {rank}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {trader.known_wallet?.label ? (
          <Link
            href={`/wallet/${trader.address}`}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")
            }
          >
            {trader.known_wallet.label}
          </Link>
        ) : (
          <Link href={`/wallet/${trader.address}`} style={{ textDecoration: "none" }}>
            <AddressTag address={trader.address} chars={5} size={11} />
          </Link>
        )}
      </div>

      {/* Position Value */}
      {trader.value_usd != null && trader.value_usd > 0 && (
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-primary)",
            flexShrink: 0,
            minWidth: "70px",
            textAlign: "right",
          }}
        >
          ${formatCompact(trader.value_usd)}
        </span>
      )}

      {/* Holding Percentage */}
      {trader.holding_pct != null && trader.holding_pct > 0 && (
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-secondary)",
            flexShrink: 0,
            minWidth: "50px",
            textAlign: "right",
          }}
        >
          {trader.holding_pct.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// ── Shared panel shell ────────────────────────────────────────────────────────

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] text-[var(--text-muted)] font-normal">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="px-4 py-8 text-center text-[12px] text-[var(--text-muted)]">
      {text}
    </div>
  );
}

function RowSkeleton({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-10 border-b border-[var(--border)]"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  if (n < 1000) return n.toFixed(4);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

// ── Smart Money Consensus ─────────────────────────────────────────────────────

function SmartMoneyPanel({ mint }: { mint: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["smart-money", mint],
    queryFn: () => kolFeedApi.smartMoney(mint, 48),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div style={{ marginTop: "24px" }}>
        <Skeleton style={{ height: "80px", borderRadius: "8px" }} />
      </div>
    );
  }

  if (!data || data.kol_count === 0) return null;

  const { buyers, sellers, net_score, kols } = data;
  const total = buyers + sellers;
  const buyPct = total > 0 ? Math.round((buyers / total) * 100) : 50;
  const scoreColor = net_score > 0.2 ? "#22c55e" : net_score < -0.2 ? "var(--accent)" : "#f59e0b";

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "10px" }}>
        Smart Money — 48h Consensus
      </div>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          gap: "24px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Score */}
        <div style={{ textAlign: "center", minWidth: "80px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: scoreColor, fontFamily: "JetBrains Mono, monospace", lineHeight: 1 }}>
            {net_score > 0 ? "+" : ""}{Math.round(net_score * 100)}%
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>net bullish</div>
        </div>

        {/* Buy/sell bar */}
        <div style={{ flex: 1, minWidth: "160px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
            <span style={{ color: "#22c55e" }}>{buyers} buying</span>
            <span style={{ color: "var(--accent)" }}>{sellers} selling</span>
          </div>
          <div style={{ height: "8px", borderRadius: "4px", background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${buyPct}%`, background: "#22c55e", borderRadius: "4px", transition: "width 400ms" }} />
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>{total} KOLs tracked</div>
        </div>

        {/* Top KOLs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {kols.slice(0, 5).map((kol) => (
            <SmartMoneyKolChip key={kol.address} kol={kol} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SmartMoneyKolChip({ kol }: { kol: SmartMoneyKol }) {
  const isBuying = kol.direction === "buying";
  const color = isBuying ? "#22c55e" : kol.direction === "selling" ? "var(--accent)" : "var(--text-muted)";
  return (
    <Link
      href={`/wallet/${kol.address}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          padding: "4px 10px",
          borderRadius: "5px",
          border: `1px solid ${color}`,
          fontSize: "11px",
          color,
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {kol.label ?? kol.address.slice(0, 8)} {isBuying ? "↑" : kol.direction === "selling" ? "↓" : "—"}
      </div>
    </Link>
  );
}
