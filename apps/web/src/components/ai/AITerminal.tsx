"use client";

import { useState, useRef, useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { aiApi, trackedApi, type AIQueryResponse } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { ConfidenceBadge, type Confidence } from "@/components/ui/ConfidenceBadge";

interface SessionEntry {
  id: string;
  query: string;
  response: AIQueryResponse | null;
  error: string | null;
  loading: boolean;
}

const EXAMPLE_QUERIES = [
  "does GJRs6FyJPejgMkRdnmtJTGBJPNqvMNqShpbFPkdmBeR4 send to 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1?",
  "who funded GJRs6FyJPejgMkRdnmtJTGBJPNqvMNqShpbFPkdmBeR4?",
  "show me the largest transfers for 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "classify wallet 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  "track GJRs6FyJPejgMkRdnmtJTGBJPNqvMNqShpbFPkdmBeR4",
];

export function AITerminal() {
  const sessionId = useId();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { isSignedIn } = useUser();
  const { data: trackedData } = useQuery({
    queryKey: ["tracked"],
    queryFn: () => trackedApi.list(),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  });
  const trackedWallets = (trackedData?.tracked ?? []).map((w) => ({
    label: w.label,
    address: w.address,
  }));

  const mutation = useMutation({
    mutationFn: (q: string) =>
      aiApi.query(q, sessionId, { tracked_wallets: trackedWallets }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  function handleSubmit() {
    const q = query.trim();
    if (!q || mutation.isPending) return;

    const entryId = crypto.randomUUID();
    const entry: SessionEntry = {
      id: entryId,
      query: q,
      response: null,
      error: null,
      loading: true,
    };

    setHistory((prev) => [...prev, entry]);
    setQuery("");

    mutation.mutate(q, {
      onSuccess: (data) => {
        setHistory((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, response: data, loading: false } : e
          )
        );
      },
      onError: (err) => {
        setHistory((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, error: String(err), loading: false }
              : e
          )
        );
      },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "32px 32px 24px",
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 88px)", // full height minus nav + status bar
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: "8px",
          }}
        >
          Bloodhound AI
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          Ask anything about Solana wallets, transactions, and relationships.
          Every answer is backed by on-chain evidence.
        </p>
      </div>

      {/* Session history */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: "24px",
        }}
      >
        {history.length === 0 ? (
          <EmptyState onExample={(q) => setQuery(q)} />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {history.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <QueryInput
        value={query}
        onChange={setQuery}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        isLoading={mutation.isPending}
        inputRef={inputRef}
      />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onExample }: { onExample: (q: string) => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBlock: "60px",
        gap: "32px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "40px",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: "-0.04em",
            marginBottom: "8px",
          }}
        >
          bloodhound &gt;
        </div>
        <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Ask a question about any Solana wallet or transaction.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "480px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "4px",
          }}
        >
          Example queries
        </div>
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onExample(q)}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px 14px",
              textAlign: "left",
              fontSize: "13px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 80ms, color 80ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-secondary)";
            }}
          >
            <span style={{ color: "var(--accent)", marginRight: "6px" }}>›</span>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Session entry ─────────────────────────────────────────────────────────────

function HistoryEntry({ entry }: { entry: SessionEntry }) {
  return (
    <div>
      {/* User query line */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          marginBottom: "12px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "14px",
        }}
      >
        <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>
          bloodhound &gt;
        </span>
        <span style={{ color: "var(--text-primary)" }}>{entry.query}</span>
      </div>

      {/* Response */}
      {entry.loading ? (
        <ThinkingIndicator />
      ) : entry.error ? (
        <ErrorCard error={entry.error} />
      ) : entry.response ? (
        <ResponseCard response={entry.response} />
      ) : null}
    </div>
  );
}

// ── Thinking indicator ────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "16px 20px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        fontSize: "13px",
        color: "var(--text-muted)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          gap: "4px",
          alignItems: "center",
        }}
      >
        {[0, 0.2, 0.4].map((delay, i) => (
          <span
            key={i}
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "var(--accent)",
              animation: `pulse 1.2s ease-in-out ${delay}s infinite`,
              display: "inline-block",
            }}
          />
        ))}
      </span>
      Analyzing on-chain data...
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────

