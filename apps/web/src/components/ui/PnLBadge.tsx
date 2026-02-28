/**
 * PnL (Profit & Loss) badge.
 * Always shows sign. Green for profit, red for loss.
 */

interface PnLBadgeProps {
  value: number;
  /** "usd" | "sol" | "pct" (default "usd") */
  mode?: "usd" | "sol" | "pct";
  size?: number;
}

export function PnLBadge({ value, mode = "usd", size = 13 }: PnLBadgeProps) {
  const isPositive = value >= 0;
  const color = isPositive ? "#22c55e" : "var(--accent)";
  const sign = isPositive ? "+" : "";

  let formatted: string;
  if (mode === "usd") {
    formatted = `${sign}$${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else if (mode === "sol") {
    formatted = `${sign}${Math.abs(value).toFixed(4)} SOL`;
  } else {
    formatted = `${sign}${Math.abs(value).toFixed(2)}%`;
  }

  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        fontSize: size,
        fontWeight: 500,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {formatted}
    </span>
  );
}
