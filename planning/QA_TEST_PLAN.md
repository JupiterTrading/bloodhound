# BLOODHOUND — QA Test Plan
**Production URL:** https://bloodhound-ten.vercel.app
**Date generated:** 2026-02-28
**Priority legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## 1. Environment Setup

Before testing, ensure:
- [ ] Desktop browser: Chrome (latest), Firefox (latest), Safari (latest)
- [ ] Mobile: Chrome Android, Safari iOS (375px viewport)
- [ ] Backend API (`apps/api`) is running locally or deployed
- [ ] Supabase + ClickHouse migrations confirmed (both run successfully)
- [ ] `.env.local` / Vercel env vars have all keys set

---

## 2. Landing Page (`/`)

### 2.1 Visual & Layout
- [ ] 🟡 Hero animation renders (scanlines, grid texture)
- [ ] 🟡 Stats strip shows correct values (12.4M+, 847K, Real-time, <100ms)
- [ ] 🟡 Feature sections render with correct layout (no `direction: rtl` glitches)
- [ ] 🟢 Footer renders with correct copyright year

### 2.2 Navigation
- [ ] 🟠 "Docs" link → `/docs` (renders placeholder page, no 404)
- [ ] 🟠 "API" link → `/api-docs` (renders placeholder page, no 404)
- [ ] 🟠 "GitHub" link → opens `https://github.com/JupiterTrading/bloodhound` in new tab
- [ ] 🔴 "Launch App →" → navigates to `/explorer`
- [ ] 🟡 All CTA buttons on landing page navigate correctly

### 2.3 Performance
- [ ] 🟡 LCP (Largest Contentful Paint) < 2.5s on desktop
- [ ] 🟡 No layout shift (CLS < 0.1)

---

## 3. Top Navigation (`/explorer`, `/intelligence`, etc.)

### 3.1 Search Bar
- [ ] 🔴 Type ≥2 chars → autocomplete dropdown appears
- [ ] 🔴 Autocomplete shows wallet/token/tx suggestions with type labels
- [ ] 🟠 Clicking suggestion navigates to correct page (`/wallet/[addr]` or `/token/[mint]`)
- [ ] 🟠 Press Enter in search box → navigates to `/search?q=...`
- [ ] 🟡 ESC key closes dropdown
- [ ] 🟡 Arrow keys navigate dropdown suggestions
- [ ] 🟢 Empty search box shows no dropdown

### 3.2 Network Status Pill
- [ ] 🟡 Shows "Mainnet" label
- [ ] 🟢 Color indicator is visible

### 3.3 Auth (Clerk)
- [ ] 🔴 UserButton appears when logged in
- [ ] 🟠 Clicking Sign In opens Clerk modal
- [ ] 🟠 After sign-in, UserButton replaces Sign In
- [ ] 🟡 Sign-out works correctly

---

## 4. Explorer Page (`/explorer`)

- [ ] 🔴 Address input accepts Solana addresses (44-char base58)
- [ ] 🔴 Submit → redirects to `/wallet/[address]`
- [ ] 🟠 Token input → redirects to `/token/[mint]`
- [ ] 🟠 Tx input (88-char signature) → handled (even if backend 404s gracefully)
- [ ] 🟡 "Recent searches" section renders (currently hardcoded — acceptable for MVP)
- [ ] 🟡 Trending tokens list renders if backend responds

---

## 5. Wallet Page (`/wallet/[address]`)

Use test address: `GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ` (or any known wallet)

### 5.1 Header Card
- [ ] 🔴 Page loads without white screen / crash
- [ ] 🔴 Wallet address displayed (truncated or labeled)
- [ ] 🟠 SOL Balance, Portfolio, Total Txs, Volume, First Active, Last Active stats shown
- [ ] 🟠 Classification badges render (e.g., "WHALE", "SMART_MONEY", "DEX_TRADER")
- [ ] 🟡 "Tracked by X users" counter shows
- [ ] 🟡 Twitter / Telegram handles link out correctly if wallet is labeled

