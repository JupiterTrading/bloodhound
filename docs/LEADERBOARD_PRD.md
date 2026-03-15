# Bloodhound Leaderboard - Product Requirements Document

> Version 1.0 | March 14, 2026

## 1. Executive Summary

Greenfield rebuild of the Bloodhound Leaderboard page. Replacing the current poorly-formatted implementation with a polished, Axiom-inspired real-time KOL ranking system.

## 2. Tech Stack

- Frontend: Next.js 15, React 19, Tailwind CSS v4, framer-motion
- State: @tanstack/react-query, zustand
- Icons: lucide-react
- Auth: Clerk
- Backend: FastAPI (Python)
- Database: Supabase (PostgreSQL)
- Cache: Upstash Redis
- Data Sources: Helius, Birdeye
- Real-time: 15s polling + optimistic UI

## 3. Routes

- /rankings (default: KOL tab)
- /rankings?tab=global (Global wallets)
- /rankings?tab=tracked (Tracked wallets)

## 4. Feature Specs

### 4.1 KOL Leaderboard (Default)

Top 3 Cards:
- Rank number ABOVE card (centered)
- 1 = full-width, large PFP (64px), blurred BG
- 2 and 3 = side-by-side 50% width
- Stats: Positions (total + green/red), Trades (total + green/red), Volume (SOL + USD), Avg Hold
- PNL with SOL + USD, Win rate next to name, X icon

Traders Table (4+):
- Scrollable contained box
- Columns: Rank, Trader, PNL, Win Rate, Positions, Trades, Volume, Avg Hold
- Row hover highlight with accent left border
- Click row = KOL Profile popup
- Hover PFP = enlarged preview

### 4.2 Controls

- Sort By dropdown: PnL USD, PnL SOL (default), Volume USD, Volume SOL, Wins, Losses, Buys, Sells, Avg Hold Time
- Timeframe buttons: 1d, 3d (default active color), 7d, 14d, 30d
- Asc/Desc toggle button (icon)
- USD/SOL toggle button
- Gallery/List view toggle

### 4.3 Search and Contribute

- Pill-shaped search bar filters leaderboard live
- + Contribute button opens modal
- Modal has 2 modes: Apply as KOL (wallets, twitter, tg, discord) and Submit Side Wallet (wallet, evidence)

### 4.4 KOL Profile Popup

- Overlay popup, not page nav
- Header: PFP, name, star/track, X link, wallets with source logos
- Time filters: 1d, 7d, 30d, Max (default)
- 3 columns: Balance | PNL Chart | Performance
- Tabs: Active Positions, History, Top 100, Activity

### 4.5 Global Page

- Table only (no top 3 cards)
- Top 100 wallets by each metric
- Abbreviated addresses
- Pagination 1-4

### 4.6 Tracked Page

- User tracked wallets only
- Same table format
- Empty state message

### 4.7 Animations

- Rank shift: 400ms spring on data update
- Row highlight: 600ms fade on new data
- Hover glow: 150ms ease
- PFP enlarge: 200ms scale on hover
- Number tick: 300ms on value change
- Card entrance: 600ms stagger on load
- Modal: 200ms scale+fade

### 4.8 Performance

- Page load under 2 seconds
- 15s polling refresh
- Instant client-side search
- 60fps animations

## 5. Sprint Plan

### Sprint 1: Backend API
- Add pnl_sol, volume_sol, wins, losses, buys, sells to rankings API
- Add 3d, 14d timeframes
- Reduce cache TTL to 30s
- Add sort direction parameter

### Sprint 2: Leaderboard Layout
- Greenfield rankings page with top 3 cards + scrollable table
- Proper formatting, readable text, correct sizing

### Sprint 3: Controls
- Sort dropdown, timeframe buttons, asc/desc, USD/SOL toggle, gallery/list

### Sprint 4: Search and Contribute
- Search bar with live filtering
- Contribute modal with 2 form modes

### Sprint 5: KOL Profile Popup
- Overlay with balance, PNL chart placeholder, performance stats
- Tabs for positions, history, top 100, activity

### Sprint 6: Animations
- framer-motion rank shifts, hover effects, live number updates
- Card entrance animations

### Sprint 7: Global and Tracked Pages
- Global tab with full wallet table
- Tracked tab with user wallet data

### Sprint 8: Performance and Polish
- Optimize queries, reduce bundle size
- Final UI polish pass

## 6. User Stories

- US-1: As a user, I can see the top 3 KOLs featured prominently with their stats
- US-2: As a user, I can scroll through all ranked KOLs in a table below the top 3
- US-3: As a user, I can sort KOLs by any metric (PnL, Volume, Wins, etc.)
- US-4: As a user, I can filter by timeframe (1d through 30d)
- US-5: As a user, I can toggle between USD and SOL display
- US-6: As a user, I can switch between list and gallery view
- US-7: As a user, I can search for specific KOLs by name
- US-8: As a user, I can contribute a new KOL or side wallet via modal
- US-9: As a user, I can click a KOL to see their detailed profile popup
- US-10: As a user, I can see rank changes animate in real-time
- US-11: As a user, I can view the Global leaderboard of all wallets
- US-12: As a user, I can view my tracked wallets performance
- US-13: As a user, I can copy a KOL wallet address by clicking their name
- US-14: As a user, I can hover over PFPs to see enlarged previews
- US-15: As a user, the page loads within 2 seconds with all data
