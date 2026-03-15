# Leaderboard Rebuild Plan — Axiom Vision 1:1 Parity

> Detailed, granular UI/UX and techstack plan to rebuild the Bloodhound leaderboard
> to match Axiom's Vision leaderboard in functionality, animation, and design quality.
> Bloodhound colorway (blood-red accent, warm dark backgrounds) instead of Axiom blue.

---

## 1. Page Structure (Top to Bottom)

### 1.1 Tab Navigation Bar
**Reference**: Axiom images 1, 6 — `KOL | Global | Your Wallets | Tracked`

| Element | Axiom Spec | Bloodhound Implementation |
|---------|-----------|--------------------------|
| Layout | Horizontal text tabs, no background, no border | `flex items-center gap-6` |
| Active tab | White text, `font-medium`, `text-[16px]` | `text-[var(--text-primary)] font-semibold` |
| Inactive tab | Muted gray `text-textTertiary` | `text-[var(--text-muted)]` |
| Hover | `text-textSecondary` | `hover:text-[var(--text-secondary)]` |
| Transition | `duration-[65ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]` | Same |
| Active click | `active:scale-[0.96]` | Same |
| Right side | `+ Apply` button + `Search KOLs...` pill input | `+ Submit Wallet` + search input |

**Changes from current**:
- Remove pill-shaped category buttons with emoji icons
- Use plain text tabs like Axiom (cleaner, more professional)
- Add search input (pill-shaped, `rounded-full`) to right side
- `+ Submit Wallet` opens inline form (already built)

### 1.2 Sort & Period Controls
**Reference**: Axiom images 1, 6, 7

| Element | Axiom Spec | Bloodhound Implementation |
|---------|-----------|--------------------------|
| Sort dropdown | `Sort by PnL SOL ▾` with filter icon | `Sort by PnL ▾` dropdown |
| Period pills | `1d 3d 7d 14d 30d` — right-aligned | Same periods, right-aligned |
| Active period | `text-primaryBlue` (accent color text only) | `text-[var(--accent)]` |
| Inactive period | `text-textPrimary` plain | `text-[var(--text-primary)]` |
| Layout | Sort left, periods right | Same |

### 1.3 Top 3 KOL Featured Cards
**Reference**: Axiom images 1, 4, 6 — the most distinctive visual element

#### Card #1 (Winner) — Full-width, centered
```
┌──────────────────────────────────────────────────────────────────┐
│                              1                                    │
│  ┌──────┐  Username  WinRate%            PNL                     │
│  │ PFP  │  X icon                    ≡ +201.2                    │
│  │64x64 │                            +$17.6K                     │
│  └──────┘                                                        │
│  ─────────────────────────────────────────────────────────────── │
│  21          103          ≡ 783.4  $68.3K         18m            │
│  Positions   Trades       Volume                  Avg. Hold Time │
│  12  9       33   70                                             │
└──────────────────────────────────────────────────────────────────┘
```

**Visual effects**:
- Blurred PFP as card background (`blur(100px) saturate(1.75) brightness(0.5) opacity(0.1)`)
- Gradient border glow on hover (accent color)
- `rounded-[16px]` corners
- Card padding: `p-[20px]` to `p-[24px]`

#### Cards #2 and #3 — Side by side (50% width each)
```
┌─────── 2 ───────┐  ┌─────── 3 ───────┐
│ [PFP] Dv 45.78% │  │ [PFP] Jijo 64%  │
│       X         │  │       X          │
│    PNL: +173.3  │  │    PNL: +149.6   │
│   +$15.1K       │  │   +$13.1K        │
│ ──────────────  │  │ ────────────── │
│ 616    4.71K    │  │ 103    377       │
│ Pos    Trades   │  │ Pos    Trades    │
│ 282|334 3.7K|1K │  │ 66|37  253|124  │
│ ≡2.4K $210K 47s │  │ ≡834 $73.1K 8m  │
│ Volume AvgHold  │  │ Volume AvgHold   │
└─────────────────┘  └─────────────────┘
```

**Implementation**:
- Grid: `grid-cols-1` for rank 1, then `grid-cols-2 gap-4` for ranks 2-3
- Same blurred background effect but subtler border
- Rank number displayed above the card, centered, `text-[var(--text-muted)]`

