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
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "64px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "40px",
      }}
    >
      {/* Headline */}
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Explore Solana
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Search any wallet address, token, transaction, or program.
        </p>
      </div>

      {/* Big search form */}
      <form onSubmit={handleSubmit} style={{ width: "100%" }}>
        <div
          style={{
            display: "flex",
            gap: "0",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
            transition: "border-color 80ms, box-shadow 80ms",
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--accent)";
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              "0 0 0 2px var(--accent-glow)";
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--border)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste wallet address, token mint, tx signature, or @handle..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              padding: "14px 18px",
              fontSize: "14px",
              fontFamily: query.length > 20 ? "JetBrains Mono, monospace" : "inherit",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "14px 24px",
              background: "var(--accent)",
              border: "none",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 80ms",
              flexShrink: 0,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-hover)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent)")
            }
          >
            Search
          </button>
        </div>
      </form>

      {/* Quick access */}
      {recent.length > 0 && (
      <div style={{ width: "100%" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}
        >
          Recently Viewed
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          {recent.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                router.push(
                  item.type === "wallet"
                    ? `/wallet/${item.id}`
                    : `/token/${item.id}`
                )
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "background 60ms",
                marginBottom: "4px",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-elevated)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-surface)")
              }
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: "3px",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  flexShrink: 0,
                }}
              >
                {item.type}
              </span>
              <span
                style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}
              >
                {item.label}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                {item.id.slice(0, 6)}...{item.id.slice(-4)}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Tip */}
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Try{" "}
        <span style={{ color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
          @handle
        </span>{" "}
        to resolve Twitter/X handles, or{" "}
        <a
          href="/ai"
          style={{
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          ask Bloodhound AI
        </a>{" "}
        to query in plain language.
      </p>
    </div>
  );
}
