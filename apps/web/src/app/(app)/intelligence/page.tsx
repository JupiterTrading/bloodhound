"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  walletApi,
  leaderboardApi,
  trendingApi,
  type LeaderboardEntry,
  type TrendingToken,
} from "@/lib/api";
import { EventTimeline } from "@/components/events/EventTimeline";
import { ClassificationBadge } from "@/components/ui/ClassificationBadge";
import { ConfidenceBadge, type Confidence } from "@/components/ui/ConfidenceBadge";
import { AddressTag } from "@/components/ui/AddressTag";

interface KnownWalletEntry {
  address: string;
  label: string;
  category: string;
  note?: string;
}

async function fetchNotableWallets(): Promise<KnownWalletEntry[]> {
  const res = await fetch("/api/v1/known?limit=6");
  if (!res.ok) return [];
  const data = (await res.json()) as { wallets?: KnownWalletEntry[] };
  return data.wallets ?? [];
}

export default function IntelligencePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      setSearched(q);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "6px",
          }}
        >
          Intelligence
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Deep wallet profiling — classification, behavioral analysis, relationship mapping.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: "32px" }}>
        <div
          style={{
            display: "flex",
            gap: "0",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
            transition: "border-color 80ms, box-shadow 80ms",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px var(--accent-glow)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste wallet address or search @handle..."
            autoFocus
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "12px 16px",
              fontSize: "14px",
              fontFamily: query.length > 30 ? "JetBrains Mono, monospace" : "inherit",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 20px",
              background: "var(--accent)",
              border: "none",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              transition: "background 80ms",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent)")
            }
          >
            Analyze
          </button>
        </div>
      </form>

      {/* Inline intelligence result */}
      {searched && (
        <div style={{ marginBottom: "40px" }}>
          <IntelligencePreview address={searched} />
        </div>
      )}

      {/* Leaderboard + featured content */}
      {!searched && (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          <LeaderboardPanel />
          <TrendingPanel />
          <EventTimeline />
          <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <NotableAddresses />
            <ClassificationGuide />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard panel ──────────────────────────────────────────────────────────

function LeaderboardPanel() {
  const [category, setCategory] = useState<"kol" | "profitable_trader">("kol");
  const [timeframe, setTimeframe] = useState<"1d" | "7d" | "30d">("1d");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", category, timeframe],
    queryFn: () => leaderboardApi.get({ category, timeframe, limit: 10 }),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  const entries = data?.entries ?? [];
  const pnlAvailable = data?.metric === "realized_pnl_usd";

  return (
    <div>
      {/* Panel header with tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Leaderboard
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["kol", "profitable_trader"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: "3px 10px",
                  borderRadius: "4px",
                  border: "1px solid",
                  borderColor: category === cat ? "var(--accent)" : "var(--border)",
                  background: category === cat ? "var(--accent)" : "transparent",
                  color: category === cat ? "#fff" : "var(--text-muted)",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 80ms",
                }}
              >
                {cat === "kol" ? "KOLs" : "Traders"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {(["1d", "7d", "30d"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: "3px 10px",
                borderRadius: "4px",
                border: "1px solid",
                borderColor: timeframe === tf ? "var(--text-muted)" : "var(--border)",
                background: "transparent",
                color: timeframe === tf ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: timeframe === tf ? 600 : 400,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 80ms",
              }}
            >
              {tf === "1d" ? "Today" : tf === "7d" ? "7D" : "30D"}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 120px 100px",
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <span>#</span>
          <span>Wallet</span>
          <span style={{ textAlign: "right" }}>
            {pnlAvailable ? "Realized PnL" : "Portfolio"}
          </span>
          <span style={{ textAlign: "right" }}>Trades</span>
        </div>

        {isLoading ? (
          <LeaderboardSkeleton />
        ) : entries.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            No data available — backend may be offline.
          </div>
        ) : (
          entries.map((entry) => (
            <LeaderboardRow key={entry.address} entry={entry} pnlAvailable={pnlAvailable} />
          ))
        )}

        {data?.metric_note && (
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--border)",
              fontSize: "10px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            {data.metric_note}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  pnlAvailable,
}: {
  entry: LeaderboardEntry;
  pnlAvailable: boolean;
}) {
  const perfValue = pnlAvailable
    ? entry.realized_pnl_usd
    : entry.portfolio_usd;

  const perfFormatted =
    perfValue == null
      ? "—"
      : pnlAvailable
      ? `${perfValue >= 0 ? "+" : ""}$${Math.abs(perfValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `$${perfValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const perfColor =
    perfValue == null
      ? "var(--text-muted)"
      : pnlAvailable && perfValue < 0
      ? "#ef4444"
      : pnlAvailable && perfValue > 0
      ? "#22c55e"
      : "var(--text-primary)";

  return (
    <Link href={`/wallet/${entry.address}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 120px 100px",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
          transition: "background 60ms",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = "transparent")
        }
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {entry.rank}
        </span>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {entry.label ?? <AddressTag address={entry.address} chars={6} size={13} />}
          </div>
          {entry.twitter_handle && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              @{entry.twitter_handle}
            </span>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "JetBrains Mono, monospace",
              color: perfColor,
            }}
          >
            {perfFormatted}
          </span>
        </div>

        <div style={{ textAlign: "right" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {entry.trade_count != null ? entry.trade_count.toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function LeaderboardSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: "50px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-surface)",
            opacity: 1 - i * 0.1,
          }}
        />
      ))}
    </>
  );
}

// ── Trending tokens panel ──────────────────────────────────────────────────────

function TrendingPanel() {
  const [view, setView] = useState<"trending" | "gainers" | "losers">("trending");

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-tokens"],
    queryFn: () => trendingApi.tokens(8),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: view === "trending",
  });

  const { data: gainersData, isLoading: gainersLoading } = useQuery({
    queryKey: ["token-gainers", view],
    queryFn: () =>
      trendingApi.gainers("24h", 8, view === "losers" ? "losers" : "gainers"),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: view === "gainers" || view === "losers",
  });

  const isLoading = view === "trending" ? trendingLoading : gainersLoading;
  const tokens: TrendingToken[] =
    view === "trending"
      ? (trendingData?.tokens ?? [])
      : (gainersData?.tokens ?? []);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Market
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["trending", "gainers", "losers"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "3px 10px",
                borderRadius: "4px",
                border: "1px solid",
                borderColor: view === v ? "var(--accent)" : "var(--border)",
                background: view === v ? "var(--accent)" : "transparent",
                color: view === v ? "#fff" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                textTransform: "capitalize",
                transition: "all 80ms",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

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
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 100px",
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <span>Token</span>
          <span style={{ textAlign: "right" }}>Price</span>
          <span style={{ textAlign: "right" }}>24h %</span>
          <span style={{ textAlign: "right" }}>Volume 24h</span>
        </div>

        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: "46px",
                borderBottom: "1px solid var(--border)",
                opacity: 1 - i * 0.12,
              }}
            />
          ))
        ) : tokens.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            No data — backend may be offline.
          </div>
        ) : (
          tokens.map((token) => (
            <Link
              key={token.mint}
              href={`/token/${token.mint}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 90px 100px",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  alignItems: "center",
                  transition: "background 60ms",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                }
              >
                <div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginRight: "6px",
                    }}
                  >
                    {token.symbol || "—"}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {token.name}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "JetBrains Mono, monospace",
                      color: "var(--text-primary)",
                    }}
                  >
                    ${token.price_usd < 0.01
                      ? token.price_usd.toExponential(2)
                      : token.price_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "JetBrains Mono, monospace",
                      fontWeight: 600,
                      color: token.price_change_pct >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {token.price_change_pct >= 0 ? "+" : ""}
                    {token.price_change_pct.toFixed(1)}%
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "JetBrains Mono, monospace",
                      color: "var(--text-muted)",
                    }}
                  >
                    ${(token.volume_24h_usd / 1_000_000).toFixed(1)}M
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ── Intelligence preview card ──────────────────────────────────────────────────

function IntelligencePreview({ address }: { address: string }) {
  const summaryQ = useQuery({
    queryKey: ["wallet", "summary", address],
    queryFn: () => walletApi.summary(address),
    staleTime: 60_000,
  });

  const intelQ = useQuery({
    queryKey: ["wallet", "intelligence", address],
    queryFn: () => walletApi.intelligence(address),
    staleTime: 300_000,
    retry: false,
  });

  const summary = summaryQ.data;
  const intel = intelQ.data;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            {summaryQ.isLoading ? (
              <span style={{ color: "var(--text-muted)" }}>Loading...</span>
            ) : (
              summary?.known_wallet?.label ?? (
                <AddressTag address={address} chars={8} size={14} />
              )
            )}
          </div>
          {!summaryQ.isLoading && summary && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {summary.classification.map((c) => (
                <ClassificationBadge key={c} label={c} />
              ))}
            </div>
          )}
        </div>

        <Link
          href={`/wallet/${address}`}
          style={{
            padding: "6px 14px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            transition: "border-color 80ms, color 80ms",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
          }}
        >
          Full Profile →
        </Link>
      </div>

      {summary && !summaryQ.isLoading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {[
            { label: "SOL Balance", value: summary.sol_balance != null ? `${summary.sol_balance.toFixed(2)} SOL` : "—" },
            { label: "Portfolio", value: summary.portfolio_usd != null ? `$${summary.portfolio_usd.toLocaleString()}` : "—" },
            { label: "Total Txs", value: summary.total_txs.toLocaleString() },
            { label: "Active Days", value: `${summary.active_days}d` },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{ padding: "12px 16px", borderRight: "1px solid var(--border)" }}
            >
              <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "16px 20px" }}>
        {intelQ.isLoading ? (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Generating intelligence summary...
          </p>
        ) : intel?.summary ? (
          <div>
            <p style={{ fontSize: "13px", lineHeight: 1.65, color: "var(--text-secondary)", marginBottom: "12px" }}>
              {intel.summary}
            </p>
            <ConfidenceBadge confidence={intel.confidence as Confidence} />
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            No intelligence summary available.{" "}
            <Link href={`/wallet/${address}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
              View full profile →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Notable addresses ──────────────────────────────────────────────────────────

function NotableAddresses() {
  const { data, isLoading } = useQuery({
    queryKey: ["known-wallets-notable"],
    queryFn: fetchNotableWallets,
    staleTime: 300_000,
    retry: false,
  });

  const wallets = data ?? [];

  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "12px",
        }}
      >
        Notable Addresses
      </div>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: "52px", borderBottom: "1px solid var(--border)", opacity: 1 - i * 0.2 }} />
          ))
        ) : wallets.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            No notable addresses.
          </div>
        ) : (
          wallets.map((w) => (
            <Link key={w.address} href={`/wallet/${w.address}`} style={{ textDecoration: "none", display: "block" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 60ms",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              >
                <span style={{ fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>◎</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                    {w.label}
                  </div>
                  <AddressTag address={w.address} chars={6} size={11} />
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{w.category}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ── Classification guide ───────────────────────────────────────────────────────

function ClassificationGuide() {
  const classes = [
    { label: "WHALE", desc: "Holds or moves >$500K in a single wallet" },
    { label: "SMART MONEY", desc: "Consistent early entry on winning trades" },
    { label: "SNIPER", desc: "Buys within seconds of launch, automated" },
    { label: "DEPLOYER", desc: "Has deployed token or program accounts" },
    { label: "BOT", desc: "High-frequency automated trading patterns" },
    { label: "BUNDLER", desc: "Uses Jito bundles to co-snipe with others" },
  ];

  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "12px",
        }}
      >
        Classification Labels
      </div>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {classes.map((c) => (
          <div
            key={c.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <ClassificationBadge label={c.label} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{c.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
