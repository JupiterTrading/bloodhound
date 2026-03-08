"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { tokenApi, kolFeedApi, type TokenSummary, type TokenHolder, type TopTrader, type SmartMoneyKol } from "@/lib/api";
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

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Token header */}
      <TokenHeader mint={mint} summary={summary} isLoading={isLoading} />

      {/* Stats grid */}
      <TokenStatsGrid summary={summary} isLoading={isLoading} />

      {/* Price chart */}
      <PriceChart mint={mint} pairAddress={summary?.pair_address} />

      {/* Smart money consensus */}
      <SmartMoneyPanel mint={mint} />

      {/* Two columns: holders + top traders */}
      <div
        className="grid-responsive-2"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <HoldersPanel mint={mint} />
        <TopTradersPanel mint={mint} />
      </div>
    </div>
  );
}

// ── Price chart (GeckoTerminal embed) ────────────────────────────────────────

function PriceChart({ mint, pairAddress }: { mint: string; pairAddress: string | null | undefined }) {
  // GeckoTerminal uses the same pool address as DexScreener for Raydium/Orca/Meteora pools.
  // Swap to DexScreener embed as fallback — it accepts the same pair address.
  const embedUrl = pairAddress
    ? `https://www.geckoterminal.com/solana/pools/${pairAddress}?embed=1&info=0&swaps=0`
    : null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginTop: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Price History
        </span>
        {pairAddress && (
          <a
            href={`https://www.geckoterminal.com/solana/pools/${pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              transition: "color 80ms",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
            }
          >
            GeckoTerminal ↗
          </a>
        )}
      </div>

      <div style={{ height: "400px" }}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            title="Price Chart"
            allow="clipboard-write"
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Chart not yet available
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
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
  isLoading,
}: {
  mint: string;
  summary: TokenSummary | undefined;
  isLoading: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      {/* Logo */}
      {isLoading ? (
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            flexShrink: 0,
          }}
        />
      ) : summary?.logo_uri ? (
        <img
          src={summary.logo_uri}
          alt={summary.symbol ?? ""}
          width={44}
          height={44}
          style={{ borderRadius: "50%", border: "1px solid var(--border)", flexShrink: 0 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          ◈
        </div>
      )}

      {/* Name / symbol */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isLoading ? (
          <>
            <Skeleton height={20} width={160} style={{ marginBottom: 6 }} />
            <Skeleton height={14} width={100} />
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <h1
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--text-primary)",
                }}
              >
                {summary?.name ?? "Unknown Token"}
              </h1>
              {summary?.symbol && (
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "14px",
                    color: "var(--text-muted)",
                  }}
                >
                  {summary.symbol}
                </span>
              )}
              {summary?.is_pump_fun && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: "3px",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                    letterSpacing: "0.06em",
                  }}
                >
                  PUMP.FUN
                </span>
              )}
            </div>
            <AddressTag address={mint} chars={8} size={12} />
          </>
        )}
      </div>

      {/* Price */}
      {summary?.price_usd != null && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            ${formatPrice(summary.price_usd)}
          </div>
          {summary.price_change_24h_pct != null && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: summary.price_change_24h_pct >= 0 ? "#22c55e" : "var(--accent)",
              }}
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
    {
      label: "Market Cap",
      value: summary?.market_cap_usd != null ? `$${formatCompact(summary.market_cap_usd)}` : null,
    },
    {
      label: "24h Volume",
      value: summary?.volume_24h_usd != null ? `$${formatCompact(summary.volume_24h_usd)}` : null,
    },
    {
      label: "Liquidity",
      value: summary?.liquidity_usd != null ? `$${formatCompact(summary.liquidity_usd)}` : null,
    },
    {
      label: "Holders",
      value: summary?.holder_count != null ? summary.holder_count.toLocaleString() : null,
    },
    {
      label: "Security Score",
      value: summary?.security_score != null ? `${(summary.security_score * 100).toFixed(0)}/100` : null,
    },
    {
      label: "Supply",
      value: summary?.supply != null ? formatCompact(summary.supply) : null,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            padding: "14px 16px",
            borderRight: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              marginBottom: "4px",
            }}
          >
            {s.label}
          </div>
          {isLoading ? (
            <Skeleton height={18} width={60} />
          ) : (
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
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

  return (
    <Panel title="Top Holders">
      {isLoading ? (
        <RowSkeleton count={6} />
      ) : holders.length === 0 ? (
        <EmptyPanel text="No holder data available." />
      ) : (
        <div>
          {holders.slice(0, 15).map((h, i) => (
            <HolderRow key={h.owner} holder={h} rank={i + 1} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function HolderRow({ holder, rank }: { holder: TokenHolder; rank: number }) {
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
            href={`/wallet/${holder.owner}`}
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
            href={`/wallet/${holder.owner}`}
            style={{ textDecoration: "none" }}
          >
            <AddressTag address={holder.owner} chars={5} size={11} />
          </Link>
        )}
      </div>

      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-secondary)",
          flexShrink: 0,
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

  return (
    <Panel title="Top Traders">
      {isLoading ? (
        <RowSkeleton count={6} />
      ) : traders.length === 0 ? (
        <EmptyPanel text="No trader data available." />
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
  const hasPnl = trader.pnl != null;

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

      {hasPnl && (
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: (trader.pnl ?? 0) >= 0 ? "#22c55e" : "var(--accent)",
            flexShrink: 0,
          }}
        >
          {(trader.pnl ?? 0) >= 0 ? "+" : ""}${formatCompact(Math.abs(trader.pnl ?? 0))}
        </span>
      )}

      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}
      >
        ${formatCompact(trader.volume)}
      </span>
    </div>
  );
}

// ── Shared panel shell ────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        fontSize: "12px",
        color: "var(--text-muted)",
      }}
    >
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
          style={{
            height: "40px",
            borderBottom: "1px solid var(--border)",
            opacity: 1 - i * 0.15,
          }}
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
