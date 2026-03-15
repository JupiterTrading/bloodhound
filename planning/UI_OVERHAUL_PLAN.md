# BLOODHOUND — UI/UX Overhaul Plan

**Created:** Mar 12, 2026  
**Goal:** Transform BLOODHOUND from functional to unforgettable. Elevate every surface to feel like a precision intelligence instrument — alive, data-forward, and distinctly designed.

---

## Current State Assessment

### What Exists (46 components, 21 pages)
- **Landing:** Hero with live KOL feed, feature sections, stats strip
- **App Shell:** TopNav with search, StatusBar, mobile drawer
- **Core Pages:** Wallet profile, Token, Tx, Graph, Explorer, Search
- **Features:** AI Terminal, Signals, Tracked wallets, Portfolio
- **UI Components:** AddressTag, ClassificationBadge, ConfidenceBadge, PnLBadge, TxSourceLogo, Skeleton

### Issues to Address
1. **Heavy inline styles** — ~90% of styling is inline `style={}`, not Tailwind
2. **Generic patterns** — Some layouts feel templated (card grids, same spacing everywhere)
3. **Typography** — Using Inter/system fonts, not the distinctive NHGrotesk specified
4. **Motion** — Basic animations exist but lack orchestration and signature moments
5. **Data density** — Good data, but hierarchy could be sharper
6. **Visual identity** — Solid color system, but lacking distinctive flourishes that make it memorable

### What's Working
- Color palette is locked (black/white/blood red)
- Live data streaming in hero
- Scanline texture on background
- Functional search with autocomplete
- Mobile responsive foundation

---

## Design Direction (from CLAUDE.md)

**Brand Personality:** Intuitive · Intelligent · Beautiful

**Aesthetic:** Dark, high-contrast, data-forward. Calm but alive. Bloomberg terminal meets modern design sensibility.

**Principles:**
1. Data is the hero
2. Alive, not animated
3. Precision over decoration
4. Confidence through restraint
5. Intelligent defaults, powerful depth

---

## Phase 1: Foundation — Design System Overhaul

**Files:** `globals.css`, new `design-tokens.css`

### Typography System
- [ ] Load **Geist** (display/UI) + **JetBrains Mono** (data) via next/font
- [ ] Create fluid type scale with `clamp()`:
  - `--text-xs`: 11px
  - `--text-sm`: 12px
  - `--text-base`: 14px
  - `--text-lg`: 16px
  - `--text-xl`: 20px
  - `--text-2xl`: 28px
  - `--text-3xl`: 36px
  - `--text-display`: clamp(40px, 5vw, 56px)
- [ ] Define weight scale: 400 (body), 500 (medium), 600 (semibold), 700 (bold)

### Spacing System
- [ ] 4px base unit with scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
- [ ] Fluid spacing for major sections using `clamp()`
- [ ] Asymmetric rhythm — tight groupings, generous separations

### Color Refinements
- [ ] Add `--bg-subtle` between base and surface for more depth layers
- [ ] Add semantic colors: `--success`, `--warning`, `--error` (from DESIGN_BRIEF)
- [ ] Add `--glow-red` for subtle accent glows
- [ ] Tint all grays slightly warm (toward `#0d0a0a` undertone)

### Motion Tokens
- [ ] `--ease-out-expo`: cubic-bezier(0.16, 1, 0.3, 1)
- [ ] `--ease-out-quart`: cubic-bezier(0.25, 1, 0.5, 1)
- [ ] `--duration-fast`: 100ms
- [ ] `--duration-normal`: 200ms
- [ ] `--duration-slow`: 400ms
- [ ] Stagger delay tokens for orchestrated reveals

### Tailwind Config
- [ ] Extend Tailwind with custom colors, spacing, typography
- [ ] Create component classes for common patterns
- [ ] Set up CSS variables that Tailwind can reference

---

## Phase 2: Core UI Components

**Files:** `components/ui/*`

