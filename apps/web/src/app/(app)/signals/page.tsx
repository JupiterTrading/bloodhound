"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { signalsApi, type Signal } from "@/lib/api";

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  abnormal_inflow: "Abnormal Inflow",
  cluster_forming: "Cluster Forming",
  deployer_funding: "Deployer Funding",
  wash_trading: "Wash Trading",
  lp_removal: "LP Removal",
  dormant_wake: "Dormant Wake",
  insider_identified: "Insider Identified",
  pump_fun_bundler: "Pump.fun Bundler",
  known_sniper_active: "Sniper Active",
  dev_sold_supply: "Dev Sold Supply",
};

const SIGNAL_ICONS: Record<string, string> = {
  abnormal_inflow: "↑",
  cluster_forming: "◈",
  deployer_funding: "◎",
  wash_trading: "↻",
  lp_removal: "↓",
  dormant_wake: "◉",
  insider_identified: "◉",
  pump_fun_bundler: "⬡",
  known_sniper_active: "→",
  dev_sold_supply: "!",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  CONFIRMED: "#22c55e",
  PROBABLE: "#f59e0b",
  SUSPECTED: "var(--text-muted)",
};

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "abnormal_inflow", label: "Inflows" },
  { value: "deployer_funding", label: "Deployers" },
  { value: "insider_identified", label: "Insiders" },
  { value: "known_sniper_active", label: "Snipers" },
  { value: "dev_sold_supply", label: "Dev Sells" },
  { value: "pump_fun_bundler", label: "Bundlers" },
];

export default function SignalsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["signals", typeFilter, confidenceFilter, page],
    queryFn: () =>
      signalsApi.feed({
        types: typeFilter || undefined,
        confidence: confidenceFilter || undefined,
        page,
        limit: 50,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const signals = data?.signals ?? [];

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "6px",
          }}
        >
          Signals
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Detected anomalies, insider activity, and on-chain patterns — updated every 60s.
        </p>
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Type pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setTypeFilter(f.value);
                setPage(1);
              }}
              style={{
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: typeFilter === f.value ? 600 : 400,
                background:
                  typeFilter === f.value ? "var(--accent)" : "var(--bg-surface)",
                border: `1px solid ${
                  typeFilter === f.value ? "var(--accent)" : "var(--border)"
                }`,
                borderRadius: "20px",
                color: typeFilter === f.value ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 80ms",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Confidence selector */}
        <div style={{ marginLeft: "auto" }}>
          <select
            value={confidenceFilter}
            onChange={(e) => {
              setConfidenceFilter(e.target.value);
              setPage(1);
            }}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "12px",
              color: "var(--text-secondary)",
              fontFamily: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">All confidence</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROBABLE">Probable</option>
            <option value="SUSPECTED">Suspected</option>
          </select>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <SignalsSkeleton />
      ) : signals.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {signals.map((s, i) => (
            <SignalCard key={`${s.wallet_address}-${s.detected_at}-${i}`} signal={s} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && (data.count === 50 || page > 1) && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            marginTop: "24px",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: "7px 16px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "13px",
              color: page === 1 ? "var(--text-muted)" : "var(--text-secondary)",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Prev
          </button>
          <span
            style={{
              padding: "7px 12px",
              fontSize: "13px",
              color: "var(--text-muted)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={data.count < 50}
            style={{
              padding: "7px 16px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "13px",
              color: data.count < 50 ? "var(--text-muted)" : "var(--text-secondary)",
              cursor: data.count < 50 ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: Signal }) {
  const icon = SIGNAL_ICONS[signal.signal_type] ?? "·";
  const label = SIGNAL_TYPE_LABELS[signal.signal_type] ?? signal.signal_type.replace(/_/g, " ");
  const confidenceColor = CONFIDENCE_COLORS[signal.confidence] ?? "var(--text-muted)";
  const meta = signal.metadata ?? {};

  const walletShort = `${signal.wallet_address.slice(0, 6)}...${signal.wallet_address.slice(-4)}`;
  const timeAgo = formatTimeAgo(signal.detected_at);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        transition: "border-color 80ms",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--text-muted)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
      }
    >
      {/* Type icon */}
      <span
        style={{
          fontSize: "14px",
          color: "var(--accent)",
          width: "18px",
          textAlign: "center",
          flexShrink: 0,
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {icon}
      </span>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "3px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: confidenceColor,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ● {signal.confidence}
          </span>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/wallet/${signal.wallet_address}`}
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: "11px",
            }}
          >
            {walletShort}
          </Link>

          {typeof meta["amount_usd"] === "number" && (
            <span>${(meta["amount_usd"] as number).toLocaleString()}</span>
          )}
          {typeof meta["token_symbol"] === "string" && (
            <span>{meta["token_symbol"] as string}</span>
          )}
          {typeof meta["description"] === "string" && (
            <span style={{ color: "var(--text-secondary)" }}>
              {meta["description"] as string}
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          flexShrink: 0,
          whiteSpace: "nowrap",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {timeAgo}
      </span>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Empty / skeleton ──────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "6px" }}>
        No signals detected.
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Signals are generated as anomalies are detected on-chain. Check back soon.
      </p>
    </div>
  );
}

function SignalsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            height: "58px",
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
