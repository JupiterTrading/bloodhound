-- ============================================================
-- BLOODHOUND — Known Wallets Seed Data
-- Run in Supabase SQL editor: https://supabase.com/dashboard
-- All entries are publicly confirmed on-chain entities.
-- ============================================================

INSERT INTO known_wallets (address, label, category, description, twitter_handle, confidence, status)
VALUES

-- ── Protocol Programs ────────────────────────────────────────
(
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'Jupiter Aggregator v6',
  'protocol_team',
  'Jupiter DEX aggregator program v6. Routes swaps across Raydium, Orca, Meteora and other Solana DEXes.',
  'JupiterExchange',
  1.0,
  'approved'
),
(
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'Raydium AMM v4',
  'protocol_team',
  'Raydium automated market maker program v4. Core liquidity pool program for the Raydium DEX.',
  'RaydiumProtocol',
  1.0,
  'approved'
),
(
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  'Orca Whirlpool',
  'protocol_team',
  'Orca concentrated liquidity AMM (Whirlpool) program. Powers Orca DEX trading and LP positions.',
  'orca_so',
  1.0,
  'approved'
),
(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  'Pump.fun',
  'protocol_team',
  'Pump.fun token launch platform. Every token minted or traded on pump.fun routes through this program.',
  'pumpdotfun',
  1.0,
  'approved'
),
(
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
  'Magic Eden v2',
  'protocol_team',
  'Magic Eden NFT marketplace program v2. Primary NFT trading venue on Solana.',
  'MagicEden',
  1.0,
  'approved'
),
(
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  'Serum DEX v3',
  'protocol_team',
  'Project Serum decentralised exchange program v3. Central limit order book (CLOB) on Solana.',
  'ProjectSerum',
  1.0,
  'approved'
),
(
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Meteora DLMM',
  'protocol_team',
  'Meteora Dynamic Liquidity Market Maker program. Used for concentrated LP positions and dynamic fee pools.',
  'MeteoraAG',
  1.0,
  'approved'
),
(
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
  'Marinade Finance',
  'protocol_team',
  'Marinade liquid staking protocol. Issues mSOL in exchange for staked SOL.',
  'MarinadeFinance',
  1.0,
  'approved'
),
(
  'So11111111111111111111111111111111111111112',
  'Wrapped SOL',
  'protocol_team',
  'Native SOL wrapped as an SPL token. Used in DeFi protocols that require an SPL-compatible SOL token.',
  NULL,
  1.0,
  'approved'
),

-- ── Exchanges ────────────────────────────────────────────────
(
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'Binance Hot Wallet',
  'exchange',
  'Binance exchange hot wallet on Solana. High-volume SOL and token movements for exchange operations.',
  'binance',
  0.75,
  'approved'
),
(
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn39wD',
  'Coinbase Prime',
  'exchange',
  'Coinbase Prime institutional custody wallet on Solana. Used for large institutional SOL movements.',
  'coinbase',
  0.70,
  'approved'
),
(
  '5tzFkiKscXHK5ZXCGbCAPgLAL5Lh3CzRUzUKcJnz2Kvh',
  'FTX Estate',
  'exchange',
  'Former FTX exchange wallet. Now under bankruptcy estate management. Historical reference only.',
  NULL,
  0.75,
  'approved'
),
(
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BrmHMFGM8uQ2',
  'OKX Hot Wallet',
  'exchange',
  'OKX exchange hot wallet on Solana used for customer deposits and withdrawals.',
  'okx',
  0.70,
  'approved'
),
(
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'Binance Deposit Wallet',
  'exchange',
  'Secondary Binance deposit collection wallet on Solana.',
  'binance',
  0.70,
  'approved'
)

ON CONFLICT (address) DO UPDATE SET
  label       = EXCLUDED.label,
  category    = EXCLUDED.category,
  description = EXCLUDED.description,
  twitter_handle = EXCLUDED.twitter_handle,
  confidence  = EXCLUDED.confidence,
  status      = EXCLUDED.status;
