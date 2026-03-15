"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { kolApi, type KolRanking } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { KolProfilePopup } from "@/components/kol/KolProfilePopup";

/* ═══ Constants ═══ */

const TABS = [
  { id: "kol", label: "KOL" },
  { id: "global", label: "Global" },
  { id: "tracked", label: "Tracked" },
] as const;

const PERIODS = [
  { id: "1d", label: "1d" },
  { id: "3d", label: "3d" },
  { id: "7d", label: "7d" },
  { id: "14d", label: "14d" },
  { id: "30d", label: "30d" },
] as const;

const SORT_OPTIONS = [
  { id: "pnl_sol", label: "PnL SOL" },
  { id: "pnl_usd", label: "PnL USD" },
  { id: "volume_usd", label: "Volume USD" },
  { id: "volume_sol", label: "Volume SOL" },
  { id: "wins", label: "Wins" },
  { id: "losses", label: "Losses" },
  { id: "buys", label: "Buys" },
  { id: "sells", label: "Sells" },
  { id: "avg_hold_time", label: "Avg Hold Time" },
] as const;

type Tab = (typeof TABS)[number]["id"];
type Period = (typeof PERIODS)[number]["id"];
type SortBy = (typeof SORT_OPTIONS)[number]["id"];

/* ═══ Formatters ═══ */

function fmtPnl(n: number, isSol: boolean): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (isSol) {
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
    return `${sign}${abs.toFixed(1)}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtVol(n: number, isSol: boolean): string {
  if (n <= 0) return "\u2014";
  if (isSol) {
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(1);
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtHold(mins: number): string {
  if (!mins || mins <= 0) return "\u2014";
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

function truncAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}..${a.slice(-4)}` : a;
}

