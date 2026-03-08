"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

/**
 * Admin review page — /admin
 * Lists AI-detected event drafts and lets the owner publish or reject them.
 * Protected by ADMIN_API_KEY header (set in env).
 */

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? "";

async function fetchDrafts(adminKey: string) {
  const res = await fetch("/api/v1/events/drafts", {
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<{ drafts: EventDraft[]; count: number }>;
}

async function publishDraft(slug: string, adminKey: string) {
  const res = await fetch(`/api/v1/events/admin/${slug}/publish`, {
    method: "PUT",
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

interface EventDraft {
  slug: string;
  title: string;
  category: string;
  significance: string;
  occurred_at: string;
  token_symbol: string | null;
  ai_confidence: string;
  review_status: string;
  created_at: string;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  CONFIRMED: "#22c55e",
  PROBABLE: "#f59e0b",
  SUSPECTED: "var(--text-muted)",
  UNKNOWN: "var(--text-muted)",
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(ADMIN_KEY);
  const [authed, setAuthed] = useState(!!ADMIN_KEY);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-drafts", adminKey],
    queryFn: () => fetchDrafts(adminKey),
    enabled: authed,
    staleTime: 30_000,
    retry: false,
  });

  const publishMutation = useMutation({
    mutationFn: (slug: string) => publishDraft(slug, adminKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-drafts"] }),
  });

  if (!authed) {
    return (
      <div style={{ maxWidth: "400px", margin: "80px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px", color: "var(--text-primary)" }}>
          Admin Access
        </h1>
        <input
          type="password"
          placeholder="Admin API key..."
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "14px",
            fontFamily: "JetBrains Mono, monospace",
            marginBottom: "12px",
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => e.key === "Enter" && setAuthed(true)}
        />
        <button
          onClick={() => setAuthed(true)}
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Enter
        </button>
      </div>
    );
  }

  const drafts = data?.drafts ?? [];

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
            Event Review Queue
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            AI-detected events pending review. CONFIRMED auto-publishes — PROBABLE needs your approval.
          </p>
        </div>
        <Link href="/intelligence" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}>
          ← Intelligence
        </Link>
      </div>

      {isLoading && (
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading...</p>
      )}
      {error && (
        <p style={{ fontSize: "13px", color: "var(--accent)" }}>
          Access denied or backend unavailable.
        </p>
      )}

      {!isLoading && drafts.length === 0 && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center",
          fontSize: "13px",
          color: "var(--text-muted)",
        }}>
          No drafts pending review.
        </div>
      )}

      {drafts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {drafts.map((draft) => (
            <div
              key={draft.slug}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {draft.title}
                  </span>
                  {draft.token_symbol && (
                    <span style={{ fontSize: "11px", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                      ${draft.token_symbol}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {draft.category}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: CONFIDENCE_COLORS[draft.ai_confidence] ?? "var(--text-muted)",
                    }}
                  >
                    {draft.ai_confidence}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {new Date(draft.occurred_at).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    detected {timeAgo(draft.created_at)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <Link
                  href={`/event/${draft.slug}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontWeight: 500,
                    textDecoration: "none",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Preview
                </Link>
                <button
                  onClick={() => publishMutation.mutate(draft.slug)}
                  disabled={publishMutation.isPending}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity: publishMutation.isPending ? 0.6 : 1,
                  }}
                >
                  Publish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
