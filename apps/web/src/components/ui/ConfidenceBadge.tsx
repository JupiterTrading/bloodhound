/**
 * AI confidence level badge.
 * Used in Bloodhound AI responses, intelligence summaries, and side wallet panels.
 */

export type Confidence = "CONFIRMED" | "PROBABLE" | "SUSPECTED" | "UNKNOWN";

const CONFIG: Record<
  Confidence,
  { dot: string; color: string; label: string; symbol: string }
> = {
  CONFIRMED: {
    dot: "#1a7a1a",
    color: "#1a7a1a",
    label: "CONFIRMED",
    symbol: "●",
  },
  PROBABLE: {
    dot: "#b36a00",
    color: "#b36a00",
    label: "PROBABLE",
    symbol: "◐",
  },
  SUSPECTED: {
    dot: "#c45200",
    color: "#c45200",
    label: "SUSPECTED",
    symbol: "○",
  },
  UNKNOWN: {
    dot: "var(--text-muted)",
    color: "var(--text-muted)",
    label: "UNKNOWN",
    symbol: "✗",
  },
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

  if (dotOnly) {
    return (
      <span
        title={cfg.label}
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        color: cfg.color,
      }}
    >
      <span style={{ fontSize: "10px" }}>{cfg.symbol}</span>
      {showLabel && cfg.label}
    </span>
  );
}
