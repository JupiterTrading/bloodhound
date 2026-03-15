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

/* ═══ SOL Icon (proper Solana logo) ═══ */

function SolLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 398 312" className="shrink-0">
      <linearGradient id="sol-a" x1="360.879" x2="141.213" y1="351.455" y2="-69.294" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <path fill="url(#sol-a)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
      <path fill="url(#sol-a)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
      <path fill="url(#sol-a)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
    </svg>
  );
}

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
  return s.replace(/[<>"'&]/g, "").trim().slice(0, 200);
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
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const walletTypeParam = tab === "global" ? "all" : tab;
  const pageSize = 100;
  const offset = (page - 1) * pageSize;

  const { data, isLoading } = useQuery({
    queryKey: ["rankings", tab, period, sortBy, sortDir, page],
    queryFn: () => kolApi.rankings({ wallet_type: walletTypeParam, period, sort_by: sortBy, sort_dir: sortDir, limit: pageSize, offset }),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  useEffect(() => { setPage(1); }, [tab, sortBy, sortDir, period]);

  const all = data?.rankings ?? [];
  const filtered = search
    ? all.filter((r) => r.profile.display_name.toLowerCase().includes(search.toLowerCase()) || (r.profile.twitter_handle || "").toLowerCase().includes(search.toLowerCase()))
    : all;

  const isKol = tab === "kol";
  const showTop3 = isKol && !search;
  const top3 = showTop3 ? filtered.slice(0, 3) : [];
  const rows = showTop3 ? filtered.slice(3) : filtered;
  const topKolHandle = top3[0]?.profile.twitter_handle;

  return (
    <div className="relative isolate w-full min-h-screen">
      {/* ── Hero BG gradient from #1 KOL PFP ── */}
      {topKolHandle && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[-1] select-none overflow-hidden" style={{ height: 750 }}>
          <div className="absolute inset-0 z-[-2]" style={{ background: "var(--bg-base)" }} />
          <div className="absolute bottom-0 inset-x-0 z-0" style={{ height: 300, background: "linear-gradient(to top, var(--bg-base), transparent)" }} />
          <div className="absolute inset-x-0 top-0 z-[-1]" style={{ height: 750, filter: "blur(100px) saturate(1.75) brightness(0.5)" }}>
            <div className="h-full w-full" style={{ opacity: 0.1 }}>
              <img alt="" src={`https://unavatar.io/twitter/${topKolHandle}`} className="h-full w-full object-fill" style={{ position: "absolute", inset: 0 }} loading="eager" />
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1420px] mx-auto px-[24px]">
        {/* ═══ Row 1: Page tabs + Apply + Search ═══ */}
        <div className="flex items-center justify-between pt-[24px] pb-[16px] gap-[16px] flex-wrap">
          <div className="flex items-center gap-[24px]">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`text-[16px] font-medium leading-[21px] cursor-pointer transition-all duration-[65ms] ease-out active:scale-[0.96] ${
                  tab === t.id ? "text-[var(--text-primary)]" : "text-[rgba(119,122,140,1)] hover:text-[rgba(200,201,209,1)]"
                }`}
              >{t.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-[12px]">
            <button onClick={() => setShowContribute(true)}
              className="flex items-center gap-[4px] h-[36px] px-[12px] text-[14px] font-medium text-[var(--text-primary)] rounded-full cursor-pointer transition-all duration-150 hover:bg-[rgba(252,252,252,0.1)]"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}
            >+ Apply</button>
            <div className="flex h-[32px] w-[280px] cursor-text items-center gap-[8px] rounded-full pl-[12px] pr-[4px] transition-colors duration-150 hover:bg-[rgba(252,252,252,0.035)]"
              style={{ border: "1px solid rgba(255,255,255,0.05)" }}>
              <svg className="w-[16px] h-[16px] shrink-0" style={{ color: "rgba(252,252,252,0.9)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${isKol ? "KOLs" : tab === "global" ? "Global" : "Tracked"}...`}
                className="flex-1 bg-transparent text-[14px] font-medium text-[var(--text-primary)] outline-none placeholder:font-medium placeholder:text-[rgba(252,252,252,0.6)]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-[rgba(252,252,252,0.4)] hover:text-[var(--text-primary)] cursor-pointer pr-[4px]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Row 2: Sort + Direction | Timeframes ═══ */}
        <div className="flex items-center justify-between pb-[16px] gap-[16px] flex-wrap">
          <div className="flex items-center gap-[8px]">
            <div className="relative" ref={sortRef}>
              <button onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-[7px] h-[36px] pl-[12px] pr-[10px] text-[14px] rounded-full text-[var(--text-primary)] cursor-pointer hover:bg-[rgba(255,255,255,0.03)] transition-all duration-[65ms]"
                style={{ border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-[rgba(119,122,140,1)] text-[14px]">Sort by</span>
                <span className="font-medium">{SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "PnL SOL"}</span>
                <svg className="w-[16px] h-[16px]" style={{ color: "rgba(252,252,252,0.6)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-[4px] w-[200px] rounded-[12px] shadow-2xl z-50 overflow-hidden py-[4px]"
                    style={{ background: "rgb(16,17,20)", border: "1px solid rgba(50,53,66,0.6)" }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <button key={o.id} onClick={() => { setSortBy(o.id); setShowSortDropdown(false); }}
                        className={`w-full text-left px-[16px] py-[10px] text-[14px] cursor-pointer transition-colors ${
                          sortBy === o.id ? "text-[var(--accent)] font-medium" : "text-[rgba(200,201,209,1)] hover:bg-[rgba(255,255,255,0.04)]"
                        }`}
                      >{o.label}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
              className="flex h-[32px] w-[32px] items-center justify-center rounded-full transition-all duration-150 hover:bg-[rgba(255,255,255,0.1)]"
              style={{ border: "1px solid rgba(255,255,255,0.035)", background: "rgba(255,255,255,0.05)" }}
            >
              <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {sortDir === "desc"
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m8-4v12m0 0l-4-4m4 4l4-4" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m8 4V4m0 0l-4 4m4-4l4 4" />}
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-[16px]">
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`h-[32px] px-[8px] text-[14px] font-medium cursor-pointer rounded-[8px] transition-all duration-[65ms] active:scale-[0.96] ${
                  period === p.id ? "text-[rgb(82,111,255)]" : "text-[var(--text-primary)] hover:bg-[rgba(82,111,255,0.2)] hover:text-[rgb(82,111,255)]"
                }`}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* ═══ Top 3 Hero Cards (KOL tab only, hidden during search) ═══ */}
        {showTop3 && !isLoading && top3.length > 0 && (
          <div className="pb-[24px]">
            {/* Rank 1 — full width */}
            {top3[0] && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <div className="flex justify-center mb-[8px]">
                  <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: "rgba(82,111,255,0.15)", color: "rgb(82,111,255)", border: "1px solid rgba(82,111,255,0.3)" }}>1</div>
                </div>
                <TopCard entry={top3[0]} rank={1} showUsd={showUsd} onSelect={setSelectedKol} />
              </motion.div>
            )}
            {/* Ranks 2 & 3 — side by side */}
            {(top3[1] || top3[2]) && (
              <div className="grid grid-cols-2 gap-[16px] mt-[16px]">
                {top3[1] && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                    <div className="flex items-center gap-[8px] mb-[8px]">
                      <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: "rgba(252,252,252,0.05)", color: "rgba(200,201,209,1)", border: "1px solid rgba(255,255,255,0.08)" }}>2</div>
                    </div>
                    <TopCard entry={top3[1]} rank={2} showUsd={showUsd} onSelect={setSelectedKol} />
                  </motion.div>
                )}
                {top3[2] && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                    <div className="flex items-center justify-end gap-[8px] mb-[8px]">
                      <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: "rgba(252,252,252,0.05)", color: "rgba(200,201,209,1)", border: "1px solid rgba(255,255,255,0.08)" }}>3</div>
                    </div>
                    <TopCard entry={top3[2]} rank={3} showUsd={showUsd} onSelect={setSelectedKol} />
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && isKol && (
          <div className="pb-[24px] space-y-[16px]">
            <div className="h-[180px] rounded-[16px] animate-pulse" style={{ background: "rgba(252,252,252,0.02)" }} />
            <div className="grid grid-cols-2 gap-[16px]">
              <div className="h-[150px] rounded-[16px] animate-pulse" style={{ background: "rgba(252,252,252,0.02)" }} />
              <div className="h-[150px] rounded-[16px] animate-pulse" style={{ background: "rgba(252,252,252,0.02)" }} />
            </div>
          </div>
        )}

        {/* ═══ Traders Table ═══ */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "rgba(252,252,252,0.00135)", border: "1px solid rgba(252,252,252,0.05)" }}>
          {/* Table title bar */}
          <div className="flex items-center justify-between h-[52px] px-[24px]">
            <span className="text-[16px] font-semibold text-[var(--text-primary)]">{tab === "tracked" ? "Tracked Wallets" : "Traders"}</span>
            <div className="flex items-center gap-[16px]">
              {/* SOL/USD toggle */}
              <button onClick={() => setShowUsd(!showUsd)}
                className="flex h-[32px] items-center gap-[4px] rounded-full pl-[10px] pr-[8px] text-[14px] font-medium text-[var(--text-primary)] cursor-pointer transition-colors duration-150 hover:bg-[rgba(252,252,252,0.1)]"
                style={{ background: "rgba(252,252,252,0.055)", border: "1px solid rgba(255,255,255,0.035)" }}
                title={showUsd ? "Switch to SOL" : "Switch to USD"}
              >
                {showUsd ? "USD" : "SOL"}
                <svg className="w-[14px] h-[14px]" style={{ opacity: 0.65 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
              </button>
              {/* Pagination (Global tab) */}
              {tab === "global" && (
                <div className="flex items-center gap-[4px]">
                  {[1, 2, 3, 4].map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-[28px] h-[28px] text-[13px] font-medium rounded-[4px] cursor-pointer transition-colors ${
                        page === p ? "text-[var(--text-primary)]" : "text-[rgba(119,122,140,1)] hover:text-[var(--text-primary)]"
                      }`}
                      style={{ background: page === p ? "rgba(252,252,252,0.08)" : "rgba(252,252,252,0.03)" }}
                    >{p}</button>
                  ))}
                </div>
              )}
              {/* Gallery/List toggle */}
              <button onClick={() => setViewMode(viewMode === "list" ? "gallery" : "list")}
                className="flex h-[32px] w-[32px] items-center justify-center rounded-[4px] text-[var(--text-primary)] cursor-pointer transition-colors duration-150 hover:bg-[rgba(252,252,252,0.1)]"
                style={{ background: "rgba(252,252,252,0.05)" }}
              >
                {viewMode === "list"
                  ? <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                  : <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>}
              </button>
            </div>
          </div>

          {viewMode === "gallery" ? (
            /* Gallery view */
            <div className="px-[24px] pb-[24px] overflow-y-auto" style={{ maxHeight: "calc(100vh - 400px)" }}>
              {isLoading ? (
                <div className="space-y-[12px]">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-[120px] rounded-[16px] animate-pulse" style={{ background: "rgba(252,252,252,0.02)" }} />))}</div>
              ) : rows.length === 0 && top3.length === 0 ? (
                <div className="py-[64px] text-center text-[rgba(119,122,140,1)] text-[15px]">No rankings data available</div>
              ) : (
                <div className="space-y-[12px]">
                  {rows.map((entry, i) => (
                    <GalleryCard key={entry.profile.id} entry={entry} rank={showTop3 ? i + 4 : i + 1} showUsd={showUsd} onSelect={setSelectedKol} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* List view */
            <>
              <div className="flex h-[40px] w-full items-center gap-[16px] whitespace-nowrap px-[24px] text-[14px] font-normal text-[rgba(119,122,140,1)]" style={{ paddingRight: 34 }}>
                <div className="w-[80px] shrink-0">Rank</div>
                <div className="flex-1">{tab === "global" || tab === "tracked" ? "Wallet" : "Trader"}</div>
                <div className="flex-1">PNL</div>
                <div className="flex-1">Win Rate</div>
                <div className="flex-1">Positions</div>
                <div className="flex-1">Trades</div>
                <div className="flex-1">Volume</div>
                <div className="flex-1">Avg Hold</div>
              </div>
              {/* Scrollable rows */}
              <div className="overflow-y-auto pb-[32px]" style={{ maxHeight: "calc(100vh - 400px)", minHeight: 400 }}>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (<div key={i} className="h-[72px] animate-pulse" style={{ opacity: 1 - i * 0.08, background: "rgba(252,252,252,0.01)" }} />))
                ) : rows.length === 0 && top3.length === 0 ? (
                  <div className="px-[24px] py-[64px] text-center text-[rgba(119,122,140,1)] text-[15px]">No rankings data available</div>
                ) : (
                  rows.map((entry, i) => (
                    <TraderRow key={entry.profile.id} entry={entry} rank={showTop3 ? i + 4 : i + 1} isKol={isKol} showUsd={showUsd} onSelect={setSelectedKol} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showContribute && <ContributeModal onClose={() => setShowContribute(false)} />}
      </AnimatePresence>
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

  return (
    <div onClick={() => onSelect(entry)}
      className="group relative isolate overflow-hidden rounded-[16px] cursor-pointer transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      style={{ background: "rgba(16,17,20,0.9)", border: big ? "2px solid rgba(82,111,255,0.2)" : "2px solid rgba(255,255,255,0.05)" }}
    >
      {/* Glow border for #1 */}
      {big && <div className="pointer-events-none absolute inset-[-1px] z-[3] rounded-[16px]" style={{ boxShadow: "inset 0 0 0 1px rgba(82,111,255,0.15), 0 0 80px -15px rgba(82,111,255,0.15)" }} />}
      {/* BG overlay */}
      <div className="pointer-events-none absolute inset-0 z-[1] rounded-[16px]" style={{ background: "var(--bg-base)", opacity: 0.35 }} />
      {/* Blurred PFP */}
      {entry.profile.twitter_handle && (
        <div className="pointer-events-none absolute inset-0 z-[0] overflow-hidden">
          <div className="h-full w-full scale-150 blur-[100px] saturate-[1.75] brightness-[0.5] opacity-[0.1]"
            style={{ backgroundImage: `url(https://unavatar.io/twitter/${entry.profile.twitter_handle})`, backgroundSize: "cover" }} />
        </div>
      )}
      {/* Content */}
      <div className="relative z-10 p-[24px]">
        <div className="flex items-start justify-between gap-[16px] mb-[16px]">
          <div className="flex items-center gap-[12px]">
            <PfpImage handle={entry.profile.twitter_handle} pfp={entry.profile.twitter_pfp_url} name={entry.profile.display_name} size={big ? 64 : 48} />
            <div>
              <div className="flex items-center gap-[8px]">
                <span className={`${big ? "text-[18px]" : "text-[16px]"} font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors`}>{entry.profile.display_name}</span>
                <span className="text-[14px] text-[rgba(119,122,140,1)]">{entry.win_rate > 0 ? `${entry.win_rate.toFixed(2)}%` : ""}</span>
              </div>
              <div className="flex items-center gap-[6px] mt-[4px]"><XIcon /></div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-[rgba(119,122,140,1)]">PNL</div>
            <div className="flex items-center justify-end gap-[4px]">
              {!showUsd && <SolLogo size={14} />}
              <span className={`${big ? "text-[24px]" : "text-[20px]"} font-bold tabular-nums ${pos ? "text-[rgb(47,227,172)]" : "text-[rgb(236,57,122)]"}`}>{fmtPnl(pnl, !showUsd)}</span>
            </div>
            <div className={`text-[13px] tabular-nums ${pnlUsd >= 0 ? "text-[rgb(47,227,172)]" : "text-[rgb(236,57,122)]"}`}>{fmtPnl(pnlUsd, false)}</div>
          </div>
        </div>
        <div className="h-px mb-[16px]" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="flex items-center gap-[24px]">
          <StatBlock value={entry.positions > 0 ? String(entry.positions) : "\u2014"} label="Positions" win={entry.positions_win} loss={entry.positions_loss} />
          <StatBlock value={entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"} label="Trades" win={entry.winning_trades} loss={entry.losing_trades} />
          <div className="flex items-center gap-[8px]">
            {!showUsd && <SolLogo size={13} />}
            <span className="text-[14px] font-medium tabular-nums text-[var(--text-primary)]">{fmtVol(showUsd ? entry.volume_usd : entry.volume_sol, !showUsd)}</span>
            {!showUsd && entry.volume_usd > 0 && <span className="text-[12px] text-[rgba(119,122,140,1)]">${fmtVol(entry.volume_usd, false).replace("$", "")}</span>}
          </div>
          <div className="text-[12px] text-[rgba(119,122,140,1)]">Volume</div>
          <div><span className="text-[14px] font-medium tabular-nums text-[var(--text-primary)]">{fmtHold(entry.avg_hold_time_mins ?? 0)}</span></div>
          <div className="text-[12px] text-[rgba(119,122,140,1)]">Avg. Hold Time</div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ value, label, win, loss }: { value: string; label: string; win: number; loss: number }) {
  return (
    <div className="flex flex-col items-start gap-[3px]">
      <span className="flex h-[24px] items-center text-[14px] font-medium leading-none text-[var(--text-primary)]">{value}</span>
      <span className="text-[12px] leading-none text-[rgba(119,122,140,1)]">{label}</span>
      {(win > 0 || loss > 0) && (
        <div className="flex items-center gap-[6px] mt-[2px]">
          <span className="text-[11px] font-medium leading-none text-[rgb(47,227,172)]">{win.toLocaleString()}</span>
          <span className="text-[11px] font-medium leading-none text-[rgb(236,57,122)]">{loss.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

/* ═══ Trader Row ═══ */

function TraderRow({ entry, rank, isKol, showUsd, onSelect }: { entry: KolRanking; rank: number; isKol: boolean; showUsd: boolean; onSelect: (k: KolRanking) => void }) {
  const pnl = showUsd ? entry.pnl_usd : entry.pnl_sol;
  const pos = pnl >= 0;
  const vol = showUsd ? entry.volume_usd : entry.volume_sol;

  return (
    <div onClick={() => onSelect(entry)}
      className="group/tablerow relative flex h-[72px] min-h-[72px] w-full cursor-pointer flex-row items-center justify-start gap-[16px] overflow-hidden whitespace-nowrap bg-transparent px-[24px] transition-colors duration-150 hover:bg-[rgba(252,252,252,0.02)]"
    >
      {/* Hover PFP blur */}
      {isKol && entry.profile.twitter_handle && (
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/tablerow:opacity-100">
          <div className="absolute inset-y-0 -left-[100px] right-[50%] blur-[60px] brightness-[0.65] saturate-[1.3]">
            <img alt="" loading="eager" src={`https://unavatar.io/twitter/${entry.profile.twitter_handle}`} className="absolute inset-0 h-full w-full object-cover opacity-[0.25]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-white/[0.08] via-white/0 to-transparent blur-[20px]" style={{ mixBlendMode: "overlay" }} />
        </div>
      )}
      <div className="relative z-10 w-[80px] shrink-0 text-[14px] font-normal text-[rgba(200,201,209,1)] tabular-nums">{rank}</div>
      <div className="relative z-10 flex flex-1 items-center gap-[8px] min-w-0">
        <PfpImage handle={isKol ? entry.profile.twitter_handle : null} pfp={entry.profile.twitter_pfp_url} name={entry.profile.display_name} size={44} />
        <div className="min-w-0">
          <div className="flex items-center gap-[6px]">
            <span className="text-[16px] font-medium text-[var(--text-primary)] truncate group-hover/tablerow:text-[var(--accent)] transition-colors">{isKol ? entry.profile.display_name : truncAddr(entry.profile.id)}</span>
          </div>
          {isKol && entry.profile.twitter_handle && <div className="flex items-center gap-1 mt-0.5"><XIcon small /></div>}
        </div>
      </div>
      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-[4px]">
          {!showUsd && <SolLogo size={12} />}
          <span className={`text-[16px] font-medium tabular-nums ${pos ? "text-[rgb(47,227,172)]" : "text-[rgb(236,57,122)]"}`}>{fmtPnl(pnl, !showUsd)}</span>
        </div>
      </div>
      <div className="relative z-10 flex-1 text-[16px] tabular-nums text-[var(--text-primary)]">{entry.win_rate > 0 ? `${entry.win_rate.toFixed(1)}%` : "\u2014"}</div>
      <div className="relative z-10 flex-1">
        <div className="text-[16px] tabular-nums text-[var(--text-primary)]">{entry.positions > 0 ? entry.positions.toLocaleString() : "\u2014"}</div>
        {(entry.positions_win > 0 || entry.positions_loss > 0) && (
          <div className="flex items-center gap-[6px] mt-[2px] text-[12px] tabular-nums">
            <span className="text-[rgb(47,227,172)]">{entry.positions_win.toLocaleString()}</span>
            <span className="text-[rgb(236,57,122)]">{entry.positions_loss.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="relative z-10 flex-1">
        <div className="text-[16px] tabular-nums text-[var(--text-primary)]">{entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"}</div>
        {(entry.winning_trades > 0 || entry.losing_trades > 0) && (
          <div className="flex items-center gap-[6px] mt-[2px] text-[12px] tabular-nums">
            <span className="text-[rgb(47,227,172)]">{entry.winning_trades.toLocaleString()}</span>
            <span className="text-[rgb(236,57,122)]">{entry.losing_trades.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-[4px] text-[16px] tabular-nums text-[var(--text-primary)]">
          {!showUsd && <SolLogo size={12} />}
          {fmtVol(vol, !showUsd)}
        </div>
      </div>
      <div className="relative z-10 flex-1 text-[16px] tabular-nums text-[rgba(119,122,140,1)]">{fmtHold(entry.avg_hold_time_mins ?? 0)}</div>
    </div>
  );
}

/* ═══ Gallery Card ═══ */

function GalleryCard({ entry, rank, showUsd, onSelect }: { entry: KolRanking; rank: number; showUsd: boolean; onSelect: (k: KolRanking) => void }) {
  const pnl = showUsd ? entry.pnl_usd : entry.pnl_sol;
  const pnlUsd = entry.pnl_usd;
  const pos = pnl >= 0;

  return (
    <div onClick={() => onSelect(entry)}
      className="group relative overflow-hidden rounded-[16px] p-[24px] cursor-pointer transition-all duration-150 hover:bg-[rgba(252,252,252,0.02)]"
      style={{ border: "2px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center justify-between gap-[16px]">
        <div className="flex items-center gap-[12px]">
          <span className="text-[14px] font-normal text-[rgba(200,201,209,1)] tabular-nums w-[32px]">{rank}</span>
          <PfpImage handle={entry.profile.twitter_handle} pfp={entry.profile.twitter_pfp_url} name={entry.profile.display_name} size={44} />
          <div>
            <div className="flex items-center gap-[8px]">
              <span className="text-[16px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{entry.profile.display_name}</span>
              <span className="text-[14px] text-[rgba(119,122,140,1)]">{entry.win_rate > 0 ? `${entry.win_rate.toFixed(2)}%` : ""}</span>
            </div>
            <div className="flex items-center gap-[6px] mt-[4px]"><XIcon small /></div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase text-[rgba(119,122,140,1)]">PNL</div>
          <div className="flex items-center justify-end gap-[4px]">
            {!showUsd && <SolLogo size={13} />}
            <span className={`text-[18px] font-bold tabular-nums ${pos ? "text-[rgb(47,227,172)]" : "text-[rgb(236,57,122)]"}`}>{fmtPnl(pnl, !showUsd)}</span>
          </div>
          <div className={`text-[12px] tabular-nums ${pnlUsd >= 0 ? "text-[rgb(47,227,172)]" : "text-[rgb(236,57,122)]"}`}>{fmtPnl(pnlUsd, false)}</div>
        </div>
      </div>
      <div className="h-px my-[16px]" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="flex items-center gap-[24px]">
        <StatBlock value={String(entry.positions || "\u2014")} label="Positions" win={entry.positions_win} loss={entry.positions_loss} />
        <StatBlock value={entry.trade_count > 0 ? entry.trade_count.toLocaleString() : "\u2014"} label="Trades" win={entry.winning_trades} loss={entry.losing_trades} />
        <div className="flex items-center gap-[4px]">
          {!showUsd && <SolLogo size={12} />}
          <span className="text-[14px] font-medium tabular-nums">{fmtVol(showUsd ? entry.volume_usd : entry.volume_sol, !showUsd)}</span>
          {!showUsd && entry.volume_usd > 0 && <span className="text-[12px] text-[rgba(119,122,140,1)]">${fmtVol(entry.volume_usd, false).replace("$", "")}</span>}
        </div>
        <div className="text-[12px] text-[rgba(119,122,140,1)]">Volume</div>
        <div><span className="text-[14px] font-medium tabular-nums">{fmtHold(entry.avg_hold_time_mins ?? 0)}</span></div>
        <div className="text-[12px] text-[rgba(119,122,140,1)]">Avg. Hold Time</div>
      </div>
    </div>
  );
}

/* ═══ Contribute Modal ═══ */

function ContributeModal({ onClose }: { onClose: () => void }) {
  const [wallet, setWallet] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [discord, setDiscord] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = sanitize(wallet);
    if (!w || w.length < 32 || w.length > 44 || !/^[A-Za-z0-9]+$/.test(w)) return;
    setStatus("busy");
    try {
      await kolApi.submit({ wallet_address: w, twitter_handle: sanitize(twitter) || undefined, display_name: sanitize(twitter) || undefined });
      setStatus("ok");
      setTimeout(onClose, 1500);
    } catch { setStatus("err"); setTimeout(() => setStatus("idle"), 3000); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        className="w-full max-w-[480px] rounded-[16px] shadow-2xl overflow-hidden"
        style={{ background: "rgb(16,17,20)", border: "1px solid rgba(50,53,66,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid rgba(50,53,66,0.4)" }}>
          <h2 className="text-[17px] font-semibold text-[var(--text-primary)]">Add KOL</h2>
          <button onClick={onClose} className="text-[rgba(119,122,140,1)] hover:text-[var(--text-primary)] cursor-pointer"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <form onSubmit={handleSubmit} className="px-[24px] py-[24px] space-y-[20px]">
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-[8px]">Select your wallet</label>
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Select a wallet" required
              className="w-full text-[14px] py-[12px] px-[16px] rounded-[12px] outline-none" style={{ background: "rgb(24,24,26)", border: "1px solid rgba(50,53,66,0.5)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-[8px]">Twitter Handle *</label>
            <div className="relative">
              <span className="absolute left-[16px] top-1/2 -translate-y-1/2"><XIcon /></span>
              <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@username"
                className="w-full text-[14px] py-[12px] pl-[40px] pr-[16px] rounded-[12px] outline-none" style={{ background: "rgb(24,24,26)", border: "1px solid rgba(50,53,66,0.5)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-[8px]">Telegram Handle</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="username"
              className="w-full text-[14px] py-[12px] px-[16px] rounded-[12px] outline-none" style={{ background: "rgb(24,24,26)", border: "1px solid rgba(50,53,66,0.5)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-[var(--text-primary)] mb-[8px]">Discord Handle</label>
            <input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="username#0000"
              className="w-full text-[14px] py-[12px] px-[16px] rounded-[12px] outline-none" style={{ background: "rgb(24,24,26)", border: "1px solid rgba(50,53,66,0.5)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex items-center justify-end gap-[16px] pt-[8px]">
            <button type="button" onClick={onClose} className="text-[14px] text-[rgba(119,122,140,1)] hover:text-[var(--text-primary)] cursor-pointer">Cancel</button>
            <button type="submit" disabled={status === "busy" || !wallet.trim()}
              className="px-[20px] py-[10px] text-[14px] font-semibold text-white rounded-[12px] cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "rgb(82,111,255)" }}>{status === "busy" ? "Submitting..." : status === "ok" ? "Done!" : "Add KOL"}</button>
          </div>
          {status === "err" && <p className="text-[12px] text-[rgb(236,57,122)]">Submission failed. Please try again.</p>}
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ═══ Shared Components ═══ */

function PfpImage({ handle, pfp, name, size }: { handle: string | null; pfp: string | null; name: string; size: number }) {
  const [idx, setIdx] = useState(0);
  const px = `${size}px`;
  const srcs: string[] = [];
  if (handle) srcs.push(`https://unavatar.io/twitter/${handle}`);
  if (pfp) srcs.push(pfp);
  const src = srcs[idx];
  if (src) {
    return (
      <div className="relative shrink-0 group/pfp" style={{ width: px, height: px }}>
        <div className="pointer-events-none absolute inset-0 z-[15] rounded-[8px]" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
        <img src={src} alt={name} width={size} height={size} className="rounded-[8px] h-full w-full object-cover"
          style={{ boxShadow: "0 8px 16px -2px rgba(0,0,0,0.2), 0 4px 8px -1px rgba(0,0,0,0.1)" }}
          onError={() => (idx < srcs.length - 1 ? setIdx(idx + 1) : setIdx(srcs.length))} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center text-white font-bold shrink-0 rounded-[8px]"
      style={{ width: px, height: px, fontSize: `${Math.round(size * 0.38)}px`, background: "linear-gradient(135deg, var(--accent), var(--accent-muted))", border: "1px solid rgba(255,255,255,0.1)" }}>
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function XIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="shrink-0" style={{ color: "rgba(119,122,140,1)" }}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