function ErrorCard({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: "8px",
        fontSize: "13px",
        color: "var(--text-secondary)",
      }}
    >
      Couldn't reach the indexer — the backend may be temporarily unavailable. Try again in a moment.
    </div>
  );
}

// ── Response card ─────────────────────────────────────────────────────────────

function ResponseCard({ response }: { response: AIQueryResponse }) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const evidenceSlice = showAllEvidence
    ? response.evidence
    : response.evidence.slice(0, 2);

  // Derive graph address from actions if available
  const graphAction = response.actions.find((a) => a.type === "open_graph");
  const graphAddress = graphAction?.parameters?.address as string | undefined;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        animation: "fadeSlideIn 150ms ease-out",
      }}
    >
      {/* Answer */}
      <div
        style={{
          padding: "20px",
          borderBottom:
            response.evidence.length > 0 || response.numbers.length > 0
              ? "1px solid var(--border)"
              : "none",
        }}
      >
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.65,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {response.answer}
        </p>

        {/* Key numbers */}
        {response.numbers.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            {response.numbers.map((n, i) => {
              const [key, val] = Object.entries(n)[0] ?? [];
              return (
                key && (
                  <div key={i}>
                    <div
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--text-muted)",
                        marginBottom: "2px",
                      }}
                    >
                      {key}
                    </div>
                    <div
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {val}
                    </div>
                  </div>
                )
              );
            })}
          </div>
        )}
      </div>

      {/* Evidence */}
      {response.evidence.length > 0 && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "10px",
            }}
          >
            Evidence
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {evidenceSlice.map((ev) => (
              <EvidenceRow key={ev.tx_signature} evidence={ev} />
            ))}
          </div>
          {response.evidence.length > 2 && (
            <button
              onClick={() => setShowAllEvidence((v) => !v)}
              style={{
                marginTop: "8px",
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: "12px",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              {showAllEvidence
                ? "Show less"
                : `Show all ${response.evidence.length} transactions`}
            </button>
          )}
        </div>
      )}

      {/* Footer: confidence + actions */}
      <div
        style={{
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <ConfidenceBadge confidence={response.confidence as Confidence} />

        {/* Agentic actions */}
        {response.actions.length > 0 && (
          <div style={{ display: "flex", gap: "8px" }}>
            {response.actions.map((action, i) => (
              <ActionChip key={i} action={action} />
            ))}
          </div>
        )}

        {/* Viz buttons */}
        {response.viz_type !== "none" && (
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            {response.viz_type === "graph" && (
              <VizButton label="Show Graph" targetHref={graphAddress ? `/graph/${graphAddress}` : null} />
            )}
            {response.viz_type === "table" && (
              <VizButton label="Show Table" targetHref={null} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceRow({
  evidence,
}: {
  evidence: { tx_signature: string; block_time: string; amount: number };
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "12px",
      }}
    >
      <span style={{ color: "var(--accent)", flexShrink: 0 }}>→</span>
      <AddressTag address={evidence.tx_signature} chars={6} size={12} />
      <span style={{ color: "var(--text-muted)" }}>
        {new Date(evidence.block_time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          color: "var(--text-primary)",
          fontWeight: 500,
        }}
      >
        {evidence.amount.toFixed(2)} SOL
      </span>
      <a
        href={`https://solscan.io/tx/${evidence.tx_signature}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textDecoration: "none",
          padding: "2px 8px",
          border: "1px solid var(--border)",
          borderRadius: "3px",
          fontFamily: "inherit",
          transition: "border-color 80ms, color 80ms",
          marginLeft: "auto",
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
            "var(--text-muted)";
        }}
      >
        view ↗
      </a>
    </div>
  );
}

function ActionChip({ action }: { action: { type: string; parameters: Record<string, unknown> } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const labels: Record<string, string> = {
    track_wallet: "Track wallet",
    set_alert: "Set alert",
    add_label: "Add label",
    open_graph: "Open graph",
  };

  async function handleClick() {
    if (done || busy) return;

    if (action.type === "open_graph") {
      const addr = action.parameters.address as string | undefined;
      if (addr) router.push(`/graph/${addr}`);
      return;
    }

    if (action.type === "track_wallet") {
      const addr = action.parameters.address as string | undefined;
      const label = (action.parameters.label as string | undefined) ?? addr?.slice(0, 8) ?? "wallet";
      if (!addr) return;
      setBusy(true);
      try {
        await trackedApi.add({ address: addr, label });
        qc.invalidateQueries({ queryKey: ["tracked"] });
        setDone(true);
      } catch {
        // silently fail — user may not be logged in
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action.type === "set_alert") {
      const addr = action.parameters.address as string | undefined;
      if (!addr) return;
      setBusy(true);
      try {
        // Ensure wallet is tracked first, then navigate to set up alert
        await trackedApi.add({
          address: addr,
          label: (action.parameters.label as string | undefined) ?? addr.slice(0, 8),
        });
        qc.invalidateQueries({ queryKey: ["tracked"] });
        setDone(true);
        // Brief delay so user sees ✓ Done before navigating
        setTimeout(() => router.push(`/tracked`), 800);
      } catch {
        // Wallet may already be tracked — still navigate
        setDone(true);
        setTimeout(() => router.push(`/tracked`), 800);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action.type === "add_label") {
      const addr = action.parameters.address as string | undefined;
      const label = action.parameters.label as string | undefined;
      if (!addr || !label) return;
      setBusy(true);
      try {
        await trackedApi.update(addr, { label });
        qc.invalidateQueries({ queryKey: ["tracked"] });
        setDone(true);
      } catch {
        // Wallet not tracked yet — add it
        try {
          await trackedApi.add({ address: addr, label });
          qc.invalidateQueries({ queryKey: ["tracked"] });
          setDone(true);
        } catch {
          // silently fail
        }
      } finally {
        setBusy(false);
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={done || busy}
      style={{
        background: done ? "var(--bg-surface)" : "var(--bg-elevated)",
        border: `1px solid ${done ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "4px",
        padding: "4px 10px",
        fontSize: "12px",
        color: done ? "var(--accent)" : "var(--text-secondary)",
        cursor: done || busy ? "default" : "pointer",
        fontFamily: "inherit",
        transition: "border-color 80ms, color 80ms",
        opacity: busy ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!done && !busy)
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!done)
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
      }}
    >
      {done ? "✓ Done" : busy ? "..." : (labels[action.type] ?? action.type)}
    </button>
  );
}

function VizButton({ label, targetHref }: { label: string; targetHref: string | null }) {
  const router = useRouter();

  function handleClick() {
    if (targetHref) {
      router.push(targetHref);
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "4px 10px",
        fontSize: "12px",
        color: "var(--text-secondary)",
        cursor: targetHref ? "pointer" : "default",
        fontFamily: "inherit",
        transition: "border-color 80ms, color 80ms",
      }}
      onMouseEnter={(e) => {
        if (targetHref) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
      }}
    >
      {label}
    </button>
  );
}

// ── Query input ───────────────────────────────────────────────────────────────

function QueryInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isLoading,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        transition: "border-color 80ms",
      }}
      onFocusCapture={(e) => {
        (
          e.currentTarget as HTMLDivElement
        ).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 0 0 2px var(--accent-glow)";
      }}
      onBlurCapture={(e) => {
        (
          e.currentTarget as HTMLDivElement
        ).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Prompt prefix + textarea */}
      <div style={{ display: "flex", alignItems: "flex-start", padding: "14px 16px" }}>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--accent)",
            marginRight: "10px",
            paddingTop: "1px",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          bloodhound &gt;
        </span>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about Solana wallets or transactions..."
          rows={1}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "14px",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            overflowY: "hidden",
          }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${t.scrollHeight}px`;
          }}
        />
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Press{" "}
          <kbd
            style={{
              padding: "1px 5px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "3px",
              fontSize: "10px",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            Enter
          </kbd>{" "}
          to run · Shift+Enter for new line
        </span>
        <button
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          style={{
            background: isLoading || !value.trim() ? "var(--bg-elevated)" : "var(--accent)",
            border: "none",
            borderRadius: "5px",
            padding: "6px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: isLoading || !value.trim() ? "var(--text-muted)" : "#fff",
            cursor: isLoading || !value.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "background 80ms, color 80ms",
          }}
          onMouseEnter={(e) => {
            if (!isLoading && value.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && value.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--accent)";
            }
          }}
        >
          {isLoading ? "Running..." : "Run Query"}
        </button>
      </div>
    </div>
  );
}
