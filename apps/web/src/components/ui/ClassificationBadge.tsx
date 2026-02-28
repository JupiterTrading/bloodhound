/**
 * Wallet classification badge.
 * Dangerous types (INSIDER, BUNDLER, WASH_TRADER, BOT) get blood red accent.
 * Neutral types (DEPLOYER, LP_PROVIDER, EXCHANGE) get white outline.
 */

const DANGEROUS_TYPES = new Set([
  "insider",
  "bundler",
  "wash_trader",
  "bot",
]);

const LABEL_MAP: Record<string, string> = {
  whale_wallet: "WHALE",
  whale_holder: "WHALE HOLDER",
  smart_money: "SMART MONEY",
  sniper: "SNIPER",
  insider: "INSIDER",
  bundler: "BUNDLER",
  wash_trader: "WASH TRADER",
  bot: "BOT",
  deployer: "DEPLOYER",
  lp_provider: "LP PROVIDER",
  exchange: "EXCHANGE",
  protocol: "PROTOCOL",
  known_kol: "KOL",
  known_figure: "KNOWN",
};

interface ClassificationBadgeProps {
  label: string;
}

export function ClassificationBadge({ label }: ClassificationBadgeProps) {
  const normalized = label.toLowerCase().replace(/ /g, "_");
  const isDangerous = DANGEROUS_TYPES.has(normalized);
  const display = LABEL_MAP[normalized] ?? label.replace(/_/g, " ").toUpperCase();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        padding: "3px 8px",
        borderRadius: "4px",
        border: `1px solid ${isDangerous ? "var(--accent)" : "var(--border)"}`,
        color: isDangerous ? "var(--accent)" : "var(--text-secondary)",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {display}
    </span>
  );
}
