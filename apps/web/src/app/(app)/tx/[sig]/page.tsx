"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { txApi, type TxDetail } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TxPage({
  params,
}: {
  params: Promise<{ sig: string }>;
}) {
  const { sig } = use(params);

  const { data: tx, isLoading, isError } = useQuery({
    queryKey: ["tx", sig],
    queryFn: () => txApi.get(sig),
    staleTime: 3_600_000, // immutable
    retry: 1,
  });

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            Transaction
          </h1>
          {!isLoading && tx && (
            <StatusBadge success={true} />
          )}
        </div>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            color: "var(--text-muted)",
            wordBreak: "break-all",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>{sig}</span>
          <button
            onClick={() => navigator.clipboard.writeText(sig)}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "2px 7px",
              fontSize: "11px",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            Copy
          </button>
          <a
            href={`https://solscan.io/tx/${sig}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              flexShrink: 0,
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "2px 7px",
            }}
          >
            Solscan ↗
          </a>
        </div>
      </div>

      {isLoading ? (
        <TxSkeleton />
      ) : isError || !tx ? (
        <TxNotFound sig={sig} />
      ) : (
        <TxBody tx={tx} />
      )}
    </div>
  );
}

function TxBody({ tx }: { tx: TxDetail }) {
  const timestamp = tx.timestamp
    ? new Date(tx.timestamp * 1000).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const feeSol = tx.fee ? (tx.fee / 1_000_000_000).toFixed(6) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Overview card */}
      <Card title="Overview">
        <Row label="Status" value={<StatusBadge success={true} />} />
        {timestamp && <Row label="Timestamp" value={timestamp} mono />}
        {tx.slot && <Row label="Slot" value={tx.slot.toLocaleString()} mono />}
        {feeSol && <Row label="Fee" value={`${feeSol} SOL`} mono />}
        {tx.type && tx.type !== "UNKNOWN" && <Row label="Type" value={tx.type} />}
        {tx.source && tx.source !== "UNKNOWN" && <Row label="Source" value={tx.source} />}
        {tx.feePayer && (
          <Row
            label="Fee Payer"
            value={
              <Link href={`/wallet/${tx.feePayer}`} style={{ textDecoration: "none" }}>
                <AddressTag address={tx.feePayer} chars={8} size={12} />
              </Link>
            }
          />
        )}
        {tx.description && (
          <Row label="Description" value={tx.description} />
        )}
      </Card>

      {/* Token transfers */}
      {tx.tokenTransfers && tx.tokenTransfers.length > 0 && (
        <Card title={`Token Transfers (${tx.tokenTransfers.length})`}>
          {tx.tokenTransfers.map((t, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr auto",
                alignItems: "center",
                gap: "12px",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "13px",
              }}
            >
              <Link href={`/wallet/${t.fromUserAccount}`} style={{ textDecoration: "none" }}>
                <AddressTag address={t.fromUserAccount} chars={6} size={12} />
              </Link>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>→</span>
              <Link href={`/wallet/${t.toUserAccount}`} style={{ textDecoration: "none" }}>
                <AddressTag address={t.toUserAccount} chars={6} size={12} />
              </Link>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  textAlign: "right",
                }}
              >
                {t.tokenAmount?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Native SOL transfers */}
      {tx.nativeTransfers && tx.nativeTransfers.length > 0 && (
        <Card title={`SOL Transfers (${tx.nativeTransfers.length})`}>
          {tx.nativeTransfers.map((t, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr auto",
                alignItems: "center",
                gap: "12px",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                fontSize: "13px",
              }}
            >
              <Link href={`/wallet/${t.fromUserAccount}`} style={{ textDecoration: "none" }}>
                <AddressTag address={t.fromUserAccount} chars={6} size={12} />
              </Link>
              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>→</span>
              <Link href={`/wallet/${t.toUserAccount}`} style={{ textDecoration: "none" }}>
                <AddressTag address={t.toUserAccount} chars={6} size={12} />
              </Link>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                  textAlign: "right",
                }}
              >
                {(t.amount / 1_000_000_000).toFixed(6)} SOL
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Account balance changes */}
      {tx.accountData && tx.accountData.filter((a) => a.nativeBalanceChange !== 0).length > 0 && (
        <Card title="Balance Changes">
          {tx.accountData
            .filter((a) => a.nativeBalanceChange !== 0)
            .map((a, i) => {
              const change = a.nativeBalanceChange / 1_000_000_000;
              const positive = change > 0;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <Link href={`/wallet/${a.account}`} style={{ textDecoration: "none" }}>
                    <AddressTag address={a.account} chars={8} size={12} />
                  </Link>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: positive ? "#22c55e" : "var(--accent)",
                    }}
                  >
                    {positive ? "+" : ""}
                    {change.toFixed(6)} SOL
                  </span>
                </div>
              );
            })}
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        alignItems: "center",
        fontSize: "13px",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{label}</span>
      <span
        style={{
          color: "var(--text-primary)",
          fontFamily: mono ? "JetBrains Mono, monospace" : "inherit",
          fontSize: mono ? "12px" : "13px",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ success }: { success: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 600,
        color: success ? "#22c55e" : "var(--accent)",
        background: success ? "rgba(34,197,94,0.1)" : "rgba(220,38,38,0.1)",
        border: `1px solid ${success ? "rgba(34,197,94,0.3)" : "rgba(220,38,38,0.3)"}`,
        borderRadius: "4px",
        padding: "2px 8px",
      }}
    >
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: success ? "#22c55e" : "var(--accent)",
        }}
      />
      {success ? "Success" : "Failed"}
    </span>
  );
}

function TxNotFound({ sig }: { sig: string }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "16px" }}>
        Transaction not found in index. View on an external explorer:
      </div>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
        <ExternalLink href={`https://solscan.io/tx/${sig}`} label="Solscan" />
        <ExternalLink href={`https://explorer.solana.com/tx/${sig}`} label="Solana Explorer" />
        <ExternalLink href={`https://xray.helius.xyz/tx/${sig}`} label="XRAY" />
      </div>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "8px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        fontSize: "13px",
        color: "var(--text-primary)",
        textDecoration: "none",
        fontWeight: 500,
      }}
    >
      {label} ↗
    </a>
  );
}

function TxSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Skeleton height={11} width={80} />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: "12px",
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <Skeleton height={12} width={80} />
            <Skeleton height={12} width={200} />
          </div>
        ))}
      </div>
    </div>
  );
}
