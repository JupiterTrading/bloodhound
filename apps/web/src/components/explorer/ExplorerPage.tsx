"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const LS_KEY = "bh_recent_searches";
const MAX_RECENT = 6;

type RecentItem = { type: "wallet" | "token"; label: string; id: string };

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

function saveRecent(item: RecentItem) {
  const current = loadRecent().filter((r) => r.id !== item.id);
  const next = [item, ...current].slice(0, MAX_RECENT);
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function ExplorerPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.trim();
    // Detect if it looks like a wallet address (base58, 32-44 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      const item: RecentItem = { type: "wallet", label: `${q.slice(0, 6)}...${q.slice(-4)}`, id: q };
      saveRecent(item);
      setRecent(loadRecent());
      router.push(`/wallet/${q}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div className="max-w-[720px] mx-auto px-6 py-16 flex flex-col items-center gap-10">
      {/* Headline */}
      <div className="text-center">
        <h1 className="text-3xl lg:text-[36px] font-bold tracking-tight mb-3 text-[var(--text-primary)]">
          Explore Solana
        </h1>
        <p className="text-[15px] text-[var(--text-secondary)]">
          Search any wallet, token, transaction, or program.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-surface)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-ring)] transition-all">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wallet address, token mint, tx signature, or @handle..."
            className={`flex-1 bg-transparent border-none px-4 py-3.5 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] ${query.length > 20 ? 'font-mono' : ''}`}
          />
          <button
            type="submit"
            className="btn btn-primary px-6 rounded-none"
          >
            Search
          </button>
        </div>
      </form>

      {/* Quick access */}
      {recent.length > 0 && (
        <div className="w-full relative z-10 animate-fade-up stagger-2">
          <div className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-muted)] mb-4 flex items-center gap-2">
            <span className="w-8 h-px bg-[var(--border)]" />
            Recently Viewed
            <span className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recent.map((item, i) => (
              <button
                key={item.id}
                onClick={() =>
                  router.push(
                    item.type === "wallet"
                      ? `/wallet/${item.id}`
                      : `/token/${item.id}`
                  )
                }
                className="card card-interactive flex items-center gap-3 px-4 py-3.5 text-left group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className={`badge ${item.type === 'wallet' ? 'badge-accent' : 'badge-success'} uppercase shrink-0`}>
                  {item.type}
                </span>
                <span className="text-[13px] text-[var(--text-primary)] font-medium">
                  {item.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity">
                  {item.id.slice(0, 4)}...{item.id.slice(-4)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      <p className="text-[13px] text-[var(--text-muted)] text-center">
        Tip: Try <span className="font-mono text-[var(--text-secondary)]">@handle</span> to resolve Twitter handles, or{" "}
        <a href="/ai" className="text-[var(--accent)] hover:underline">
          ask Bloodhound AI
        </a>.
      </p>
    </div>
  );
}
