"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { entityApi, EntityCluster, TokenHolding, KnownEvent } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { ClassificationBadge } from "@/components/ui/ClassificationBadge";
import { Skeleton } from "@/components/ui/Skeleton";

interface Props {
  address: string;
}

export function EntityProfile({ address }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["entity", address],
    queryFn: () => entityApi.get(address),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <EntitySkeleton />;
  if (error || !data) {
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
        <p style={{ fontSize: "13px", color: "var(--accent)" }}>
          Unable to load entity data — backend may be temporarily unavailable.
        </p>
      </div>
    );
  }

  const { known_wallet, cluster, total_usd, combined_holdings, combined_events, wallet_count } = data;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
            {known_wallet?.label ?? <AddressTag address={address} />}
          </h1>
          {known_wallet?.category && (
            <ClassificationBadge label={known_wallet.category} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {address}
          </span>
          <Link
            href={`/wallet/${address}`}
            style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}
          >
            Wallet ↗
          </Link>
        </div>
      </div>

      {/* Cluster summary bar */}
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
        <Stat label="Wallets in entity" value={String(wallet_count)} />
        <Stat label="Cluster confidence" value={cluster.members.length > 0 ? `${Math.round(cluster.cluster_confidence * 100)}%` : "—"} />
        <Stat
          label="Combined portfolio"
          value={total_usd > 0 ? `$${total_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
        />
        <Stat label="Events involved" value={String(combined_events.length)} />
      </div>

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Side wallets */}
          <Section title="Identity Cluster" badge={cluster.members.length > 0 ? String(cluster.members.length) : undefined}>
            {cluster.members.length === 0 ? (
              <EmptyState text="No side wallets detected yet. Clustering runs automatically in the background." />
            ) : (
              cluster.members.map((m) => (
                <ClusterMemberRow key={m.address} member={m} />
              ))
            )}
          </Section>

          {/* Events */}
          <Section title="Events Involved" badge={combined_events.length > 0 ? String(combined_events.length) : undefined}>
            {combined_events.length === 0 ? (
              <EmptyState text="No known events linked to this entity." />
            ) : (
              combined_events.slice(0, 5).map((evt) => (
                <EventRow key={evt.slug} event={evt} />
              ))
            )}
          </Section>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Combined holdings */}
          <Section title="Combined Holdings" badge={combined_holdings.length > 0 ? String(combined_holdings.length) : undefined}>
            {combined_holdings.length === 0 ? (
              <EmptyState text="No token holdings found." />
            ) : (
              combined_holdings.slice(0, 10).map((h) => (
                <HoldingRow key={h.mint} holding={h} />
              ))
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
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
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
        {badge !== undefined && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              background: "var(--bg-base)",
              padding: "1px 6px",
              borderRadius: "4px",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
      {text}
    </div>
  );
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   "var(--accent)",
  medium: "#f59e0b",
  low:    "var(--text-muted)",
};

function confidenceLabel(conf: number) {
  if (conf >= 0.75) return { label: "HIGH", color: CONFIDENCE_COLORS.high };
  if (conf >= 0.55) return { label: "MED",  color: CONFIDENCE_COLORS.medium };
  return              { label: "LOW",  color: CONFIDENCE_COLORS.low };
}

interface ClusterMember {
  address: string;
  confidence: number;
  signals: string[];
  explanation: string | null;
}

function ClusterMemberRow({ member }: { member: ClusterMember }) {
  const { label, color } = confidenceLabel(member.confidence);
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link
          href={`/entity/${member.address}`}
          style={{ fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", textDecoration: "none" }}
        >
          <AddressTag address={member.address} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color }}>{label}</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {Math.round(member.confidence * 100)}%
          </span>
          <Link
            href={`/wallet/${member.address}`}
            style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}
          >
            ↗
          </Link>
        </div>
      </div>
      {member.explanation && (
        <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
          {member.explanation}
        </p>
      )}
      {member.signals.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {member.signals.map((s) => (
            <span
              key={s}
              style={{
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "3px",
                background: "var(--bg-base)",
                color: "var(--text-muted)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingRow({ holding }: { holding: TokenHolding }) {
  const symbol = holding.symbol ?? holding.name ?? "—";
  const usd = holding.usd_value ?? 0;
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link
        href={`/token/${holding.mint}`}
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          textDecoration: "none",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        ${symbol}
      </Link>
      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
        {usd > 0 ? `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
      </span>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  token_launch: "var(--accent)",
  rug_pull:     "#ef4444",
  hack:         "#ef4444",
  scandal:      "#f59e0b",
  airdrop:      "#22c55e",
  manipulation: "#f59e0b",
  collapse:     "#ef4444",
  other:        "var(--text-muted)",
};

function EventRow({ event }: { event: KnownEvent }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "3px",
          height: "32px",
          borderRadius: "2px",
          background: CATEGORY_COLORS[event.category] ?? "var(--text-muted)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/event/${event.slug}`}
          style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}
        >
          {event.title}
        </Link>
        <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            {event.category}
          </span>
          {event.token_symbol && (
            <span style={{ fontSize: "10px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
              ${event.token_symbol}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EntitySkeleton() {
  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      <Skeleton style={{ height: "24px", width: "200px", marginBottom: "8px" }} />
      <Skeleton style={{ height: "14px", width: "360px", marginBottom: "28px" }} />
      <Skeleton style={{ height: "80px", borderRadius: "8px", marginBottom: "24px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <Skeleton style={{ height: "260px", borderRadius: "8px" }} />
        <Skeleton style={{ height: "260px", borderRadius: "8px" }} />
      </div>
    </div>
  );
}
