"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";
import { PnLBadge } from "@/components/ui/PnLBadge";

interface KolWallet {
  id: string;
  address: string;
  label: string | null;
  is_primary: boolean;
}

interface KolProfile {
  id: string;
  display_name: string;
  twitter_handle: string | null;
  twitter_pfp_url: string | null;
  telegram_handle: string | null;
  description: string | null;
  total_pnl_usd: number;
  win_rate: number;
  trade_count: number;
  verified: boolean;
  kol_wallets: KolWallet[];
}

interface Trade {
  tx_signature: string;
  block_time: string;
  trader: string;
  dex: string;
  token_in_mint: string;
  token_out_mint: string;
  amount_usd: number;
  realized_pnl_usd: number;
}

async function fetchKolProfile(handle: string): Promise<KolProfile> {
  const res = await fetch(`/api/v1/kol/profiles/${handle}`);
  if (!res.ok) throw new Error("Failed to fetch KOL profile");
  return res.json();
}

async function fetchKolTrades(handle: string): Promise<{ trades: Trade[] }> {
  const res = await fetch(`/api/v1/kol/profiles/${handle}/trades?limit=50`);
  if (!res.ok) throw new Error("Failed to fetch trades");
  return res.json();
}

export function KolProfileView({ handle }: { handle: string }) {
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["kol-profile", handle],
    queryFn: () => fetchKolProfile(handle),
    staleTime: 60_000,
  });

  const { data: tradesData } = useQuery({
    queryKey: ["kol-trades", handle],
    queryFn: () => fetchKolTrades(handle),
    staleTime: 30_000,
    enabled: !!profile,
  });

  if (isLoading) return <KolProfileSkeleton />;
  if (error || !profile) {
    return (
      <div className="container py-20 text-center">
        <div className="text-[48px] mb-4">🔍</div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          KOL Not Found
        </h2>
        <p className="text-[var(--text-muted)] mb-6">
          We couldn't find a KOL with handle @{handle}
        </p>
        <Link href="/kols" className="btn btn-secondary">
          Browse KOLs
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Header Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* PFP */}
          <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] border-2 border-[var(--border)] overflow-hidden shrink-0">
            {profile.twitter_pfp_url ? (
              <img
                src={profile.twitter_pfp_url}
                alt={profile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-3xl">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {profile.display_name}
              </h1>
              {profile.verified && (
                <span className="badge badge-accent">Verified</span>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4">
              {profile.twitter_handle && (
                <a
                  href={`https://x.com/${profile.twitter_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  @{profile.twitter_handle}
                </a>
              )}
              {profile.telegram_handle && (
                <a
                  href={`https://t.me/${profile.telegram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  t.me/{profile.telegram_handle}
                </a>
              )}
            </div>

            {profile.description && (
              <p className="text-[14px] text-[var(--text-secondary)] mb-4">
                {profile.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-8 pt-4 border-t border-[var(--border)]">
              <Stat
                label="Total PnL"
                value={
                  <span className={profile.total_pnl_usd >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}>
                    {profile.total_pnl_usd >= 0 ? "+" : ""}${Math.abs(profile.total_pnl_usd).toLocaleString()}
                  </span>
                }
              />
              <Stat
                label="Win Rate"
                value={`${profile.win_rate.toFixed(1)}%`}
              />
              <Stat
                label="Trades"
                value={profile.trade_count.toLocaleString()}
              />
              <Stat
                label="Wallets"
                value={profile.kol_wallets?.length || 0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Trades */}
        <div>
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-primary)]">Recent Trades</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {tradesData?.trades?.length ? (
                tradesData.trades.map((trade) => (
                  <TradeRow key={trade.tx_signature} trade={trade} />
                ))
              ) : (
                <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No trades found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Wallets */}
        <div>
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-primary)]">Linked Wallets</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {profile.kol_wallets?.map((wallet) => (
                <Link
                  key={wallet.id}
                  href={`/wallet/${wallet.address}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {wallet.label || "Wallet"}
                      </span>
                      {wallet.is_primary && (
                        <span className="badge badge-neutral text-[9px]">PRIMARY</span>
                      )}
                    </div>
                    <AddressTag address={wallet.address} size={11} />
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="font-mono text-[15px] font-medium text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const time = new Date(trade.block_time).toLocaleString();
  
  return (
    <div className="flex items-center px-4 py-3 gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-medium text-[var(--text-primary)]">
            {trade.dex}
          </span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            ${trade.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="font-mono text-[10px] text-[var(--text-faint)]">
          {time}
        </div>
      </div>
      <PnLBadge value={trade.realized_pnl_usd} />
    </div>
  );
}

function KolProfileSkeleton() {
  return (
    <div className="container py-6">
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="flex gap-8 pt-4 border-t border-[var(--border)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-20" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
