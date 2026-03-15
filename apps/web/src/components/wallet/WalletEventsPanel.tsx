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
    <div className="card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)] text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
        Event Involvement — {events.length}
      </div>

      {events.map((ev) => {
        const color = CATEGORY_COLORS[ev.category] ?? "var(--text-muted)";
        return (
          <Link
            key={ev.slug}
            href={`/event/${ev.slug}`}
            className="no-underline block"
          >
            <div className="flex items-start gap-2.5 px-4 py-2.5 border-b border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors">
              <div
                className="w-[3px] h-8 rounded-sm shrink-0 mt-0.5"
                style={{ background: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                  {ev.title}
                </div>
                <div className="flex gap-2 items-center">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {ev.role?.replace("_", " ")}
                  </span>
                  {ev.description && (
                    <span className="text-[10px] text-[var(--text-muted)] overflow-hidden text-ellipsis whitespace-nowrap">
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
