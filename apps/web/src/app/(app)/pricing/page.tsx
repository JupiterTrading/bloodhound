"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

const FEATURES: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Universal search",         free: true,          pro: true },
  { label: "Wallet & token pages",     free: "90-day history", pro: "Full history" },
  { label: "Graph view",               free: "2 hops",      pro: "Up to 5 hops" },
  { label: "Bloodhound AI queries",    free: "10 / day",    pro: "Unlimited" },
  { label: "Tracked wallets",          free: "50 wallets",  pro: "Unlimited" },
  { label: "Wallet groups",            free: "1 group",     pro: "Unlimited" },
  { label: "Alert rules",              free: "5 alerts",    pro: "Unlimited" },
  { label: "Alert channels",           free: "In-app + email", pro: "In-app, email, Telegram, webhook" },
  { label: "Portfolio view",           free: true,          pro: true },
  { label: "KOL overlap signals",      free: true,          pro: true },
  { label: "AI portfolio report",      free: true,          pro: true },
  { label: "Graph + CSV export",       free: true,          pro: true },
  { label: "Identity clustering",      free: true,          pro: true },
  { label: "API access",               free: false,         pro: "10K req / day" },
  { label: "Priority support",         free: false,         pro: true },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const { url, error } = await res.json();
      if (error || !url) {
        alert("Unable to start checkout. Please try again.");
        return;
      }
      window.location.href = url;
    } catch {
      alert("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "12px",
          }}
        >
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "480px", margin: "0 auto" }}>
          Start free. Upgrade when you need deeper intelligence.
        </p>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
          marginBottom: "40px",
        }}
      >
        {/* Free */}
        <TierCard
          name="Free"
          price="$0"
          period="forever"
          description="Search, explore, and track up to 50 wallets with no commitment."
          cta={isSignedIn ? null : <Link href="/explorer" style={ghostBtnStyle}>Get started</Link>}
          highlight={false}
        />

        {/* Pro — highlighted */}
        <TierCard
          name="Pro"
          price="$15"
          period="per month"
          description="Unlimited wallets, full history, API access, and advanced alert delivery."
          cta={
            isSignedIn ? (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                style={{
                  ...accentBtnStyle,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? "Redirecting…" : "Upgrade to Pro"}
              </button>
            ) : (
              <Link href="/sign-in?redirect=/pricing" style={accentBtnStyle}>
                Sign up free
              </Link>
            )
          }
          highlight
          badge="Most Popular"
        />

        {/* Enterprise */}
        <TierCard
          name="Enterprise"
          price="Custom"
          period=""
          description="Custom data volume, dedicated support, on-prem ClickHouse, and SLA guarantees."
          cta={
            <a href="mailto:team@bloodhound.xyz" style={ghostBtnStyle}>
              Contact us
            </a>
          }
          highlight={false}
        />
      </div>

      {/* Feature comparison table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-base)",
          }}
        >
          <span style={headerCell}>Feature</span>
          <span style={{ ...headerCell, textAlign: "center" }}>Free</span>
          <span style={{ ...headerCell, textAlign: "center", color: "var(--accent)" }}>Pro</span>
        </div>

        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              padding: "11px 20px",
              borderBottom: i < FEATURES.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{f.label}</span>
            <span style={{ textAlign: "center" }}>{renderCell(f.free)}</span>
            <span style={{ textAlign: "center" }}>{renderCell(f.pro, true)}</span>
          </div>
        ))}
      </div>

      {/* Fine print */}
      <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", marginTop: "24px" }}>
        Cancel anytime. No hidden fees. All prices in USD.
      </p>
    </div>
  );
}

// --- Sub-components ---

function TierCard({
  name,
  price,
  period,
  description,
  cta,
  highlight,
  badge,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: React.ReactNode;
  highlight: boolean;
  badge?: string;
}) {
  return (
    <div
      style={{
        background: highlight ? "var(--bg-surface)" : "var(--bg-base)",
        border: highlight ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "10px",
        padding: "24px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        position: "relative",
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: "-11px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: "20px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      )}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)" }}>{price}</span>
          {period && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{period}</span>}
        </div>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>
      {cta && <div style={{ marginTop: "auto" }}>{cta}</div>}
    </div>
  );
}

function renderCell(val: string | boolean, isPro = false) {
  if (val === true) {
    return <span style={{ color: isPro ? "var(--accent)" : "#22c55e", fontSize: "14px" }}>✓</span>;
  }
  if (val === false) {
    return <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>—</span>;
  }
  return (
    <span style={{ fontSize: "11px", color: isPro ? "var(--text-secondary)" : "var(--text-muted)" }}>
      {val}
    </span>
  );
}

const headerCell: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const accentBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 0",
  background: "var(--accent)",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
  textDecoration: "none",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 0",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  color: "var(--text-secondary)",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "center",
  textDecoration: "none",
};
