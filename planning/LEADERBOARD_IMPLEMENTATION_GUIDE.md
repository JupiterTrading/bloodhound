# Bloodhound Leaderboard Implementation Guide

> Based on Axiom UI/UX Analysis - Ready to implement

## 🎨 Step 1: CSS Variables Setup

Add these to your global CSS or Tailwind config:

```css
/* globals.css or app.css */
:root {
  /* Backgrounds */
  --bg-primary: #06070B;
  --bg-secondary: rgb(16, 17, 20);
  --bg-tertiary: rgb(24, 24, 26);
  
  /* Text */
  --text-primary: rgb(252, 252, 252);
  --text-secondary: rgb(200, 201, 209);
  --text-tertiary: rgb(119, 122, 140);
  
  /* Borders */
  --stroke-primary: rgb(34, 36, 45);
  --stroke-secondary: rgb(50, 53, 66);
  --border-subtle: rgb(31, 31, 35);
  
  /* Brand */
  --primary-blue: rgb(82, 111, 255);
  --primary-blue-hover: rgb(102, 131, 255);
  
  /* Data Visualization */
  --profit-green: rgb(47, 227, 172);
  --profit-green-hover: rgb(91, 231, 189);
  --loss-red: rgb(236, 57, 122);
  --loss-red-hover: rgb(248, 100, 154);
  
  /* Chart Colors */
  --chart-up: rgb(11, 153, 129);
  --chart-down: rgb(242, 53, 70);
}
```

### Tailwind Config Extension

```js
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        stroke: {
          primary: 'var(--stroke-primary)',
          secondary: 'var(--stroke-secondary)',
        },
        accent: {
          blue: 'var(--primary-blue)',
          'blue-hover': 'var(--primary-blue-hover)',
        },
        profit: 'var(--profit-green)',
        loss: 'var(--loss-red)',
      },
      transitionTimingFunction: {
        'axiom': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
    },
  },
}
```

---

## 🧩 Step 2: Component Structure

### KOL Leaderboard Card Component

```tsx
// components/KOLLeaderboardCard.tsx
interface KOLCardProps {
  rank: number;
  username: string;
  handle: string;
  avatar: string;
  winRate: number;
  pnl: number;
  pnlChange: number;
  positions: { total: number; wins: number; losses: number };
  trades: { total: number; wins: number; losses: number };
  volume: number;
  volumeFormatted: string;
  avgHoldTime: string;
}

export function KOLLeaderboardCard({
  rank,
  username,
  handle,
  avatar,
  winRate,
  pnl,
  pnlChange,
  positions,
  trades,
  volume,
  volumeFormatted,
  avgHoldTime,
}: KOLCardProps) {
  const isProfitable = pnl >= 0;
  
  return (
    <div className="relative isolate w-full overflow-hidden rounded-[16px] border border-stroke-primary bg-background-secondary transition-all duration-[135ms] ease-axiom hover:border-accent-blue hover:shadow-lg hover:shadow-accent-blue/20">
      {/* Blurred background image */}
      <div className="pointer-events-none absolute inset-0 z-[-1] select-none overflow-hidden opacity-10">
        <div 
          className="h-full w-full blur-[100px] saturate-[1.75] brightness-50"
          style={{ backgroundImage: `url(${avatar})`, backgroundSize: 'cover' }}
        />
      </div>
      
      {/* Card content */}
      <div className="relative z-10 flex flex-col gap-[16px] p-[16px] sm:p-[24px]">
        {/* Header: Avatar, Name, Win Rate, PNL */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-[12px]">
            <img 
              src={avatar} 
              alt={username}
              className="h-[48px] w-[48px] rounded-[12px] border border-stroke-primary"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-[8px]">
                <span className="text-[17px] font-medium text-text-primary">
                  {username}
                </span>
                <span className="text-[14px] text-text-tertiary">
                  {winRate.toFixed(2)}%
                </span>
              </div>
              <span className="text-[14px] text-text-secondary">
                @{handle}
              </span>
            </div>
          </div>
          
          {/* PNL Display */}
          <div className="flex flex-col items-end">
            <span className="text-[12px] text-text-tertiary">PNL</span>
            <span className={`text-[18px] font-medium ${isProfitable ? 'text-profit' : 'text-loss'}`}>
              {isProfitable ? '+' : ''}{pnl >= 1000 ? `$${(pnl / 1000).toFixed(1)}K` : `$${pnl.toFixed(2)}`}
            </span>
            <span className={`text-[14px] ${isProfitable ? 'text-profit' : 'text-loss'}`}>
              {isProfitable ? '+' : ''}${pnlChange >= 1000 ? `${(pnlChange / 1000).toFixed(1)}K` : pnlChange.toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-[1px] w-full bg-stroke-primary" />
        
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-[16px]">
          {/* Positions */}
          <StatColumn
            label="Positions"
            total={positions.total}
            wins={positions.wins}
            losses={positions.losses}
          />
          
          {/* Trades */}
          <StatColumn
            label="Trades"
            total={trades.total}
            wins={trades.wins}
            losses={trades.losses}
          />
          
          {/* Volume */}
          <div className="flex flex-col">
            <span className="text-[20px] font-medium text-text-primary">
              ${volumeFormatted}
            </span>
            <span className="text-[12px] text-text-tertiary">Volume</span>
          </div>
          
          {/* Avg Hold Time */}
          <div className="flex flex-col">
            <span className="text-[20px] font-medium text-text-primary">
              {avgHoldTime}
            </span>
            <span className="text-[12px] text-text-tertiary">Avg. Hold Time</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatColumn({ label, total, wins, losses }: { 
  label: string; 
  total: number; 
  wins: number; 
  losses: number; 
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[20px] font-medium text-text-primary">{total}</span>
      <span className="text-[12px] text-text-tertiary">{label}</span>
      <div className="mt-[4px] flex items-center gap-[8px] text-[12px]">
        <span className="text-profit">{wins}</span>
        <span className="text-text-tertiary">|</span>
        <span className="text-loss">{losses}</span>
      </div>
    </div>
  );
}
```

