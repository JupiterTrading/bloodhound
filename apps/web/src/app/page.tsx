"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BloodhoundLogo } from "@/components/ui/BloodhoundLogo";
import { LandingHero } from "@/components/landing/LandingHero";

// CoinGecko free API — no key needed, CORS allowed from browser
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true";

interface CoinData {
  usd: number;
  usd_24h_change: number;
}
interface MacroPrices {
  bitcoin: CoinData;
  ethereum: CoinData;
  solana: CoinData;
}

const MACRO_COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
] as const;

function formatMacroPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

function MacroTicker() {
  const { data } = useQuery<MacroPrices>({
    queryKey: ["macro-prices"],
    queryFn: () => fetch(COINGECKO_URL).then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  return (
    <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 lg:px-10 flex items-center overflow-x-auto scrollbar-none">
      <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--text-muted)] pr-5 border-r border-[var(--border)] mr-5 whitespace-nowrap shrink-0 leading-10">
        Markets
      </span>

      {MACRO_COINS.map(({ id, symbol }) => {
        const coin = data?.[id as keyof MacroPrices];
        const change = coin?.usd_24h_change ?? 0;
        const isUp = change >= 0;
        return (
          <div key={id} className="flex items-center gap-1.5 px-5 border-r border-[var(--border)] h-10 shrink-0">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wide">
              {symbol}
            </span>
            <span className="font-mono text-[12px] text-[var(--text-primary)] font-medium">
              {coin ? `$${formatMacroPrice(coin.usd)}` : "—"}
            </span>
            {coin && (
              <span 
                className="font-mono text-[10px] font-semibold"
                style={{ color: isUp ? "var(--success)" : "var(--accent)" }}
              >
                {isUp ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}

      <span className="font-mono text-[10px] text-[var(--text-muted)] px-5 whitespace-nowrap shrink-0">
        Solana Mainnet · Live
      </span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <LandingNav />
      <LandingHero />
      <MacroTicker />
      <StatsStrip />
      <FeaturesSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}

// ── Landing Nav ───────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[rgba(8,7,11,0.8)] backdrop-blur-xl border-b border-[var(--border)] flex items-center px-6 lg:px-10 gap-6 z-[200]">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="relative">
          <BloodhoundLogo size={22} />
          <div className="absolute inset-0 blur-md opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: "var(--accent)" }} />
        </div>
        <span 
          className="text-[15px] font-extrabold tracking-tight bg-clip-text text-transparent transition-all"
          style={{
            backgroundImage: "linear-gradient(135deg, var(--text-primary), var(--text-secondary))",
          }}
        >
          BLOODHOUND
        </span>
      </Link>

      <nav className="ml-auto flex items-center gap-6">
        {[
          { label: "Docs", href: "/docs" },
          { label: "API", href: "/api-docs" },
          { label: "GitHub", href: "https://github.com/JupiterTrading/bloodhound" },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors relative group"
          >
            {label}
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent)] group-hover:w-full transition-all duration-300" />
          </a>
        ))}

        <Link href="/explorer" className="btn btn-gradient text-[13px] py-2 px-5">
          Launch App
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K+`;
  return n.toLocaleString();
}

function StatsStrip() {
  const { data } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () =>
      fetch("/api/v1/stats").then((r) => (r.ok ? r.json() : null)) as Promise<{
        tx_count: number;
        wallet_count: number;
        latency_p50_ms: number;
      } | null>,
    staleTime: 300_000,
    retry: false,
  });

  const stats = [
    { value: data?.tx_count ? formatCount(data.tx_count) : "—", label: "Transactions Indexed" },
    { value: data?.wallet_count ? formatCount(data.wallet_count) : "—", label: "Wallets Tracked" },
    { value: "Real-time", label: "Solana Mainnet" },
    { value: data?.latency_p50_ms ? `<${data.latency_p50_ms}ms` : "<100ms", label: "Autocomplete Latency" },
  ];

  return (
    <div className="border-y border-[var(--border)] py-6 bg-[var(--bg-surface)]">
      <div className="container flex justify-around flex-wrap gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-mono text-xl lg:text-2xl font-bold text-[var(--text-primary)] mb-1">
              {s.value}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] tracking-wide uppercase">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature sections ──────────────────────────────────────────────────────────

const FEATURES = [
  {
    eyebrow: "01 — INTELLIGENCE LAYER",
    headline: "Know who you're watching.",
    body: "Every wallet gets automatically profiled. WHALE, SMART MONEY, SNIPER, INSIDER, BOT — classification runs on every address at rest and in real time. See portfolio value, first funding source, transaction patterns, and known social handles in one view.",
    tags: ["Wallet Profiling", "Auto Classification", "Source Tracking", "Known Wallets DB"],
    visual: <IntelligenceVisual />,
    reverse: false,
  },
  {
    eyebrow: "02 — RELATIONSHIP MAPPING",
    headline: "Follow the connections.",
    body: "Graph view maps every wallet's relationships — direct transfers, co-sniped launches, same Jito bundles, shared funding sources. Expand hop by hop. See cluster membership, time-decay on old connections, and potential side wallets flagged automatically.",
    tags: ["Graph View", "2–5 Hop Traversal", "Side Wallet Detection", "Bundle Analysis"],
    visual: <GraphVisual />,
    reverse: true,
  },
  {
    eyebrow: "03 — BLOODHOUND AI",
    headline: "Ask in plain language.",
    body: "\"Does poop send to punk?\" — Bloodhound AI traces relationships, funding chains, and wallet behaviors in natural language. Every answer is backed by real transaction evidence. Confirmed, Probable, or Suspected — never fabricated. Agentic: it tracks wallets, sets alerts, and opens graphs for you.",
    tags: ["NL Queries", "Evidence Links", "Agentic Actions", "Multi-turn Memory"],
    visual: <AIVisual />,
    reverse: false,
  },
];

function FeaturesSection() {
  return (
    <div className="container">
      {FEATURES.map((f) => (
        <FeatureRow key={f.eyebrow} {...f} />
      ))}
    </div>
  );
}

function FeatureRow({
  eyebrow,
  headline,
  body,
  tags,
  visual,
  reverse,
}: (typeof FEATURES)[0]) {
  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center py-16 lg:py-24 border-b border-[var(--border)] ${reverse ? 'direction-rtl' : ''}`}
    >
      <div className="direction-ltr">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[var(--accent)] mb-4">
          {eyebrow}
        </div>
        <h2 className="text-2xl lg:text-[32px] font-bold tracking-tight leading-tight text-[var(--text-primary)] mb-5">
          {headline}
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] mb-6">
          {body}
        </p>
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="badge badge-neutral"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div style={{ direction: "ltr" }}>{visual}</div>
    </div>
  );
}

