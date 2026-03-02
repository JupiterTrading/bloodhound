"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { BloodhoundLogo } from "@/components/ui/BloodhoundLogo";
import { searchApi } from "@/lib/api";

const NAV_LINKS = [
  { href: "/explorer", label: "Explorer" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/tracked", label: "Tracked" },
  { href: "/signals", label: "Signals" },
  { href: "/ai", label: "Bloodhound AI" },
  { href: "/api-docs", label: "API" },
  { href: "/docs", label: "Docs" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: "24px",
        gap: "20px",
        zIndex: 200,
      }}
    >
      {/* Logo lockup */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <BloodhoundLogo size={20} />
        <span
          style={{
            fontFamily: "'Neue Haas Grotesk', 'Helvetica Neue', Arial, sans-serif",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          BLOODHOUND
        </span>
      </Link>

      {/* Universal search */}
      <div style={{ flex: 1, maxWidth: "460px" }}>
        <SearchBar />
      </div>

      {/* Nav links */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginLeft: "auto",
          flexShrink: 0,
        }}
      >
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                textDecoration: "none",
                borderBottom: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                paddingBottom: "2px",
                transition: "color 80ms",
                whiteSpace: "nowrap",
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: network status + auth */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        <NetworkPill />
        <AuthButton />
      </div>
    </header>
  );
}

// ── Search Bar ────────────────────────────────────────────────────────────────

type SearchResult = {
  type: "wallet" | "token" | "transaction" | "program";
  id: string;
  label: string;
  secondary?: string;
};

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: autocompleteData } = useQuery({
    queryKey: ["search", "autocomplete", query],
    queryFn: () => searchApi.autocomplete(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });

  const results: SearchResult[] = (autocompleteData?.suggestions ?? []).map((s) => ({
    type: (s.type === "wallet" ? "wallet" : s.type === "transaction" ? "transaction" : "token") as SearchResult["type"],
    id: s.id,
    label: s.label,
    secondary: s.sublabel,
  }));

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setOpen(false);
      setQuery("");
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(e.target.value.length >= 2);
        }}
        onFocus={() => {
          setFocused(true);
          if (query.length >= 2) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search wallet, token, tx, program, @handle..."
        style={{
          width: "100%",
          background: "var(--bg-surface)",
          border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "6px",
          padding: "7px 12px",
          fontSize: "13px",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color 80ms",
          boxShadow: focused ? "0 0 0 2px var(--accent-glow)" : "none",
        }}
      />

      {open && results.length > 0 && (
        <SearchDropdown results={results} onClose={() => setOpen(false)} onClear={() => setQuery("")} />
      )}
    </div>
  );
}

function SearchDropdown({
  results,
  onClose,
  onClear,
}: {
  results: SearchResult[];
  onClose: () => void;
  onClear: () => void;
}) {
  const router = useRouter();

  const SECTION_ORDER: SearchResult["type"][] = [
    "wallet",
    "token",
    "transaction",
    "program",
  ];
  const SECTION_LABELS: Record<SearchResult["type"], string> = {
    wallet: "Wallets",
    token: "Tokens",
    transaction: "Transactions",
    program: "Programs",
  };

  const grouped = SECTION_ORDER.reduce(
    (acc, type) => {
      acc[type] = results.filter((r) => r.type === type);
      return acc;
    },
    {} as Record<SearchResult["type"], SearchResult[]>
  );

  function navigate(result: SearchResult) {
    const path =
      result.type === "wallet"
        ? `/wallet/${result.id}`
        : result.type === "token"
        ? `/token/${result.id}`
        : result.type === "transaction"
        ? `/tx/${result.id}`
        : `/program/${result.id}`;
    router.push(path);
    onClose();
    onClear();
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        zIndex: 300,
        overflow: "hidden",
        animation: "fadeSlideIn 100ms ease-out",
      }}
    >
      {SECTION_ORDER.filter((t) => grouped[t].length > 0).map((type) => (
        <div key={type}>
          <div
            style={{
              padding: "8px 14px 4px",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {SECTION_LABELS[type]}
          </div>
          {grouped[type].map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(r)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "8px 14px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                gap: "12px",
                transition: "background 60ms",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "var(--bg-surface)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "none")
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <TypeIcon type={type} />
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-primary)",
                    fontFamily:
                      type === "transaction"
                        ? "JetBrains Mono, monospace"
                        : undefined,
                  }}
                >
                  {r.label}
                </span>
              </div>
              {r.secondary && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.secondary}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function TypeIcon({ type }: { type: SearchResult["type"] }) {
  const icons: Record<SearchResult["type"], string> = {
    wallet: "◎",
    token: "◈",
    transaction: "→",
    program: "⬡",
  };
  return (
    <span
      style={{
        fontSize: "12px",
        color: "var(--text-muted)",
        width: "16px",
        textAlign: "center",
        flexShrink: 0,
      }}
    >
      {icons[type]}
    </span>
  );
}

// ── Network pill ──────────────────────────────────────────────────────────────

function NetworkPill() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontFamily: "JetBrains Mono, monospace",
        color: "var(--text-muted)",
        padding: "3px 8px",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        background: "var(--bg-surface)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#22c55e",
          animation: "pulse 2s ease-in-out infinite",
          display: "inline-block",
        }}
      />
      Mainnet
    </div>
  );
}

// ── Auth button ───────────────────────────────────────────────────────────────

function AuthButton() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: { width: 28, height: 28 },
          },
        }}
      />
    );
  }

  return (
    <SignInButton mode="modal">
      <button
        style={{
          fontSize: "13px",
          fontWeight: 500,
          padding: "5px 14px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "border-color 80ms, color 80ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--border)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-secondary)";
        }}
      >
        Sign In
      </button>
    </SignInButton>
  );
}
