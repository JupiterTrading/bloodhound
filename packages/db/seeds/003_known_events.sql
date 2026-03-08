-- ============================================================
-- BLOODHOUND — Known Events Seed Data
-- Run in Supabase SQL Editor after 004_known_events.sql
-- ============================================================

-- Clear and re-seed (idempotent via ON CONFLICT slug)
INSERT INTO known_events (slug, title, category, description, occurred_at, token_mint, token_symbol, significance, chain, is_published)
VALUES

-- $TRUMP Coin Launch
(
  'trump-coin-launch',
  '$TRUMP Meme Coin Launch',
  'token_launch',
  'On January 17, 2025 — days before Donald Trump''s presidential inauguration — an official $TRUMP meme coin was launched on Solana. The token launched with insider wallets holding large allocations, with early buyers including several wallets now linked to political insiders. The launch triggered enormous retail buying followed by sharp sell-offs as early holders rotated. The event highlighted risks around politically-themed meme coins and the use of coordinated launch wallets.',
  '2025-01-17 20:00:00+00',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
  'TRUMP',
  'historic',
  'solana',
  true
),

-- $MELANIA Coin
(
  'melania-coin-launch',
  '$MELANIA Meme Coin Launch',
  'token_launch',
  'Shortly after the $TRUMP coin launch, the $MELANIA meme coin was launched on Solana on January 19, 2025. The token drew immediate attention and liquidity away from $TRUMP, causing $TRUMP to drop significantly. Early buyers of $MELANIA included several wallets that had profited from the $TRUMP launch, suggesting coordinated activity across both launches.',
  '2025-01-19 18:00:00+00',
  'FUCkwBvm8XndRHN2RGF9AHRX2fNSJGVmXKBLmgjggq6N',
  'MELANIA',
  'historic',
  'solana',
  true
),

-- $BONK Launch
(
  'bonk-launch',
  '$BONK Launch — Solana Community Coin',
  'token_launch',
  '$BONK launched on Christmas Day 2022 as a community-led memecoin airdrop to Solana NFT holders, developers, and protocol users. Unlike most memecoins, BONK had no VC allocation and distributed tokens directly to the Solana ecosystem. The launch helped revive Solana''s NFT and DeFi activity in the aftermath of the FTX collapse. Early distribution wallets and claim patterns are documented in this event.',
  '2022-12-25 00:00:00+00',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'BONK',
  'historic',
  'solana',
  true
),

-- FTX Collapse
(
  'ftx-collapse',
  'FTX Exchange Collapse',
  'collapse',
  'In November 2022, FTX — the world''s second-largest crypto exchange — collapsed after a CoinDesk article revealed that Alameda Research held massive FTX (FTT) token positions. A bank run followed, Binance''s Changpeng Zhao announced he would sell his FTT holdings, and within days FTX halted withdrawals. Sam Bankman-Fried was arrested in December 2022. Billions in customer funds were lost. On-chain, large SOL unlocks from FTX/Alameda wallets hit the market and SOL dropped from ~$33 to under $10.',
  '2022-11-08 00:00:00+00',
  NULL,
  NULL,
  'historic',
  'solana',
  true
),

-- Pump.fun Launch
(
  'pumpfun-launch',
  'Pump.fun Launches on Solana',
  'token_launch',
  'Pump.fun launched in early 2024 as a permissionless meme coin factory on Solana. It introduced a bonding curve mechanism that made launching tokens trivially easy and removed the need for initial liquidity. Within months it became the largest on-chain revenue generator on any blockchain, processing thousands of token launches per day. The platform was controversial — enabling rapid rug pulls and coordinated insider buying — but also democratized token creation.',
  '2024-01-12 00:00:00+00',
  NULL,
  NULL,
  'historic',
  'solana',
  true
),

-- $WIF Launch
(
  'wif-dogwifhat-launch',
  '$WIF (dogwifhat) Launch',
  'token_launch',
  'dogwifhat ($WIF) launched in November 2023 as a Solana-native memecoin featuring a Shiba Inu wearing a hat. It became one of the largest memecoins by market cap, eventually reaching over $4B. Early buyers who held from launch saw extraordinary returns. The project was community-led with no team allocation, and the token''s rise marked a turning point for Solana''s memecoin ecosystem.',
  '2023-11-20 00:00:00+00',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'WIF',
  'historic',
  'solana',
  true
),

-- Solana Saga Phone Airdrop
(
  'saga-bonk-airdrop',
  'Solana Saga Phone BONK Airdrop',
  'airdrop',
  'In late 2023, Solana Saga phone holders received a large BONK airdrop that made the $599 phone worth far more than its retail price in token value alone. This triggered a rush to buy second-hand Saga phones to claim the airdrop, and subsequently drove demand for a second Saga device. The event highlighted how token airdrops could create unexpected economic incentives in the Solana ecosystem.',
  '2023-12-15 00:00:00+00',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'BONK',
  'notable',
  'solana',
  true
),

-- $JUP Airdrop
(
  'jupiter-jup-airdrop',
  'Jupiter $JUP Token Airdrop',
  'airdrop',
  'Jupiter Exchange — the largest DEX aggregator on Solana — launched its $JUP token in January 2024 with a massive airdrop to active protocol users. 40% of the total supply was allocated to the community across multiple rounds. The launch was one of the largest and most anticipated token events on Solana, with the airdrop claiming period generating enormous on-chain activity. Wallets that traded heavily on Jupiter prior to the snapshot date received the largest allocations.',
  '2024-01-31 00:00:00+00',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'JUP',
  'historic',
  'solana',
  true
),

-- $DJT (Martin Shkrelli)
(
  'djt-shkrelli',
  '$DJT Token — Martin Shkrelli Launch',
  'scandal',
  'In August 2024, Martin Shkrelli launched the $DJT token on Solana, claiming it was related to Donald Trump but later clarifying it was named after himself (Donald James Trump... or Martin Shkrelli). The launch was surrounded by controversy: wallets connected to Shkrelli appeared to have pre-bought before the public announcement, and the token experienced extreme volatility. The launch became a case study in meme coin manipulation and celebrity token launches.',
  '2024-08-02 00:00:00+00',
  NULL,
  'DJT',
  'notable',
  'solana',
  true
),

-- Jito Airdrop
(
  'jito-jto-airdrop',
  'Jito $JTO Token Airdrop',
  'airdrop',
  'Jito Labs — the leading Solana MEV infrastructure provider and liquid staking protocol — launched its $JTO governance token in December 2023 with a large airdrop to stakers and protocol users. The airdrop rewarded users who had staked SOL via Jito''s liquid staking token (JitoSOL). The launch highlighted the value accrual potential of Solana''s MEV ecosystem and MEV-aware staking products.',
  '2023-12-07 00:00:00+00',
  'jtojtomepa8berqQfDqoh5Q1zZpHpgpnuQnVNNTe5R',
  'JTO',
  'notable',
  'solana',
  true
)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  occurred_at = EXCLUDED.occurred_at,
  token_mint = EXCLUDED.token_mint,
  token_symbol = EXCLUDED.token_symbol,
  significance = EXCLUDED.significance,
  is_published = EXCLUDED.is_published;
