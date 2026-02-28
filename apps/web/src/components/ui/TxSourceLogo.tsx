/**
 * Transaction source platform logo badge.
 * Shows a colored icon + platform name tooltip.
 * Actual SVG logos should replace these placeholder glyphs over time.
 */

export type TxPlatform =
  | "axiom"
  | "phantom"
  | "jupiter"
  | "raydium"
  | "orca"
  | "pump_fun"
  | "coinbase"
  | "jito"
  | "meteora"
  | "unknown";

interface PlatformConfig {
  label: string;
  abbr: string;
  color: string;
  bg: string;
}

const PLATFORMS: Record<TxPlatform, PlatformConfig> = {
  axiom: { label: "Axiom", abbr: "AX", color: "#fff", bg: "#1a1a2e" },
  phantom: { label: "Phantom", abbr: "PH", color: "#fff", bg: "#4e44ce" },
  jupiter: { label: "Jupiter", abbr: "JU", color: "#000", bg: "#c7f284" },
  raydium: { label: "Raydium", abbr: "RY", color: "#fff", bg: "#1a56d6" },
  orca: { label: "Orca", abbr: "OR", color: "#fff", bg: "#0d9488" },
  pump_fun: { label: "Pump.fun", abbr: "PF", color: "#000", bg: "#a3e635" },
  coinbase: { label: "Coinbase", abbr: "CB", color: "#fff", bg: "#0052ff" },
  jito: { label: "Jito", abbr: "JT", color: "#fff", bg: "#c7451b" },
  meteora: { label: "Meteora", abbr: "MT", color: "#fff", bg: "#6d28d9" },
  unknown: { label: "Unknown", abbr: "?", color: "var(--text-muted)", bg: "var(--bg-elevated)" },
};

interface TxSourceLogoProps {
  platform: TxPlatform | string;
  /** Size in px (default 20) */
  size?: number;
  /** Show the platform name label next to icon (default false) */
  showLabel?: boolean;
}

export function TxSourceLogo({ platform, size = 20, showLabel = false }: TxSourceLogoProps) {
  const key = (platform as TxPlatform) in PLATFORMS ? (platform as TxPlatform) : "unknown";
  const cfg = PLATFORMS[key];

  return (
    <span
      title={cfg.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "4px",
          background: cfg.bg,
          color: cfg.color,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.4,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {cfg.abbr}
      </span>
      {showLabel && (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {cfg.label}
        </span>
      )}
    </span>
  );
}
