"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { kolFeedApi, type KolTrade } from "@/lib/api";

// Fallback shown while real data loads
const FALLBACK_EVENTS = [
  { label: "punk.sol", action: "bought", amountUsd: "$22K", dex: "Raydium", time: "3s", type: "buy" },
  { label: "dev_wallet", action: "sold", amountUsd: "$44K", dex: "Pump.fun", time: "9s", type: "sell" },
  { label: "sniper_X", action: "bought", amountUsd: "$18K", dex: "Raydium", time: "15s", type: "buy" },
  { label: "whale_12", action: "sold", amountUsd: "$124K", dex: "Jupiter", time: "22s", type: "sell" },
  { label: "smartmoney9", action: "bought", amountUsd: "$9.8K", dex: "Pump.fun", time: "31s", type: "buy" },
  { label: "kol_larry", action: "bought", amountUsd: "$29K", dex: "Raydium", time: "40s", type: "buy" },
  { label: "insider_A", action: "sold", amountUsd: "$31K", dex: "Jupiter", time: "55s", type: "sell" },
  { label: "bundler_3", action: "bought", amountUsd: "$9.8K", dex: "Pump.fun", time: "1m", type: "buy" },
];

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
    amountUsd: formatUsd(t.amount_usd),
    dex: DEX_LABELS[t.dex] ?? t.dex ?? "DEX",
    time: timeAgo(t.block_time),
    type: t.direction,
  };
}

export function LandingHero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        paddingTop: "56px", // below nav
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay — hero only */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          pointerEvents: "none",
        }}
      />

      {/* Centered content */}
      <div
        className="landing-hero-grid"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          paddingInline: "40px",
          paddingTop: "40px",
          paddingBottom: "40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "80px",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Left: headline + CTAs */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Live · Solana Mainnet
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 4vw, 52px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: "24px",
            }}
          >
            On-Chain Intelligence
            <br />
            for Solana.
          </h1>

          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.65,
              color: "var(--text-secondary)",
              marginBottom: "36px",
              maxWidth: "420px",
            }}
          >
            Track wallets. Map relationships. Follow the money. The intelligence
            layer Solana traders actually need.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link
              href="/explorer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 80ms",
                boxShadow: "0 4px 20px var(--accent-glow)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.background =
                  "var(--accent-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.background =
                  "var(--accent)")
              }
            >
              Launch App
              <span style={{ fontSize: "16px" }}>→</span>
            </Link>
            <a
              href="/docs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 24px",
                borderRadius: "8px",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "15px",
                fontWeight: 500,
                textDecoration: "none",
                border: "1px solid var(--border)",
                transition: "border-color 80ms, color 80ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "var(--text-muted)";
                (e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor =
                  "var(--border)";
                (e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--text-secondary)";
              }}
            >
              Read Docs
            </a>
          </div>
        </div>

        {/* Right: live data feed */}
        <LiveFeedPanel />
      </div>
    </section>
  );
}

function LiveFeedPanel() {
  const { data } = useQuery({
    queryKey: ["kol-feed-hero"],
    queryFn: () => kolFeedApi.feed({ limit: 40, min_usd: 1000 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const rows = data?.trades?.length
    ? data.trades.map(tradeToRow)
    : FALLBACK_EVENTS;

  // Duplicate for seamless CSS loop
  const doubled = [...rows, ...rows];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        height: "420px",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: data?.trades?.length ? "#22c55e" : "#f59e0b",
              animation: "pulse 2s ease-in-out infinite",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Live · KOL Activity
          </span>
        </div>
        {data?.count != null && (
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {data.count} trades
          </span>
        )}
      </div>

      {/* Fade overlays */}
      <div
        style={{
          position: "absolute",
          top: "50px",
          left: 0,
          right: 0,
          height: "32px",
          background: "linear-gradient(to bottom, var(--bg-surface), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "56px",
          background: "linear-gradient(to top, var(--bg-surface), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Scrolling feed */}
      <div style={{ height: "calc(100% - 50px)", overflow: "hidden", position: "relative" }}>
        <div style={{ animation: "ticker 32s linear infinite", willChange: "transform" }}>
          {doubled.map((event, i) => (
            <FeedEventRow key={i} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

type FeedRow = { label: string; action: string; amountUsd: string; dex: string; time: string; type: string };

function FeedEventRow({ event }: { event: FeedRow }) {
  const isBuy = event.type === "buy";
  const amountColor = isBuy ? "#22c55e" : "var(--accent)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 20px",
        borderBottom: "1px solid var(--border)",
        gap: "10px",
        fontSize: "12px",
      }}
    >
      {/* Direction dot */}
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: amountColor,
          flexShrink: 0,
          opacity: 0.8,
        }}
      />

      {/* Wallet label */}
      <span
        style={{
          fontWeight: 600,
          color: "var(--text-primary)",
          fontSize: "12px",
          minWidth: "80px",
          maxWidth: "110px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.label}
      </span>

      {/* Action */}
      <span style={{ color: "var(--text-muted)", fontSize: "11px", flexShrink: 0 }}>
        {event.action}
      </span>

      {/* Amount */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "12px",
          color: amountColor,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {event.amountUsd}
      </span>

      {/* DEX */}
      <span
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          marginLeft: "auto",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {event.dex}
      </span>

      {/* Time */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          color: "var(--text-muted)",
          width: "28px",
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {event.time}
      </span>
    </div>
  );
}
