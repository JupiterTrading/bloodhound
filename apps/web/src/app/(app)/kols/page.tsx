"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";

interface KolProfile {
  id: string;
  display_name: string;
  twitter_handle: string | null;
  twitter_pfp_url: string | null;
  total_pnl_usd: number;
  win_rate: number;
  trade_count: number;
  wallet_count: number;
  verified: boolean;
}

async function fetchKolProfiles(search: string) {
  const params = new URLSearchParams({ limit: "50" });
  if (search) params.set("search", search);
  
  const res = await fetch(`/api/v1/kol/profiles?${params}`);
  if (!res.ok) throw new Error("Failed to fetch KOL profiles");
  return res.json() as Promise<{ profiles: KolProfile[] }>;
}

export default function KolsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["kol-profiles", debouncedSearch],
    queryFn: () => fetchKolProfiles(debouncedSearch),
    staleTime: 60_000,
  });

  // Debounce search
  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).kolSearchTimeout);
    (window as any).kolSearchTimeout = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
            KOL Profiles
          </h1>
          <p className="text-[14px] text-[var(--text-muted)]">
            Track and analyze Key Opinion Leaders on Solana
          </p>
        </div>
        <Link href="/submit" className="btn btn-primary btn-sm">
          + Submit KOL
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or @handle..."
          className="input w-full max-w-md"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-lg" />
          ))}
        </div>
      ) : data?.profiles?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.profiles.map((kol) => (
            <KolCard key={kol.id} kol={kol} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-[48px] mb-4">🔍</div>
          <p className="text-[var(--text-muted)]">
            {search ? "No KOLs found matching your search" : "No KOL profiles yet"}
          </p>
          <Link href="/submit" className="btn btn-secondary btn-sm mt-4">
            Be the first to submit
          </Link>
        </div>
      )}
    </div>
  );
}

function KolCard({ kol }: { kol: KolProfile }) {
  const pnlColor = kol.total_pnl_usd >= 0 ? "text-[var(--success)]" : "text-[var(--error)]";
  const pnlSign = kol.total_pnl_usd >= 0 ? "+" : "";

  return (
    <Link
      href={`/kols/${kol.twitter_handle || kol.id}`}
      className="card p-4 hover:border-[var(--border-strong)] transition-all group"
    >
      <div className="flex items-start gap-3 mb-4">
        {/* PFP */}
        <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] overflow-hidden shrink-0">
          {kol.twitter_pfp_url ? (
            <img
              src={kol.twitter_pfp_url}
              alt={kol.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-lg">
              {kol.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name + handle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
              {kol.display_name}
            </h3>
            {kol.verified && (
              <span className="text-[var(--accent)]" title="Verified">✓</span>
            )}
          </div>
          {kol.twitter_handle && (
            <div className="text-[12px] text-[var(--text-muted)]">
              @{kol.twitter_handle}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border)]">
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
            PnL
          </div>
          <div className={`font-mono text-[13px] font-medium ${pnlColor}`}>
            {pnlSign}${Math.abs(kol.total_pnl_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
            Win Rate
          </div>
          <div className="font-mono text-[13px] font-medium text-[var(--text-primary)]">
            {kol.win_rate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
            Wallets
          </div>
          <div className="font-mono text-[13px] font-medium text-[var(--text-primary)]">
            {kol.wallet_count}
          </div>
        </div>
      </div>
    </Link>
  );
}
