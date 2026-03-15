"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type SearchResult } from "@/lib/api";
import Link from "next/link";

// Inner component: all useSearchParams() calls live here, inside <Suspense>
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchApi.search(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });

  const results = data?.results ?? [];

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8">
      {/* Search header */}
      <div className="mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const input = form.querySelector("input") as HTMLInputElement;
            if (input.value.trim()) {
              router.push(`/search?q=${encodeURIComponent(input.value.trim())}`);
            }
          }}
        >
          <input
            type="text"
            defaultValue={q}
            placeholder="Search wallet, token, tx, @handle..."
            autoFocus
            className="input w-full px-4 py-3 text-[15px]"
          />
        </form>

        {q && (
          <p className="mt-3 text-[13px] text-[var(--text-muted)]">
            {isLoading
              ? "Searching..."
              : isError
              ? "Search failed"
              : `${results.length} result${results.length !== 1 ? "s" : ""} for "${q}"`}
          </p>
        )}
      </div>

      {/* Results */}
      {!q ? (
        <SearchTips />
      ) : isLoading ? (
        <SearchSkeleton />
      ) : isError ? (
        <div className="card p-4">
          <div className="text-[14px] font-semibold text-[var(--text-primary)] mb-1.5">
            Couldn't reach the search service
          </div>
          <div className="text-[13px] text-[var(--text-muted)] leading-snug">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      ) : results.length === 0 ? (
        <NoResults q={q} />
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

// Page wrapper: required so useSearchParams() is inside a Suspense boundary
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}

function getResultHref(result: SearchResult): string {
  switch (result.type) {
    case "wallet": return `/wallet/${result.id}`;
    case "token": return `/token/${result.id}`;
    case "transaction": return `/tx/${result.id}`;
    case "program": return `/program/${result.id}`;
  }
}

function ResultCard({ result }: { result: SearchResult }) {
  const TYPE_ICONS: Record<string, string> = {
    wallet: "◎",
    token: "◈",
    transaction: "→",
    program: "⬡",
  };

  const icon = TYPE_ICONS[result.type] ?? "·";

  return (
    <Link href={getResultHref(result)} className="no-underline block">
      <div className="card px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[var(--accent)] transition-colors">
        <span className="text-lg text-[var(--text-muted)] w-6 text-center shrink-0">
          {icon}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--text-primary)] mb-0.5">
            {result.label}
          </div>
          {result.sublabel && (
            <div className="text-[12px] text-[var(--text-muted)] capitalize">
              {result.sublabel.replace(/_/g, " ")}
            </div>
          )}
        </div>

        <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide shrink-0">
          {result.type}
        </span>
      </div>
    </Link>
  );
}

function SearchTips() {
  const tips = [
    { icon: "◎", text: "Paste any Solana wallet address" },
    { icon: "→", text: "Paste a transaction signature" },
    { icon: "@", text: "Search by @handle (e.g. @poop)" },
    { icon: "◈", text: "Search by token name or symbol" },
  ];

  return (
    <div className="card p-6">
      <p className="text-[13px] text-[var(--text-muted)] mb-4">
        What you can search for:
      </p>
      <div className="flex flex-col gap-2.5">
        {tips.map((tip) => (
          <div key={tip.text} className="flex items-center gap-3">
            <span className="text-[var(--accent)] text-[14px] w-5">{tip.icon}</span>
            <span className="text-[13px] text-[var(--text-secondary)]">{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="card h-[72px]"
          style={{ opacity: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="text-[14px] text-[var(--text-secondary)] mb-2">
        No results for &quot;{q}&quot;
      </p>
      <p className="text-[12px] text-[var(--text-muted)]">
        If this is a wallet address, try navigating directly to{" "}
        <Link href={`/wallet/${q}`} className="text-[var(--accent)] no-underline hover:underline">
          /wallet/{q.slice(0, 8)}...
        </Link>
      </p>
    </div>
  );
}