function sanitize(s: string): string {
  return s.replace(/[<>"'&]/g, '').trim().slice(0, 200);
}

/* ═══ Main Page ═══ */

export default function RankingsPage() {
  const [tab, setTab] = useState<Tab>("kol");
  const [period, setPeriod] = useState<Period>("3d");
  const [sortBy, setSortBy] = useState<SortBy>("pnl_sol");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showUsd, setShowUsd] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [search, setSearch] = useState("");
  const [showContribute, setShowContribute] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedKol, setSelectedKol] = useState<KolRanking | null>(null);
  const [page, setPage] = useState(1);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const walletTypeParam = tab === "global" ? "all" : tab;
  const pageSize = 100;
  const offset = (page - 1) * pageSize;

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", tab, period, sortBy, sortDir, page],
    queryFn: () =>
      kolApi.rankings({
        wallet_type: walletTypeParam,
        period,
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: pageSize,
        offset,
      }),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  useEffect(() => { setPage(1); }, [tab, sortBy, sortDir, period]);

  const all = data?.rankings ?? [];
  const filtered = search
    ? all.filter(
        (r) =>
          r.profile.display_name.toLowerCase().includes(search.toLowerCase()) ||
          (r.profile.twitter_handle || "").toLowerCase().includes(search.toLowerCase())
      )
    : all;

  const isKol = tab === "kol";
  const showTop3 = isKol && !search;
  const top3 = showTop3 ? filtered.slice(0, 3) : [];
  const rows = showTop3 ? filtered.slice(3) : filtered;

  return (
    <div style={{ maxWidth: 1420, margin: "0 auto", padding: "0 24px 40px" }}>
      {/* ── Row 1: Tabs + Contribute + Search ── */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-[24px]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-[16px] font-medium leading-[21px] cursor-pointer transition-all duration-[65ms] ease-out active:scale-[0.96] ${
                tab === t.id
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowContribute(true)}
            className="flex items-center gap-[7px] h-[36px] px-[12px] text-[14px] font-medium text-[var(--accent)] border border-[var(--border)] rounded-full hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-all duration-[65ms] active:scale-[0.96]"
          >
            + Contribute
          </button>
          <div className="flex items-center gap-[8px] h-[32px] pl-[12px] pr-[4px] border border-[var(--border)] rounded-full hover:bg-[rgba(255,255,255,0.03)] transition-colors">
            <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${isKol ? "KOLs" : tab === "global" ? "Global" : "Tracked"}...`}
              className="bg-transparent text-[12px] font-medium text-[var(--text-primary)] outline-none w-[160px] placeholder:text-[var(--text-muted)]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Sort + Asc/Desc | Period ── */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-[8px]">
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-[7px] h-[36px] pl-[12px] pr-[10px] text-[14px] border border-[var(--border)] rounded-full text-[var(--text-primary)] cursor-pointer hover:bg-[rgba(255,255,255,0.03)] transition-all duration-[65ms]"
            >
              <span className="text-[var(--text-muted)] text-[13px]">Sort by</span>
              <span className="font-semibold">{SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "PnL SOL"}</span>
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1.5 w-[200px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                >
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => { setSortBy(o.id); setShowSortDropdown(false); }}
                      className={`w-full text-left px-4 py-2.5 text-[14px] cursor-pointer transition-colors ${
                        sortBy === o.id
                          ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="flex items-center justify-center w-[36px] h-[36px] border border-[var(--border)] rounded-full text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)] cursor-pointer transition-all duration-[65ms]"
            title={sortDir === "desc" ? "Sort Descending" : "Sort Ascending"}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sortDir === "desc" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m8-4v12m0 0l-4-4m4 4l4-4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m8 4V4m0 0l-4 4m4-4l4 4" />
              )}
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`h-[32px] px-[8px] text-[14px] font-medium cursor-pointer rounded-[8px] transition-all duration-[65ms] ease-out active:scale-[0.96] ${
                period === p.id ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top 3 Cards (KOL tab) ── */}
      {showTop3 && !isLoading && top3.length > 0 && (
        <div className="mb-[16px]">
          {top3[0] && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="text-center text-[16px] font-medium text-[var(--text-muted)] mb-2.5">1</div>
              <TopCard entry={top3[0]} rank={1} showUsd={showUsd} onSelect={setSelectedKol} />
            </motion.div>
          )}
          {(top3[1] || top3[2]) && (
            <div className="grid grid-cols-2 gap-[16px] mt-[16px]">
              {top3[1] && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                  <div className="text-center text-[16px] font-medium text-[var(--text-muted)] mb-2.5">2</div>
                  <TopCard entry={top3[1]} rank={2} showUsd={showUsd} onSelect={setSelectedKol} />
                </motion.div>
              )}
              {top3[2] && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                  <div className="text-center text-[16px] font-medium text-[var(--text-muted)] mb-2.5">3</div>
                  <TopCard entry={top3[2]} rank={3} showUsd={showUsd} onSelect={setSelectedKol} />
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && isKol && (
        <div className="mb-8 space-y-5">
          <div className="h-[170px] rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
          <div className="grid grid-cols-2 gap-5">
            <div className="h-[140px] rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
            <div className="h-[140px] rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border)] animate-pulse" />
          </div>
        </div>
      )}

      {/* ── Tracked Empty State ── */}
      {tab === "tracked" && !isLoading && filtered.length === 0 && (
        <div className="rounded-[16px] bg-[var(--bg-surface)] border border-[var(--border)] p-16 mb-8 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--accent)] mb-2">No wallet data available</h3>
          <p className="text-[14px] text-[var(--text-muted)] max-w-[400px] mx-auto">
            Add some wallets to your account to see their performance rankings and statistics.
          </p>
        </div>
      )}

      {/* ── Traders Table ── */}
      <div className="rounded-[16px] overflow-hidden" style={{ background: 'rgba(252,252,252,0.00135)', border: '1px solid rgba(252,252,252,0.05)' }}>
        <div className="flex items-center justify-between h-[52px] min-h-[52px] px-[24px]">
          <span className="text-[16px] font-semibold text-[var(--text-primary)]">
            {tab === "tracked" ? "Tracked Wallets" : "Traders"}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowUsd(!showUsd)}
              className="flex h-[32px] min-h-[32px] items-center gap-[4px] rounded-full pl-[10px] pr-[8px] text-[14px] font-medium text-[var(--text-primary)] cursor-pointer transition-colors duration-150 hover:bg-[rgba(252,252,252,0.1)]"
              style={{ background: 'rgba(252,252,252,0.05)' }}
              title={showUsd ? "Switch to SOL" : "Switch to USD"}
            >
              {showUsd ? "USD" : "SOL"}
              <svg className="w-[14px] h-[14px]" style={{ opacity: 0.65 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            {tab === "global" && (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-[13px] font-medium rounded-lg cursor-pointer transition-colors ${
                      page === p
                        ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : "text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setViewMode(viewMode === "list" ? "gallery" : "list")}
              className="flex h-[32px] min-h-[32px] w-[32px] items-center justify-center rounded-[4px] text-[var(--text-primary)] cursor-pointer transition-colors duration-150 hover:bg-[rgba(252,252,252,0.1)]"
              style={{ background: 'rgba(252,252,252,0.05)' }}
              title={viewMode === "list" ? "Gallery view" : "List view"}
            >
              {viewMode === "list" ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {viewMode === "gallery" ? (
          <div className="px-5 pb-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[120px] rounded-[12px] bg-[var(--bg-elevated)] animate-pulse" />
                ))}
              </div>
            ) : rows.length === 0 && top3.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-muted)] text-[15px]">No rankings data available</div>
            ) : (
              <div className="space-y-3">
                {rows.map((entry, i) => (
                  <GalleryCard key={entry.profile.id} entry={entry} rank={showTop3 ? i + 4 : i + 1} showUsd={showUsd} onSelect={setSelectedKol} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Table header - Axiom style: subtle, no harsh bg */}
            <div className="flex h-[40px] min-h-[40px] w-full items-center gap-[16px] whitespace-nowrap px-[24px] text-[14px] font-normal text-[var(--text-muted)]">
              <div className="w-[80px] shrink-0">Rank</div>
              <div className="flex-1">{tab === "global" || tab === "tracked" ? "Wallet" : "Trader"}</div>
              <div className="flex-1">PNL</div>
              <div className="flex-1">Win Rate</div>
              <div className="flex-1">Positions</div>
              <div className="flex-1">Trades</div>
              <div className="flex-1">Volume</div>
              <div className="flex-1">Avg Hold</div>
            </div>
            <div className="min-h-[720px] w-full pb-[32px]">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-[60px] animate-pulse bg-[var(--bg-surface)]" style={{ opacity: 1 - i * 0.08, borderBottom: '1px solid rgba(42,32,32,0.2)' }} />
                ))
              ) : rows.length === 0 && top3.length === 0 ? (
                <div className="px-6 py-16 text-center text-[var(--text-muted)] text-[15px]">No rankings data available</div>
              ) : (
                rows.map((entry, i) => (
                  <TraderRow
                    key={entry.profile.id}
                    entry={entry}
                    rank={showTop3 ? i + 4 : i + 1}
                    isKol={isKol}
                    showUsd={showUsd}
                    onSelect={setSelectedKol}
                  />
                ))
              )}
            </div>
          </>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="px-6 py-3 text-[13px] text-[var(--text-faint)]" style={{ borderTop: '1px solid rgba(42,32,32,0.4)' }}>
            Showing {filtered.length} traders
          </div>
        )}
      </div>

      {/* ── Contribute Modal ── */}
      <AnimatePresence>
        {showContribute && <ContributeModal onClose={() => setShowContribute(false)} />}
      </AnimatePresence>

      {/* ── KOL Profile Popup ── */}
      <AnimatePresence>
        {selectedKol && <KolProfilePopup entry={selectedKol} onClose={() => setSelectedKol(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ═══ Top 3 Card ═══ */

function TopCard({ entry, rank, showUsd, onSelect }: { entry: KolRanking; rank: number; showUsd: boolean; onSelect: (k: KolRanking) => void }) {
  const pnl = showUsd ? entry.pnl_usd : entry.pnl_sol;
  const pnlUsd = entry.pnl_usd;
  const pos = pnl >= 0;
  const big = rank === 1;
  const pfpSize = big ? 64 : 52;

  return (
    <div
      onClick={() => onSelect(entry)}
      className={`group relative isolate overflow-hidden rounded-[16px] cursor-pointer transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]`}
      style={{ 
        background: 'rgba(16,17,20,0.9)',
        border: big ? '2px solid rgba(255,255,255,0.08)' : '2px solid rgba(255,255,255,0.05)',
      }}
    >
      {entry.profile.twitter_handle && (
        <div className="pointer-events-none absolute inset-0 z-[-1] overflow-hidden">
          <div
            className="h-full w-full scale-150 blur-[100px] saturate-[1.75] brightness-[0.3] opacity-[0.12]"
            style={{ backgroundImage: `url(https://unavatar.io/twitter/${entry.profile.twitter_handle})`, backgroundSize: "cover" }}
          />
        </div>
      )}

      <div className={`relative z-10 ${big ? "px-7 py-6" : "px-6 py-5"}`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <PfpImage handle={entry.profile.twitter_handle} pfp={entry.profile.twitter_pfp_url} name={entry.profile.display_name} size={pfpSize} />
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`${big ? "text-[19px]" : "text-[16px]"} font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors`}>
                  {entry.profile.display_name}
                </span>
                <span className="text-[14px] text-[var(--text-muted)]">
                  {entry.win_rate > 0 ? `${entry.win_rate.toFixed(2)}%` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <XIcon />
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)]">PNL</div>
            <div className="flex items-center justify-end gap-1">
              {!showUsd && <SolIcon size={15} />}
              <span className={`${big ? "text-[24px]" : "text-[20px]"} font-bold font-mono tabular-nums ${pos ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
                {fmtPnl(pnl, !showUsd)}
              </span>
            </div>
            <div className={`text-[13px] font-mono tabular-nums ${pnlUsd >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
              {fmtPnl(pnlUsd, false)}
            </div>
          </div>
        </div>

        <div className="h-px mb-4" style={{ background: 'rgba(42,32,32,0.5)' }} />

        <div className="grid grid-cols-5 gap-5 text-[var(--text-primary)]">
          <StatBlock value={entry.positions > 0 ? String(entry.positions) : "\u2014"} label="Positions" win={entry.positions_win} loss={entry.positions_loss} />
          <StatBlock value={entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"} label="Trades" win={entry.winning_trades} loss={entry.losing_trades} />
          <div>
            <div className="flex items-center gap-1">
              {!showUsd && <SolIcon size={13} />}
              <span className="text-[17px] font-bold font-mono tabular-nums">
                {fmtVol(showUsd ? entry.volume_usd : entry.volume_sol, !showUsd)}
              </span>
            </div>
            {!showUsd && entry.volume_usd > 0 && (
              <div className="text-[11px] text-[var(--text-faint)] mt-0.5">${fmtVol(entry.volume_usd, false).replace("$", "")}</div>
            )}
            <div className="text-[11px] text-[var(--text-faint)]">Volume</div>
          </div>
          <div>
            <div className="text-[17px] font-bold font-mono tabular-nums">{fmtHold(entry.avg_hold_time_mins ?? 0)}</div>
            <div className="text-[11px] text-[var(--text-faint)] mt-0.5">Avg. Hold Time</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ value, label, win, loss }: { value: string; label: string; win: number; loss: number }) {
  return (
    <div>
      <div className="text-[17px] font-bold font-mono tabular-nums">{value}</div>
      <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{label}</div>
      {(win > 0 || loss > 0) && (
        <div className="flex items-center gap-2 mt-1 text-[12px] font-mono tabular-nums">
          <span className="text-[var(--success)]">{win.toLocaleString()}</span>
          <span className="text-[var(--error)]">{loss.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

/* ═══ Trader Row ═══ */

function TraderRow({
  entry, rank, isKol, showUsd, onSelect,
}: {
  entry: KolRanking; rank: number; isKol: boolean; showUsd: boolean; onSelect: (k: KolRanking) => void;
}) {
  const pnl = showUsd ? entry.pnl_usd : entry.pnl_sol;
  const pos = pnl >= 0;
  const vol = showUsd ? entry.volume_usd : entry.volume_sol;

  return (
    <div
      onClick={() => onSelect(entry)}
      className="group relative flex h-[72px] min-h-[72px] w-full cursor-pointer items-center gap-[16px] overflow-hidden whitespace-nowrap px-[24px] transition-colors duration-150 hover:bg-[rgba(252,252,252,0.02)]"
    >
      {/* Rank */}
      <div className="w-[80px] shrink-0 text-[16px] font-medium text-[var(--text-muted)] tabular-nums">{rank}</div>

      {/* Trader */}
      <div className="flex flex-1 items-center gap-[12px] min-w-0">
        <PfpImage
          handle={isKol ? entry.profile.twitter_handle : null}
          pfp={entry.profile.twitter_pfp_url}
          name={entry.profile.display_name}
          size={40}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-[6px]">
            <span className="text-[16px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
              {isKol ? entry.profile.display_name : truncAddr(entry.profile.id)}
            </span>
            {entry.profile.verified && <VerifyBadge />}
          </div>
          {isKol && entry.profile.twitter_handle && (
            <div className="flex items-center gap-1 mt-0.5">
              <XIcon small />
            </div>
          )}
        </div>
      </div>

      {/* PNL */}
      <div className="flex-1">
        <span className={`text-[16px] font-medium tabular-nums ${pos ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
          {fmtPnl(pnl, !showUsd)}
        </span>
      </div>

      {/* Win Rate */}
      <div className="flex-1 text-[16px] tabular-nums text-[var(--text-primary)]">
        {entry.win_rate > 0 ? `${entry.win_rate.toFixed(1)}%` : "\u2014"}
      </div>

      {/* Positions */}
      <div className="flex-1">
        <div className="text-[16px] tabular-nums text-[var(--text-primary)]">
          {entry.positions > 0 ? entry.positions.toLocaleString() : "\u2014"}
        </div>
        {(entry.positions_win > 0 || entry.positions_loss > 0) && (
          <div className="flex items-center gap-[6px] mt-0.5 text-[12px] tabular-nums">
            <span className="text-[var(--success)]">{entry.positions_win.toLocaleString()}</span>
            <span className="text-[var(--error)]">{entry.positions_loss.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Trades */}
      <div className="flex-1">
        <div className="text-[16px] tabular-nums text-[var(--text-primary)]">
          {entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"}
        </div>
        {(entry.winning_trades > 0 || entry.losing_trades > 0) && (
          <div className="flex items-center gap-[6px] mt-0.5 text-[12px] tabular-nums">
            <span className="text-[var(--success)]">{entry.winning_trades.toLocaleString()}</span>
            <span className="text-[var(--error)]">{entry.losing_trades.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Volume */}
      <div className="flex-1 text-[16px] tabular-nums text-[var(--text-primary)]">
        {fmtVol(vol, !showUsd)}
      </div>

      {/* Avg Hold */}
      <div className="flex-1 text-[16px] tabular-nums text-[var(--text-muted)]">
        {fmtHold(entry.avg_hold_time_mins ?? 0)}
      </div>
    </div>
  );
}

/* ═══ Gallery Card ═══ */

function GalleryCard({ entry, rank, showUsd, onSelect }: { entry: KolRanking; rank: number; showUsd: boolean; onSelect: (k: KolRanking) => void }) {
  const pnl = showUsd ? entry.pnl_usd : entry.pnl_sol;
  const pnlUsd = entry.pnl_usd;
  const pos = pnl >= 0;

  return (
    <div
      onClick={() => onSelect(entry)}
      className="group relative overflow-hidden rounded-[14px] p-5 cursor-pointer hover:bg-[var(--bg-hover)] transition-all duration-150"
      style={{ background: 'rgba(16,13,13,0.6)', border: '1px solid rgba(42,32,32,0.4)' }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="text-[15px] font-semibold text-[var(--text-muted)] tabular-nums w-7">{rank}</span>
          <PfpImage handle={entry.profile.twitter_handle} pfp={entry.profile.twitter_pfp_url} name={entry.profile.display_name} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                {entry.profile.display_name}
              </span>
              <span className="text-[14px] text-[var(--text-muted)]">{entry.win_rate > 0 ? `${entry.win_rate.toFixed(2)}%` : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5"><XIcon small /></div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-mono uppercase text-[var(--text-faint)]">PNL</div>
          <div className={`text-[19px] font-bold font-mono tabular-nums ${pos ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {fmtPnl(pnl, !showUsd)}
          </div>
          <div className={`text-[12px] font-mono tabular-nums ${pnlUsd >= 0 ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
            {fmtPnl(pnlUsd, false)}
          </div>
        </div>
      </div>
      <div className="h-px my-3.5" style={{ background: 'rgba(42,32,32,0.4)' }} />
      <div className="grid grid-cols-5 gap-4 text-[var(--text-primary)]">
        <StatBlock value={String(entry.positions || "\u2014")} label="Positions" win={entry.positions_win} loss={entry.positions_loss} />
        <StatBlock value={entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"} label="Trades" win={entry.winning_trades} loss={entry.losing_trades} />
        <div>
          <div className="text-[15px] font-bold font-mono tabular-nums">{fmtVol(showUsd ? entry.volume_usd : entry.volume_sol, !showUsd)}</div>
          <div className="text-[11px] text-[var(--text-faint)]">Volume</div>
        </div>
        <div>
          <div className="text-[15px] font-bold font-mono tabular-nums">{fmtHold(entry.avg_hold_time_mins ?? 0)}</div>
          <div className="text-[11px] text-[var(--text-faint)]">Avg. Hold Time</div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Contribute Modal — Redesigned ═══ */

function ContributeModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"apply" | "submit">("apply");
  const [wallet, setWallet] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [evidence, setEvidence] = useState("");
  const [kolName, setKolName] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanWallet = sanitize(wallet);
    if (!cleanWallet || cleanWallet.length < 32 || cleanWallet.length > 44) return;
    if (!/^[A-Za-z0-9]+$/.test(cleanWallet)) return;
    setStatus("busy");
    try {
      await kolApi.submit({
        wallet_address: cleanWallet,
        twitter_handle: sanitize(twitter) || undefined,
        display_name: sanitize(kolName) || undefined,
        evidence_text: sanitize(evidence) || undefined,
      });
      setStatus("ok");
      setTimeout(onClose, 1500);
    } catch {
      setStatus("err");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[520px] rounded-[16px] shadow-2xl overflow-hidden"
        style={{ background: 'rgb(16,17,20)', border: '1px solid rgba(50,53,66,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: '1px solid rgba(50,53,66,0.4)' }}>
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">Add KOL</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          {/* Select wallet */}
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-2">Select your wallet</label>
            <div className="relative">
              <input
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="Select a wallet"
                required
                className="w-full text-[14px] font-mono py-3 px-4 rounded-xl outline-none transition-colors"
                style={{ background: 'rgb(24,24,26)', border: '1px solid rgba(50,53,66,0.5)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Twitter - with X icon */}
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-2">Twitter Handle *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2">
                <XIcon />
              </span>
              <input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@username"
                className="w-full text-[14px] py-3 pl-10 pr-4 rounded-xl outline-none transition-colors"
                style={{ background: 'rgb(24,24,26)', border: '1px solid rgba(50,53,66,0.5)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Telegram - with icon */}
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-2">Telegram Handle</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </span>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="username"
                className="w-full text-[14px] py-3 pl-10 pr-4 rounded-xl outline-none transition-colors"
                style={{ background: 'rgb(24,24,26)', border: '1px solid rgba(50,53,66,0.5)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Discord - with icon */}
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-2">Discord Handle</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
              </span>
              <input
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="username#0000"
                className="w-full text-[14px] py-3 pl-10 pr-4 rounded-xl outline-none transition-colors"
                style={{ background: 'rgb(24,24,26)', border: '1px solid rgba(50,53,66,0.5)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-3">
            <button type="button" onClick={onClose} className="text-[14px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === "busy" || !wallet.trim()}
              className="px-5 py-2.5 text-[14px] font-semibold text-white rounded-xl cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'rgb(82,111,255)' }}
            >
              {status === "busy" ? "Submitting..." : status === "ok" ? "Done!" : "Add KOL"}
            </button>
          </div>
          {status === "err" && <p className="text-[12px] text-[var(--error)]">Submission failed. Please try again.</p>}
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ═══ Shared Components ═══ */

function PfpImage({ handle, pfp, name, size }: { handle: string | null; pfp: string | null; name: string; size: number }) {
  const [idx, setIdx] = useState(0);
  const px = `${size}px`;
  const r = size >= 48 ? "rounded-[12px]" : "rounded-[8px]";
  const srcs: string[] = [];
  if (handle) srcs.push(`https://unavatar.io/twitter/${handle}`);
  if (pfp) srcs.push(pfp);
  const src = srcs[idx];
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`${r} border border-[var(--border)] group-hover:border-[var(--accent)]/50 pfp-hover object-cover shrink-0`}
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

function XIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-muted)] shrink-0">
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

function VerifyBadge() {
  return (
    <div className="shrink-0 rounded-full bg-[var(--accent)] flex items-center justify-center" style={{ width: 15, height: 15 }}>
      <svg style={{ width: 9, height: 9 }} fill="currentColor" viewBox="0 0 20 20" className="text-white">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  );
}
