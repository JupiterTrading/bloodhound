"use client";

import Link from "next/link";

// Mock live feed data — will be replaced by real Ably data
const FEED_EVENTS = [
  { label: "poop", action: "bought", token: "BONK", amount: "420K", amountUsd: "$12.4K", time: "2s", type: "buy" },
  { label: "punk.sol", action: "sold", token: "WIF", amount: "1.2M", amountUsd: "$8.1K", time: "5s", type: "sell" },
  { label: "DEZ...4kPz", action: "sniped", token: "GOAT", amount: "50K", amountUsd: "$4.2K", time: "12s", type: "snipe" },
  { label: "whale_12", action: "transferred", token: "SOL", amount: "850", amountUsd: "$124K", time: "18s", type: "transfer" },
  { label: "insider_A", action: "bought", token: "MOODENG", amount: "2.8M", amountUsd: "$31K", time: "24s", type: "buy" },
  { label: "dev_wallet", action: "minted", token: "NEWTOKEN", amount: "1B", amountUsd: "—", time: "31s", type: "mint" },
  { label: "bundler_3", action: "bundled", token: "PEPE2", amount: "200K", amountUsd: "$9.8K", time: "38s", type: "bundle" },
  { label: "smartmoney9", action: "bought", token: "POPCAT", amount: "500K", amountUsd: "$22K", time: "44s", type: "buy" },
  { label: "MiDa...9xPz", action: "sold", token: "DOGWIF", amount: "180K", amountUsd: "$7.2K", time: "52s", type: "sell" },
  { label: "kol_larry", action: "transferred", token: "SOL", amount: "200", amountUsd: "$29K", time: "1m", type: "transfer" },
  { label: "rug_watch", action: "sold", token: "SHIB2", amount: "99%", amountUsd: "$44K", time: "1m", type: "sell" },
  { label: "sniper_X", action: "sniped", token: "PNUT", amount: "900K", amountUsd: "$18K", time: "2m", type: "snipe" },
];

// Duplicate so the CSS scroll loop works seamlessly
const DOUBLED = [...FEED_EVENTS, ...FEED_EVENTS];

const EVENT_COLORS: Record<string, string> = {
  buy: "#22c55e",
  sell: "var(--accent)",
  snipe: "#facc15",
  bundle: "#c084fc",
  transfer: "var(--text-muted)",
  mint: "#38bdf8",
};

export function LandingHero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        paddingTop: "56px", // below nav
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay — hero only */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          pointerEvents: "none",
        }}
      />

      {/* Centered content */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          paddingInline: "40px",
          paddingTop: "40px",
          paddingBottom: "40px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "80px",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Left: headline + CTAs */}
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            Live · Solana Mainnet
          </div>

          <h1
            style={{
              fontSize: "clamp(36px, 4vw, 52px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: "24px",
            }}
          >
            On-Chain Intelligence
            <br />
            for Solana.
          </h1>

          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.65,
              color: "var(--text-secondary)",
              marginBottom: "36px",
              maxWidth: "420px",
            }}
          >
            Track wallets. Map relationships. Follow the money. The intelligence
            layer Solana traders actually need.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link
              href="/explorer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                borderRadius: "8px",
                background: "var(--accent)",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 80ms",
                boxShadow: "0 4px 20px var(--accent-glow)",
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
              <span style={{ fontSize: "16px" }}>→</span>
            </Link>
            <a
              href="/docs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 24px",
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

        {/* Right: live data feed */}
        <LiveFeedPanel />
      </div>
    </section>
  );
}

function LiveFeedPanel() {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        height: "420px",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--bg-elevated)",
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#22c55e",
            animation: "pulse 2s ease-in-out infinite",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Live · KOL & Whale Activity
        </span>
      </div>

      {/* Fades at top and bottom */}
      <div
        style={{
          position: "absolute",
          top: "50px",
          left: 0,
          right: 0,
          height: "40px",
          background: "linear-gradient(to bottom, var(--bg-surface), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60px",
          background: "linear-gradient(to top, var(--bg-surface), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Scrolling feed */}
      <div
        style={{
          height: "calc(100% - 50px)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            animation: "ticker 28s linear infinite",
            willChange: "transform",
          }}
        >
          {DOUBLED.map((event, i) => (
            <FeedEventRow key={i} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedEventRow({
  event,
}: {
  event: (typeof FEED_EVENTS)[0];
}) {
  const color = EVENT_COLORS[event.type] ?? "var(--text-muted)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 20px",
        borderBottom: "1px solid var(--border)",
        gap: "10px",
        fontSize: "12px",
      }}
    >
      {/* Time */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          color: "var(--text-muted)",
          width: "28px",
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {event.time}
      </span>

      {/* Wallet label */}
      <span
        style={{
          fontWeight: 600,
          color: "var(--text-primary)",
          fontSize: "12px",
          minWidth: "90px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.label}
      </span>

      {/* Action */}
      <span style={{ color: "var(--text-muted)", fontSize: "11px", flexShrink: 0 }}>
        {event.action}
      </span>

      {/* Amount + token */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "12px",
          color,
          fontWeight: 500,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {event.amount} {event.token}
      </span>

      {/* USD value */}
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "11px",
          color: "var(--text-muted)",
          marginLeft: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {event.amountUsd}
      </span>
    </div>
  );
}
