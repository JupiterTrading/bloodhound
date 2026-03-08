"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackedApi, alertsApi, keysApi, type ApiKey } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * /billing — Subscription management page.
 * Shows current tier, usage stats, and links to Stripe Customer Portal.
 */
export default function BillingPage() {
  const { isSignedIn, isLoaded, user } = useUser();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "true";
  const [portalLoading, setPortalLoading] = useState(false);
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(upgraded);

  useEffect(() => {
    if (upgraded) {
      const t = setTimeout(() => setShowUpgradedBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [upgraded]);

  if (!isLoaded) {
    return <PageShell><Skeleton style={{ height: "200px", borderRadius: "8px" }} /></PageShell>;
  }

  if (!isSignedIn) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", paddingTop: "40px" }}>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Sign in to manage your subscription.
          </p>
          <SignInButton mode="modal">
            <button style={accentBtn}>Sign In</button>
          </SignInButton>
        </div>
      </PageShell>
    );
  }

  // Read tier from Clerk publicMetadata (set by Clerk webhook or admin) or fallback
  // Since we update Supabase directly via Stripe webhook, tier isn't in Clerk metadata.
  // We show a simple UI that works without knowing the exact tier.
  const email = user.emailAddresses?.[0]?.emailAddress ?? "";

  return (
    <PageShell>
      {showUpgradedBanner && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#22c55e",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>✓</span>
          <span>You're now on Pro. Refresh the page to see your updated limits.</span>
        </div>
      )}

      {/* Account card */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px 24px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              Account
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600, marginBottom: "2px" }}>
              {user.fullName ?? user.username ?? "—"}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{email}</div>
          </div>
          <Link
            href="/pricing"
            style={{
              padding: "7px 14px",
              background: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Upgrade to Pro →
          </Link>
        </div>
      </div>

      {/* Usage card */}
      <UsageCard />

      {/* API Keys */}
      <ApiKeysCard />

      {/* Manage subscription */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "20px 24px",
          marginTop: "20px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
          Subscription
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
          Manage your Pro subscription, update payment details, view invoices, or cancel in the Stripe Customer Portal.
        </p>
        <button
          onClick={async () => {
            setPortalLoading(true);
            try {
              const res = await fetch("/api/stripe/portal", { method: "POST" });
              const { url, error } = await res.json();
              if (error || !url) {
                alert(error === "No active subscription found"
                  ? "No active subscription found. Upgrade to Pro first."
                  : "Unable to open billing portal. Please try again.");
                return;
              }
              window.location.href = url;
            } catch {
              alert("Unable to reach the server.");
            } finally {
              setPortalLoading(false);
            }
          }}
          disabled={portalLoading}
          style={{
            padding: "8px 16px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: portalLoading ? "wait" : "pointer",
            fontFamily: "inherit",
            opacity: portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading ? "Opening…" : "Manage Subscription"}
        </button>
      </div>
    </PageShell>
  );
}

function ApiKeysCard() {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => keysApi.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => keysApi.create(newKeyName || "Default"),
    onSuccess: (result) => {
      setRevealedKey(result.key);
      setNewKeyName("");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => {
      setCreateError(err.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const keys: ApiKey[] = data?.keys ?? [];

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "20px 24px",
        marginBottom: "20px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>
        API Keys
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.5 }}>
        Pro feature. Use your key in the <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }}>Authorization: Bearer bh_...</code> header.
        10,000 requests/day. Max 5 active keys.{" "}
        <Link href="/api-docs" style={{ color: "var(--accent)", textDecoration: "none" }}>API docs →</Link>
      </p>

      {/* Revealed key — shown once */}
      {revealedKey && (
        <div
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: "6px",
            padding: "12px 14px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#22c55e", marginBottom: "6px", fontWeight: 600 }}>
            ✓ Key created — copy it now, it won't be shown again.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "12px",
                color: "var(--text-primary)",
                wordBreak: "break-all",
                flex: 1,
              }}
            >
              {revealedKey}
            </code>
            <button
              onClick={copyKey}
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Existing keys list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
          <Skeleton height={32} borderRadius={4} />
          <Skeleton height={32} borderRadius={4} />
        </div>
      ) : keys.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "6px", overflow: "hidden", marginBottom: "16px" }}>
          {keys.map((k) => (
            <div
              key={k.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-base)",
                padding: "10px 14px",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {k.name}
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-muted)" }}>
                    {k.key_prefix}••••••••••••••••••••••••
                  </code>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {k.last_used_at
                      ? `Last used ${formatRelative(k.last_used_at)}`
                      : `Created ${formatRelative(k.created_at)}`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => revokeMutation.mutate(k.id)}
                disabled={revokeMutation.isPending}
                style={{
                  fontSize: "11px",
                  color: "var(--accent)",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Generate new key */}
      {createError && (
        <p style={{ fontSize: "12px", color: "var(--accent)", marginBottom: "10px" }}>{createError}</p>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Key name (e.g. Production)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          maxLength={60}
          style={{
            flex: 1,
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "7px 10px",
            fontSize: "12px",
            color: "var(--text-primary)",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          style={{
            padding: "7px 14px",
            background: "var(--accent)",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: createMutation.isPending ? "wait" : "pointer",
            fontFamily: "inherit",
            opacity: createMutation.isPending ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {createMutation.isPending ? "Creating…" : "Generate Key"}
        </button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function UsageCard() {
  const { data: trackedData, isLoading: tLoading } = useQuery({
    queryKey: ["tracked"],
    queryFn: () => trackedApi.list(),
    staleTime: 60_000,
  });

  const { data: alertData, isLoading: aLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    staleTime: 60_000,
  });

  const walletCount = trackedData?.count ?? 0;
  const alertCount = (alertData?.alerts as unknown[])?.length ?? 0;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "20px 24px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "16px" }}>
        Usage (Free Tier Limits)
      </div>
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        <UsageStat
          label="Tracked wallets"
          current={tLoading ? null : walletCount}
          limit={50}
          unit="wallets"
        />
        <UsageStat
          label="Alert rules"
          current={aLoading ? null : alertCount}
          limit={5}
          unit="alerts"
        />
        <UsageStat
          label="Wallet groups"
          current={null}
          limit={1}
          unit="group"
          hideBar
        />
        <UsageStat
          label="AI queries / day"
          current={null}
          limit={10}
          unit="queries"
          hideBar
        />
      </div>
    </div>
  );
}

function UsageStat({
  label,
  current,
  limit,
  unit,
  hideBar,
}: {
  label: string;
  current: number | null;
  limit: number;
  unit: string;
  hideBar?: boolean;
}) {
  const pct = current !== null ? Math.min((current / limit) * 100, 100) : null;
  const overLimit = pct !== null && pct >= 100;

  return (
    <div style={{ minWidth: "120px" }}>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
      {current === null ? (
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          — / {limit} {unit}
        </div>
      ) : (
        <div style={{ fontSize: "13px", fontWeight: 600, color: overLimit ? "var(--accent)" : "var(--text-primary)" }}>
          {current} / {limit} {unit}
        </div>
      )}
      {!hideBar && pct !== null && (
        <div
          style={{
            marginTop: "6px",
            height: "3px",
            borderRadius: "2px",
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: overLimit ? "var(--accent)" : "#22c55e",
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "24px" }}>
        Billing
      </h1>
      {children}
    </div>
  );
}

const accentBtn: React.CSSProperties = {
  padding: "9px 20px",
  background: "var(--accent)",
  border: "none",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