### 5.2 Intelligence Summary Panel
- [ ] 🔴 Panel renders with loading skeleton → then summary text
- [ ] 🟠 Multi-line summaries display on separate lines (pre-wrap fix)
- [ ] 🟠 Confidence badge shows correct color (CONFIRMED=green, PROBABLE=yellow, etc.)
- [ ] 🟡 "Show more / Show less" toggle works for long summaries
- [ ] 🟡 "No intelligence data" fallback shows if backend returns empty

### 5.3 Token Holdings
- [ ] 🔴 Holdings grid renders
- [ ] 🟠 Token logo shows (or fallback initials if logo 404s)
- [ ] 🟠 USD values formatted correctly
- [ ] 🟡 "No holdings" empty state shows if wallet holds nothing

### 5.4 Transaction History
- [ ] 🔴 Transaction table renders with correct columns
- [ ] 🔴 Direction badges (IN / OUT / SELF) show correct color
- [ ] 🟠 Filter by token, direction, date range works
- [ ] 🟠 Pagination: Next / Prev buttons change page
- [ ] 🟡 Pagination buttons disabled while loading (check for duplicate requests)
- [ ] 🟡 Amount USD shows "—" if 0 or null

### 5.5 Counterparties Panel
- [ ] 🟠 Top counterparties listed with interaction count + volume
- [ ] 🟠 Clicking counterparty address navigates to their wallet page
- [ ] 🟡 Known labels shown next to addresses

### 5.6 Side Wallets Panel
- [ ] 🟡 Side wallet candidates shown with confidence percentage
- [ ] 🟡 Signals listed for each candidate
- [ ] 🟢 "No side wallets detected" empty state shown if empty

### 5.7 Action Buttons
- [ ] 🟠 "Open Graph" → navigates to `/intelligence?address=...`
- [ ] 🟠 "Bloodhound AI" → navigates to `/ai?q=Summarize wallet [address]`

---

## 6. Token Page (`/token/[mint]`)

Use test mint: `So11111111111111111111111111111111111111112` (wSOL) or any token

- [ ] 🔴 Page loads without crash
- [ ] 🔴 Token name, symbol, price displayed
- [ ] 🟠 Price change 24h shows with correct color (green +, red -)
- [ ] 🟠 Market cap, volume, liquidity shown
- [ ] 🟠 Token logo loads (or placeholder if 404)
- [ ] 🟡 Security score badge renders
- [ ] 🟡 Top holders table loads
- [ ] 🟡 Top traders table loads
- [ ] 🟡 Clicking holder address → `/wallet/[addr]`

---

## 7. Search Page (`/search`)

- [ ] 🔴 `/search?q=` renders without crash (Suspense fix verified)
- [ ] 🔴 Results render as cards with type labels (wallet, token, tx, program)
- [ ] 🟠 Clicking result navigates to correct page
- [ ] 🟠 Empty query → shows search tips
- [ ] 🟠 No results → shows "No results for..." message with wallet link fallback
- [ ] 🟡 Loading skeleton shows while fetching
- [ ] 🟡 Re-submitting search from within page works

---

## 8. Tracked Wallets Page (`/tracked`)

- [ ] 🔴 Unauthenticated user sees sign-in prompt (not a crash)
- [ ] 🔴 Authenticated user sees wallet list (or empty state)
- [ ] 🟠 Add wallet form: enter address + label → wallet appears in list
- [ ] 🟠 Error message shown if address invalid
- [ ] 🟠 Remove wallet button (×) works
- [ ] 🟡 Edit label works
- [ ] 🟡 Group assignment works (if groups exist)
- [ ] 🟡 Activity feed shows recent transfers from tracked wallets

---

## 9. Signals Page (`/signals`)

- [ ] 🔴 Page loads without crash
- [ ] 🟠 Signal list renders with type, wallet, confidence, timestamp
- [ ] 🟠 Filter by confidence level (CONFIRMED / PROBABLE / SUSPECTED) works
- [ ] 🟠 Filter by signal type works
- [ ] 🟡 Pagination works (Next / Prev)
- [ ] 🟡 Clicking wallet address in signal navigates to wallet page

---

## 10. Intelligence Page (`/intelligence`)

- [ ] 🔴 Page loads without crash
- [ ] 🔴 Address input → Submit shows wallet summary card
- [ ] 🟠 Intelligence AI summary loads below summary card
- [ ] 🟠 "Ask the Hive" input navigates to AI terminal with pre-filled query
- [ ] 🟡 Relationship map placeholder renders
- [ ] 🟡 Error state: invalid address shows error message, not infinite spinner

