# Axiom vs Bloodhound: Element-by-Element Diff

## LEADERBOARD PAGE

### Tab Bar (Top)
| Element | Axiom (Images 1,6) | Bloodhound (Image 4) | Status |
|---------|-------------------|----------------------|--------|
| Tabs | `KOL  Global  Your Wallets  Tracked` plain text | `KOL  Global  Tracked` | CLOSE - missing "Your Wallets" |
| Active tab style | White bold text, no underline, no bg | White text | OK |
| Inactive tab style | Gray muted text | Gray text | OK |
| Right: + Apply | Small text link `+ Apply` | `+ Apply` | OK |
| Right: Search | `Q Search KOLs...` pill input | Pill search input | OK |
| Tab spacing | `gap-[24px]` between tabs | gap-6 | OK |

### Sort & Period Row
| Element | Axiom | Bloodhound | Status |
|---------|-------|------------|--------|
| Sort dropdown | `Sort by PnL SOL v` with hamburger icon | `Sort by PnL v` dropdown | CLOSE - missing hamburger icon, missing "SOL" |
| Period pills | `1d 3d 7d 14d 30d` right-aligned, active=cyan text only | `1d 3d 7d 14d 30d` active=red text | NEEDS FIX - Axiom uses CYAN not brand accent for active period |
| Period position | Far right | Far right | OK |

### Top 3 Cards

#### Card #1 (Full Width)
| Element | Axiom | Bloodhound | Status |
|---------|-------|------------|--------|
| Rank "1" | Centered ABOVE card in gray text | Centered above card | OK |
| Card border | Subtle blue/cyan glow border | accent border | OK |
| PFP | 64x64 square `rounded-[12px]` on LEFT | Square PFP on left | OK |
| Name | `clukz` white bold, `52.17%` gray next to it | Name + win% | OK |
| Twitter | `X` icon below name | X icon + @handle | OK |
| PNL label | Small "PNL" label top-right | "PNL" label | OK |
| PNL value | `= +204.4` in GREEN (SOL amount with = prefix) | `+$330.0K` USD only | **MAJOR DIFF** - Axiom shows SOL first |
| PNL USD | `+$17.9K` below SOL in green | Shows ROI% instead | **MAJOR DIFF** |
| Divider | Thin horizontal line | Line | OK |
| Stats: Positions | `23` bold, `Positions` label below, `12  9` green/red sub-numbers | Shows but all dashes | **DATA GAP** |
| Stats: Trades | `108` bold, `Trades` label, `35  73` green/red | All dashes | **DATA GAP** |
| Stats: Volume | `= 817.2  $71.3K` (SOL + USD) | Shows USD only when available | CLOSE |
| Stats: Avg Hold Time | `17m` bold | Shows dash | **DATA GAP** |
| Stats layout | Horizontal row, evenly spaced | flex gap-8 | OK |

#### Cards #2 + #3 (Side by Side)
| Element | Axiom | Bloodhound | Status |
|---------|-------|------------|--------|
| Layout | 2 cards side-by-side, each ~48% width | grid-cols-2 | OK |
| Rank | "2" and "3" centered above each card | Centered above | OK |
| Same structure as #1 | Yes, just smaller PFP (48px) | Similar | OK |

### Traders Table

#### Table Header
| Column | Axiom | Bloodhound | Status |
|--------|-------|------------|--------|
| Rank | `Rank` | `Rank` | OK |
| Trader | `Trader` | `Trader` | OK |
| PNL | `PNL` | `PNL` | OK |
| Win Rate | `Win Rate` | `Win Rate` | OK |
| Positions | `Positions` | `Positions` | OK |
| Trades | `Trades` | `Trades` | OK |
| Volume | `Volume` | `Volume` | OK |
| Avg Hold | `Avg Hold` | `Avg Hold` | OK |
| Right corner | `USD ↕` toggle + grid icon | `USD` text only | **MISSING** toggle + grid icon |

#### Table Rows
| Element | Axiom (Images 2,4,5) | Bloodhound (Images 4,5) | Status |
|---------|---------------------|------------------------|--------|
| Rank number | Plain number, left-aligned | Plain number | OK |
| PFP | Square `rounded-[8px]` 36px | Square with rounded corners | OK |
| Name | Bold white, truncated | Bold white | OK |
| X icon | Small X logo below name | X icon below name | OK |
| PNL value | GREEN `+$10.6K` | GREEN `+193.7` (wrong format?) | **CHECK** |
| PNL prefix | No SOL icon in table USD mode | Has = prefix | NEEDS FIX for USD mode |
| Win Rate | `34.15%` | `100.00%` | OK (data dependent) |
| Positions | `41` total, below: `14` green `27` red | All dashes `—` | **DATA GAP** |
| Trades | `139` total, below: `88` green `51` red | All dashes `—` | **DATA GAP** |
| Volume | `$36.4K` | All dashes `—` | **DATA GAP** |
| Avg Hold | `13m` | All dashes `—` | **DATA GAP** |
| Row hover | Subtle bg change | Has `.table-row-interactive` | OK |

