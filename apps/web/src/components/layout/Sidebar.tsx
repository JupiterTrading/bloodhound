"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import { BloodhoundLogo } from "@/components/ui/BloodhoundLogo";
import { useCommandPalette } from "@/components/ui/CommandPalette";

// New sidebar structure per user request
const NAV_SECTIONS = [
  {
    label: "Leaderboard",
    items: [
      { href: "/rankings", label: "Leaderboard", icon: "trophy", shortcut: "L" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/intelligence", label: "Live Feed", icon: "sparkles", shortcut: "F" },
      { href: "/ai", label: "Bloodhound AI", icon: "brain", shortcut: "A" },
    ],
  },
  {
    label: "Dashboard",
    items: [
      { href: "/explorer", label: "DEX Explorer", icon: "search", shortcut: "E" },
      { href: "/tracked", label: "Tracked Wallets", icon: "star", shortcut: "T" },
      { href: "/new-pairs", label: "Hot Pairs", icon: "fire", shortcut: "H" },
    ],
  },
] as const;

const SECONDARY_ITEMS = [
  { href: "/docs", label: "Docs", icon: "book" },
  { href: "/api-docs", label: "API", icon: "code" },
] as const;

// Keep old structure for mobile menu
const NAV_ITEMS = [
  { href: "/rankings", label: "Leaderboard", icon: "trophy", shortcut: "L" },
  { href: "/intelligence", label: "Live Feed", icon: "sparkles", shortcut: "F" },
  { href: "/ai", label: "Bloodhound AI", icon: "brain", shortcut: "A" },
  { href: "/explorer", label: "DEX Explorer", icon: "search", shortcut: "E" },
  { href: "/tracked", label: "Tracked Wallets", icon: "star", shortcut: "T" },
  { href: "/new-pairs", label: "Hot Pairs", icon: "fire", shortcut: "H" },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  search: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  users: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  trophy: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  ),
  sparkles: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  brain: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 15.5m14.8-.2a9 9 0 01-4.653 5.338 9.05 9.05 0 01-6.294 0A9 9 0 014.2 15.3" />
    </svg>
  ),
  star: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  wallet: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  ),
  plus: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  book: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  code: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  fire: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const { open: openCommandPalette } = useCommandPalette();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={`sidebar fixed left-0 top-8 bottom-0 z-[100] flex flex-col bg-[var(--bg-base)] border-r border-[var(--border)] transition-all duration-300 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[var(--border)] shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group overflow-hidden">
          <div className="relative shrink-0">
            <BloodhoundLogo size={22} />
            <div className="absolute inset-0 blur-md opacity-0 group-hover:opacity-60 transition-opacity bg-[var(--accent)]" />
          </div>
          {!collapsed && (
            <span className="text-[14px] font-bold tracking-tight font-mono text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors whitespace-nowrap">
              BLOODHOUND
            </span>
          )}
        </Link>
      </div>

      {/* Search trigger */}
      <div className="px-3 py-3 border-b border-[var(--border)]">
        <button
          onClick={openCommandPalette}
          className={`w-full flex items-center gap-2 px-2.5 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-left hover:border-[var(--border-strong)] transition-colors cursor-pointer ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          {!collapsed && (
            <>
              <span className="text-[12px] text-[var(--text-muted)] flex-1">Search...</span>
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-[var(--text-faint)]">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Main nav - sectioned */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.label} className={sectionIdx > 0 ? "mt-4" : ""}>
            {/* Section label */}
            {!collapsed && (
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isIndented = 'indent' in item && item.indent;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item group flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    } ${collapsed ? 'justify-center' : ''} ${isIndented && !collapsed ? 'ml-4' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}`}>
                      {ICONS[item.icon]}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="text-[13px] flex-1">{item.label}</span>
                        {'shortcut' in item && item.shortcut && (
                          <kbd className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[9px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-[var(--text-faint)] transition-opacity">
                            {item.shortcut}
                          </kbd>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Divider */}
        <div className="my-4 mx-3 h-px bg-[var(--border)]" />

        {/* Secondary nav - Docs & API */}
        <div className="space-y-0.5">
          {SECONDARY_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item group flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="shrink-0 text-[var(--text-faint)]">
                  {ICONS[item.icon]}
                </span>
                {!collapsed && (
                  <span className="text-[12px]">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Network status */}
      <div className={`px-3 py-2 border-t border-[var(--border)] ${collapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] ${collapsed ? '' : 'px-2'}`}>
          <span className="status-dot status-dot-live shrink-0" />
          {!collapsed && <span>Solana Mainnet</span>}
        </div>
      </div>

      {/* User section */}
      <div className={`px-3 py-3 border-t border-[var(--border)] ${collapsed ? 'flex justify-center' : ''}`}>
        {isSignedIn ? (
          <div className={`flex items-center gap-3 ${collapsed ? '' : 'px-1'}`}>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: 32, height: 32 },
                },
              }}
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <Link 
                  href="/portfolio" 
                  className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  My Portfolio →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <SignInButton mode="modal">
            <button className={`btn btn-primary text-[12px] ${collapsed ? 'btn-sm px-2' : 'w-full'}`}>
              {collapsed ? '→' : 'Sign In'}
            </button>
          </SignInButton>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg 
          className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <>
      {/* Mobile header - offset for Bloomberg nav */}
      <header className="mobile-header fixed top-8 left-0 right-0 h-14 bg-[var(--bg-base)] border-b border-[var(--border)] flex items-center px-4 gap-4 z-[200] lg:hidden">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <BloodhoundLogo size={20} />
          <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
            BLOODHOUND
          </span>
        </Link>

        <button
          onClick={openCommandPalette}
          className="flex-1 flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg"
        >
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-[12px] text-[var(--text-muted)]">Search...</span>
        </button>

        <button
          onClick={() => setOpen(!open)}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {open ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile menu - offset for Bloomberg nav + mobile header */}
      {open && (
        <div className="fixed inset-0 top-[calc(32px+56px)] bg-[var(--bg-base)] z-[199] lg:hidden overflow-y-auto animate-fade-in">
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {ICONS[item.icon]}
                  <span className="text-[14px]">{item.label}</span>
                </Link>
              );
            })}
            <div className="my-4 h-px bg-[var(--border)]" />
            {SECONDARY_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[var(--text-muted)]"
              >
                {ICONS[item.icon]}
                <span className="text-[13px]">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