### 1.4 Traders Table (Rank 4+)
**Reference**: Axiom images 3, 4, 5, 7, 8

#### Table Header
```
Rank | Trader | PNL | Win Rate | Positions | Trades | Volume | Avg Hold
```

**Column widths** (Axiom-exact):
```
grid-cols-[60px_1fr_110px_90px_90px_120px_110px_90px]
```

#### Table Row Structure
```
 7  | [PFP] Radiance   | ≡ +48.1  | 48.61% | 72     | 300      | ≡ 420.8 | 1m
    |       X           |          |        | 35  37 | 98  202  |         |
```

**Key details from Axiom**:
- **PFP**: Square with rounded corners (`rounded-[8px]`), 36x36px in table
- **X/Twitter icon**: Small X icon below name (not a link, just indicator)
- **Positions column**: Total on top, green|red sub-numbers below
- **Trades column**: Total on top, green|red sub-numbers below
- **Green numbers**: wins/profitable (`text-[var(--success)]`)
- **Red numbers**: losses/unprofitable (`text-[var(--error)]`)
- **Volume**: Shows SOL icon `≡` prefix
- **PnL**: Green for positive with `+` prefix, shows SOL icon `≡`

#### Row Hover
- Background: `hover:bg-[var(--bg-hover)]`
- Left border accent: 2px `var(--accent)` (already in `.table-row-interactive`)
- Transition: `duration-[65ms]`

#### Table Footer
```
Showing 50 of 2862418 traders        Wallets per page: [50 ▾]
```

### 1.5 Global Tab
**Reference**: Axiom image 7

- Same table structure but:
  - **No PFP** — shows truncated wallet address (e.g., `Gygi..BUpA`)
  - **No X icon**
  - **Pagination**: `1 2 3 4` page buttons
  - **USD toggle**: `USD ↕` button
  - Sort dropdown shows `PnL USD` instead of `PnL SOL`

---

## 2. Data & Calculations

### 2.1 Metrics to Display

| Metric | Source | Current State | Fix Needed |
|--------|--------|--------------|------------|
| PnL (SOL/USD) | `kolApi.rankings` → `pnl_usd` | ✅ Working | Show SOL equivalent too |
| Win Rate | `kolApi.rankings` → `win_rate` | ✅ Working | Already percentage |
| Positions | Not in current API response | ❌ Missing | Need API field or derive from trade data |
| Trades | `kolApi.rankings` → `trade_count` | ⚠️ Returns 0 | Backend needs to compute from `wallet_trades` |
| Volume | `kolApi.rankings` → `volume_usd` | ⚠️ Partial (some 0) | Backend aggregation needed |
| Avg Hold Time | `kolApi.rankings` → `avg_hold_time_mins` | ⚠️ Returns 0 | Backend calculation needed |
| ROI % | `kolApi.rankings` → `roi` | ✅ Working for some | Already returned |

### 2.2 Positions Breakdown (Green/Red)
Axiom shows `Positions: 72` with sub-numbers `35 37` (wins/losses).

**Implementation options**:
1. **Derive from existing data**: `positions_won = round(trade_count * win_rate / 100)`, `positions_lost = trade_count - positions_won`
2. **Add to API**: New fields `positions_won`, `positions_lost` from `wallet_trades` aggregation

**Recommendation**: Option 1 for now (derived), Option 2 later when backfill completes.

### 2.3 Trades Breakdown (Green/Red)
Same pattern. Can derive: `trades_won = round(trade_count * win_rate / 100)`

### 2.4 PFP Coverage Fix

**Current problem**: Most KOLs show letter fallback because:
1. GMGN PFP URLs were the only source imported
2. Many KOLs don't have GMGN images
3. `next.config.ts` was missing `gmgn.ai` domain (now fixed)

**Fix strategy**:
1. ✅ Already fixed: Added `gmgn.ai` to Next.js image domains
2. **Use `<img>` tags** (not Next.js `<Image>`) for external PFPs — avoids optimization issues
3. **Square avatars** with `rounded-[8px]` (matching Axiom) instead of `rounded-full`
4. **Fallback**: Gradient letter avatar (keep current, but make square)
5. **Future**: Twitter API enrichment for missing PFPs using bearer token

