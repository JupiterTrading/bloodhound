"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AddressTag } from "@/components/ui/AddressTag";

const KNOWN_PROGRAMS: Record<string, { name: string; category: string; website?: string }> = {
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "Pump.fun", category: "Launchpad", website: "https://pump.fun" },
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": { name: "Raydium AMM v4", category: "DEX", website: "https://raydium.io" },
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": { name: "Orca Whirlpools", category: "DEX", website: "https://orca.so" },
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": { name: "Jupiter Aggregator v6", category: "DEX Aggregator", website: "https://jup.ag" },
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": { name: "Metaplex Token Metadata", category: "NFT", website: "https://metaplex.com" },
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": { name: "SPL Token Program", category: "Core", website: "https://spl.solana.com" },
  "11111111111111111111111111111111": { name: "System Program", category: "Core" },
  "ComputeBudget111111111111111111111111111111": { name: "Compute Budget Program", category: "Core" },
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bC4": { name: "Associated Token Program", category: "Core" },
};

async function fetchKnownProgram(address: string) {
  try {
    const res = await fetch(`/api/v1/known/${address}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ label: string; category: string } | null>;
  } catch {
    return null;
  }
}

export default function ProgramPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);

  const { data: knownData } = useQuery({
    queryKey: ["known", address],
    queryFn: () => fetchKnownProgram(address),
    staleTime: 300_000,
    retry: false,
  });

  const local = KNOWN_PROGRAMS[address];
  const programName = local?.name ?? knownData?.label ?? null;
  const programCategory = local?.category ?? knownData?.category ?? "Program";
  const programWebsite = local?.website;

  const shortAddr = address.slice(0, 8) + "..." + address.slice(-6);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {programCategory}
          </span>
          {programWebsite && (
            <a
              href={programWebsite}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")}
            >
              {programWebsite.replace("https://", "")} ↗
            </a>
          )}
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "6px",
          }}
        >
          {programName ?? shortAddr}
        </h1>

        <AddressTag address={address} chars={12} size={12} />
      </div>

      {/* External links */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "14px",
          }}
        >
          External References
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Solscan", href: `https://solscan.io/account/${address}` },
            { label: "SolanaFM", href: `https://solana.fm/address/${address}` },
            { label: "Explorer", href: `https://explorer.solana.com/address/${address}` },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                transition: "border-color 80ms, color 80ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              }}
            >
              {label} ↗
            </a>
          ))}
        </div>
      </div>

      {/* Notice about program intelligence */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
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
          Program Intelligence
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.65 }}>
          Deep program analytics — caller wallets, interaction volumes, and behavioral patterns —
          are available in the Bloodhound intelligence pipeline. This feature is being rolled out
          progressively. To explore wallets that interact with this program, use the{" "}
          <Link
            href="/ai"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            AI terminal
          </Link>
          .
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <Link
          href={`/search?q=${address}`}
          style={{
            padding: "8px 18px",
            background: "var(--accent)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            textDecoration: "none",
            transition: "background 80ms",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background = "var(--accent)")
          }
        >
          Search interactions
        </Link>
        <Link
          href={`/graph/${address}`}
          style={{
            padding: "8px 18px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            textDecoration: "none",
            transition: "border-color 80ms, color 80ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
          }}
        >
          View relationship graph
        </Link>
      </div>
    </div>
  );
}
