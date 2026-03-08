"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { walletApi } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { ClassificationBadge } from "@/components/ui/ClassificationBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { IntelligenceSummary } from "@/components/wallet/IntelligenceSummary";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { CounterpartiesPanel, SideWalletsPanel } from "@/components/wallet/CounterpartiesPanel";
import { TokenHoldings } from "@/components/wallet/TokenHoldings";
import { NftHoldings } from "@/components/wallet/NftHoldings";
import { KolTwitterCard } from "@/components/wallet/KolTwitterCard";
import { WalletEventsPanel } from "@/components/wallet/WalletEventsPanel";

interface Props {
  address: string;
}

export function WalletProfile({ address }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet", "summary", address],
    queryFn: () => walletApi.summary(address),
    staleTime: 30_000,
  });

  const { data: trackerData } = useQuery({
    queryKey: ["wallet", "tracker-count", address],
    queryFn: () => walletApi.trackerCount(address),
    staleTime: 120_000,
  });

  if (isLoading) return <WalletProfileSkeleton />;
  if (error) return <WalletProfileError address={address} />;
  if (!data) return null;

  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const displayName = data.known_wallet?.label ?? data.entity_label?.label ?? short;

  return (
    <div
      className="page-container"
      style={{
        padding: "24px 32px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* ── Header card ─────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        {/* Classification badges */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "14px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {data.classification.map((label) => (
            <ClassificationBadge key={label} label={label} />
          ))}
          {!data.known_wallet && data.entity_label && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {data.entity_label.category}
            </span>
          )}
          {trackerData?.tracker_count != null && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              Tracked by{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                {trackerData.tracker_count.toLocaleString()}
              </span>{" "}
              users
            </span>
          )}
        </div>

        {/* Name + social handles */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                marginBottom: "6px",
              }}
            >
              {displayName}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <AddressTag address={address} chars={6} size={13} />
              {data.known_wallet?.twitter_handle && (
                <SocialHandle
                  platform="twitter"
                  handle={data.known_wallet.twitter_handle}
                />
              )}
              {data.known_wallet?.telegram_handle && (
                <SocialHandle
                  platform="telegram"
                  handle={data.known_wallet.telegram_handle}
                />
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <ActionButton href={`/graph/${address}`} label="Open Graph" />
            <ActionButton href={`/ai?q=${encodeURIComponent(`Summarize wallet ${address}`)}`} label="Bloodhound AI" primary />
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            flexWrap: "wrap",
            paddingTop: "16px",
            borderTop: "1px solid var(--border)",
            marginTop: "16px",
          }}
        >
          <Stat
            label="SOL Balance"
            value={
              data.sol_balance != null
                ? `${data.sol_balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`
                : "—"
            }
            mono
          />
          <Stat
            label="Portfolio"
            value={
              data.portfolio_usd != null
                ? `$${data.portfolio_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : "—"
            }
            mono
          />
          <Stat label="Total Txs" value={data.total_txs.toLocaleString()} mono />
          <Stat
            label="Volume"
            value={
              data.total_volume_usd > 0
                ? `$${formatLarge(data.total_volume_usd)}`
                : "—"
            }
            mono
          />
          <Stat
            label="First Active"
            value={data.first_active ? formatDate(data.first_active) : "—"}
          />
          <Stat
            label="Last Active"
            value={data.last_active ? formatRelative(data.last_active) : "—"}
          />
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div
        className="grid-responsive-2"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Left: intelligence + token holdings + tx history */}
        <div>
          <IntelligenceSummary address={address} />
          <TokenHoldings address={address} />
          <NftHoldings address={address} />
          <TransactionHistory address={address} />
        </div>

        {/* Right: KOL Twitter + event involvement + counterparties + side wallets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {data.known_wallet?.twitter_handle && (
            <KolTwitterCard address={address} />
          )}
          <WalletEventsPanel address={address} />
          <CounterpartiesPanel address={address} />
          <SideWalletsPanel address={address} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: mono ? "15px" : "14px",
          fontWeight: 500,
          color: "var(--text-primary)",
          fontFamily: mono ? "JetBrains Mono, monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SocialHandle({
  platform,
  handle,
}: {
  platform: "twitter" | "telegram";
  handle: string;
}) {
  const url =
    platform === "twitter"
      ? `https://x.com/${handle.replace("@", "")}`
      : `https://t.me/${handle.replace("@", "")}`;
  const prefix = platform === "twitter" ? "@" : "t.me/";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: "var(--text-muted)",
        textDecoration: "none",
        transition: "color 0.1s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.color =
          "var(--text-primary)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLAnchorElement).style.color =
          "var(--text-muted)")
      }
    >
      {platform === "twitter" ? "𝕏" : "✈"}
      {prefix}
      {handle.replace("@", "")}
    </a>
  );
}

function ActionButton({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: "6px",
        fontSize: "13px",
        fontWeight: 500,
        textDecoration: "none",
        background: primary ? "var(--accent)" : "transparent",
        border: `1px solid ${primary ? "var(--accent)" : "var(--border)"}`,
        color: primary ? "#fff" : "var(--text-secondary)",
        transition: "background 80ms, border-color 80ms, color 80ms",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (primary) {
          el.style.background = "var(--accent-hover)";
        } else {
          el.style.borderColor = "var(--text-muted)";
          el.style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (primary) {
          el.style.background = "var(--accent)";
        } else {
          el.style.borderColor = "var(--border)";
          el.style.color = "var(--text-secondary)";
        }
      }}
    >
      {label}
    </Link>
  );
}

function WalletProfileSkeleton() {
  return (
    <div style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <Skeleton width={80} height={22} borderRadius={4} />
          <Skeleton width={100} height={22} borderRadius={4} />
        </div>
        <Skeleton height={28} width={200} style={{ marginBottom: 12 }} />
        <Skeleton height={14} width={280} style={{ marginBottom: 20 }} />
        <div style={{ display: "flex", gap: "32px" }}>
          {[80, 100, 70, 90, 100, 80].map((w, i) => (
            <div key={i}>
              <Skeleton height={10} width={50} style={{ marginBottom: 6 }} />
              <Skeleton height={16} width={w} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WalletProfileError({ address }: { address: string }) {
  return (
    <div
      className="page-container"
      style={{
        padding: "24px 32px",
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            marginBottom: "8px",
          }}
        >
          Could not load wallet data.
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          <AddressTag address={address} />
        </p>
      </div>
    </div>
  );
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function formatLarge(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
