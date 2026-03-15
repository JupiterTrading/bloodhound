"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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

const TX_TYPES = ["", "SWAP", "TRANSFER", "NFT_SALE", "MINT", "BURN", "STAKE"];

const DIRECTION_COLORS = {
  in: "#22c55e",
  out: "var(--accent)",
  self: "var(--text-muted)",
};

interface Props {
  address: string;
}

export function TransactionHistory({ address }: Props) {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [dirFilter, setDirFilter] = useState<"in" | "out" | "both" | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 25;

  const params = {
    page,
    limit,
    ...(typeFilter ? { tx_type: typeFilter } : {}),
    ...(dirFilter ? { direction: dirFilter as "in" | "out" | "both" } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wallet", "transactions", address, page, typeFilter, dirFilter, dateFrom, dateTo],
    queryFn: () => walletApi.transactions(address, params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const txs = data?.transactions ?? [];
  const hasMore = data?.has_more ?? false;
  const hasFilters = typeFilter !== "" || dirFilter !== "" || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setTypeFilter("");
    setDirFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] gap-3 flex-wrap">
        <h2 className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)] shrink-0">
          Transaction History
        </h2>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className={`input py-1 px-2 text-[12px] ${typeFilter ? 'border-[var(--accent)] text-[var(--text-primary)]' : ''}`}
          >
            <option value="">All types</option>
            {TX_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{TX_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>

          <select
            value={dirFilter}
            onChange={(e) => { setDirFilter(e.target.value as typeof dirFilter); setPage(1); }}
            className={`input py-1 px-2 text-[12px] ${dirFilter ? 'border-[var(--accent)] text-[var(--text-primary)]' : ''}`}
          >
            <option value="">All directions</option>
            <option value="in">Incoming</option>
            <option value="out">Outgoing</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            title="From date"
            className={`input py-1 px-2 text-[12px] [color-scheme:dark] ${dateFrom ? 'border-[var(--accent)] text-[var(--text-primary)]' : ''}`}
          />
          <span className="text-[11px] text-[var(--text-muted)]">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            title="To date"
            className={`input py-1 px-2 text-[12px] [color-scheme:dark] ${dateTo ? 'border-[var(--accent)] text-[var(--text-primary)]' : ''}`}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="bg-transparent border border-[var(--border)] rounded py-1 px-2 text-[12px] text-[var(--text-muted)] cursor-pointer hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear ×
            </button>
          )}

          {isFetching && (
            <span className="text-[11px] text-[var(--text-muted)]">Loading...</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-[11px] tracking-wide uppercase">
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
                    className="px-5 py-10 text-center text-[var(--text-muted)] text-[13px]"
                  >
                    {hasFilters
                      ? "No transactions match the current filters."
                      : "This address has no recorded on-chain activity."}
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
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] text-[12px] text-[var(--text-muted)]">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <PaginationBtn
              label="← Prev"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <PaginationBtn
              label="Next →"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
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
      className="px-3 py-2.5 pl-4 font-semibold whitespace-nowrap"
      style={{ textAlign: align }}
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
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Link
            href={`/tx/${tx.tx_signature}`}
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textDecoration: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            detail
          </Link>
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
        </div>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      {[120, 28, 60, 50, 80, 28, 100, 60, 20].map((w, i) => (
        <td key={i} className="px-4 py-3">
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
      className={`bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2.5 py-1 text-[12px] ${disabled ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50' : 'text-[var(--text-primary)] cursor-pointer'}`}
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
