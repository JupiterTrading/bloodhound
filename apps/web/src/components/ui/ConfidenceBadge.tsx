/**
 * AI confidence level badge.
 * Used in Bloodhound AI responses, intelligence summaries, and side wallet panels.
 *
 * Colors are shared constants — keep in sync with CONFIDENCE_COLORS in signals/page.tsx.
 */

export type Confidence = "CONFIRMED" | "PROBABLE" | "SUSPECTED" | "UNKNOWN";

export const CONFIDENCE_COLORS: Record<Confidence, string> = {
  CONFIRMED: "#22c55e",
  PROBABLE: "#f59e0b",
  SUSPECTED: "#b45309",
  UNKNOWN: "var(--text-muted)",
};

const CONFIG: Record<
  Confidence,
  { label: string; symbol: string }
> = {
  CONFIRMED: { label: "CONFIRMED", symbol: "●" },
  PROBABLE:  { label: "PROBABLE",  symbol: "◐" },
  SUSPECTED: { label: "SUSPECTED", symbol: "○" },
  UNKNOWN:   { label: "UNKNOWN",   symbol: "✗" },
};

interface ConfidenceBadgeProps {
  confidence: Confidence;
  /** Show the label text next to the dot (default true) */
  showLabel?: boolean;
  /** Compact dot-only mode */
  dotOnly?: boolean;
}

export function ConfidenceBadge({
  confidence,
  showLabel = true,
  dotOnly = false,
}: ConfidenceBadgeProps) {
  const cfg = CONFIG[confidence];
  const color = CONFIDENCE_COLORS[confidence];

  if (dotOnly) {
    return (
      <span
        title={cfg.label}
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide"
      style={{ color }}
    >
      <span className="text-[10px]">{cfg.symbol}</span>
      {showLabel && cfg.label}
    </span>
  );
}
