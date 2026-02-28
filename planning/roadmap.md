# Bloodhound — Roadmap Detail

## Current Status: Pre-Phase 1 (Foundation Lock-In)

### Immediate Blockers (Do Before Anything Else)
1. [ ] Confirm "Bloodhound" — check @bloodhound on Twitter/X, bloodhound.so / bloodhound.xyz / bloodhoundsol.com
2. [ ] Lock name → secure Twitter handle immediately
3. [ ] Register domain
4. [ ] Create GitHub org
5. [ ] Set up Helius account and get API key
6. [ ] Set up Supabase project

### Phase 1 Milestones (Weeks 1–6): Foundation
**Goal: Look legitimate. Functioning explorer core.**
- [ ] GitHub org live with clean README and repo structure
- [ ] Landing page (polished placeholder, not blank)
- [ ] Twitter/X profile with bio, logo, banner
- [ ] API docs skeleton (even just architecture overview)
- [ ] Core explorer: wallet search → address lookup → transaction history
- [ ] Basic token/NFT display
- [ ] Helius integration live
- [ ] Authentication (Supabase)
- [ ] Domain live with SSL

### Phase 2 Milestones (Weeks 7–14): Intelligence Layer
**Goal: The actual differentiator. This is what makes Bloodhound not Solscan.**
- [ ] Wallet labeling system (private labels per user)
- [ ] Public tag system (community labels)
- [ ] Tracked wallet dashboard
- [ ] Basic relationship query: "show transfers between wallet A and wallet B"
- [ ] Flow graph visualization (React Flow)
- [ ] Helius webhook → real-time alerts for tracked wallets

### Phase 3 Milestones (Weeks 14–20): AI Interface
**Goal: Natural language intelligence layer.**
- [ ] Claude API integration with function calling
- [ ] NL query → structured API call → result with narrative
- [ ] Wallet AI summary ("this wallet looks like a dev deployer...")
- [ ] Smart money tagging
- [ ] Insider cluster detection

### Phase 4 (Month 6+): Monetization
- [ ] Stripe subscription tiers
- [ ] Pro tier: higher limits, private labels, advanced alerts
- [ ] API access for builders
- [ ] Team workspaces
- [ ] Solana Foundation grant application

## Repo Structure (Target)
```
bloodhound/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI or Node.js heavy backend
├── packages/
│   ├── ui/           # Shared component library
│   └── db/           # Supabase schema + migrations
├── docs/             # API documentation
├── indexer/          # Future: custom Geyser indexer
└── README.md
```
