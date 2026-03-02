"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type SearchResult } from "@/lib/api";
import Link from "next/link";

// Inner component: all useSearchParams() calls live here, inside <Suspense>
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";

  // Redirect immediately if the query is unambiguously an address or tx signature
  useEffect(() => {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      router.replace(`/wallet/${q}`);
    } else if (/^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(q)) {
      router.replace(`/tx/${q}`);
    }
  }, [q, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchApi.search(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });

  const results = data?.results ?? [];

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {/* Search header */}
      <div style={{ marginBottom: "32px" }}>
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
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px 16px",
              fontSize: "15px",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </form>

        {q && (
          <p
            style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            {isLoading
              ? "Searching..."
              : `${results.length} result${results.length !== 1 ? "s" : ""} for "${q}"`}
          </p>
        )}
      </div>

      {/* Results */}
      {!q ? (
        <SearchTips />
      ) : isLoading ? (
        <SearchSkeleton />
      ) : results.length === 0 ? (
        <NoResults q={q} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
    <Link
      href={getResultHref(result)}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          transition: "border-color 80ms",
          cursor: "pointer",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")
        }
      >
        <span
          style={{
            fontSize: "18px",
            color: "var(--text-muted)",
            width: "24px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "2px",
            }}
          >
            {result.label}
          </div>
          {result.sublabel && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {result.sublabel.replace(/_/g, " ")}
            </div>
          )}
        </div>

        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
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
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "24px",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        What you can search for:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {tips.map((tip) => (
          <div
            key={tip.text}
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <span style={{ color: "var(--accent)", fontSize: "14px", width: "20px" }}>
              {tip.icon}
            </span>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {tip.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            height: "72px",
            opacity: 1 - i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "32px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
        No results for &quot;{q}&quot;
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        If this is a wallet address, try navigating directly to{" "}
        <Link
          href={`/wallet/${q}`}
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          /wallet/{q.slice(0, 8)}...
        </Link>
      </p>
    </div>
  );
}
