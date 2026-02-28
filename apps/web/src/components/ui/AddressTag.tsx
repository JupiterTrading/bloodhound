"use client";

import { useState } from "react";

interface AddressTagProps {
  address: string;
  /** Optionally show a label prefix before the truncated address */
  label?: string;
  /** Character count for each side of the truncation (default 4) */
  chars?: number;
  /** Show the full address tooltip (default true) */
  showTooltip?: boolean;
  /** Font size in px (default 13) */
  size?: number;
  /** Color override */
  color?: string;
}

export function AddressTag({
  address,
  label,
  chars = 4,
  showTooltip = true,
  size = 13,
  color,
}: AddressTagProps) {
  const [copied, setCopied] = useState(false);

  const truncated = address.length > chars * 2 + 3
    ? `${address.slice(0, chars)}...${address.slice(-chars)}`
    : address;

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <span
      title={showTooltip ? (copied ? "Copied!" : address) : undefined}
      onClick={handleCopy}
      style={{
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: size,
        color: color ?? "var(--text-secondary)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        userSelect: "none",
        transition: "color 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.color = color ?? "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.color = color ?? "var(--text-secondary)";
      }}
    >
      {label && (
        <span style={{ color: "var(--text-muted)", marginRight: "2px" }}>
          {label}
        </span>
      )}
      {truncated}
      {copied && (
        <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: "4px" }}>
          ✓
        </span>
      )}
    </span>
  );
}
