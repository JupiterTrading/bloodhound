"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import { BloodhoundLogo } from "@/components/ui/BloodhoundLogo";
import { searchApi } from "@/lib/api";
import { useCommandPalette } from "@/components/ui/CommandPalette";

const NAV_LINKS = [
  { href: "/explorer", label: "Explorer" },
  { href: "/new-pairs", label: "New Pairs" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/signals", label: "Signals" },
  { href: "/tracked", label: "Tracked" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/ai", label: "AI" },
  { href: "/docs", label: "Docs" },
];

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: openCommandPalette } = useCommandPalette();

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
    <header className="fixed top-0 left-0 right-0 h-14 bg-[var(--bg-base)] border-b border-[var(--border)] flex items-center px-6 gap-5 z-[200]">
      {/* Logo lockup */}
      <Link href="/" className="flex items-center gap-2 shrink-0 group">
        <BloodhoundLogo size={20} />
        <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
          BLOODHOUND
        </span>
      </Link>

      {/* Command palette trigger */}
      <button
        onClick={openCommandPalette}
        className="nav-search flex-1 max-w-[400px] flex items-center gap-3 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer"
      >
        <span className="text-[var(--text-muted)] text-sm">Search wallets, tokens, commands...</span>
        <kbd className="ml-auto px-2 py-0.5 text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-[var(--text-muted)]">
          ⌘K
        </kbd>
      </button>

      {/* Nav links — hidden on mobile */}
      <nav className="nav-links flex items-center gap-4 ml-auto shrink-0">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[13px] whitespace-nowrap pb-0.5 border-b-2 transition-colors ${
                isActive 
                  ? "font-semibold text-[var(--accent)] border-[var(--accent)]" 
                  : "font-normal text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: network status + auth */}
      <div className="flex items-center gap-3 shrink-0 ml-auto">
        <div className="nav-network"><NetworkPill /></div>
        <AuthButton />
        {/* Hamburger — mobile only */}
        <button
          className="nav-hamburger hidden bg-transparent border border-[var(--border)] rounded-md px-2 py-1.5 cursor-pointer text-[var(--text-secondary)] text-lg leading-none hover:border-[var(--border-strong)] transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>
    </header>

    {/* Mobile menu drawer */}
    {mobileOpen && (
      <div className="nav-mobile-drawer fixed top-14 left-0 right-0 bg-[var(--bg-elevated)] border-b border-[var(--border)] z-[199] p-4 flex flex-col gap-1 animate-fade-in">
        {NAV_LINKS.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2.5 rounded-md text-[14px] transition-colors ${
                isActive 
                  ? "font-semibold text-[var(--accent)] bg-[var(--bg-surface)]" 
                  : "font-normal text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    )}
    </>
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
      const q = query.trim();
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
        router.push(`/wallet/${q}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }
      setOpen(false);
      setQuery("");
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
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
        className={`input text-[13px] py-2 ${focused ? 'border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-glow)]' : ''}`}
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
    <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[300] overflow-hidden animate-fade-in">
      {SECTION_ORDER.filter((t) => grouped[t].length > 0).map((type) => (
        <div key={type}>
          <div className="px-3.5 pt-2 pb-1 text-[10px] font-semibold tracking-widest uppercase text-[var(--text-muted)]">
            {SECTION_LABELS[type]}
          </div>
          {grouped[type].map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(r)}
              className="flex items-center justify-between w-full px-3.5 py-2 bg-transparent border-none cursor-pointer text-left gap-3 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <TypeIcon type={type} />
                <span className={`text-[13px] text-[var(--text-primary)] ${type === "transaction" ? "font-mono" : ""}`}>
                  {r.label}
                </span>
              </div>
              {r.secondary && (
                <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
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
    <span className="text-[12px] text-[var(--text-muted)] w-4 text-center shrink-0">
      {icons[type]}
    </span>
  );
}

// ── Network pill ──────────────────────────────────────────────────────────────

function NetworkPill() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] px-2.5 py-1 border border-[var(--border)] rounded-full bg-[var(--bg-surface)]">
      <span className="status-dot status-dot-live" />
      Mainnet
    </div>
  );
}

// ── Auth button ───────────────────────────────────────────────────────────────

function AuthButton() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2.5">
        <Link
          href="/billing"
          className="text-[12px] text-[var(--text-muted)] px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Billing
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: { width: 28, height: 28 },
            },
          }}
        />
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="btn btn-secondary btn-sm">
        Sign In
      </button>
    </SignInButton>
  );
}
