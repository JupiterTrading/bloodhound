"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { trackedApi, type TrackedWallet } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";

export default function TrackedPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <PageShell><LoadingSkeleton /></PageShell>;
  }

  if (!isSignedIn) {
    return <PageShell><SignInGate /></PageShell>;
  }

  return <PageShell><TrackedDashboard /></PageShell>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "32px 24px",
      }}
    >
      {children}
    </div>
  );
}

// ── Sign-in gate ───────────────────────────────────────────────────────────────

function SignInGate() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBlock: "80px",
        gap: "16px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "32px",
          fontFamily: "JetBrains Mono, monospace",
          color: "var(--accent)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          marginBottom: "8px",
        }}
      >
        ◎
      </div>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}
      >
        Tracked Wallets
      </h1>
      <p style={{ fontSize: "14px", color: "var(--text-muted)", maxWidth: "340px" }}>
        Sign in to save wallets, assign labels, and receive real-time alerts.
      </p>
      <SignInButton mode="modal">
        <button
          style={{
            marginTop: "8px",
            padding: "10px 24px",
            background: "var(--accent)",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Sign In
        </button>
      </SignInButton>
    </div>
  );
}

// ── Tracked dashboard ─────────────────────────────────────────────────────────

function TrackedDashboard() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tracked"],
    queryFn: () => trackedApi.list(),
    staleTime: 30_000,
  });

  const wallets = data?.tracked ?? [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            Tracked Wallets
          </h1>
          {!isLoading && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} tracked
            </p>
          )}
        </div>

        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: "8px 16px",
            background: "var(--accent)",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background 80ms",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = "var(--accent)")
          }
        >
          + Track Wallet
        </button>
      </div>

      {/* Add wallet form */}
      {showAdd && (
        <AddWalletForm
          onDismiss={() => setShowAdd(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["tracked"] });
            setShowAdd(false);
          }}
        />
      )}

      {/* Wallet list */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : wallets.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {wallets.map((w) => (
            <WalletRow
              key={w.address}
              wallet={w}
              onRemoved={() => qc.invalidateQueries({ queryKey: ["tracked"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add wallet form ───────────────────────────────────────────────────────────

function AddWalletForm({
  onDismiss,
  onAdded,
}: {
  onDismiss: () => void;
  onAdded: () => void;
}) {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => trackedApi.add({ address: address.trim(), label: label.trim() }),
    onSuccess: onAdded,
    onError: (e) => setError(String(e)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!address.trim() || !label.trim()) return;
    mutation.mutate();
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "16px",
        }}
      >
        Track a wallet
      </h3>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Wallet address (base58)"
            autoFocus
            style={inputStyle}
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. punk, my cold wallet)"
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: "12px", color: "var(--accent)" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={onDismiss} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !address.trim() || !label.trim()}
              style={{
                ...primaryBtnStyle,
                opacity: mutation.isPending ? 0.6 : 1,
                cursor: mutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {mutation.isPending ? "Tracking..." : "Track"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Wallet row ────────────────────────────────────────────────────────────────

function WalletRow({
  wallet,
  onRemoved,
}: {
  wallet: TrackedWallet;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const removeMutation = useMutation({
    mutationFn: () => trackedApi.remove(wallet.address),
    onSuccess: onRemoved,
  });

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      {/* Icon */}
      <span
        style={{
          fontSize: "16px",
          color: wallet.is_own ? "var(--accent)" : "var(--text-muted)",
          flexShrink: 0,
          width: "20px",
          textAlign: "center",
        }}
      >
        {wallet.is_own ? "◉" : "◎"}
      </span>

      {/* Name + address */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link
          href={`/wallet/${wallet.address}`}
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            textDecoration: "none",
            display: "block",
            marginBottom: "2px",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")
          }
        >
          {wallet.label}
        </Link>
        <AddressTag address={wallet.address} chars={6} size={11} />
      </div>

      {/* Tags */}
      {wallet.tags.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", flexShrink: 0 }}>
          {wallet.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Date */}
      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {new Date(wallet.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>

      {/* Remove */}
      {confirming ? (
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            style={{
              ...primaryBtnStyle,
              padding: "4px 10px",
              fontSize: "12px",
            }}
          >
            {removeMutation.isPending ? "..." : "Remove"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{ ...secondaryBtnStyle, padding: "4px 10px", fontSize: "12px" }}
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Remove"
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "16px",
            padding: "2px 4px",
            flexShrink: 0,
            lineHeight: 1,
            transition: "color 80ms",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--accent)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
          }
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "28px", color: "var(--text-muted)", marginBottom: "12px" }}>◎</div>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "6px" }}>
        No wallets tracked yet.
      </p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Track wallets to monitor their activity and set real-time alerts.
      </p>
      <button onClick={onAdd} style={primaryBtnStyle}>
        Track your first wallet
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            height: "58px",
            opacity: 1 - i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "9px 12px",
  fontSize: "13px",
  color: "var(--text-primary)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--accent)",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  color: "var(--text-secondary)",
  fontSize: "13px",
  cursor: "pointer",
  fontFamily: "inherit",
};
