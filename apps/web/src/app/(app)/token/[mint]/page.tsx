"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { tokenApi, type TokenSummary, type TokenHolder, type TopTrader, type OHLCVItem } from "@/lib/api";
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
      <PriceChart mint={mint} />

      {/* Two columns: holders + top traders */}
      <div
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

// ── Price chart ───────────────────────────────────────────────────────────────

const RESOLUTIONS = [
  { label: "15m", value: "15m" },
  { label: "1H",  value: "1H"  },
  { label: "4H",  value: "4H"  },
  { label: "1D",  value: "1D"  },
  { label: "1W",  value: "1W"  },
];

function PriceChart({ mint }: { mint: string }) {
  const [resolution, setResolution] = useState("1D");

  const { data, isLoading } = useQuery({
    queryKey: ["token", mint, "ohlcv", resolution],
    queryFn: () => tokenApi.ohlcv(mint, resolution),
    staleTime: 60_000,
  });

  const items: OHLCVItem[] = data?.items ?? [];

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
      {/* Chart header */}
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
        <div style={{ display: "flex", gap: "4px" }}>
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              style={{
                background: resolution === r.value ? "var(--accent)" : "transparent",
                border: `1px solid ${resolution === r.value ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                color: resolution === r.value ? "#fff" : "var(--text-muted)",
                cursor: "pointer",
                fontFamily: "JetBrains Mono, monospace",
                transition: "all 80ms",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ padding: "8px 0", height: "200px" }}>
        {isLoading ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Skeleton width={600} height={150} />
          </div>
        ) : items.length < 2 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            No price data available.
          </div>
        ) : (
          <OHLCVLineChart items={items} />
        )}
      </div>
    </div>
  );
}

function OHLCVLineChart({ items }: { items: OHLCVItem[] }) {
  const W = 1000;
  const H = 160;
  const PAD_L = 64;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;

  const closes = items.map((d) => d.close);
  const minP = Math.min(...closes);
  const maxP = Math.max(...closes);
  const rangeP = maxP - minP || 1;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const toX = (i: number) => PAD_L + (i / (items.length - 1)) * chartW;
  const toY = (p: number) => PAD_T + chartH - ((p - minP) / rangeP) * chartH;

  // Build polyline points
  const pts = items.map((d, i) => `${toX(i)},${toY(d.close)}`).join(" ");

  // Build filled area path
  const firstX = toX(0);
  const lastX = toX(items.length - 1);
  const baseY = PAD_T + chartH;
  const areaPath = `M${firstX},${baseY} L${pts.replace(/ /g, " L")} L${lastX},${baseY} Z`;

  const trendUp = closes[closes.length - 1] >= closes[0];
  const lineColor = trendUp ? "#22c55e" : "var(--accent)";
  const areaColor = trendUp ? "rgba(34,197,94,0.08)" : "rgba(220,38,38,0.08)";

  // Y-axis labels (3 ticks)
  const yTicks = [minP, minP + rangeP / 2, maxP];

  // X-axis labels (4 ticks)
  const xTickIdxs = [0, Math.floor(items.length / 3), Math.floor((2 * items.length) / 3), items.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      {yTicks.map((_, i) => {
        const y = PAD_T + (i / (yTicks.length - 1)) * chartH;
        return (
          <line
            key={i}
            x1={PAD_L}
            y1={y}
            x2={W - PAD_R}
            y2={y}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill={areaColor} />

      {/* Line */}
      <polyline
        points={pts}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Y-axis labels */}
      {yTicks.map((price, i) => (
        <text
          key={i}
          x={PAD_L - 6}
          y={PAD_T + ((yTicks.length - 1 - i) / (yTicks.length - 1)) * chartH + 4}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="JetBrains Mono, monospace"
        >
          {formatPrice(price)}
        </text>
      ))}

      {/* X-axis labels */}
      {xTickIdxs.map((idx) => {
        const d = items[idx];
        if (!d) return null;
        const label = new Date(d.unixTime * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        return (
          <text
            key={idx}
            x={toX(idx)}
            y={H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="var(--text-muted)"
            fontFamily="JetBrains Mono, monospace"
          >
            {label}
          </text>
        );
      })}
    </svg>
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
