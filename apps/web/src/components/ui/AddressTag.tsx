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
      className="font-mono inline-flex items-center gap-1 cursor-pointer select-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      style={{ fontSize: size, color }}
    >
      {label && (
        <span className="text-[var(--text-muted)] mr-0.5">{label}</span>
      )}
      {truncated}
      {copied && (
        <span className="text-[10px] text-[var(--accent)] ml-1">✓</span>
      )}
    </span>
  );
}
