"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { portfolioApi, type PortfolioHolding, type PortfolioWallet } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

export function PortfolioView() {
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => portfolioApi.get(),
    staleTime: 5 * 60 * 1000,
  });

  const reportMutation = useMutation({
    mutationFn: () => portfolioApi.report(),
    onSuccess: () => setReportOpen(true),
  });

  if (isLoading) return <PortfolioSkeleton />;

  if (error) {
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
        <p style={{ fontSize: "13px", color: "var(--accent)" }}>
          Unable to load portfolio — backend may be temporarily unavailable.
        </p>
      </div>
    );
  }

  const { wallets = [], holdings = [], total_usd = 0 } = data ?? {};
  const hasOwnWallets = wallets.length > 0;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            My Portfolio
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {hasOwnWallets
              ? `Aggregated across ${wallets.length} wallet${wallets.length !== 1 ? "s" : ""}`
              : "Mark wallets as 'Own' in Tracked to populate your portfolio"}
          </p>
        </div>
        {hasOwnWallets && (
          <button
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: reportMutation.isPending ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: reportMutation.isPending ? 0.7 : 1,
            }}
          >
            {reportMutation.isPending ? "Analyzing…" : "Generate AI Report"}
          </button>
        )}
      </div>

      {/* AI report panel */}
      {reportOpen && reportMutation.data && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent)",
            borderRadius: "8px",
            padding: "20px 24px",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              AI Portfolio Briefing
            </span>
            <button
              onClick={() => setReportOpen(false)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", fontFamily: "inherit" }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {reportMutation.data.report}
          </p>
        </div>
      )}

      {/* Stats bar */}
      {hasOwnWallets && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "16px 20px",
            display: "flex",
            gap: "32px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <Stat label="Total Value" value={total_usd > 0 ? `$${total_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"} />
          <Stat label="Wallets" value={String(wallets.length)} />
          <Stat label="Tokens" value={String(holdings.length)} />
          <Stat
            label="KOL Overlap"
            value={`${holdings.filter((h) => h.kol_count > 0).length} tokens`}
            accent
          />
        </div>
      )}

      {/* Wallet chips */}
      {hasOwnWallets && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          {wallets.map((w) => (
            <Link
              key={w.address}
              href={`/wallet/${w.address}`}
              style={{
                padding: "4px 10px",
                borderRadius: "5px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                fontSize: "11px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {w.label}
            </Link>
          ))}
          <Link
            href="/tracked"
            style={{
              padding: "4px 10px",
              borderRadius: "5px",
              background: "transparent",
              border: "1px dashed var(--border)",
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            + Manage wallets
          </Link>
        </div>
      )}

      {/* Holdings table */}
      {!hasOwnWallets ? (
        <EmptyPortfolio />
      ) : holdings.length === 0 ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "40px",
            textAlign: "center",
            fontSize: "13px",
            color: "var(--text-muted)",
          }}
        >
          No token holdings found across your wallets.
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
              padding: "10px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: "10px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            <span>Token</span>
            <span style={{ textAlign: "right" }}>Amount</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>Value</span>
            <span style={{ textAlign: "center" }}>KOL Overlap</span>
          </div>

          {/* Rows */}
          {holdings.map((h) => (
            <HoldingRow key={h.mint} holding={h} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  const symbol = holding.symbol || holding.mint.slice(0, 8);
  const amount = holding.amount ?? 0;
  const price = holding.price_usd ?? 0;
  const usd = holding.usd_value ?? 0;
  const kolCount = holding.kol_count ?? 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr 100px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        alignItems: "center",
      }}
    >
      {/* Token */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        {holding.logo_uri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={holding.logo_uri}
            alt={symbol}
            width={20}
            height={20}
            style={{ borderRadius: "50%", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--border)",
              flexShrink: 0,
            }}
          />
        )}
        <Link
          href={`/token/${holding.mint}`}
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            textDecoration: "none",
            fontFamily: "JetBrains Mono, monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          ${symbol}
        </Link>
      </div>

      {/* Amount */}
      <div style={{ textAlign: "right", fontSize: "12px", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
        {formatAmount(amount)}
      </div>

      {/* Price */}
      <div style={{ textAlign: "right", fontSize: "12px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
        {price > 0 ? `$${formatPrice(price)}` : "—"}
      </div>

      {/* USD Value */}
      <div style={{ textAlign: "right", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
        {usd > 0 ? `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
      </div>

      {/* KOL Overlap */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {kolCount > 0 ? (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(220, 38, 38, 0.12)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {kolCount} KOL{kolCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>
        )}
      </div>
    </div>
  );
}

function EmptyPortfolio() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
        No own wallets yet
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Add your own wallets in Tracked and toggle "Own wallet" to populate your portfolio.
      </p>
      <Link
        href="/tracked"
        style={{
          padding: "8px 18px",
          background: "var(--accent)",
          border: "none",
          borderRadius: "6px",
          color: "#fff",
          fontSize: "12px",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Go to Tracked Wallets
      </Link>
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      <Skeleton style={{ height: "24px", width: "160px", marginBottom: "8px" }} />
      <Skeleton style={{ height: "14px", width: "240px", marginBottom: "28px" }} />
      <Skeleton style={{ height: "80px", borderRadius: "8px", marginBottom: "20px" }} />
      <Skeleton style={{ height: "280px", borderRadius: "8px" }} />
    </div>
  );
}

// --- Formatters ---

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1)         return n.toFixed(2);
  return n.toPrecision(3);
}

function formatPrice(p: number): string {
  if (p >= 1)       return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 0.0001)  return p.toFixed(6);
  return p.toExponential(2);
}
