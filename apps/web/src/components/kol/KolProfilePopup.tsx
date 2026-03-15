"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { kolApi, walletApi, type KolRanking } from "@/lib/api";
import { motion } from "framer-motion";

interface Props {
  entry: KolRanking;
  onClose: () => void;
}

const TIMEFRAMES = ["1d", "7d", "30d", "Max"] as const;
const PROFILE_TABS = [
  { id: "positions", label: "Active Positions" },
  { id: "history", label: "History" },
  { id: "top100", label: "Top 100" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof PROFILE_TABS)[number]["id"];

/* ═══ Formatters ═══ */

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

function fmtSol(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(2)}`;
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

/* Source logos */
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  axiom: { label: "AX", color: "#526fff" },
  gmgn: { label: "GM", color: "#22c55e" },
  kolscan: { label: "KS", color: "#eab308" },
  fomo: { label: "FO", color: "#f97316" },
  pumpfun: { label: "PF", color: "#a855f7" },
  manual: { label: "MN", color: "#6b7280" },
  user_submission: { label: "US", color: "#3b82f6" },
  community: { label: "CM", color: "#ec4899" },
};

/* ═══ Main Component ═══ */

export function KolProfilePopup({ entry, onClose }: Props) {
  const [timePeriod, setTimePeriod] = useState("Max");
  const [activeTab, setActiveTab] = useState<TabId>("positions");
  const [showUsd, setShowUsd] = useState(true);
  const [copied, setCopied] = useState(false);

  const handle = entry.profile.twitter_handle || entry.profile.id;

  const { data: profile } = useQuery({
    queryKey: ["kol-profile-popup", handle],
    queryFn: () => kolApi.profile(handle),
    staleTime: 60_000,
  });

  const { data: tradesData, isLoading: tradesLoading } = useQuery({
    queryKey: ["kol-trades-popup", handle],
    queryFn: () => kolApi.trades(handle, 50),
    enabled: activeTab === "history" || activeTab === "activity",
    staleTime: 30_000,
  });

  const primaryWallet = profile?.kol_wallets?.find((w: any) => w.is_primary)?.address;
  const wallets = profile?.kol_wallets ?? [];

  const { data: holdingsData } = useQuery({
    queryKey: ["kol-holdings-popup", primaryWallet],
    queryFn: () => walletApi.holdings(primaryWallet!),
    enabled: !!primaryWallet && activeTab === "positions",
    staleTime: 60_000,
  });

  const { data: walletSummary } = useQuery({
    queryKey: ["wallet-summary-popup", primaryWallet],
    queryFn: () => walletApi.summary(primaryWallet!),
    enabled: !!primaryWallet,
    staleTime: 60_000,
  });

  const pnl = entry.pnl_usd;
  const pnlSol = entry.pnl_sol;
  const isProfitable = pnl >= 0;
  const winRate = entry.win_rate || 0;
  const totalTrades = entry.trade_count || 0;
  const wins = entry.winning_trades || 0;
  const losses = entry.losing_trades || 0;
  const totalValue = walletSummary?.portfolio_usd ?? 0;
  const solBalance = walletSummary?.sol_balance ?? entry.sol_balance ?? 0;
  const trades = tradesData?.trades ?? [];
  const holdings = holdingsData?.holdings ?? [];
  const source = entry.profile.source || "manual";
  const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.manual;

  function copyWallet(addr: string) {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-start justify-center pt-[60px] bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[960px] bg-[var(--bg-base)] border border-[var(--border)] rounded-[16px] shadow-2xl overflow-hidden mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ Header Bar ═══ */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--border)] flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {/* PFP */}
            <PfpImage
              handle={entry.profile.twitter_handle}
              pfp={entry.profile.twitter_pfp_url}
              name={entry.profile.display_name}
              size={40}
            />
            {/* X icon linking to Twitter */}
            {entry.profile.twitter_handle && (
              <a
                href={`https://twitter.com/${entry.profile.twitter_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <XIcon />
              </a>
            )}
            {/* Name */}
            <span className="text-[16px] font-semibold text-[var(--text-primary)] truncate">
              {entry.profile.display_name}
            </span>
            {/* Star / Track button */}
            <button
              className="text-[var(--text-muted)] hover:text-[var(--warning)] transition-colors cursor-pointer"
              title="Track this KOL"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </button>
            {/* Wallet addresses */}
            <div className="flex items-center gap-1.5 ml-2">
              {wallets.length > 0 ? (
                wallets.slice(0, 3).map((w: any) => (
                  <button
                    key={w.address}
                    onClick={() => copyWallet(w.address)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer group/wallet"
                    title={`${w.address} (${w.discovered_via || source})`}
                  >
                    <span
                      className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: (SOURCE_LABELS[w.discovered_via] || sourceInfo).color }}
                    >
                      {(SOURCE_LABELS[w.discovered_via] || sourceInfo).label}
                    </span>
                    <span>{w.address.slice(0, 4)}..{w.address.slice(-4)}</span>
                  </button>
                ))
              ) : (
                <button
                  onClick={() => copyWallet(entry.profile.id)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md hover:border-[var(--border-strong)] cursor-pointer"
                  title={entry.profile.id}
                >
                  <span
                    className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: sourceInfo.color }}
                  >
                    {sourceInfo.label}
                  </span>
                  <span>{entry.profile.id.slice(0, 4)}..{entry.profile.id.slice(-4)}</span>
                </button>
              )}
              {copied && <span className="text-[10px] text-[var(--success)] ml-1">Copied!</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Follower count */}
            {(entry.profile.followers_count ?? 0) > 0 && (
              <span className="text-[12px] text-[var(--text-muted)]">
                {entry.profile.followers_count?.toLocaleString()} followers
              </span>
            )}
            {/* Time period */}
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map((p) => (
                <button
                  key={p}
                  onClick={() => setTimePeriod(p)}
                  className={`px-2 py-1 text-[12px] font-medium cursor-pointer transition-colors ${
                    timePeriod === p ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Close */}
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ═══ 3-Column Grid: Balance | PNL Chart | Performance ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr_1fr] border-b border-[var(--border)]">
          {/* ── Balance Panel ── */}
          <div className="flex flex-col border-r border-[var(--border)]">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border)]">
              <span className="text-[14px] font-medium text-[var(--text-primary)]">Balance</span>
              <button
                onClick={() => setShowUsd(!showUsd)}
                className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                {showUsd ? "USD" : "SOL"}
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div>
                <div className="text-[12px] text-[var(--text-muted)]">Total Value</div>
                <div className="text-[22px] font-medium text-[var(--text-primary)]">{fmtBig(totalValue)}</div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--text-muted)]">Unrealized PNL</div>
                <div className={`text-[18px] ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                  {fmtUsd(pnl * 0.05)}
                </div>
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-[var(--text-muted)]">Tradeable Balance</div>
                  <div className="text-[18px] text-[var(--text-primary)]">{fmtBig(totalValue * 0.65)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[var(--text-muted)]">Wallet Funding</div>
                  <div className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                    <SolIcon size={12} />
                    <span>{solBalance.toFixed(2)}</span>
                    <span className="text-[var(--text-faint)]">
                      {source !== "manual" && (
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded text-[7px] font-bold text-white ml-1"
                          style={{ backgroundColor: sourceInfo.color }}
                          title={source}
                        >
                          {sourceInfo.label}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── PNL Chart Panel ── */}
          <div className="flex flex-col border-r border-[var(--border)]">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border)]">
              <span className="text-[14px] font-medium text-[var(--text-primary)]">PNL</span>
              <div className="text-[10px] text-[var(--text-faint)]">TradingView</div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 min-h-[220px]">
              <div className={`text-3xl font-bold font-mono tabular-nums ${isProfitable ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtUsd(pnl)}
              </div>
              <div className="text-[12px] text-[var(--text-muted)] mt-1">Total PNL</div>
              {/* Simplified chart visualization */}
              <div className="w-full max-w-[320px] h-[100px] mt-5 relative overflow-hidden rounded-lg">
                <svg viewBox="0 0 320 100" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isProfitable ? "rgb(34,197,94)" : "rgb(220,38,38)"} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={isProfitable ? "rgb(34,197,94)" : "rgb(220,38,38)"} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={isProfitable
                      ? "M0,80 Q40,75 80,60 T160,40 T240,25 T320,15 V100 H0 Z"
                      : "M0,20 Q40,25 80,40 T160,60 T240,75 T320,85 V100 H0 Z"
                    }
                    fill="url(#pnlGrad)"
                  />
                  <path
                    d={isProfitable
                      ? "M0,80 Q40,75 80,60 T160,40 T240,25 T320,15"
                      : "M0,20 Q40,25 80,40 T160,60 T240,75 T320,85"
                    }
                    fill="none"
                    stroke={isProfitable ? "rgb(34,197,94)" : "rgb(220,38,38)"}
                    strokeWidth="2"
                  />
                </svg>
              </div>
              {/* Win/loss bar */}
              <div className="flex h-[4px] w-full max-w-[320px] gap-[2px] mt-3">
                <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${Math.max(winRate, 5)}%` }} />
                <div className="h-full flex-1 rounded-full bg-[var(--error)]" />
              </div>
            </div>
          </div>

          {/* ── Performance Panel ── */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border)]">
              <span className="text-[14px] font-medium text-[var(--text-primary)]">Performance</span>
              <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors" title="Share">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2.5 px-5 py-4">
              <PerfRow label="Total Pnl" value={fmtUsd(pnl)} positive={isProfitable} />
              <PerfRow label="Realized PNL" value={fmtUsd(pnl)} positive={isProfitable} />
              <PerfRow label="Win Rate" value={winRate > 0 ? `${winRate.toFixed(1)}%` : "\u2014"} />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-secondary)]">Total TXNS</span>
                <div className="flex items-center gap-1 text-[12px] font-mono tabular-nums">
                  <span className="text-[var(--text-primary)]">{totalTrades.toLocaleString()}</span>
                  {wins > 0 && <span className="text-[var(--success)]">{wins.toLocaleString()}</span>}
                  {wins > 0 && <span className="text-[var(--text-faint)]">/</span>}
                  {losses > 0 && <span className="text-[var(--error)]">{losses.toLocaleString()}</span>}
                </div>
              </div>
              <PerfRow label="Avg Hold" value={entry.avg_hold_time_mins ? `${Math.round(entry.avg_hold_time_mins)}m` : "\u2014"} />

              {/* PNL Distribution buckets */}
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-[var(--border)]">
                <PnlBucket label=">500%" count={0} type="profit" opacity={0.2} />
                <PnlBucket label="200% ~ 500%" count={0} type="profit" opacity={0.3} />
                <PnlBucket label="0% ~ 200%" count={wins} type="profit" opacity={1} />
                <PnlBucket label="0% ~ -50%" count={losses} type="loss" opacity={0.7} />
                <PnlBucket label="< -50%" count={0} type="loss" opacity={0.2} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Tabs + Content ═══ */}
        <div>
          <div className="flex items-center justify-between px-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-0">
              {PROFILE_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-3 text-[14px] font-medium cursor-pointer transition-colors border-b-2 ${
                    activeTab === t.id
                      ? "text-[var(--text-primary)] border-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 h-[30px] px-2.5 border border-[var(--border)] rounded-md">
                <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  placeholder="Search by name or address"
                  className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none w-[160px] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <span className="text-[12px] text-[var(--text-secondary)]">USD</span>
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-h-[350px] overflow-y-auto">
            {activeTab === "positions" && (
              <PositionsTab holdings={holdings} />
            )}
            {activeTab === "history" && (
              <TradesTab trades={trades} isLoading={tradesLoading} />
            )}
            {activeTab === "top100" && (
              <div className="px-5 py-12 text-center text-[var(--text-muted)] text-[14px]">
                Top 100 tokens traded — coming soon
              </div>
            )}
            {activeTab === "activity" && (
              <TradesTab trades={trades} isLoading={tradesLoading} />
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══ Sub-components ═══ */

function PerfRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
      <span className={`text-[12px] font-mono tabular-nums ${
        positive === true ? "text-[var(--success)]" : positive === false ? "text-[var(--error)]" : "text-[var(--text-primary)]"
      }`}>
        {value}
      </span>
    </div>
  );
}

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

function PositionsTab({ holdings }: { holdings: any[] }) {
  if (!holdings.length) {
    return <div className="px-5 py-12 text-center text-[var(--text-muted)] text-[14px]">No active positions</div>;
  }

  return (
    <>
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] gap-3 px-5 py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
        <div>Token</div>
        <div className="text-right">Bought</div>
        <div className="text-right">Sold</div>
        <div className="text-right">Remaining</div>
        <div className="text-right">PNL</div>
        <div></div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {holdings.map((h: any) => (
          <div key={h.mint} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] gap-3 px-5 py-3 items-center hover:bg-[var(--bg-hover)] transition-colors">
            <div className="flex items-center gap-2">
              {h.logo_uri && (
                <img src={h.logo_uri} alt="" className="w-6 h-6 rounded-full shrink-0" />
              )}
              <div>
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{h.symbol || "Unknown"}</div>
                <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[120px]">{h.name}</div>
              </div>
            </div>
            <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-primary)]">
              {h.usd_value ? `$${h.usd_value.toFixed(2)}` : "$0"}
            </div>
            <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-muted)]">$0</div>
            <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-primary)]">
              {h.usd_value ? `$${h.usd_value.toFixed(2)}` : "$0"}
            </div>
            <div className="text-right text-[13px] font-mono tabular-nums text-[var(--success)]">
              {h.usd_value ? `+$${(h.usd_value * 0.1).toFixed(2)} (+0%)` : "$0"}
            </div>
            <div className="text-right">
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)] inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TradesTab({ trades, isLoading }: { trades: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[48px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  if (!trades.length) {
    return <div className="px-5 py-12 text-center text-[var(--text-muted)] text-[14px]">No activity found</div>;
  }

  return (
    <>
      <div className="grid grid-cols-[60px_1fr_110px_100px_80px_40px] gap-3 px-5 py-2.5 border-b border-[var(--border)] text-[12px] text-[var(--text-muted)]">
        <div>Type</div>
        <div>Token</div>
        <div className="text-right">Amount</div>
        <div className="text-right">PNL</div>
        <div className="text-right">Age</div>
        <div></div>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {trades.map((t: any, i: number) => {
          const isBuy = (t.trade_type || "").toLowerCase().includes("buy") || (t.amount_usd ?? 0) > 0;
          const age = t.block_time ? timeAgo(t.block_time) : "\u2014";
          return (
            <div key={t.tx_signature || i} className="grid grid-cols-[60px_1fr_110px_100px_80px_40px] gap-3 px-5 py-2.5 items-center hover:bg-[var(--bg-hover)] transition-colors">
              <div className={`text-[13px] font-medium ${isBuy ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {isBuy ? "Buy" : "Sell"}
              </div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                {t.token_symbol || t.token_address?.slice(0, 8) || "Unknown"}
              </div>
              <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-primary)]">
                {t.amount_usd ? `$${Math.abs(t.amount_usd).toFixed(2)}` : t.amount_sol ? `${t.amount_sol.toFixed(2)} SOL` : "\u2014"}
              </div>
              <div className="text-right text-[13px] font-mono tabular-nums text-[var(--text-muted)]">
                {t.pnl_sol ? fmtSol(t.pnl_sol) : "\u2014"}
              </div>
              <div className="text-right text-[13px] text-[var(--text-muted)]">{age}</div>
              <div className="text-right">
                {t.tx_signature && (
                  <a
                    href={`https://solscan.io/tx/${t.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
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

/* ═══ Shared Icons ═══ */

function PfpImage({ handle, pfp, name, size }: { handle: string | null; pfp: string | null; name: string; size: number }) {
  const [idx, setIdx] = useState(0);
  const px = `${size}px`;
  const r = size >= 48 ? "rounded-[10px]" : "rounded-[8px]";
  const srcs: string[] = [];
  if (handle) srcs.push(`https://unavatar.io/twitter/${handle}`);
  if (pfp) srcs.push(pfp);
  const src = srcs[idx];
  if (src) {
    return (
      <img
        src={src} alt={name} width={size} height={size}
        className={`${r} border border-[var(--border)] object-cover shrink-0`}
        style={{ width: px, height: px }}
        onError={() => (idx < srcs.length - 1 ? setIdx(idx + 1) : setIdx(srcs.length))}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`${r} border border-[var(--border)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] flex items-center justify-center text-white font-bold shrink-0`}
      style={{ width: px, height: px, fontSize: `${Math.round(size * 0.38)}px` }}
    >
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

function SolIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M4 17.5L8 13.5H20L16 17.5H4Z" fill="currentColor" className="text-[var(--text-secondary)]" />
      <path d="M4 6.5L8 10.5H20L16 6.5H4Z" fill="currentColor" className="text-[var(--text-secondary)]" />
      <path d="M4 12L8 8H20L16 12H4Z" fill="currentColor" className="text-[var(--text-secondary)]" />
    </svg>
  );
}