### AddressTag
- [ ] Truncation with monospace
- [ ] Copy-on-click with subtle feedback (not a tooltip, use a brief glow)
- [ ] Optional label prefix with different weight
- [ ] Hover state: slight bg shift

### ClassificationBadge
- [ ] Pill styling with uppercase, tight letter-spacing
- [ ] Accent red for dangerous types, white outline for neutral
- [ ] Subtle pulse animation on "active" badges
- [ ] Size variants: sm, md

### ConfidenceBadge
- [ ] Dot + text pattern
- [ ] CONFIRMED (green), PROBABLE (amber), SUSPECTED (orange), UNKNOWN (muted)
- [ ] Clean implementation with semantic colors

### PnLBadge
- [ ] Green/red with sign always shown
- [ ] Monospace numbers
- [ ] Optional background for emphasis

### TxSourceLogo
- [ ] Clean logo rendering with proper sizing
- [ ] Fallback for unknown sources
- [ ] Tooltip on hover with platform name

### New: Button Component
- [ ] Primary (accent fill), Secondary (border), Ghost (text only)
- [ ] Size variants: sm, md, lg
- [ ] Loading state with subtle spinner
- [ ] Hover/active states with proper easing

### New: Input Component
- [ ] Consistent styling across all inputs
- [ ] Focus ring using accent-glow
- [ ] Error state
- [ ] Search variant with icon

### New: Card Component
- [ ] Surface background, border
- [ ] Header/body/footer slots
- [ ] Hover lift for interactive cards

---

## Phase 3: Layout Shell

**Files:** `TopNav.tsx`, `StatusBar.tsx`, `layout.tsx`

### TopNav Redesign
- [ ] Convert inline styles to Tailwind
- [ ] Refined logo lockup with proper spacing
- [ ] Search bar: sleeker design, command-K hint
- [ ] Nav links: subtle hover states, active indicator refined
- [ ] Network pill: cleaner, integrated feel
- [ ] Auth section: polished user menu
- [ ] Mobile: slide-in drawer with backdrop blur

### StatusBar
- [ ] Tighter, more refined
- [ ] Monospace for all data values
- [ ] Pulsing dots for live indicators
- [ ] Error/warning states clearly distinguished

### App Layout
- [ ] Proper page padding system
- [ ] Consistent max-width container
- [ ] Page transition animations (subtle fade + slide)

---

## Phase 4: Landing Page

**Files:** `page.tsx`, `LandingHero.tsx`

### Hero Section
- [ ] Bolder typography with tighter line-height
- [ ] Asymmetric layout — headline doesn't need to be perfectly centered
- [ ] Live feed panel: more refined, feels like real infrastructure
- [ ] Signature moment: staggered text reveal on load
- [ ] Grid overlay: more subtle, larger grid
- [ ] CTAs: primary button with subtle glow, secondary with clean hover

### Stats Strip
- [ ] Horizontal layout with generous spacing
- [ ] Monospace numbers, uppercase labels
- [ ] No cards — just clean data on surface bg

### Feature Sections
- [ ] Break from identical card grid
- [ ] Each section has slightly different treatment
- [ ] Visuals feel like actual product screenshots, not mockups
- [ ] Tags: refined pill styling

### CTA Section
- [ ] Clean, confident, not desperate
- [ ] Single clear action

### Footer
- [ ] Minimal, functional
- [ ] Links in subtle secondary color

---

## Phase 5: Wallet Profile (Critical Page)

**Files:** `WalletProfile.tsx`, wallet components

### Header Card
- [ ] Classification badges prominently displayed
- [ ] Wallet label/name large and bold
- [ ] Social handles as clean chips
- [ ] Address with copy functionality
- [ ] Key stats in clean grid
- [ ] Action buttons: Open Graph, AI, Track, Share

### Intelligence Summary
- [ ] Clean card with AI-generated text
- [ ] Confidence badge
- [ ] Collapsible with smooth animation
- [ ] "Analyzing..." state with skeleton

