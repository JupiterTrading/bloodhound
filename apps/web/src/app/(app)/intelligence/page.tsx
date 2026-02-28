"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { walletApi, type WalletSummary, type IntelligenceSummary } from "@/lib/api";
import { ClassificationBadge } from "@/components/ui/ClassificationBadge";
import { ConfidenceBadge, type Confidence } from "@/components/ui/ConfidenceBadge";
import { AddressTag } from "@/components/ui/AddressTag";

// Known wallets to feature on the landing
const FEATURED_WALLETS = [
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", label: "punk.sol", note: "BONK deployer" },
  { address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", note: "Raydium: AMM v4" },
  { address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", note: "Pump.fun: program" },
  { address: "So11111111111111111111111111111111111111112", label: "Wrapped SOL", note: "Native mint" },
];

export default function IntelligencePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // If it looks like a full address, show inline intelligence
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      setSearched(q);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
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

      {/* Featured wallets */}
      {!searched && (
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
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {FEATURED_WALLETS.map((fw) => (
              <FeaturedRow key={fw.address} {...fw} />
            ))}
          </div>

          <div style={{ marginTop: "40px" }}>
            <ClassificationGuide />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Intelligence preview card ─────────────────────────────────────────────────

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
      {/* Header */}
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

      {/* Stats row */}
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
              style={{
                padding: "12px 16px",
                borderRight: "1px solid var(--border)",
              }}
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

      {/* AI narrative */}
      <div style={{ padding: "16px 20px" }}>
        {intelQ.isLoading ? (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Generating intelligence summary...
          </p>
        ) : intel?.summary ? (
          <div>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.65,
                color: "var(--text-secondary)",
                marginBottom: "12px",
              }}
            >
              {intel.summary}
            </p>
            <ConfidenceBadge confidence={intel.confidence as Confidence} />
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            No intelligence summary available for this address.{" "}
            <Link href={`/wallet/${address}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
              View full profile →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Featured row ──────────────────────────────────────────────────────────────

function FeaturedRow({
  address,
  label,
  note,
}: {
  address: string;
  label?: string;
  note: string;
}) {
  return (
    <Link
      href={`/wallet/${address}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          transition: "border-color 80ms",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
        }
      >
        <span style={{ fontSize: "14px", color: "var(--text-muted)", width: "16px", textAlign: "center", flexShrink: 0 }}>
          ◎
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
              {label}
            </div>
          )}
          <AddressTag address={address} chars={6} size={11} />
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {note}
        </span>
        <span style={{ fontSize: "13px", color: "var(--text-muted)", flexShrink: 0 }}>→</span>
      </div>
    </Link>
  );
}

// ── Classification guide ──────────────────────────────────────────────────────

function ClassificationGuide() {
  const classes = [
    { label: "WHALE", desc: "Holds or moves >$500K in a single wallet" },
    { label: "SMART MONEY", desc: "Consistent early entry on winning trades, high win rate" },
    { label: "SNIPER", desc: "Buys within seconds of launch, automated patterns" },
    { label: "DEPLOYER", desc: "Has deployed one or more token or program accounts" },
    { label: "BOT", desc: "High-frequency, low-variance automated trading patterns" },
    { label: "BUNDLER", desc: "Uses Jito bundles to co-snipe with other wallets" },
  ];

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
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Classification Labels
      </div>
      <div style={{ padding: "4px 0" }}>
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