---

## 3. Visual Design Spec

### 3.1 Color Mapping (Axiom → Bloodhound)

| Axiom Color | Value | Bloodhound Equivalent | Value |
|-------------|-------|----------------------|-------|
| `--background` | `#06070B` | `--bg-base` | `#0a0808` |
| `--background-secondary` | `rgb(16,17,20)` | `--bg-surface` | `#131010` |
| `--background-tertiary` | `rgb(24,24,26)` | `--bg-elevated` | `#1a1515` |
| `--primary-color` (blue) | `rgb(82,111,255)` | `--accent` (red) | `#dc2626` |
| `--increase` (green) | `rgb(47,227,172)` | `--success` | `#22c55e` |
| `--decrease` (pink/red) | `rgb(236,57,122)` | `--error` | `#dc2626` |
| `--text-primary` | `rgb(252,252,252)` | `--text-primary` | `#f0eded` |
| `--text-secondary` | `rgb(200,201,209)` | `--text-secondary` | `#9e9090` |
| `--text-tertiary` | `rgb(119,122,140)` | `--text-muted` | `#6b5c5c` |
| `--primary-stroke` | `rgb(34,36,45)` | `--border` | `#2a2020` |

### 3.2 Typography

| Element | Axiom | Bloodhound |
|---------|-------|-----------|
| Tab labels | `text-[16px] font-medium` | `text-base font-semibold` |
| Card KOL name | `text-[17px] font-medium` | `text-[17px] font-semibold` |
| Card stats numbers | `text-[20px]` | `text-xl font-bold font-mono` |
| Card stat labels | `text-[12px] text-textTertiary` | `text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]` |
| Table header | `text-[10px] font-mono uppercase` | Same (already using this) |
| Table data | `text-[14px] font-mono` | `text-sm font-mono tabular-nums` |
| PnL values | `font-bold text-increase/decrease` | `font-bold text-[var(--success/error)]` |

### 3.3 Avatar Spec

| Context | Size | Shape | Border |
|---------|------|-------|--------|
| Card #1 | 64x64 | `rounded-[12px]` (square) | `2px border-[var(--border)]` |
| Card #2, #3 | 56x56 | `rounded-[10px]` (square) | `2px border-[var(--border)]` |
| Table row | 36x36 | `rounded-[8px]` (square) | `1px border-[var(--border)]` |
| Hover state | Same | Same | `border-[var(--accent)]` |

### 3.4 Animation Spec

| Interaction | Duration | Easing | Effect |
|-------------|----------|--------|--------|
| Tab click | `65ms` | `cubic-bezier(0.25,0.1,0.25,1)` | `active:scale-[0.96]` |
| Period click | `65ms` | Same | Color change |
| Card hover | `200ms` | `ease-out-quint` | `translateY(-2px)`, border glow |
| Row hover | `100ms` | `ease` | Background change, left accent border |
| Card enter | `300ms` | `ease-out-expo` | `fadeUp` staggered |
| Row enter | `200ms` | `ease-out-expo` | `fadeSlideIn` staggered (30ms per row) |
| PFP hover | `150ms` | `ease` | Border color transition |

---

## 4. Component Architecture

```
rankings/page.tsx
├── TabNav (KOL | Global | Your Wallets | Tracked)
├── ControlBar (Sort dropdown + Period pills + Search)
├── TopKolCards
│   ├── TopCard (rank 1, full-width)
│   └── SideCards (rank 2-3, side-by-side)
├── TradersTable
│   ├── TableHeader
│   └── TraderRow (for each rank 4+)
│       ├── KolAvatar (square, with fallback)
│       ├── TwitterIcon
│       ├── PnlCell
│       ├── WinRateCell
│       ├── PositionsCell (total + green/red breakdown)
│       ├── TradesCell (total + green/red breakdown)
│       ├── VolumeCell
│       └── AvgHoldCell
├── TableFooter (pagination for Global tab)
└── InlineSubmitForm (collapsible)
```

