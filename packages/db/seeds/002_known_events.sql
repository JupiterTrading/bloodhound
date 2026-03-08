-- ============================================================
-- BLOODHOUND — Known Events Seed Data (US-B604)
-- Initial set of historically significant Solana on-chain events.
-- Run after 004_known_events.sql schema migration.
--
-- IMPORTANT: Wallet addresses marked [VERIFY] need on-chain verification
-- before going to production. Use Solscan/SolanaFM to confirm.
-- ============================================================

INSERT INTO known_events (slug, title, category, significance, occurred_at, token_symbol, token_mint, description) VALUES

(
  'trump-coin-launch',
  '$TRUMP Meme Coin Launch',
  'token_launch',
  'historic',
  '2025-01-18 05:00:00+00',
  'TRUMP',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
  'President-elect Donald Trump announced the $TRUMP meme coin via social media on January 17-18, 2025, just days before his inauguration. The token launched on Solana and reached a market cap of over $10 billion within 24 hours, becoming one of the largest meme coin launches in crypto history. Insiders and early wallets accumulated significant positions before the announcement, and on-chain analysis revealed bundled buys and coordinated insider activity.'
),

(
  'melania-coin-launch',
  '$MELANIA Coin Launch',
  'token_launch',
  'notable',
  '2025-01-19 20:00:00+00',
  'MELANIA',
  'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P',
  'Melania Trump launched her own meme coin $MELANIA just two days after $TRUMP, on the eve of the inauguration. The launch caused $TRUMP to drop ~50% as liquidity rotated. Both tokens were widely criticized as coordinated retail extraction mechanisms.'
),

(
  'libra-scandal',
  'Libra / Viva La Libertad Rug',
  'rug_pull',
  'historic',
  '2025-02-14 22:00:00+00',
  'LIBRA',
  null,
  'Argentine President Javier Milei tweeted on February 14, 2025 promoting the $LIBRA token, which he claimed would fund Argentine entrepreneurs. Within hours, insiders and the development team drained approximately $87M in liquidity, crashing the token price by over 90%. On-chain analysis by Bubblemaps and Zach XBT identified the insider wallet network that pre-loaded positions before Milei''s tweet. This event prompted calls for presidential accountability and sparked regulatory debate across Latin America.'
),

(
  'djt-shkrelli',
  '$DJT Token — Martin Shkrelli',
  'manipulation',
  'notable',
  '2025-01-15 18:00:00+00',
  'DJT',
  null,
  'Martin Shkrelli promoted the $DJT meme coin on social media, claiming ties to Donald Trump Jr. On-chain analysis revealed that Shkrelli-linked wallets held a significant portion of the supply before promotion began. The token experienced classic pump-and-dump dynamics. Multiple KOLs promoted the token shortly before or after large insider sells.'
),

(
  'bonk-christmas-airdrop',
  '$BONK Christmas Airdrop',
  'airdrop',
  'historic',
  '2022-12-25 00:00:00+00',
  'BONK',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  '$BONK was airdropped to Solana NFT holders, developers, and community members on Christmas Day 2022, during the depths of the post-FTX Solana bear market. 50% of the total supply was distributed in the airdrop. The token became the first major Solana dog meme coin and helped revive sentiment on the network. Early recipients who held received significant gains as BONK reached multi-billion dollar market cap in 2023-2024.'
),

(
  'ftx-collapse',
  'FTX Collapse & Alameda Unwind',
  'collapse',
  'historic',
  '2022-11-08 00:00:00+00',
  null,
  null,
  'FTX, once the second-largest cryptocurrency exchange, collapsed in November 2022 after CoinDesk published details of Alameda Research''s balance sheet, revealing that FTX customer funds had been used to prop up Alameda positions. CEO Sam Bankman-Fried resigned and FTX filed for bankruptcy on November 11. The on-chain activity in the days surrounding the collapse showed massive outflows, emergency transfers, and the infamous "hack" of $600M+ from FTX wallets post-bankruptcy. The collapse devastated Solana, which had been heavily backed by FTX/Alameda.'
),

(
  'solana-saga-bonk-airdrop',
  'Solana Saga Phone $BONK Airdrop',
  'airdrop',
  'notable',
  '2023-12-01 00:00:00+00',
  'BONK',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'Solana Saga phone owners received a $BONK airdrop worth ~$600+ per device (at peak), far exceeding the phone''s resale value. This caused a rush to buy Saga phones to claim the airdrop, creating a secondary market and selling out existing inventory. The event demonstrated the power of NFT/hardware-gated airdrops and drove significant attention to the Solana ecosystem.'
),

(
  'pump-fun-launch',
  'pump.fun Goes Live',
  'token_launch',
  'historic',
  '2024-01-12 00:00:00+00',
  null,
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  'pump.fun, a Solana-native token launchpad using a bonding curve mechanism, launched in early 2024. It eliminated traditional liquidity pool requirements, allowing anyone to create and trade a token instantly. By mid-2024, pump.fun was generating more daily revenue than Ethereum, processing millions of token launches. The platform fundamentally changed Solana''s meme coin landscape and became one of the highest-revenue protocols in crypto history.'
)

ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Event Wallets — key wallets for each event
-- Replace [VERIFY addresses] with on-chain verified addresses
-- ============================================================

-- TRUMP coin: early insider wallets (add verified addresses here)
-- INSERT INTO event_wallets (event_id, address, role, description, amount_usd)
-- SELECT id, '[VERIFY: trump deployer wallet]', 'deployer', 'Token deployer', null
-- FROM known_events WHERE slug = 'trump-coin-launch';

-- FTX: known wallets
INSERT INTO event_wallets (event_id, address, role, description)
SELECT
  id,
  '5tzFkiKscXHK5ZXCGbGuFQVMQqE3yKmBVCuABMsWBv9N',  -- FTX exchange hot wallet (public knowledge)
  'victim',
  'FTX primary exchange wallet — site of major on-chain activity during collapse'
FROM known_events WHERE slug = 'ftx-collapse'
ON CONFLICT DO NOTHING;

-- BONK: deployer
INSERT INTO event_wallets (event_id, address, role, description)
SELECT
  id,
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'deployer',
  '$BONK token mint address / program authority'
FROM known_events WHERE slug = 'bonk-christmas-airdrop'
ON CONFLICT DO NOTHING;