// ── Feature visuals (mockup panels) ──────────────────────────────────────────

function IntelligenceVisual() {
  const badges = ["WHALE", "SMART MONEY", "SNIPER"];
  return (
    <MockPanel>
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {badges.map((b) => (
          <MockBadge key={b} label={b} accent={b === "SNIPER"} />
        ))}
      </div>
      <MockLabel>punk.sol</MockLabel>
      <MockMono color="var(--text-muted)">DezX...Bt1v</MockMono>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <StatMini label="SOL Balance" value="1,284.4 SOL" />
        <StatMini label="Portfolio" value="$94,281" />
        <StatMini label="First Active" value="Jan 12 2024" />
        <StatMini label="Last Active" value="4 hours ago" />
      </div>
      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "var(--bg-base)",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          fontSize: "12px",
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        This wallet exhibits consistent early-entry patterns across 47 token launches since January 2024. Win rate 71% on closed positions. Frequently co-snipes with 3 known addresses...
      </div>
    </MockPanel>
  );
}

function GraphVisual() {
  // ASCII-style node graph mockup
  const nodes = [
    { x: 50, y: 50, r: 14, color: "var(--accent)", label: "seed" },
    { x: 18, y: 24, r: 8, color: "var(--text-secondary)", label: "punk" },
    { x: 82, y: 24, r: 6, color: "var(--text-muted)", label: "" },
    { x: 18, y: 76, r: 6, color: "var(--text-muted)", label: "" },
    { x: 82, y: 76, r: 8, color: "var(--text-secondary)", label: "anon" },
    { x: 50, y: 88, r: 5, color: "var(--text-muted)", label: "" },
  ];

  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [0, 5],
  ];

  return (
    <MockPanel style={{ aspectRatio: "16 / 10", padding: 0, overflow: "hidden" }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="var(--border)"
            strokeWidth="0.6"
          />
        ))}
        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={i === 0 ? 1 : 0.7} />
            {n.label && (
              <text
                x={n.x}
                y={n.y + n.r + 5}
                textAnchor="middle"
                fontSize="4"
                fill="var(--text-muted)"
              >
                {n.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </MockPanel>
  );
}

function AIVisual() {
  return (
    <MockPanel style={{ fontFamily: "JetBrains Mono, monospace" }}>
      <div
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginBottom: "12px",
        }}
      >
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          bloodhound &gt;
        </span>{" "}
        does poop send to punk?
      </div>

      {/* Response card */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
            fontSize: "11px",
            color: "var(--text-muted)",
            letterSpacing: "0.04em",
          }}
        >
          QUERY: does poop send to punk?
        </div>
        <div style={{ padding: "14px" }}>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            <span style={{ color: "#22c55e", fontWeight: 700 }}>YES</span> —
            poop has sent punk{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              88.7 SOL
            </span>{" "}
            across 5 transactions. Last: 14 hours ago.
          </p>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginBottom: "10px",
            }}
          >
            88.7 SOL · 5 txs · First: Feb 1 2026
          </div>
          <div
            style={{
              display: "flex",
              gap: "6px",
              fontSize: "11px",
              color: "#22c55e",
              alignItems: "center",
            }}
          >
            <span>●</span>
            <span style={{ fontWeight: 600 }}>
              CONFIRMED — Direct on-chain proof found
            </span>
          </div>
        </div>
      </div>
    </MockPanel>
  );
}