### Missing Features on Leaderboard
1. **USD ↕ toggle button** in table header right corner
2. **Grid view icon** (□□) next to USD toggle
3. **Pagination** for Global tab (`Showing 50 of 2862418 traders`, `Wallets per page: 50`)
4. **SOL/USD display mode** - Axiom shows PNL in SOL (with = icon) by default, can toggle to USD

---

## KOL PROFILE / WALLET PAGE

### Axiom Wallet Page Structure (from C.html + Images 3, 9)
```
┌─────────────────────────────────────────────────────────────────┐
│ Header: [chain icon] [X icon] Username  WalletAddress...  [copy]│
│         [eye] [star] [share] [search]   1d 7d 30d Max          │
│                                                          [close]│
├──────────────────┬──────────────────┬───────────────────────────┤
│ BALANCE          │ PNL              │ PERFORMANCE               │
│ ↕ USD            │ [chart area]     │ [share icon]              │
│                  │                  │                           │
│ Total Value      │ Green PNL chart  │ Total Pnl    +$2.28M     │
│ $62.3K           │ with area fill   │ Realized PNL +$2.28M     │
│                  │                  │ Total TXNS   152640       │
│ Unrealized PNL   │                  │              81883/70757  │
│ +$5.249          │                  │                           │
│                  │                  │ >500%           6         │
│ ─────────────    │                  │ 200%~500%      86         │
│ Tradeable Balance│ Wallet Funding   │ 0%~200%     30173         │
│ $62.3K           │ [wallet] = 0.1   │ 0%~-50%     18476         │
│                  │ [timer] 1y       │ <-50%         138         │
│ Stable Coin Bal  │                  │                           │
│ $7,336           │ [usdc] 7.336     │ [green|red progress bar]  │
├──────────────────┴──────────────────┴───────────────────────────┤
│ [Active Positions] [History] [Top 100] [Activity]    ↕ USD      │
├─────────────────────────────────────────────────────────────────┤
│ Type  Token        Amount ≡    Market Cap ☀    Age    Explorer  │
│ Sell  Money        = 1.1236   $4.3K            9h     [link]    │
│ Buy   Money        = 0.99     $29K             9h     [link]    │
│ Buy   Money        = 3.96     $24.3K           9h     [link]    │
│ Sell  MOLDAGENT    = 4.3261   $41.4K           9h     [link]    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Bloodhound KOL Profile (Image 6)
```
┌─────────────────────────────────────────────────────────────────┐
│ [PFP] eq                                                        │
│       @404flipped                                                │
│       [Track Trades btn]  [Follow btn]                          │
├─────────────────────────────────────────────────────────────────┤
│ Total PnL  Win Rate  Trades  Wallets  Followers  Rank           │
│ +$67.9K    66.7%     0       1        —          #—              │
├─────────────────────────────────────────────────────────────────┤
│ Recent Posts: Loading tweets...                                  │
├─────────────────────────────────────────────────────────────────┤
│ [Recent Trades] [Holdings] [Wallets] [Activity]                 │
│ No recent trades found                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Differences
| Element | Axiom Wallet | Bloodhound KOL Profile | Fix Needed |
|---------|-------------|----------------------|------------|
| Layout | 3-column grid: Balance \| PNL Chart \| Performance | Single-column stats grid | **MAJOR REDESIGN** |
| Header | Wallet address with copy, chain icon, time filters | Name + handle + buttons | Redesign header |
| Balance panel | Total Value, Unrealized PNL, Tradeable Balance, Wallet Funding, Stable Coin | Just PnL number | **ADD** full balance panel |
| PNL Chart | Green area chart showing PNL over time | Not present | **ADD** PNL chart |
| Performance | Total PnL, Realized PNL, Total TXNS (green/red), distribution buckets, progress bar | Not present | **ADD** performance panel |
| Tabs | Active Positions, History, Top 100, Activity | Recent Trades, Holdings, Wallets, Activity | Rename to match |
| Activity table | Type (Buy/Sell colored), Token (icon+name), Amount (SOL), Market Cap, Age, Explorer link | Basic trade list | **REDESIGN** activity table |
| Time filters | 1d, 7d, 30d, Max in header | Not present | **ADD** |
| Actions | Star (favorite), Share, Search, Close (X) | Track Trades, Follow | Keep our actions |

---

## PRIORITY FIXES

### P0 - Critical (must fix for 1:1 parity)
1. Leaderboard PNL display should show USD with `+$X.XK` format consistently
2. All data columns showing `—` need real data OR graceful handling
3. KOL profile page needs complete redesign to 3-column Axiom layout

### P1 - High (visual parity)
1. Add USD toggle button to table header
2. Fix active period color (should stand out more)
3. Add pagination for Global tab

### P2 - Medium (polish)
1. Add grid view icon
2. Hamburger/filter icon next to sort
3. SOL/USD toggle mode
