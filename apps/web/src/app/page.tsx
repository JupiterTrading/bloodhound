"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BloodhoundLogo } from "@/components/ui/BloodhoundLogo";
import { LandingHero } from "@/components/landing/LandingHero";

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      {/* Minimal landing nav (not the app nav) */}
      <LandingNav />

      {/* Hero */}
      <LandingHero />

      {/* Stats strip */}
      <StatsStrip />

      {/* Feature sections */}
      <FeaturesSection />

      {/* CTA section */}
      <CtaSection />

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}

// ── Landing Nav ───────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "56px",
        background: "rgba(13, 10, 10, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        paddingInline: "40px",
        gap: "24px",
        zIndex: 200,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          textDecoration: "none",
        }}
      >
        <BloodhoundLogo size={20} />
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          BLOODHOUND
        </span>
      </Link>

      {/* Right */}
      <nav
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
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
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 80ms",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-secondary)")
            }
          >
            {label}
          </a>
        ))}

        <Link
          href="/explorer"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            padding: "6px 16px",
            borderRadius: "6px",
            background: "var(--accent)",
            color: "#fff",
            textDecoration: "none",
            transition: "background 80ms",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background =
              "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background =
              "var(--accent)")
          }
        >
          Launch App →
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
    {
      value: data?.tx_count ? formatCount(data.tx_count) : "—",
      label: "Transactions Indexed",
    },
    {
      value: data?.wallet_count ? formatCount(data.wallet_count) : "—",
      label: "Wallets Tracked",
    },
    { value: "Real-time", label: "Solana Mainnet" },
    {
      value: data?.latency_p50_ms ? `<${data.latency_p50_ms}ms` : "<100ms",
      label: "Autocomplete Latency",
    },
  ];

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "24px 0",
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          paddingInline: "40px",
          display: "flex",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: "24px",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "4px",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
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
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        paddingInline: "40px",
      }}
    >
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
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "80px",
        alignItems: "center",
        padding: "96px 0",
        borderBottom: "1px solid var(--border)",
        direction: reverse ? "rtl" : "ltr",
      }}
    >
      <div style={{ direction: "ltr" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: "16px",
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            fontSize: "32px",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
            marginBottom: "20px",
          }}
        >
          {headline}
        </h2>
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.7,
            color: "var(--text-secondary)",
            marginBottom: "24px",
          }}
        >
          {body}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "11px",
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: "4px",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
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
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "96px 40px",
        textAlign: "center",
        background: "var(--bg-surface)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: "16px",
        }}
      >
        Ready to hunt?
      </div>
      <h2
        style={{
          fontSize: "40px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text-primary)",
          marginBottom: "16px",
        }}
      >
        On-Chain Intelligence for Solana.
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "var(--text-secondary)",
          marginBottom: "40px",
          maxWidth: "480px",
          margin: "0 auto 40px",
        }}
      >
        Track wallets. Map relationships. Follow the money.
      </p>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <Link
          href="/explorer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 28px",
            borderRadius: "8px",
            background: "var(--accent)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 600,
            textDecoration: "none",
            transition: "background 80ms",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background =
              "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background =
              "var(--accent)")
          }
        >
          Launch App
        </Link>
        <a
          href="/docs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "12px 28px",
            borderRadius: "8px",
            background: "transparent",
            color: "var(--text-secondary)",
            fontSize: "15px",
            fontWeight: 500,
            textDecoration: "none",
            border: "1px solid var(--border)",
            transition: "border-color 80ms, color 80ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              "var(--text-muted)";
            (e.currentTarget as HTMLAnchorElement).style.color =
              "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor =
              "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color =
              "var(--text-secondary)";
          }}
        >
          Read Docs
        </a>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "32px 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <BloodhoundLogo size={16} />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          BLOODHOUND
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>
          © 2026
        </span>
      </div>

      <nav style={{ display: "flex", gap: "20px" }}>
        {[
          { label: "Explorer", href: "/explorer" },
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
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              textDecoration: "none",
              transition: "color 80ms",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-secondary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-muted)")
            }
          >
            {label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