// ── Mock panel helpers ────────────────────────────────────────────────────────

function MockPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MockBadge({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        padding: "2px 7px",
        borderRadius: "3px",
        border: `1px solid ${accent ? "var(--accent)" : "var(--border)"}`,
        color: accent ? "var(--accent)" : "var(--text-secondary)",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function MockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "18px",
        fontWeight: 700,
        color: "var(--text-primary)",
        marginBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

function MockMono({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "12px",
        color: color ?? "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── CTA section ───────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <div className="relative py-32 px-6 lg:px-10 text-center overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: "linear-gradient(135deg, var(--gradient-1), var(--gradient-2))",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="badge badge-gradient mb-6 mx-auto">
          Ready to hunt?
        </div>
        <h2 className="text-4xl lg:text-[48px] font-extrabold tracking-tight mb-5">
          <span className="text-[var(--text-primary)]">Start </span>
          <span 
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(135deg, var(--gradient-1), var(--gradient-2), var(--gradient-3))",
            }}
          >
            Tracking
          </span>
          <span className="text-[var(--text-primary)]"> Now.</span>
        </h2>
        <p className="text-[17px] text-[var(--text-secondary)] mb-12 max-w-[500px] mx-auto leading-relaxed">
          Join traders using Bloodhound to gain the intelligence edge on Solana.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/explorer" className="btn btn-gradient btn-lg group">
            Launch App
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link href="/docs" className="btn btn-secondary btn-lg">
            Read Docs
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-10 px-6 lg:px-10">
      <div className="container flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <BloodhoundLogo size={18} />
          <span 
            className="text-[13px] font-bold tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, var(--text-primary), var(--text-muted))" }}
          >
            BLOODHOUND
          </span>
          <span className="text-[11px] text-[var(--text-faint)] ml-1">© 2026</span>
        </div>

        <nav className="flex gap-6">
          {[
            { label: "Explorer", href: "/explorer" },
            { label: "Pricing", href: "/pricing" },
            { label: "Docs", href: "/docs" },
            { label: "API", href: "/api-docs" },
            { label: "GitHub", href: "https://github.com/JupiterTrading/bloodhound" },
            { label: "Twitter/X", href: "https://x.com/bloodhoundxyz" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