---

## 5. KOL Tab vs Global Tab Differences

| Feature | KOL Tab | Global Tab |
|---------|---------|------------|
| Top 3 cards | ✅ Yes | ❌ No (table only) |
| PFP images | ✅ Twitter/GMGN | ❌ Letter avatar or none |
| Name display | Display name + @handle | Truncated wallet address |
| X/Twitter icon | ✅ Yes | ❌ No |
| Search | "Search KOLs..." | "Search Global..." |
| Sort default | PnL SOL | PnL USD |
| Pagination | No (50 max) | Yes (pages 1-4, 50/page) |
| Data source | `kolApi.rankings({ wallet_type: "kol" })` | `kolApi.rankings({ wallet_type: "all" })` |

---

## 6. Logo Font Fix

**Current**: `BloodhoundLogo` SVG icon + `text-[14px] font-bold tracking-tight` Inter font
**AI page style**: `"bloodhound >"` in `font-mono` (JetBrains Mono), `color: var(--accent)`, `font-weight: 700`

**Fix**: Update sidebar logo and home page to use `font-mono` for "BLOODHOUND" text:
```tsx
<span className="text-[14px] font-bold tracking-tight font-mono text-[var(--text-primary)]">
  BLOODHOUND
</span>
```

This matches the terminal/monospace identity from the AI page and aligns with the frontend-design skill's emphasis on "JetBrains Mono communicates precision, craft, and developer culture."

---

## 7. Implementation Order

### Phase 1: Data Layer (Backend)
1. Fix `trade_count` aggregation in rankings API (currently returns 0)
2. Fix `volume_usd` aggregation for all KOLs
3. Fix `avg_hold_time_mins` calculation
4. Add derived `positions_won/lost` from trade data
5. Verify PFP URLs are populated in DB for all KOLs

### Phase 2: UI Rebuild (Frontend)
1. Replace tab navigation with plain text tabs (Axiom style)
2. Rebuild sort/period controls layout
3. Rebuild Top 3 cards with exact Axiom layout
4. Rebuild Traders table with all columns (Positions, Trades breakdown)
5. Add Global tab with wallet address display + pagination
6. Fix avatars to square shape
7. Add X/Twitter icon to each row

### Phase 3: Animation & Polish
1. Add staggered entry animations for cards and rows
2. Add card hover effects (lift, glow)
3. Add row hover with left accent border
4. Add active:scale-[0.96] to all interactive elements
5. Add search input with proper styling

### Phase 4: Logo & Branding
1. Update sidebar logo to `font-mono`
2. Update home page logo to `font-mono`
3. Ensure consistent monospace branding

---

## 8. Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/(app)/rankings/page.tsx` | Full rewrite with Axiom layout |
| `apps/web/src/components/layout/Sidebar.tsx` | Logo font → `font-mono` |
| `apps/web/src/app/page.tsx` | Home page logo font |
| `apps/web/next.config.ts` | ✅ Already fixed (image domains) |
| `apps/api/app/routers/rankings.py` | Fix trade_count, volume, avg_hold aggregation |

---

## 9. Quality Checklist

- [ ] Top 3 cards with blurred PFP backgrounds
- [ ] Square avatars (`rounded-[8px]`) not circular
- [ ] PFP images loading for all KOLs with GMGN URLs
- [ ] Graceful fallback (gradient letter) for missing PFPs
- [ ] Green/red position and trade breakdowns
- [ ] SOL icon (≡) prefix on PnL and Volume
- [ ] X/Twitter icon on each KOL row
- [ ] Plain text tabs (not pill buttons)
- [ ] Period filter as plain text (active = accent color)
- [ ] Sort dropdown
- [ ] Search input (pill-shaped)
- [ ] Staggered entry animations
- [ ] Card hover lift + glow
- [ ] Row hover with accent left border
- [ ] Global tab with wallet addresses + pagination
- [ ] `font-mono` on BLOODHOUND logo
- [ ] All N/A fields show em-dash (—) not "N/A"
- [ ] Responsive on mobile

---

*Plan created: March 14, 2026*
*Reference: Axiom Vision leaderboard screenshots + extracted HTML/CSS data*
