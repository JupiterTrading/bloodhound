"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { eventsApi, type KnownEvent } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

const CATEGORY_COLORS: Record<string, string> = {
  token_launch: "#3b82f6",
  rug_pull: "var(--accent)",
  hack: "var(--accent)",
  scandal: "#f59e0b",
  airdrop: "#22c55e",
  manipulation: "#f59e0b",
  collapse: "var(--accent)",
  other: "var(--text-muted)",
};

const CATEGORY_LABELS: Record<string, string> = {
  token_launch: "Launch",
  rug_pull: "Rug",
  hack: "Hack",
  scandal: "Scandal",
  airdrop: "Airdrop",
  manipulation: "Manipulation",
  collapse: "Collapse",
  other: "Event",
};

export function EventTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ["known-events"],
    queryFn: () => eventsApi.list({ limit: 8 }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const events: KnownEvent[] = data?.events ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
          Notable Events
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Cross-referenced against all wallets
        </span>
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
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                opacity: 1 - i * 0.15,
              }}
            >
              <Skeleton width={6} height={36} borderRadius={3} />
              <div style={{ flex: 1 }}>
                <Skeleton height={14} width={220} style={{ marginBottom: 6 }} />
                <Skeleton height={11} width={120} />
              </div>
              <Skeleton width={60} height={20} borderRadius={4} />
            </div>
          ))
        ) : events.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
            No events indexed yet.
          </div>
        ) : (
          events.map((event) => <EventRow key={event.slug} event={event} />)
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: KnownEvent }) {
  const color = CATEGORY_COLORS[event.category] ?? "var(--text-muted)";

  return (
    <Link href={`/event/${event.slug}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          transition: "background 60ms",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
      >
        {/* Category colour bar */}
        <div
          style={{
            width: "3px",
            height: "36px",
            borderRadius: "2px",
            background: color,
            flexShrink: 0,
          }}
        />

        {/* Title + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {formatDate(event.occurred_at)}
            </span>
            {event.token_symbol && (
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "var(--text-muted)",
                }}
              >
                ${event.token_symbol}
              </span>
            )}
          </div>
        </div>

        {/* Category badge */}
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: "4px",
            color,
            border: `1px solid ${color}`,
            flexShrink: 0,
          }}
        >
          {CATEGORY_LABELS[event.category] ?? event.category}
        </span>
      </div>
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
