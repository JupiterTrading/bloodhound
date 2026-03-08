"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { eventsApi, type KnownEvent } from "@/lib/api";

interface Props {
  address: string;
}

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

export function WalletEventsPanel({ address }: Props) {
  const { data } = useQuery({
    queryKey: ["wallet", "events", address],
    queryFn: () => eventsApi.walletEvents(address),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const events: (KnownEvent & { role: string; description: string | null })[] =
    (data?.events as (KnownEvent & { role: string; description: string | null })[]) ?? [];

  if (!data || events.length === 0) return null;

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
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Event Involvement — {events.length}
      </div>

      {events.map((ev) => {
        const color = CATEGORY_COLORS[ev.category] ?? "var(--text-muted)";
        return (
          <Link
            key={ev.slug}
            href={`/event/${ev.slug}`}
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                transition: "background 60ms",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = "transparent")
              }
            >
              <div
                style={{
                  width: "3px",
                  height: "32px",
                  borderRadius: "2px",
                  background: color,
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ev.title}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color,
                    }}
                  >
                    {ev.role?.replace("_", " ")}
                  </span>
                  {ev.description && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ev.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
