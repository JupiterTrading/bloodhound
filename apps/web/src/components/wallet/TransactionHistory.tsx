"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { walletApi, type Transaction } from "@/lib/api";
import { AddressTag } from "@/components/ui/AddressTag";
import { TxSourceLogo } from "@/components/ui/TxSourceLogo";
import { PnLBadge } from "@/components/ui/PnLBadge";
import { Skeleton } from "@/components/ui/Skeleton";

const TX_TYPE_LABELS: Record<string, string> = {
  SWAP: "Swap",
  TRANSFER: "Transfer",
  NFT_SALE: "NFT Sale",
  MINT: "Mint",
  BURN: "Burn",
  STAKE: "Stake",
  OTHER: "Other",
};

const DIRECTION_COLORS = {
  in: "#22c55e",
  out: "var(--accent)",
  self: "var(--text-muted)",
};

interface Props {
  address: string;
}

export function TransactionHistory({ address }: Props) {
  const [page, setPage] = useState(0);
  const limit = 25;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wallet", "transactions", address, page],
    queryFn: () =>
      walletApi.transactions(address, { page, limit }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const txs = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Transaction History
          {total > 0 && (
            <span style={{ marginLeft: "8px", fontWeight: 400 }}>
              ({total.toLocaleString()})
            </span>
          )}
        </h2>
        {isFetching && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Loading...
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--text-muted)",
                fontSize: "11px",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <Th>Time</Th>
              <Th>Source</Th>
              <Th>Type</Th>
              <Th>Token</Th>
              <Th align="right">Amount</Th>
              <Th align="center">Dir</Th>
              <Th>Counterparty</Th>
              <Th align="right">PnL</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              : txs.length === 0
              ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    This address has no recorded on-chain activity.
                  </td>
                </tr>
              )
              : txs.map((tx) => (
                  <TxRow key={tx.tx_signature} tx={tx} walletAddress={address} />
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <PaginationBtn
              label="← Prev"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            />
            <PaginationBtn
              label="Next →"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "10px 12px 10px 16px",
        textAlign: align,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function TxRow({
  tx,
  walletAddress,
}: {
  tx: Transaction;
  walletAddress: string;
}) {
  const [hovered, setHovered] = useState(false);

  const time = formatTime(tx.block_time);
  const dirColor = DIRECTION_COLORS[tx.direction] ?? "var(--text-muted)";
  const dirArrow = tx.direction === "in" ? "↓" : tx.direction === "out" ? "↑" : "↔";
  const typeLabel = TX_TYPE_LABELS[tx.tx_type] ?? tx.tx_type;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: "1px solid var(--border)",
        background: hovered ? "var(--bg-elevated)" : "transparent",
        transition: "background 80ms",
      }}
    >
      {/* Time */}
      <td style={{ padding: "10px 12px 10px 16px", whiteSpace: "nowrap" }}>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          {time}
        </span>
      </td>

      {/* Source platform */}
      <td style={{ padding: "10px 12px" }}>
        <TxSourceLogo platform={tx.source_platform} size={18} />
      </td>

      {/* Type */}
      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {typeLabel}
      </td>

      {/* Token */}
      <td style={{ padding: "10px 12px" }}>
        {tx.token_symbol ? (
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              color: "var(--text-primary)",
            }}
          >
            {tx.token_symbol}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* Amount */}
      <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
        {tx.amount != null ? (
          <div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                color: "var(--text-primary)",
              }}
            >
              {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
            {tx.amount_usd != null && (
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                ${tx.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}
          </div>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* Direction */}
      <td style={{ padding: "10px 12px", textAlign: "center" }}>
        <span style={{ color: dirColor, fontWeight: 600, fontSize: "14px" }}>
          {dirArrow}
        </span>
      </td>

      {/* Counterparty */}
      <td style={{ padding: "10px 12px" }}>
        {tx.counterparty ? (
          tx.counterparty_label ? (
            <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
              {tx.counterparty_label}
            </span>
          ) : (
            <AddressTag address={tx.counterparty} size={12} />
          )
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* PnL */}
      <td style={{ padding: "10px 12px", textAlign: "right" }}>
        {tx.realized_pnl_usd != null ? (
          <PnLBadge value={tx.realized_pnl_usd} size={12} />
        ) : (
          <span style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </td>

      {/* Tx link */}
      <td style={{ padding: "10px 16px 10px 8px" }}>
        <a
          href={`https://solscan.io/tx/${tx.tx_signature}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textDecoration: "none",
            fontFamily: "JetBrains Mono, monospace",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          ↗
        </a>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      {[120, 28, 60, 50, 80, 28, 100, 60, 20].map((w, i) => (
        <td key={i} style={{ padding: "12px 16px" }}>
          <Skeleton width={w} height={12} />
        </td>
      ))}
    </tr>
  );
}

function PaginationBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "4px 10px",
        fontSize: "12px",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