---

## 11. Bloodhound AI Page (`/ai`)

- [ ] 🔴 Terminal renders with input field
- [ ] 🔴 Type query + submit → AI response appears
- [ ] 🔴 Response includes: answer text, confidence badge, evidence transactions
- [ ] 🟠 Clicking evidence tx link navigates correctly
- [ ] 🟠 "Thinking..." indicator shows while request in flight
- [ ] 🟠 Multiple queries build conversation history
- [ ] 🟡 Example queries (chips) fill input on click
- [ ] 🟡 Session ID persists across page without reload

---

## 12. API Proxy (`/api/v1/*`)

- [ ] 🔴 `/api/v1/wallet/[addr]/summary` → 200 or 503 (not 500 crash)
- [ ] 🔴 Backend offline → returns `{ error: "Backend unreachable" }` 502 (not unhandled exception)
- [ ] 🟠 Auth header forwarded correctly to backend
- [ ] 🟡 Large response bodies stream correctly (no memory overflow)

---

## 13. Docs & API Docs Pages

- [ ] 🟠 `/docs` → renders placeholder page (no 404)
- [ ] 🟠 `/api-docs` → renders placeholder page (no 404)

---

## 14. Cross-Cutting Concerns

### 14.1 Error States
- [ ] 🔴 All pages handle backend 500/503 gracefully (show error card, not blank page)
- [ ] 🔴 Invalid wallet address in URL → wallet error state, not crash
- [ ] 🟠 Network offline → React Query shows cached data or error state

### 14.2 Fonts
- [ ] 🟠 JetBrains Mono loads for addresses, numbers, code
- [ ] 🟠 Neue Haas Grotesk (or system fallback) loads for UI text
- [ ] 🟡 No FOUT (flash of unstyled text) on first load

### 14.3 Responsive Layout
- [ ] 🟠 Mobile 375px: landing page readable, nav accessible
- [ ] 🟠 Mobile 375px: wallet page single-column (not two-column grid)
- [ ] 🟡 Tablet 768px: wallet page layout adapts gracefully

### 14.4 Accessibility
- [ ] 🟡 All interactive elements reachable via Tab key
- [ ] 🟡 Icon-only buttons have aria-label
- [ ] 🟡 Color is not the only signal (e.g., IN/OUT has text + color)

### 14.5 Performance Targets
- [ ] 🟠 First Contentful Paint < 1.5s (Vercel CDN, static pages)
- [ ] 🟠 Wallet page TTI (Time to Interactive) < 3s on fast connection
- [ ] 🟡 No unnecessary re-renders on page interaction (use React DevTools Profiler)

---

## 15. Known Issues (Deferred — Not Blocking MVP)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| K-01 | StatusBar shows hardcoded "Last block: loading..." | Medium | Deferred |
| K-02 | Pagination total count approximate (uses page data, not DB total) | Medium | Deferred |
| K-03 | Search dropdown has no keyboard arrow-key navigation | Medium | Deferred |
| K-04 | Token/Signals/Intelligence pages are "use client" — no page-level metadata | Low | Deferred |
| K-05 | Mobile: wallet page two-column grid not responsive | Medium | Deferred |
| K-06 | Rate limiting on API proxy route | High | Deferred (add Upstash Ratelimit) |
| K-07 | RECENT_SEARCHES in ExplorerPage is hardcoded | Low | Deferred |
| K-08 | NetworkPill hardcoded to "Mainnet" | Low | Deferred |

---

## 16. Test Sign-Off Checklist

| Area | Tester | Status | Notes |
|------|--------|--------|-------|
| Landing page | | ⬜ | |
| Auth (Clerk) | | ⬜ | |
| Explorer / Search | | ⬜ | |
| Wallet page | | ⬜ | |
| Token page | | ⬜ | |
| Tracked wallets | | ⬜ | |
| Signals | | ⬜ | |
| Intelligence | | ⬜ | |
| Bloodhound AI | | ⬜ | |
| Mobile responsive | | ⬜ | |
| API proxy errors | | ⬜ | |
