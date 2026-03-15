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
      className={`badge uppercase ${isDangerous ? 'badge-accent' : 'badge-neutral'}`}
    >
      {display}
    </span>
  );
}
