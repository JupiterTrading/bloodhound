"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { walletApi } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

interface Props {
  address: string;
}

export function CounterpartiesPanel({ address }: Props) {
  const mountedAt = useRef(Date.now());
  const POLL_WINDOW_MS = 30_000;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wallet", "relationships", address],
    queryFn: () => walletApi.relationships(address),
    staleTime: 60_000,
    refetchInterval: (query) => {
      const cps = query.state.data?.counterparties ?? [];
      if (cps.length > 0) return false;
      if (Date.now() - mountedAt.current > POLL_WINDOW_MS) return false;
      return 5_000;
    },
  });

  const counterparties = (data?.counterparties ?? []).slice(0, 5);
  const isPolling = !isLoading && counterparties.length === 0 &&
    Date.now() - mountedAt.current < POLL_WINDOW_MS;

  return (
    <PanelShell
      title="Top Counterparties"
      headerRight={isPolling ? (
        <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
          {isFetching ? "checking..." : "analyzing"}
        </span>
      ) : undefined}
    >
      {isLoading || isPolling ? (
        <SkeletonList count={4} />
      ) : counterparties.length === 0 ? (
        <EmptyState text="No counterparties found." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {counterparties.map((cp, i) => (
            <div
              key={cp.counterparty}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom:
                  i < counterparties.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div>
                <Link
                  href={`/wallet/${cp.counterparty}`}
                  style={{ display: "block", marginBottom: "2px" }}
                >
                  <AddressTag address={cp.counterparty} />
                </Link>
                <span
                  style={{ fontSize: "11px", color: "var(--text-muted)" }}
                >
                  {cp.interaction_count} interactions
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                  }}
                >
                  ${cp.total_volume_usd.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {formatRelative(cp.last_interaction)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

export function SideWalletsPanel({ address }: Props) {
  const { user } = useUser();
  const mountedAt = useRef(Date.now());
  const POLL_WINDOW_MS = 30_000;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wallet", "side-wallets", address],
    queryFn: () => walletApi.sideWalletsTyped(address),
    staleTime: 120_000,
    refetchInterval: (query) => {
      const candidates = query.state.data?.candidates ?? [];
      if (candidates.length > 0) return false;
      if (Date.now() - mountedAt.current > POLL_WINDOW_MS) return false;
      return 5_000;
    },
  });

  const candidates = data?.candidates ?? [];
  const isPolling = !isLoading && candidates.length === 0 &&
    Date.now() - mountedAt.current < POLL_WINDOW_MS;

  return (
    <PanelShell
      title="Potential Side Wallets"
      headerRight={
        candidates.length > 0 ? (
          <Link
            href={`/entity/${address}`}
            style={{ fontSize: "11px", color: "var(--text-muted)", textDecoration: "none" }}
          >
            Entity profile →
          </Link>
        ) : isPolling ? (
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            {isFetching ? "checking..." : "analyzing"}
          </span>
        ) : undefined
      }
    >
      {isLoading ? (
        <SkeletonList count={3} />
      ) : isPolling ? (
        <SkeletonList count={3} />
      ) : candidates.length === 0 ? (
        <EmptyState text="No side wallets detected above threshold." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {candidates.map((cand, i) => (
            <div
              key={cand.address}
              style={{
                padding: "10px 0",
                borderBottom:
                  i < candidates.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <Link href={`/wallet/${cand.address}`}>
                  {cand.known_label ? (
                    <span
                      style={{
                        fontSize: "13px",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {cand.known_label}
                    </span>
                  ) : (
                    <AddressTag address={cand.address} />
                  )}
                </Link>
                <ConfidenceBar value={cand.confidence} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
                  {cand.signals.slice(0, 2).join(" · ")}
                </p>
                {user && (
                  <DisputeButton
                    walletAddress={address}
                    relatedAddress={cand.address}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function DisputeButton({
  walletAddress,
  relatedAddress,
}: {
  walletAddress: string;
  relatedAddress: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleDispute() {
    setState("loading");
    try {
      await fetch(`/api/v1/entity/${walletAddress}/dispute/${relatedAddress}`, {
        method: "POST",
      });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleDispute}
      disabled={state !== "idle"}
      title="Flag this relationship as incorrect"
      className={`text-[10px] text-[var(--text-muted)] bg-transparent border-none p-0.5 ${state === "idle" ? 'cursor-pointer underline decoration-dotted' : 'cursor-default'} ${state === "loading" ? 'opacity-50' : ''}`}
    >
      {state === "done" ? "Disputed ✓" : "Dispute"}
    </button>
  );
}

function PanelShell({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </section>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "var(--accent)" : pct >= 60 ? "#b36a00" : "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold"
      style={{ color }}
    >
      {pct}%
    </span>
  );
}

function SkeletonList({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton width={120} height={12} />
          <Skeleton width={50} height={12} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-[13px] text-[var(--text-muted)]">
      {text}
    </p>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
