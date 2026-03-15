"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type AutocompleteSuggestion } from "@/lib/api";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_ACTIONS = [
  { id: "explorer", label: "Go to Explorer", icon: "🔍", href: "/explorer" },
  { id: "intelligence", label: "Go to Intelligence", icon: "📊", href: "/intelligence" },
  { id: "signals", label: "Go to Signals", icon: "⚡", href: "/signals" },
  { id: "tracked", label: "Go to Tracked Wallets", icon: "👁", href: "/tracked" },
  { id: "ai", label: "Open Bloodhound AI", icon: "🤖", href: "/ai" },
  { id: "new-pairs", label: "View New Pairs", icon: "🪙", href: "/new-pairs" },
  { id: "portfolio", label: "View Portfolio", icon: "💼", href: "/portfolio" },
  { id: "docs", label: "Read Documentation", icon: "📖", href: "/docs" },
];

const SEARCH_ICONS: Record<string, string> = {
  wallet: "◎",
  token: "◈",
  transaction: "→",
  program: "⬡",
};

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["command-palette-search", query],
    queryFn: () => searchApi.autocomplete(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  const results = searchResults?.suggestions ?? [];

  // Filter quick actions based on query
  const filteredActions = query.length === 0
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter(a => 
        a.label.toLowerCase().includes(query.toLowerCase())
      );

  // Combined items for keyboard navigation
  const allItems = query.length >= 2 && results.length > 0
    ? [...results.map(r => ({ type: "result" as const, data: r })), ...filteredActions.map(a => ({ type: "action" as const, data: a }))]
    : filteredActions.map(a => ({ type: "action" as const, data: a }));

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (allItems[selectedIndex]) {
          const item = allItems[selectedIndex];
          if (item.type === "action") {
            router.push(item.data.href);
            onClose();
          } else if (item.type === "result") {
            const r = item.data as AutocompleteSuggestion;
            const path = r.type === "wallet" ? `/wallet/${r.id}`
              : r.type === "token" ? `/token/${r.id}`
              : r.type === "transaction" ? `/tx/${r.id}`
              : `/program/${r.id}`;
            router.push(path);
            onClose();
          }
        } else if (query.trim()) {
          // Direct search
          if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query.trim())) {
            router.push(`/wallet/${query.trim()}`);
          } else {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
          }
          onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [allItems, selectedIndex, query, router, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] animate-fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[560px] z-[501] animate-scale">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <span className="text-[var(--accent)] font-mono text-sm font-bold">bloodhound &gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search wallets, tokens, or type a command..."
              className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] text-sm font-mono placeholder:text-[var(--text-muted)]"
              autoComplete="off"
              spellCheck={false}
            />
            {isLoading && (
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            )}
            <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-muted)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {/* Search results */}
            {query.length >= 2 && results.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Search Results
                </div>
                {results.map((result, i) => {
                  const itemIndex = i;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={result.id}
                      onClick={() => {
                        const path = result.type === "wallet" ? `/wallet/${result.id}`
                          : result.type === "token" ? `/token/${result.id}`
                          : result.type === "transaction" ? `/tx/${result.id}`
                          : `/program/${result.id}`;
                        router.push(path);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="text-[var(--text-muted)] w-5 text-center">
                        {SEARCH_ICONS[result.type] ?? "?"}
                      </span>
                      <span className={`text-sm ${result.type === "transaction" ? "font-mono" : ""}`}>
                        {result.label}
                      </span>
                      {result.sublabel && (
                        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
                          {result.sublabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick actions */}
            {filteredActions.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {query.length >= 2 ? "Quick Actions" : "Navigate"}
                </div>
                {filteredActions.map((action, i) => {
                  const itemIndex = query.length >= 2 && results.length > 0 
                    ? results.length + i 
                    : i;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        router.push(action.href);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isSelected ? "bg-[var(--accent-subtle)] text-[var(--text-primary)]" : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="w-5 text-center">{action.icon}</span>
                      <span className="text-sm">{action.label}</span>
                      <span className="text-[10px] text-[var(--text-faint)] ml-auto font-mono">
                        {action.href}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {query.length >= 2 && results.length === 0 && filteredActions.length === 0 && !isLoading && (
              <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                No results found for "{query}"
              </div>
            )}

            {/* Hint when empty */}
            {query.length === 0 && (
              <div className="px-4 py-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] flex items-center gap-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[10px] font-mono">↑↓</kbd>
                  {" "}Navigate
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[10px] font-mono">Enter</kbd>
                  {" "}Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[10px] font-mono">Esc</kbd>
                  {" "}Close
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Hook to manage command palette state globally
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}
