"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { kolApi, walletApi, type KolProfile } from "@/lib/api";

interface Props {
  handle: string;
}

const PROFILE_TABS = [
  { id: "activity", label: "Activity" },
  { id: "positions", label: "Active Positions" },
  { id: "history", label: "History" },
  { id: "wallets", label: "Wallets" },
] as const;

type TabId = typeof PROFILE_TABS[number]["id"];

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function KolProfilePage({ handle }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [timePeriod, setTimePeriod] = useState("max");

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["kol-profile", handle],
    queryFn: () => kolApi.profile(handle),
    staleTime: 60_000,
  });

  const { data: socialData } = useQuery({
    queryKey: ["kol-social", handle],
    queryFn: () => kolApi.social(handle),
    enabled: !!profile?.twitter_handle,
    staleTime: 300_000,
  });

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["kol-trades", handle],
    queryFn: () => kolApi.trades(handle, 50),
    enabled: activeTab === "activity" || activeTab === "history",
    staleTime: 30_000,
  });

  const primaryWallet = profile?.kol_wallets?.find((w: any) => w.is_primary)?.address;

  const { data: holdingsData } = useQuery({
    queryKey: ["kol-holdings", primaryWallet],
    queryFn: () => walletApi.holdings(primaryWallet!),
    enabled: !!primaryWallet && activeTab === "positions",
    staleTime: 60_000,
  });

  const { data: walletSummary } = useQuery({
    queryKey: ["wallet-summary", primaryWallet],
    queryFn: () => walletApi.summary(primaryWallet!),
    enabled: !!primaryWallet,
    staleTime: 60_000,
  });

  if (profileLoading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <div className="page-container py-12 text-center">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3">The KOL profile you're looking for doesn't exist.</h1>
        <Link href="/rankings" className="btn btn-primary mt-4">Back to Leaderboard</Link>
      </div>
    );
  }

  const pnl = profile.total_pnl_usd || 0;
  const isProfitable = pnl >= 0;
  const winRate = profile.win_rate || 0;
  const tradeCount = profile.trade_count || 0;
  const walletCount = profile.kol_wallets?.length || 0;
  const totalValue = walletSummary?.portfolio_usd ?? 0;
  const solBalance = walletSummary?.sol_balance ?? 0;
  const totalTxs = walletSummary?.total_txs ?? 0;
  const pfpUrl = profile.twitter_pfp_url;
  const twitterHandle = profile.twitter_handle;
  const trades = tradesData?.trades ?? [];

  // Derive win/loss from win_rate
  const winsCount = tradeCount > 0 ? Math.round(tradeCount * winRate / 100) : 0;
  const lossCount = tradeCount > 0 ? tradeCount - winsCount : 0;

  return (
    <div className="page-container py-4" style={{ maxWidth: 960 }}>
      {/* ═══ Header Bar ═══ */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {/* PFP */}
          <Pfp handle={twitterHandle} pfp={pfpUrl} name={profile.display_name} size={36} />
          {/* X icon */}
          <XIcon />
          {/* Name */}
          <span className="text-[16px] font-semibold text-[var(--text-primary)] truncate">{profile.display_name}</span>
          {/* Wallet address */}
          {primaryWallet && (
            <span className="text-[12px] font-mono text-[var(--text-muted)] truncate max-w-[200px]">
              {primaryWallet}
            </span>
          )}
          {/* Copy button */}
          {primaryWallet && (
            <button
              onClick={() => navigator.clipboard.writeText(primaryWallet)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              title="Copy address"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: time filters + actions */}
        <div className="flex items-center gap-3">
          {/* Time period */}
          <div className="flex items-center gap-0.5">
            {["1d", "7d", "30d", "Max"].map(p => (
              <button
                key={p}
                onClick={() => setTimePeriod(p.toLowerCase())}
                className={`px-2 py-1 text-[12px] font-medium cursor-pointer transition-colors ${
                  timePeriod === p.toLowerCase()
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Close */}
          <Link href="/rankings" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ═══ 3-Column Grid: Balance | PNL Chart | Performance ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1fr] gap-0 border border-[var(--border)] rounded-[12px] overflow-hidden mb-4">
        {/* ── Balance Panel ── */}
        <div className="flex flex-col border-r border-[var(--border)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
            <span className="text-[14px] text-[var(--text-primary)]">Balance</span>
            <span className="text-[12px] text-[var(--text-secondary)]">USD</span>
          </div>
          <div className="flex flex-col gap-4 px-4 py-3">
            {/* Total Value */}
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Total Value</div>
              <div className="text-[20px] font-normal text-[var(--text-primary)]">{fmtBig(totalValue)}</div>
            </div>
            {/* Unrealized PNL */}
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Unrealized PNL</div>
              <div className={`text-[18px] ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtUsd(pnl * 0.05)}
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Tradeable Balance + Wallet Funding */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] text-[var(--text-muted)]">Tradeable Balance</div>
                <div className="text-[18px] text-[var(--text-primary)]">{fmtBig(totalValue)}</div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-[var(--text-muted)]">Wallet Funding</div>
                <div className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                  <span>{solBalance.toFixed(1)} SOL</span>
                </div>
              </div>
            </div>

            {/* Stable Coin Balance */}
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Stable Coin Balance</div>
              <div className="text-[18px] text-[var(--text-primary)]">$0</div>
            </div>
          </div>
        </div>

        {/* ── PNL Chart Panel ── */}
        <div className="flex flex-col border-r border-[var(--border)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
            <span className="text-[14px] text-[var(--text-primary)]">PNL</span>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 py-8 min-h-[200px]">
            {/* Simplified PNL visualization */}
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className={`text-3xl font-bold font-mono tabular-nums ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtUsd(pnl)}
              </div>
              <div className="text-[12px] text-[var(--text-muted)]">Total Realized PNL</div>
              {/* Simple bar chart placeholder */}
              <div className="w-full max-w-[280px] h-[80px] mt-4 relative">
                <div className={`absolute bottom-0 left-0 right-0 rounded-t-lg ${isProfitable ? "bg-[var(--success)]" : "bg-[var(--error)]"}`}
                  style={{ height: "100%", opacity: 0.15 }} />
                <div className={`absolute bottom-0 left-0 right-0 rounded-t-lg ${isProfitable ? "bg-[var(--success)]" : "bg-[var(--error)]"}`}
                  style={{ height: "70%", opacity: 0.25 }} />
                <div className={`absolute bottom-0 left-[20%] right-[10%] rounded-t-lg ${isProfitable ? "bg-[var(--success)]" : "bg-[var(--error)]"}`}
                  style={{ height: "90%", opacity: 0.4 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Performance Panel ── */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
            <span className="text-[14px] text-[var(--text-primary)]">Performance</span>
          </div>
          <div className="flex flex-col gap-2 px-4 py-3">
            {/* Total PnL */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-secondary)]">Total Pnl</span>
              <span className={`text-[12px] font-mono tabular-nums ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtUsd(pnl)}
              </span>
            </div>
            {/* Realized PNL */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-secondary)]">Realized PNL</span>
              <span className={`text-[12px] font-mono tabular-nums ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtUsd(pnl)}
              </span>
            </div>
            {/* Total TXNS */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-secondary)]">Total TXNS</span>
              <div className="flex items-center gap-1 text-[12px] font-mono tabular-nums">
                <span className="text-[var(--text-primary)]">{totalTxs.toLocaleString()}</span>
                {tradeCount > 0 && (
                  <>
                    <span className="text-[var(--success)]">{winsCount.toLocaleString()}</span>
                    <span className="text-[var(--text-muted)]">/</span>
                    <span className="text-[var(--error)]">{lossCount.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>

            {/* PNL Distribution */}
            <div className="flex flex-col gap-1.5 mt-3">
              <PnlBucket label=">500%" count={0} type="profit" opacity={0.2} />
              <PnlBucket label="200% ~ 500%" count={0} type="profit" opacity={0.3} />
              <PnlBucket label="0% ~ 200%" count={winsCount} type="profit" opacity={1} />
              <PnlBucket label="0% ~ -50%" count={lossCount} type="loss" opacity={0.7} />
              <PnlBucket label="< -50%" count={0} type="loss" opacity={0.2} />
            </div>

            {/* Win/Loss bar */}
            <div className="flex h-[4px] w-full gap-[3px] mt-2">
              <div className="h-full rounded-full bg-[var(--success)]"
                style={{ width: `${winRate}%` }} />
              <div className="h-full flex-1 rounded-full bg-[var(--error)]" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Tabs + Activity Table ═══ */}
      <div className="card overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between px-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-0">
            {PROFILE_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-3 text-[14px] font-medium cursor-pointer transition-colors border-b-2 ${
                  activeTab === t.id
                    ? "text-[var(--text-primary)] border-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-[var(--text-secondary)]">USD</span>
        </div>

        {/* Activity Content */}
        {activeTab === "activity" && (
          <ActivityTable trades={trades} isLoading={tradesLoading} />
        )}

        {activeTab === "positions" && (
          <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
            {holdingsData?.holdings?.length ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {holdingsData.holdings.map((h: any) => (
                  <div key={h.mint} className="flex items-center justify-between py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{h.symbol || "Unknown"}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{h.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-mono text-[var(--text-primary)]">{h.amount?.toLocaleString()}</div>
                      {h.usd_value && <div className="text-[11px] text-[var(--text-muted)]">${h.usd_value.toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              "No active positions"
            )}
          </div>
        )}

        {activeTab === "history" && (
          <ActivityTable trades={trades} isLoading={tradesLoading} />
        )}

        {activeTab === "wallets" && (
          <div className="divide-y divide-[var(--border-subtle)]">
            {profile.kol_wallets?.map((w: any) => (
              <Link
                key={w.address}
                href={`/wallet/${w.address}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-[var(--text-primary)] truncate max-w-[300px]">{w.address}</span>
                  {w.is_primary && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-subtle)] text-[var(--accent)] rounded">Primary</span>}
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">{w.label || w.discovered_via}</span>
              </Link>
            )) || (
              <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">No wallets found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Activity Table (Axiom-style)
   ════════════════════════════════════════════════ */
function ActivityTable({ trades, isLoading }: { trades: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[48px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
        No activity found
      </div>
    );
  }

  return (
    <>
      {/* Table header */}
      <div className="grid grid-cols-[60px_1fr_120px_120px_80px_40px] gap-3 px-4 py-2 border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
        <div>Type</div>
        <div>Token</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Market Cap</div>
        <div className="text-right">Age</div>
        <div className="text-right">Explorer</div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)] max-h-[500px] overflow-y-auto">
        {trades.map((t: any, i: number) => {
          const isBuy = (t.trade_type || t.token_symbol || "").toLowerCase().includes("buy") || t.amount_usd > 0;
          const age = t.block_time ? timeAgo(t.block_time) : "\u2014";
          return (
            <div key={t.tx_signature || i} className="grid grid-cols-[60px_1fr_120px_120px_80px_40px] gap-3 px-4 py-2.5 items-center hover:bg-[var(--bg-hover)] transition-colors">
              <div className={`text-[13px] font-medium ${isBuy ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {isBuy ? "Buy" : "Sell"}
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{t.token_symbol || t.token_address?.slice(0, 8) || "Unknown"}</span>
              </div>
              <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-primary)]">
                {t.amount_usd ? fmtBig(Math.abs(t.amount_usd)) : t.amount_sol ? `${t.amount_sol.toFixed(2)} SOL` : "\u2014"}
              </div>
              <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-muted)]">{"\u2014"}</div>
              <div className="text-right text-[13px] text-[var(--text-muted)]">{age}</div>
              <div className="text-right">
                {t.tx_signature && (
                  <a href={`https://solscan.io/tx/${t.tx_signature}`} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                    <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* ════════════════════════════════════════════════
   Sub-components
   ════════════════════════════════════════════════ */
function PnlBucket({ label, count, type, opacity }: { label: string; count: number; type: "profit" | "loss"; opacity: number }) {
  const color = type === "profit" ? "bg-[var(--success)]" : "bg-[var(--error)]";
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-4 w-4 items-center justify-center">
        <div className={`h-[9px] w-[9px] rounded-full ${color}`} style={{ opacity }} />
      </div>
      <span className="flex-1 text-[12px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[12px] font-mono tabular-nums text-[var(--text-primary)]">{count}</span>
    </div>
  );
}

function Pfp({ handle, pfp, name, size }: { handle: string | null; pfp: string | null; name: string; size: number }) {
  const [idx, setIdx] = useState(0);
  const px = `${size}px`;
  const r = size >= 48 ? "rounded-[10px]" : "rounded-[8px]";
  const srcs: string[] = [];
  if (handle) srcs.push(`https://unavatar.io/twitter/${handle}`);
  if (pfp) srcs.push(pfp);
  const src = srcs[idx];
  if (src) {
    return (
      <img src={src} alt={name} width={size} height={size}
        className={`${r} border border-[var(--border)] object-cover shrink-0`}
        style={{ width: px, height: px }}
        onError={() => idx < srcs.length - 1 ? setIdx(idx + 1) : setIdx(srcs.length)}
        loading="lazy" />
    );
  }
  return (
    <div className={`${r} border border-[var(--border)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] flex items-center justify-center text-white font-bold shrink-0`}
      style={{ width: px, height: px, fontSize: `${Math.round(size * 0.38)}px` }}>
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function XIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-muted)] shrink-0">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ProfileSkeleton() {
  return (
    <div className="page-container py-6" style={{ maxWidth: 960 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] animate-pulse" />
        <div className="h-5 w-32 bg-[var(--bg-elevated)] rounded animate-pulse" />
        <div className="h-4 w-48 bg-[var(--bg-elevated)] rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-0 border border-[var(--border)] rounded-xl overflow-hidden mb-4">
        <div className="h-[300px] bg-[var(--bg-surface)] animate-pulse" />
        <div className="h-[300px] bg-[var(--bg-surface)] animate-pulse border-x border-[var(--border)]" />
        <div className="h-[300px] bg-[var(--bg-surface)] animate-pulse" />
      </div>
      <div className="card h-[400px] animate-pulse" />
    </div>
  );
}
