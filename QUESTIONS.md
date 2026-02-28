# BLOODHOUND — Pre-Build Questions
# For PLAN review before agents are briefed
# Answer everything here. Leave blank = decision deferred to agent defaults.

---

## SECTION A — Brand & Visual Identity (UI/UX Agent)

### A1. Color Palette
1. Pure black (#000000) background or near-black with slight warmth/coolness (e.g. #0a0a0a, #080810)?
2. Text: pure white (#ffffff) or slightly off-white (e.g. #e8e8e8, #f0f0f0)?
3. Is there ANY accent color allowed — for CTAs, active states, alert indicators, graph nodes? Or truly monochrome?
   - If yes: one accent only? Options: blood red, amber/gold, electric green, cold blue, violet
   - If no accent: how do we indicate active/selected states?
4. Error states, alert colors — red is standard but breaks monochrome. Confirm allowed?
5. "Scanlines / grid / noise texture" — subtle (5% opacity, barely visible) or pronounced (noticeable, part of the identity)?

### A2. Typography
6. Monospace font preference for addresses/data/code? (IBM Plex Mono, JetBrains Mono, Courier New, Space Mono, custom?)
7. UI sans-serif preference? (Geist, Inter, Neue Haas Grotesk, custom?)
8. Headline style — large, sparse, confident (like Nexus: "Dominating Digital Markets")? Or more technical/understated?
9. Font weight philosophy — heavy headlines with light body? All medium weight? Purely monospace throughout?

### A3. Logo & Identity
10. Is there a logo concept, sketch, or direction already? Or is it to be designed from scratch?
11. Wordmark only (BLOODHOUND in styled text), icon only, or both lockup?
12. If icon — any direction? Hound silhouette, crosshair, signal trace, eye, graph node? Abstract?
13. How does "BLOODHOUND" render — all caps always? Mixed case? Stylized characters?

### A4. Layout & Density
14. Primary use case device — desktop power tool first, or mobile-friendly from launch?
15. Dashboard density preference — Bloomberg-dense (max info visible) or more breathable/modern?
16. Is there a sidebar for tracked wallets or is everything top-nav accessible?
17. Should the app feel more like a terminal (single screen, no pages) or a traditional multi-page dashboard?

### A5. Hero / Landing Page
18. Is there a hero visual concept? Content.png (Nexus) uses a glitchy distorted human figure. Options:
    - Animated graph/node network
    - Glitch/distortion effect (similar to Nexus)
    - Pure text/typography play
    - Abstract data visualization
    - A real-time data feed visible in hero
19. Does the landing page have a waitlist / early access form, or goes straight to the app?
20. What's the hero headline? ("On-Chain Intelligence for Solana" level copy or do you have a line already?)

### A6. Motion & Animation
21. Should the site feel alive with constant subtle motion (like a live terminal — data streaming, nodes pulsing, scanlines running)? Or controlled/static with animations only on interaction?
22. Page transitions — instant or animated?
23. Graph animations when new transactions arrive — aggressive (highly visible) or subtle?

---

## SECTION B — AI Rules & Intelligence System (BUILD Agent)

### B1. Wallet Classification Rules
These are the rules the AI uses to label and understand wallet types.

24. What wallet types should BLOODHOUND classify? Proposed list — confirm, remove, or add:
    - Whale (large holder)
    - Smart Money (historically profitable, early entries)
    - Sniper (first buyers on launch)
    - Insider (funded pre-launch + early buy pattern)
    - Deployer (created contracts)
    - LP Provider (liquidity provision activity)
    - Bot (automated trading patterns)
    - Exchange (CEX deposit/withdrawal patterns)
    - Known KOL (from known wallets DB)
    - Bundler (part of launch bundles)
    - Wash Trader (suspected fake volume)

25. **Whale threshold** — what defines a whale?
    - By SOL balance? (e.g. >1000 SOL)
    - By portfolio USD value? (e.g. >$100k)
    - By transaction volume? (e.g. >X SOL moved in 30 days)
    - Should this be dynamic/relative to token context?

26. **Sniper definition** — how early is a sniper?
    - First N transactions after pool creation? (define N)
    - Within first X seconds/minutes of launch?
    - What's the minimum buy size to qualify?

27. **Smart Money definition** — what makes a wallet "smart money"?
    - Win rate threshold? (e.g. >60% of trades profitable)
    - Minimum trade count to qualify?
    - Time window for measuring performance? (30d, 90d, all time?)
    - Should it be token-specific smart money or general?

28. **Insider signals** — what on-chain patterns suggest insider status?
    - Funded by deployer wallet?
    - Bought within first N blocks of deployment?
    - In same bundle as deployer?
    - Holds tokens with no public announcement/prior history?
    - Combination required or any single signal flags as "potential insider"?

29. **Bot detection signals** — what patterns indicate bot behavior?
    - Transaction frequency (X txs per minute)?
    - Identical transaction timing patterns?
    - Same program interactions in rapid succession?
    - Zero failed transactions (too clean)?

### B2. Side Wallet Detection Rules
This is the system for identifying wallets that likely belong to the same entity.

30. **What is a "side wallet"?** Which of these signals should trigger a potential side wallet flag:
    - Direct SOL transfer from/to a known labeled wallet
    - Same funding source (funded by the same originator)
    - Co-sniped same token (bought same token in same block or within N blocks)
    - Appeared in same bundle transaction
    - Consistent interaction timing (consistently transact within N minutes of each other)
    - Shared token holdings (hold many of the same unusual tokens)
    - Cross-chain origination (same CEX withdrawal to multiple Solana wallets)

31. **Confidence scoring** — should side wallets show a confidence % or just be flagged?
    - Example: "87% likely side wallet of [label]" vs just "possible side wallet"
    - What evidence does the UI show to justify the flag?

32. **Display rules** — when should side wallets appear:
    - Automatically listed under a wallet's profile?
    - Only shown in graph view?
    - Behind a toggle ("Show potential side wallets")?
    - Only shown above a confidence threshold?

33. **User can dispute/confirm** — should users be able to:
    - Mark a flagged side wallet as "confirmed" or "incorrect"?
    - Does community confirmation affect the confidence score?

### B3. Relationship Classification Rules
How the AI describes and labels connections between wallets.

34. **Relationship types to support** — confirm/add to this list:
    - "Funded by" (direct SOL transfer into a new wallet)
    - "Frequently transfers to" (repeated outbound transfers)
    - "Co-sniper" (bought same launch)
    - "Cluster member" (statistically grouped)
    - "Same bundle" (appeared in same launch bundle)
    - "Deployer → Funded" (deployer funded this wallet)
    - "LP partner" (provided liquidity together)
    - "Exchange connection" (both connected to same CEX deposit address)

35. **Hop depth** — how many hops should the relationship graph traverse by default?
    - Default display: 1 hop (direct connections only)?
    - User can expand to 2, 3 hops?
    - Max ever shown: 3 hops? 5 hops?

36. **Minimum interaction threshold** — what's the minimum to show a connection?
    - At least N transactions between wallets?
    - Or any single direct transfer qualifies?
    - Does it change based on relationship type?

37. **Time decay** — should old connections be weighted less than recent ones?
    - "Active connection" (last 30 days) vs "historical connection"?
    - Should connections older than X months be grayed out or hidden?

### B4. Ask the Hive Rules
Governing what the AI says, how confident it is, and what it refuses.

38. **Confidence levels** — should the AI express confidence tiers?
    - "Confirmed" (direct on-chain proof)
    - "Probable" (strong multi-signal pattern)
    - "Suspected" (weak signal, inference only)
    - "Unknown" (insufficient data)

39. **What should Ask the Hive NEVER do?**
    - Identify real-world names/identities from wallet addresses?
    - Make accusations about illegal activity?
    - Answer questions about wallets with no on-chain history?
    - Speculate about future price movements?
    - Anything else?

40. **When data is absent** — if the AI can't find relevant data, should it:
    - Say "no data found" clearly
    - Attempt to infer and flag as inference
    - Ask the user to clarify

41. **Multi-turn memory** — within a session, should Ask the Hive:
    - Remember all labeled wallets you've defined in your tracked list
    - Remember prior questions in the session ("now check the same for punk")
    - Reference prior answers ("as I mentioned earlier, poop sent...")

42. **Response format** — does every Ask the Hive response include:
    - A short plain-English answer (1-3 sentences)
    - Key numbers (amounts, dates, transaction counts)
    - Clickable evidence (tx signatures, wallet links)
    - Confidence indicator
    - A "show graph" / "show table" option

### B5. Known Wallets Database Rules

43. **Who can submit** a wallet for review?
    - Any user (including anonymous)?
    - Registered users only?
    - Pro tier only?

44. **What submission includes:**
    - Solana wallet address (required)
    - Proposed label/name (required)
    - Category (KOL / Known Figure / Profitable Trader / Other)
    - Evidence: images/screenshots (file types: PNG, JPG, max file size?)
    - Evidence: text/links in comments field
    - Submitter identity shown or anonymous?

45. **Review workflow:**
    - Who reviews? Dev team only? Or trusted community reviewers?
    - Is there an internal admin panel for reviewing submissions?
    - What are the approval criteria? What gets rejected?
    - Can submissions be escalated for community discussion?

46. **Post-approval:**
    - Does the wallet appear in all users' searches automatically?
    - Can approved wallets be challenged/updated?
    - Version history of labels (wallet was "poop" then identified as "KOL X")?

47. **Known Wallets categories** — confirm or add:
    - KOL (Key Opinion Leader / influencer)
    - Known Figure (founders, VC wallets, public figures)
    - Profitable Trader (verified track record)
    - Protocol / Team (project treasuries, dev wallets)
    - Exchange (CEX hot/cold wallets)
    - Suspected Bad Actor (rug puller, scammer — requires higher evidence bar?)

48. **Public vs. private known wallets** — are all approved wallets visible to:
    - All users including anonymous?
    - Registered users only?
    - Pro users only?

---

## SECTION C — Feature & Product Scope (Both Agents)

### C1. Access & Auth

49. **Can anonymous users use the site?** What's accessible without an account:
    - Basic search (wallet lookup, tx history)?
    - Intelligence layer outputs?
    - Ask the Hive?
    - Tracked wallets (no — requires account)?
    - Graph view?

50. **Wallet-based auth (Web3 login)** — is "Sign in with Phantom/Backpack" offered as an alternative to email auth? Or email only?

51. **Free vs. Pro features** — define the line. Current proposal:
    - Free: basic search, wallet page, tx history, limited tracked wallets (10), basic graph
    - Pro: unlimited tracked wallets, full history depth, advanced alerts, API access, team workspaces
    - Is Ask the Hive free (limited queries/day) or Pro only?

### C2. Explorer Core

52. **What's searchable?** Confirm:
    - Wallet/account address
    - Transaction signature
    - Token mint address
    - Program/contract address
    - Block number
    - Token name/symbol (search "BONK" and get the token page)
    - User-defined label ("poop" searches your tracked wallets first, then public tags)

53. **Wallet page sections** — what panels appear on a wallet profile page:
    - Summary (balance, portfolio value, first/last active)
    - Token holdings
    - NFT holdings (show or hide by default?)
    - Transaction history
    - Top counterparties (who they interact with most)
    - Intelligence summary (AI-generated profile)
    - Known connections / potential side wallets
    - Tracked by X users (social proof)

54. **Transaction history filters** — what filters exist on the tx list:
    - Type (swap, transfer, mint, burn, stake, NFT sale)
    - Token
    - Amount range
    - Date range
    - Program
    - Direction (in / out / both)
    - Success/failed

55. **Token pages** — how deep does token data go:
    - Price chart (OHLCV) — yes
    - Holder list — yes
    - Top traders of this token — yes
    - Known wallets holding this token — yes
    - Recent large trades — yes
    - Launch info (deployer, date, initial supply) — yes
    - Security score (rug risk) — yes
    - Anything else?

### C3. Graph & Visualization

56. **Default graph view** — when a user opens the graph for a wallet, what do they see by default:
    - The wallet + all direct connections (1 hop)?
    - Only labeled/known connections?
    - Only connections above a transaction threshold?

57. **Graph node types / colors** — since the palette is black & white, how do we visually differentiate:
    - The selected/seed wallet
    - Known labeled wallets
    - Unknown wallets
    - Side wallet candidates
    - Exchange/protocol nodes

58. **Graph interactions:**
    - Click node → opens wallet profile in sidebar?
    - Click edge → shows the transactions between those two wallets?
    - Right-click node → context menu (label this wallet, track this wallet, expand connections)?
    - Drag to rearrange nodes?

59. **Timeline view** — what is this exactly:
    - A horizontal time axis showing when transactions happened between connected wallets?
    - A chronological feed of interactions?
    - Something else?

60. **Graph export** — what format(s): PNG image, JSON data, CSV of edges?

### C4. Tracked Wallets Dashboard

61. **Wallet groups/lists** — users can organize tracked wallets into named lists ("insiders", "my targets", etc.). Is there a limit on lists or wallets per list for free users?

62. **Watchlist feed** — when viewing the feed, what events appear:
    - Any transaction by any tracked wallet?
    - Only transactions above a value threshold?
    - Only interactions between tracked wallets?
    - Large swaps only?
    - Filtered by token?

63. **Alert conditions** — what alert rules can users create:
    - "Alert me when [wallet] makes any transaction"
    - "Alert me when [wallet A] sends to [wallet B]"
    - "Alert me when [wallet] buys/sells [token]"
    - "Alert me when [wallet] balance crosses [amount]"
    - "Alert me when any tracked wallet interacts with each other"
    - Custom threshold on any of the above?

64. **Alert delivery** — how do alerts reach users:
    - In-app notification (notification bell)
    - Email
    - Push notification (browser)
    - Telegram bot integration?
    - Webhook (Pro)?

### C5. Signals

65. **Signal types** — confirm/add to this list:
    - Abnormal inflow spike (wallet received unusually large funds)
    - New wallet cluster forming around a token
    - Deployer funding new wallets that buy early
    - Suspected wash trading pattern
    - Large liquidity removal
    - Known wallet waking up (dormant wallet suddenly active)
    - New insider wallet identified

66. **Signal scope** — are signals:
    - Global (any wallet on Solana triggers signals)?
    - Personalized (only wallets related to your tracked list)?
    - Token-specific (signals about tokens you follow)?
    - All three, filterable?

67. **Signal confidence** — same confidence tier system as AI queries, or different?

68. **Signals as a feed vs. alerts** — is the Signals page a public feed anyone can browse, or is it only relevant if you have tracked wallets?

### C6. Public API

69. **API v1 endpoints** — confirm this list from message.txt:
    - `GET /wallet/{address}/summary`
    - `GET /wallet/{address}/transfers`
    - `GET /wallet/{address}/relationships`
    - `GET /token/{mint}/holders`
    - `GET /tx/{signature}`
    - `GET /wallet/{address}/events` (tracked wallet events)
    - Anything to add or remove?

70. **API auth** — API key based? JWT? Both?

71. **Rate limits by tier** — define:
    - Free tier: X requests/day
    - Pro tier: X requests/day
    - Enterprise: custom

72. **Docs format** — OpenAPI/Swagger spec, or hand-written markdown docs?

---

## SECTION D — User Stories & QA Targets

### D1. Core User Personas
These define the QA test cases.

73. **Primary persona** — who is the #1 target user?
    - Retail trader tracking influencers and insiders
    - Researcher/analyst building intelligence reports
    - Protocol team tracking their own ecosystem
    - Developer building on top of the API
    - Security researcher investigating rugs/scams

74. **Which persona is the MVP optimized for?** (Influences which flows must be perfect at launch)

### D2. User Stories — Confirm These Are Correct
These are the stories QA will test against. Add, remove, or correct any.

**Explorer Stories:**
- US-001: As a trader, I can search any Solana wallet address and see its full profile within 3 seconds
- US-002: As a user, I can see all tokens held by a wallet with live USD values
- US-003: As a user, I can filter a wallet's transaction history by type, token, date, and amount
- US-004: As a user, I can look up any token and see its price chart, top holders, and recent large trades
- US-005: As a user, I can search by a user-defined label ("poop") and it resolves to the correct wallet

**Intelligence Stories:**
- US-006: As a trader, I can view an AI-generated summary of any wallet's behavior and classification
- US-007: As a researcher, I can see who funded a wallet originally (first funding source)
- US-008: As a user, I can see a wallet's top counterparties (who it interacts with most)
- US-009: As a user, I can see potential side wallets for any tracked labeled wallet

**Ask the Hive Stories:**
- US-010: As a user, I can type "does [label] send to [label]" and get a confirmed/denied answer with tx evidence
- US-011: As a user, I can ask "who funded this wallet" and get the origin chain traced
- US-012: As a user, Ask the Hive remembers my wallet labels so I don't need to paste addresses
- US-013: As a user, I can follow up on a previous query without restating context

**Tracked Wallets Stories:**
- US-014: As a user, I can save any wallet with a custom label and it persists across sessions
- US-015: As a user, I can organize tracked wallets into named groups
- US-016: As a user, I receive an alert when a tracked wallet makes a transaction above my set threshold
- US-017: As a user, I can see a live feed of activity across all my tracked wallets

**Graph Stories:**
- US-018: As a researcher, I can view a wallet's connections in graph view with edge weights based on transfer volume
- US-019: As a user, I can click a node in the graph to open that wallet's profile
- US-020: As a user, I can expand graph hops to explore indirect connections
- US-021: As a researcher, I can export the graph as an image or the connection data as CSV

**Known Wallets Stories:**
- US-022: As a user, I can submit a wallet for review with evidence (address, label, screenshots, description)
- US-023: As a user, I can see which wallets are in the known wallets database when viewing a profile
- US-024: As an admin, I can review submitted wallets, approve/reject, and add to the known wallets database
- US-025: As a user, when I search a known wallet, its public label appears prominently

**Signals Stories:**
- US-026: As a trader, I can browse the Signals feed and see flagged on-chain events with explanation
- US-027: As a user, I can filter Signals by type and by wallets I track
- US-028: As a user, each Signal links directly to the wallet page and transaction evidence

75. **Are any of these stories wrong or missing?**

76. **What's the single most important user story for MVP?** (The one that, if broken, the launch is a failure)

### D3. Performance & Quality Standards

77. **Page load target** — wallet profile page should load in under how many seconds?

78. **Search response time** — universal search should return results within how many milliseconds?

79. **Ask the Hive response time** — acceptable wait time for an AI response? (5 seconds? 10 seconds? Show a typing/thinking indicator?)

80. **Graph render performance** — how many nodes before the graph is allowed to paginate or simplify?

81. **Uptime expectation** — is 99.9% SLA a goal from launch, or is some downtime acceptable early?

---

## SECTION E — Open Architecture Questions

82. **Portfolio tracking** — does BLOODHOUND track the user's OWN portfolio (sign in with wallet, track your own performance), or is it strictly an intelligence tool for watching OTHER wallets?

83. **NFT depth** — how deep does NFT data go:
    - Just holdings (list of NFTs owned)?
    - Full provenance/sales history?
    - Collection floor and volume?
    - Trait rarity and analytics?

84. **Cross-chain future** — is Solana-only the firm plan, or should the architecture assume multi-chain expansion eventually?

85. **Pump.fun / Memecoin focus** — is this a primary use case? The wallet tracking use case described (insiders, snipers, bundlers) is heavily memecoin/launch oriented. Should the UX lean into this explicitly or stay neutral?

86. **Mobile** — web responsive only, or is a native mobile app in the roadmap?

87. **Team/collaboration** — the Team plan includes shared watchlists and labels. How does this work:
    - Invite team members by email?
    - Shared namespace for labels?
    - Who has admin rights within a team?

88. **Data retention** — how far back does BLOODHOUND store and display transaction data?
    - All history (expensive)?
    - Rolling 90 days free, full history Pro?
    - Something else?

89. **Competitor awareness** — are there specific Solscan, SolanaFM, or Nansen features that must be matched or deliberately excluded?

90. **What is the one thing BLOODHOUND must absolutely nail at launch that no other tool does well?**

---

*Answer as many of these as possible. Anything left blank will be decided by the agent assigned to that domain and reviewed in the next planning session.*
