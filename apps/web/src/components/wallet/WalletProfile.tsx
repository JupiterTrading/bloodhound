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
    <div className="container py-6">
      {/* ── Header card ───────────────────────────────────────── */}
      <div className="card p-6 mb-6">
          {/* Classification badges */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {data.classification.map((label) => (
              <ClassificationBadge key={label} label={label} />
            ))}
            {!data.known_wallet && data.entity_label && (
              <span className="badge badge-neutral uppercase">
                {data.entity_label.category}
              </span>
            )}
            {trackerData?.tracker_count != null && (
              <span className="ml-auto text-[12px] text-[var(--text-muted)]">
                {trackerData.tracker_count.toLocaleString()} tracking
              </span>
            )}
          </div>

          {/* Name + social handles */}
          <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight mb-2 text-[var(--text-primary)]">
                {displayName}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <AddressTag address={address} chars={44} size={13} />
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
            <div className="flex gap-2 flex-wrap">
              <Link href={`/graph/${address}`} className="btn btn-secondary btn-sm group">
                <svg className="w-4 h-4 transition-transform group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Open Graph
              </Link>
              <Link href={`/ai?q=${encodeURIComponent(`Summarize wallet ${address}`)}`} className="btn btn-primary btn-sm">
                Bloodhound AI
              </Link>
            </div>
          </div>

        {/* Stats strip */}
        <div className="flex gap-8 flex-wrap pt-4 border-t border-[var(--border)] mt-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Left: intelligence + token holdings + tx history */}
        <div>
          <IntelligenceSummary address={address} />
          <TokenHoldings address={address} />
          <NftHoldings address={address} />
          <TransactionHistory address={address} />
        </div>

        {/* Right: KOL Twitter + event involvement + counterparties + side wallets */}
        <div className="flex flex-col gap-4">
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
      <div className="text-[11px] text-[var(--text-muted)] tracking-wide uppercase mb-1">
        {label}
      </div>
      <div className={`text-[14px] lg:text-[15px] font-medium text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>
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
      className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
    >
      {platform === "twitter" ? "𝕏" : "✈"}
      {prefix}
      {handle.replace("@", "")}
    </a>
  );
}

function WalletProfileSkeleton() {
  return (
    <div className="container py-6">
      <div className="card p-6 mb-6">
        <div className="flex gap-2 mb-4">
          <Skeleton width={80} height={22} borderRadius={4} />
          <Skeleton width={100} height={22} borderRadius={4} />
        </div>
        <Skeleton height={28} width={200} style={{ marginBottom: 12 }} />
        <Skeleton height={14} width={280} style={{ marginBottom: 20 }} />
        <div className="flex gap-8">
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
    <div className="container py-6">
      <div className="card p-10 text-center">
        <p className="text-[14px] text-[var(--text-secondary)] mb-2">
          Could not load wallet data.
        </p>
        <p className="text-[12px] text-[var(--text-muted)]">
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
