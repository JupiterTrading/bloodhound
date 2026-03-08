"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { eventsApi } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";

const CATEGORY_LABELS: Record<string, string> = {
  token_launch: "Token Launch",
  rug_pull: "Rug Pull",
  hack: "Hack",
  scandal: "Scandal",
  airdrop: "Airdrop",
  manipulation: "Market Manipulation",
  collapse: "Collapse",
  other: "Event",
};

const SIGNIFICANCE_COLORS: Record<string, string> = {
  historic: "var(--accent)",
  notable: "#f59e0b",
  minor: "var(--text-muted)",
};

const ROLE_LABELS: Record<string, string> = {
  deployer: "Deployer",
  early_buyer: "Early Buyer",
  insider: "Insider",
  bundler: "Bundler",
  recipient: "Recipient",
  victim: "Victim",
  team: "Team",
  suspicious: "Suspicious",
  other: "Involved",
};

interface Props {
  slug: string;
}

export function EventDetail({ slug }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["event", slug],
    queryFn: () => eventsApi.get(slug),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <EventDetailSkeleton />;

  if (error || !data) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Event not found.</p>
          <Link
            href="/intelligence"
            style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none", marginTop: "12px", display: "inline-block" }}
          >
            ← Back to Intelligence
          </Link>
        </div>
      </div>
    );
  }

  const event = data;
  const wallets: EventWallet[] = event.wallets ?? [];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/intelligence"
          style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}
        >
          Intelligence
        </Link>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 6px" }}>›</span>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Events</span>
      </div>

      {/* Event header */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <CategoryBadge category={event.category} />
          <SignificanceBadge significance={event.significance} />
          {event.token_symbol && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 600,
                fontFamily: "JetBrains Mono, monospace",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              ${event.token_symbol}
            </span>
          )}
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          {event.title}
        </h1>

        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
          {formatDate(event.occurred_at)}
        </p>

        {event.description && (
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              borderTop: "1px solid var(--border)",
              paddingTop: "16px",
            }}
          >
            {event.description}
          </p>
        )}

        {/* Action links */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
          <Link
            href={`/ai?q=${encodeURIComponent(`Tell me about the ${event.title} event on Solana`)}`}
            style={actionButtonStyle(true)}
          >
            Ask Bloodhound AI
          </Link>
          {event.token_mint && (
            <Link href={`/token/${event.token_mint}`} style={actionButtonStyle(false)}>
              View Token →
            </Link>
          )}
        </div>
      </div>

      {/* Involved wallets */}
      {wallets.length > 0 && (
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
            Involved Wallets — {wallets.length}
          </div>

          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 1fr 100px",
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <span>Role</span>
              <span>Address</span>
              <span>Note</span>
              <span style={{ textAlign: "right" }}>Amount</span>
            </div>

            {wallets.map((w) => (
              <WalletRow key={w.address} wallet={w} />
            ))}
          </div>
        </div>
      )}

      {wallets.length === 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "32px",
            textAlign: "center",
            fontSize: "13px",
            color: "var(--text-muted)",
          }}
        >
          No wallet associations indexed yet for this event.
        </div>
      )}
    </div>
  );
}

interface EventWallet {
  address: string;
  role: string;
  description: string | null;
  amount_usd: number | null;
  known_wallet?: { label: string; category: string } | null;
}

function WalletRow({ wallet: w }: { wallet: EventWallet }) {
  return (
    <Link href={`/wallet/${w.address}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 1fr 100px",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
          gap: "8px",
          transition: "background 60ms",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
      >
        <RoleBadge role={w.role} />

        <div style={{ minWidth: 0 }}>
          {w.known_wallet?.label && (
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
              {w.known_wallet.label}
            </div>
          )}
          <AddressTag address={w.address} chars={6} size={11} />
        </div>

        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {w.description ?? "—"}
        </span>

        <div style={{ textAlign: "right" }}>
          {w.amount_usd != null ? (
            <span style={{ fontSize: "12px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
              ${w.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          ) : (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        background: "var(--bg-elevated)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function SignificanceBadge({ significance }: { significance: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        color: SIGNIFICANCE_COLORS[significance] ?? "var(--text-muted)",
        border: `1px solid ${SIGNIFICANCE_COLORS[significance] ?? "var(--border)"}`,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {significance}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const roleColors: Record<string, string> = {
    deployer: "var(--accent)",
    insider: "var(--accent)",
    bundler: "#f59e0b",
    early_buyer: "#f59e0b",
    suspicious: "#f59e0b",
    victim: "#22c55e",
    recipient: "var(--text-muted)",
    team: "var(--text-secondary)",
    other: "var(--text-muted)",
  };
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: roleColors[role] ?? "var(--text-muted)",
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function actionButtonStyle(primary: boolean): React.CSSProperties {
  return {
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
    whiteSpace: "nowrap",
  };
}

function EventDetailSkeleton() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
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
          <Skeleton width={100} height={22} borderRadius={4} />
          <Skeleton width={70} height={22} borderRadius={4} />
        </div>
        <Skeleton height={30} width={320} style={{ marginBottom: 8 }} />
        <Skeleton height={14} width={120} style={{ marginBottom: 20 }} />
        <Skeleton height={14} width="100%" style={{ marginBottom: 6 }} />
        <Skeleton height={14} width="90%" style={{ marginBottom: 6 }} />
        <Skeleton height={14} width="95%" />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