---

## 📊 Step 3: Table View Component

```tsx
// components/LeaderboardTable.tsx
interface TraderRow {
  rank: number;
  username: string;
  handle: string;
  avatar: string;
  pnl: number;
  winRate: number;
  positions: { total: number; wins: number; losses: number };
  trades: { total: number; wins: number; losses: number };
  volume: number;
  avgHoldTime: string;
}

export function LeaderboardTable({ traders }: { traders: TraderRow[] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-stroke-primary">
            <th className="px-[16px] py-[12px] text-left text-[14px] font-medium text-text-tertiary">
              Rank
            </th>
            <th className="px-[16px] py-[12px] text-left text-[14px] font-medium text-text-tertiary">
              Trader
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              PNL
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              Win Rate
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              Positions
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              Trades
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              Volume
            </th>
            <th className="px-[16px] py-[12px] text-right text-[14px] font-medium text-text-tertiary">
              Avg Hold
            </th>
          </tr>
        </thead>
        <tbody>
          {traders.map((trader) => (
            <tr 
              key={trader.rank}
              className="border-b border-stroke-primary/50 transition-all duration-[65ms] hover:bg-background-tertiary active:scale-[0.99]"
            >
              <td className="px-[16px] py-[16px] text-[14px] text-text-secondary">
                {trader.rank}
              </td>
              
              <td className="px-[16px] py-[16px]">
                <div className="flex items-center gap-[12px]">
                  <img 
                    src={trader.avatar} 
                    alt={trader.username}
                    className="h-[32px] w-[32px] rounded-[8px]"
                  />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-text-primary">
                      {trader.username}
                    </span>
                    <span className="text-[12px] text-text-tertiary">
                      @{trader.handle}
                    </span>
                  </div>
                </div>
              </td>
              
              <td className="px-[16px] py-[16px] text-right">
                <span className={`text-[14px] font-medium ${trader.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {trader.pnl >= 0 ? '+' : ''}${trader.pnl.toFixed(2)}
                </span>
              </td>
              
              <td className="px-[16px] py-[16px] text-right text-[14px] text-text-primary">
                {trader.winRate.toFixed(2)}%
              </td>
              
              <td className="px-[16px] py-[16px] text-right">
                <div className="flex flex-col items-end">
                  <span className="text-[14px] text-text-primary">{trader.positions.total}</span>
                  <div className="flex items-center gap-[4px] text-[12px]">
                    <span className="text-profit">{trader.positions.wins}</span>
                    <span className="text-text-tertiary">|</span>
                    <span className="text-loss">{trader.positions.losses}</span>
                  </div>
                </div>
              </td>
              
              <td className="px-[16px] py-[16px] text-right">
                <div className="flex flex-col items-end">
                  <span className="text-[14px] text-text-primary">{trader.trades.total}</span>
                  <div className="flex items-center gap-[4px] text-[12px]">
                    <span className="text-profit">{trader.trades.wins}</span>
                    <span className="text-text-tertiary">|</span>
                    <span className="text-loss">{trader.trades.losses}</span>
                  </div>
                </div>
              </td>
              
              <td className="px-[16px] py-[16px] text-right text-[14px] text-text-primary">
                ${trader.volume.toLocaleString()}
              </td>
              
              <td className="px-[16px] py-[16px] text-right text-[14px] text-text-secondary">
                {trader.avgHoldTime}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 🎛️ Step 4: Tab Navigation & Filters

```tsx
// components/LeaderboardFilters.tsx
export function LeaderboardFilters() {
  const [activeTab, setActiveTab] = useState('KOL');
  const [timePeriod, setTimePeriod] = useState('3d');
  
  const tabs = ['KOL', 'Global', 'Your Wallets', 'Tracked'];
  const periods = ['1d', '3d', '7d', '14d', '30d'];
  
  return (
    <div className="flex w-full flex-col gap-[16px] sm:flex-row sm:items-center sm:justify-between">
      {/* Tabs */}
      <div className="flex items-center gap-[24px]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`h-[32px] text-[16px] font-medium transition-all duration-[65ms] ease-axiom active:scale-[0.96] ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      
      {/* Time Period Filters */}
      <div className="flex items-center gap-[8px]">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setTimePeriod(period)}
            className={`h-[32px] rounded-[8px] px-[12px] text-[14px] font-medium transition-all duration-[65ms] ease-axiom active:scale-[0.96] ${
              timePeriod === period
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-text-primary hover:bg-background-tertiary'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔍 Step 5: Search Component

```tsx
// components/LeaderboardSearch.tsx
export function LeaderboardSearch({ onSearch }: { onSearch: (query: string) => void }) {
  return (
    <div className="flex h-[32px] w-full items-center gap-[8px] rounded-full border border-stroke-primary bg-transparent px-[12px] transition-colors duration-[125ms] hover:bg-stroke-primary/35 sm:max-w-[300px]">
      <i className="ri-search-2-line text-[18px] text-text-primary" />
      <input
        type="text"
        placeholder="Search KOLs..."
        onChange={(e) => onSearch(e.target.value)}
        className="flex-1 bg-transparent text-[12px] font-medium text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}
```

---

## 📄 Step 6: Main Leaderboard Page

```tsx
// app/leaderboard/page.tsx
import { KOLLeaderboardCard } from '@/components/KOLLeaderboardCard';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { LeaderboardFilters } from '@/components/LeaderboardFilters';
import { LeaderboardSearch } from '@/components/LeaderboardSearch';

export default function LeaderboardPage() {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  return (
    <div className="relative min-h-screen w-full bg-background">
      <div className="mx-auto max-w-[1420px] px-[16px] py-[24px] sm:px-[24px]">
        {/* Header */}
        <div className="mb-[24px] flex flex-col gap-[16px]">
          <h1 className="text-[32px] font-bold text-text-primary">
            Leaderboard
          </h1>
          
          <LeaderboardFilters />
          
          <div className="flex items-center justify-between">
            <LeaderboardSearch onSearch={(q) => console.log(q)} />
            
            {/* View Toggle */}
            <div className="flex gap-[8px]">
              <button
                onClick={() => setViewMode('cards')}
                className={`h-[32px] w-[32px] rounded-[8px] transition-all ${
                  viewMode === 'cards' ? 'bg-accent-blue text-white' : 'text-text-tertiary'
                }`}
              >
                <i className="ri-layout-grid-line" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`h-[32px] w-[32px] rounded-[8px] transition-all ${
                  viewMode === 'table' ? 'bg-accent-blue text-white' : 'text-text-tertiary'
                }`}
              >
                <i className="ri-list-check" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        {viewMode === 'cards' ? (
          <div className="flex flex-col gap-[16px]">
            {/* Render KOL cards */}
          </div>
        ) : (
          <LeaderboardTable traders={[]} />
        )}
      </div>
    </div>
  );
}
```

---

## ✅ Implementation Checklist

- [ ] Add CSS variables to global styles
- [ ] Update Tailwind config with custom colors
- [ ] Install RemixIcon: `npm install remixicon`
- [ ] Create `KOLLeaderboardCard` component
- [ ] Create `LeaderboardTable` component
- [ ] Create `LeaderboardFilters` component
- [ ] Create `LeaderboardSearch` component
- [ ] Build main leaderboard page
- [ ] Add API integration for KOL data
- [ ] Test responsive behavior (mobile/desktop)
- [ ] Add loading states
- [ ] Add empty states
- [ ] Implement search functionality
- [ ] Add sorting capabilities
- [ ] Test hover/active states

---

*Ready to build! 🚀*
