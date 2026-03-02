-- ============================================================
-- BLOODHOUND — Known Wallets Seed Data
-- Run in Supabase SQL editor: https://supabase.com/dashboard
-- All entries are publicly confirmed on-chain entities.
--
-- PREREQUISITE: Run 003_known_wallets_source.sql first to add
-- the `source` column before running this file.
-- ============================================================

INSERT INTO known_wallets (address, label, category, description, twitter_handle, confidence, status, source)
VALUES

-- ── Protocol Programs ────────────────────────────────────────
(
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'Jupiter Aggregator v6',
  'protocol_team',
  'Jupiter DEX aggregator program v6. Routes swaps across Raydium, Orca, Meteora and other Solana DEXes.',
  'JupiterExchange',
  1.0,
  'approved',
  'manual_verified'
),
(
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'Raydium AMM v4',
  'protocol_team',
  'Raydium automated market maker program v4. Core liquidity pool program for the Raydium DEX.',
  'RaydiumProtocol',
  1.0,
  'approved',
  'manual_verified'
),
(
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  'Orca Whirlpool',
  'protocol_team',
  'Orca concentrated liquidity AMM (Whirlpool) program. Powers Orca DEX trading and LP positions.',
  'orca_so',
  1.0,
  'approved',
  'manual_verified'
),
(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  'Pump.fun',
  'protocol_team',
  'Pump.fun token launch platform. Every token minted or traded on pump.fun routes through this program.',
  'pumpdotfun',
  1.0,
  'approved',
  'manual_verified'
),
(
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
  'Magic Eden v2',
  'protocol_team',
  'Magic Eden NFT marketplace program v2. Primary NFT trading venue on Solana.',
  'MagicEden',
  1.0,
  'approved',
  'manual_verified'
),
(
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
  'Serum DEX v3',
  'protocol_team',
  'Project Serum decentralised exchange program v3. Central limit order book (CLOB) on Solana.',
  'ProjectSerum',
  1.0,
  'approved',
  'manual_verified'
),
(
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Meteora DLMM',
  'protocol_team',
  'Meteora Dynamic Liquidity Market Maker program. Used for concentrated LP positions and dynamic fee pools.',
  'MeteoraAG',
  1.0,
  'approved',
  'manual_verified'
),
(
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
  'Marinade Finance',
  'protocol_team',
  'Marinade liquid staking protocol. Issues mSOL in exchange for staked SOL.',
  'MarinadeFinance',
  1.0,
  'approved',
  'manual_verified'
),
(
  'So11111111111111111111111111111111111111112',
  'Wrapped SOL',
  'protocol_team',
  'Native SOL wrapped as an SPL token. Used in DeFi protocols that require an SPL-compatible SOL token.',
  NULL,
  1.0,
  'approved',
  'manual_verified'
),
(
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH',
  'Drift Protocol',
  'protocol_team',
  'Drift Protocol perpetuals and spot DEX program on Solana. Leading on-chain perp exchange.',
  'DriftProtocol',
  1.0,
  'approved',
  'manual_verified'
),
(
  'TSWAPaqyCSx2KABk68Shruf4rp7CxcAi9UTjtKujMUo',
  'Tensor NFT Marketplace',
  'protocol_team',
  'Tensor NFT marketplace and AMM program on Solana. High-volume Solana NFT trading platform.',
  'tensor_hq',
  1.0,
  'approved',
  'manual_verified'
),
(
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
  'Phoenix DEX',
  'protocol_team',
  'Phoenix central limit order book (CLOB) DEX program on Solana. Fully on-chain order book.',
  'ellipsis_labs',
  1.0,
  'approved',
  'manual_verified'
),

-- ── Exchanges ────────────────────────────────────────────────
(
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'Binance Hot Wallet',
  'exchange',
  'Binance exchange hot wallet on Solana. High-volume SOL and token movements for exchange operations.',
  'binance',
  0.75,
  'approved',
  'manual_verified'
),
(
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'Binance Deposit Wallet',
  'exchange',
  'Secondary Binance deposit collection wallet on Solana.',
  'binance',
  0.70,
  'approved',
  'manual_verified'
),
(
  '53unSgGWqEWANcPYRF35B2Bgf8BkszUtcccKiXwGGLyr',
  'Binance.US Hot Wallet',
  'exchange',
  'Binance.US (US-facing Binance entity) hot wallet on Solana. Community-labeled on Solscan.',
  'BinanceUS',
  0.65,
  'approved',
  'solscan_label'
),
(
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn39wD',
  'Coinbase Prime',
  'exchange',
  'Coinbase Prime institutional custody wallet on Solana. Used for large institutional SOL movements.',
  'coinbase',
  0.70,
  'approved',
  'manual_verified'
),
(
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  'Coinbase Hot Wallet 2',
  'exchange',
  'Secondary Coinbase hot wallet on Solana. Community-labeled on Solscan.',
  'coinbase',
  0.65,
  'approved',
  'solscan_label'
),
(
  '5tzFkiKscXHK5ZXCGbCAPgLAL5Lh3CzRUzUKcJnz2Kvh',
  'FTX Estate',
  'exchange',
  'Former FTX exchange wallet. Now under bankruptcy estate management. Historical reference only.',
  NULL,
  0.75,
  'approved',
  'manual_verified'
),
(
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BrmHMFGM8uQ2',
  'OKX Hot Wallet',
  'exchange',
  'OKX exchange hot wallet on Solana used for customer deposits and withdrawals.',
  'okx',
  0.70,
  'approved',
  'manual_verified'
),
(
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
  'Gate.io Hot Wallet',
  'exchange',
  'Gate.io exchange hot wallet on Solana. Community-labeled on Solscan.',
  'gate_io',
  0.65,
  'approved',
  'solscan_label'
)

ON CONFLICT (address) DO UPDATE SET
  label          = EXCLUDED.label,
  category       = EXCLUDED.category,
  description    = EXCLUDED.description,
  twitter_handle = EXCLUDED.twitter_handle,
  confidence     = EXCLUDED.confidence,
  status         = EXCLUDED.status,
  source         = EXCLUDED.source;