### Transaction History
- [ ] TanStack Table with proper styling
- [ ] Source logos inline
- [ ] Direction arrows/indicators
- [ ] Time formatting consistent
- [ ] Filters: clean popover design
- [ ] Infinite scroll with loading state

### Right Column
- [ ] Top Counterparties: mini wallet cards
- [ ] Known Connections: relationship badges
- [ ] Side Wallets: subtle warning styling
- [ ] Social proof: tracked by N users

### Token Holdings
- [ ] Grid of token cards
- [ ] Logo + name + amount + USD
- [ ] Sorted by value
- [ ] Loading skeleton

### NFT Holdings
- [ ] Hidden by default
- [ ] Grid with images
- [ ] Collection name, floor price

---

## Phase 6: Explorer & Search

### Explorer Page
- [ ] Universal search prominent
- [ ] Recent activity feed
- [ ] Quick links to common actions
- [ ] Stats overview

### Search Results
- [ ] Tabbed interface
- [ ] Clean result rows
- [ ] Type indicators
- [ ] Pagination or infinite scroll

---

## Phase 7: AI Terminal

### Terminal Interface
- [ ] Distinctive prompt styling: `bloodhound >` in accent red
- [ ] Input field: terminal feel but clean
- [ ] Response cards: structured with evidence links
- [ ] Confidence badges on every response
- [ ] Action buttons: Track, Graph, Table
- [ ] Multi-turn history
- [ ] "Thinking" state with pulsing indicator

---

## Phase 8: Graph View

### Graph Canvas
- [ ] Clean controls panel
- [ ] Node styling per type (seed, known, unknown, exchange)
- [ ] Edge styling with thickness scaling
- [ ] Smooth zoom/pan
- [ ] Node selection with sidebar detail

### Sidebar Detail
- [ ] Mini wallet profile
- [ ] Relationship to seed
- [ ] Recent transactions
- [ ] Quick actions

---

## Phase 9: Secondary Pages

### Signals Feed
- [ ] Clean row-based design
- [ ] Signal type icons
- [ ] Confidence indicators
- [ ] Time formatting
- [ ] Filter controls

### Tracked Wallets
- [ ] Two-column layout
- [ ] Wallet list with search
- [ ] Activity feed
- [ ] Group management (Pro)

### Token Page
- [ ] Price chart (TradingView)
- [ ] Tabbed content below
- [ ] Holder distribution
- [ ] Security indicators

### Transaction Page
- [ ] Clean layout
- [ ] Instruction parsing
- [ ] Account list
- [ ] Program interaction

---

## Phase 10: Polish Pass

### Consistency Check
- [ ] All spacing follows the system
- [ ] All colors from palette
- [ ] All typography from scale
- [ ] All motion uses tokens

### Micro-interactions
- [ ] Button hover/active states
- [ ] Link underlines
- [ ] Copy feedback
- [ ] Loading states
- [ ] Error states
- [ ] Empty states

### Performance
- [ ] Lazy load heavy components
- [ ] Optimize images
- [ ] Reduce bundle size
- [ ] Test on slow connections

### Accessibility
- [ ] Focus states visible
- [ ] Color contrast AA compliant
- [ ] Reduced motion support
- [ ] Keyboard navigation

---

## Execution Order

**Start with Phase 1** — everything else builds on the foundation.

Then proceed linearly, but prioritize:
1. **Phase 5 (Wallet Profile)** — the most important page
2. **Phase 4 (Landing)** — first impression
3. **Phase 7 (AI Terminal)** — differentiating feature

---

## Success Criteria

When complete, showing this interface should prompt:
- "How was this built?" not "Which AI made this?"
- "This feels like Bloomberg for crypto"
- "Every detail looks intentional"
- "It feels alive, like real data is flowing through it"

The interface should be **unforgettable** — distinctive enough that users recognize it instantly.
