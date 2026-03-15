# Axiom Leaderboard UI/UX Analysis

> Extracted from Axiom.trade Vision leaderboard - March 2026

## 🎨 Design System Overview

### Color Palette

Axiom uses a **dark-first design** with a sophisticated color system based on CSS variables:

#### Background Colors
- **Primary Background**: `#06070B` (Very dark blue-black)
- **Secondary Background**: `rgb(16, 17, 20)` - Card backgrounds
- **Tertiary Background**: `rgb(24, 24, 26)` - Elevated elements

#### Text Hierarchy
- **Primary Text**: `rgb(252, 252, 252)` - White, main content
- **Secondary Text**: `rgb(200, 201, 209)` - Light gray, supporting text
- **Tertiary Text**: `rgb(119, 122, 140)` - Muted gray, labels/metadata

#### Accent Colors
- **Primary Blue**: `rgb(82, 111, 255)` - Brand color, CTAs
- **Primary Blue Hover**: `rgb(102, 131, 255)` - Interactive states
- **Primary Hue**: `230` - Blue hue value

#### Strokes & Borders
- **Primary Stroke**: `rgb(34, 36, 45)` - Main borders
- **Secondary Stroke**: `rgb(50, 53, 66)` - Subtle dividers
- **Border Subtle**: `rgb(31, 31, 35)` - Very subtle borders

#### Data Visualization Colors
- **Increase/Profit**: `rgb(47, 227, 172)` - Bright green
- **Increase Hover**: `rgb(91, 231, 189)` - Lighter green
- **Decrease/Loss**: `rgb(236, 57, 122)` - Bright pink/red
- **Decrease Hover**: `rgb(248, 100, 154)` - Lighter pink
- **Chart Up**: `rgb(11, 153, 129)` - Darker green for charts
- **Chart Down**: `rgb(242, 53, 70)` - Red for charts

#### Semantic Colors
- **Green**: `rgb(18, 175, 128)` - Success states
- **Yellow**: `rgb(220, 193, 60)` - Warning/neutral
- **Orange**: `rgb(226, 124, 77)` - Attention
- **Orange Hover**: `rgb(238, 146, 103)`
- **Red**: `rgb(242, 84, 97)` - Error/danger
- **Light Blue**: `rgb(82, 197, 255)` - Info/links

---

## 📐 Layout & Structure

### Container System
- **Max Width**: `1420px` - Main content container
- **Responsive Padding**: 
  - Mobile: `16px`
  - Desktop: `24px` (`sm:px-[24px]`)

### Card Layout (KOL Cards)

Based on the screenshots and HTML, Axiom uses **large card components** for KOL entries:

```
┌─────────────────────────────────────────────────────┐
│  [Avatar]  Username  Win%          PNL: +$274.6    │
│            @handle                      +$24K       │
│  ─────────────────────────────────────────────────  │
│  46        202         $1.18K  $103K    8m          │
│  Positions Trades     Volume          Avg Hold Time │
│  25  21    68   134                                 │
└─────────────────────────────────────────────────────┘
```

**Key Features:**
- **Rounded corners**: `rounded-[12px]` or `rounded-[16px]`
- **Border**: Subtle border with `border-primaryStroke`
- **Gradient border on hover**: Blue accent glow effect
- **Background blur effect**: Blurred profile image in background
- **Padding**: `px-[16px]` to `px-[24px]`
- **Gap between sections**: `gap-[16px]`

### Table Layout (Traders List)

For the detailed traders table view:

```
Rank | Trader | PNL | Win Rate | Positions | Trades | Volume | Avg Hold
-----|--------|-----|----------|-----------|--------|--------|----------
  8  | [img]  |+$39 |  52.63%  |    57     |  194   | $420.2 |   1h
     | Name   |     |          | 30 | 27   |103 | 91|        |
```

**Column Structure:**
- Fixed-width rank column (left-aligned)
- Avatar + name column (flex)
- Right-aligned numeric columns
- Sub-metrics shown in smaller text with color coding (green/red)

---

## 🎯 Component Patterns

### 1. Tab Navigation
```html
<button class="text-textPrimary text-[16px] font-medium">KOL</button>
<button class="text-textTertiary text-[16px] font-medium">Global</button>
<button class="text-textTertiary text-[16px] font-medium">Wallet</button>
<button class="text-textTertiary text-[16px] font-medium">Tracked</button>
```

**Style:**
- Active: `text-textPrimary` (white)
- Inactive: `text-textTertiary` (muted gray)
- Height: `h-[32px]`
- Font: `text-[16px] font-medium`
- Spacing: `gap-[24px]`

### 2. Time Period Filters
```html
<button class="rounded-[8px] px-[8px] h-[32px]">1d</button>
<button class="text-primaryBlue">3d</button> <!-- Active -->
<button>7d</button>
<button>14d</button>
<button>30d</button>
```

**Active State:**
- Text color: `text-primaryBlue`
- Background: Subtle blue tint
- Border radius: `rounded-[8px]`

### 3. Search Input
```html
<div class="rounded-full border-[1px] border-primaryStroke pl-[12px] pr-[4px] h-[32px]">
  <i class="ri-search-2-line text-[18px]"></i>
  <input placeholder="Search KOLs..." class="text-[12px]" />
</div>
```

**Style:**
- Fully rounded: `rounded-full`
- Border: `border-primaryStroke`
- Icon: RemixIcon search icon
- Small text: `text-[12px]`

### 4. Stat Display (Positions/Trades)
```
46 Positions
25 (green) | 21 (red)

202 Trades  
68 (green) | 134 (red)
```

**Pattern:**
- Large number on top
- Label below in muted text
- Win/Loss breakdown with color coding
- Green for wins: `text-increase`
- Red for losses: `text-decrease`

### 5. Profile Avatar
- **Size**: `64px x 64px` (estimated from cards)
- **Border radius**: `rounded-[8px]` or `rounded-[12px]`
- **Border**: Subtle stroke
- **Background**: Blurred version used as card background

---

## ✨ Animations & Interactions

### Transitions
Axiom uses **custom cubic-bezier easing** for smooth, professional animations:

```css
/* Primary easing */
ease-[cubic-bezier(0.25,0.1,0.25,1)]

/* Durations */
duration-[65ms]   /* Quick interactions (clicks) */
duration-[125ms]  /* Medium (hovers) */
duration-[135ms]  /* Slower (expansions) */
duration-300      /* Large state changes */
```

### Interactive States
```css
/* Active/Click state */
active:scale-[0.96]
active:bg-backgroundSecondary/65

/* Hover states */
hover:bg-primaryStroke/35
hover:text-textSecondary

/* Transitions */
transition-all
transition-colors
transition-opacity
transition-scale
```

### Card Hover Effect
- **Scale**: Subtle lift effect
- **Border**: Glowing blue border appears
- **Background**: Slightly lighter
- **Cursor**: Pointer

---

## 📊 Typography System

### Font Sizes
- **Large Headlines**: `text-[24px]`
- **Section Headers**: `text-[20px]`
- **Body/Primary**: `text-[16px]` or `text-[17px]`
- **Secondary**: `text-[14px]`
- **Small/Labels**: `text-[12px]`

### Font Weights
- **Medium**: `font-medium` - Most UI elements
- **Bold**: `font-bold` - CTAs, emphasis
- **Normal**: `font-normal` - Body text

### Line Heights
- Compact: `leading-[21px]` for `text-[16px]`
- Standard: Default Tailwind line heights

---

## 🔲 Spacing System

Axiom uses **pixel-perfect spacing** with bracket notation:

### Common Gaps
- `gap-[8px]` - Tight spacing (icons, inline elements)
- `gap-[12px]` - Small spacing
- `gap-[16px]` - Standard spacing (most common)
- `gap-[24px]` - Large spacing (sections)

### Padding
- `px-[8px]` - Buttons, small elements
- `px-[12px]` - Inputs
- `px-[16px]` - Cards (mobile)
- `px-[24px]` - Cards (desktop), page padding
- `py-[16px]` - Vertical card padding

### Border Radius
- `rounded-full` - Pills, search bars, circular buttons
- `rounded-[4px]` - Small elements
- `rounded-[8px]` - Buttons, filters
- `rounded-[12px]` - Medium cards
- `rounded-[16px]` - Large cards

---

## 🎭 Special Effects

### Background Blur Effect
Cards have a **blurred profile image** in the background:

```css
filter: blur(100px) saturate(1.75) brightness(0.5);
opacity: 0.1;
```

Creates a subtle, colorful glow behind each KOL card.

### Gradient Overlays
```css
bg-gradient-to-t from-background to-transparent
```

Used to fade content smoothly into the background.

### Glow Effects
- Blue glow on hover for interactive elements
- Accent borders that appear on interaction
- Subtle shadow/elevation changes

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: Default styles
- **Desktop**: `sm:` prefix (640px+)

### Mobile Adaptations
- Tabs shown at top: `sm:hidden`
- Reduced padding: `px-[16px]` → `sm:px-[24px]`
- Stacked layouts become horizontal
- Smaller font sizes on mobile

---

## 🎯 Key Takeaways for Bloodhound

### 1. **Color System**
- Implement CSS variables for theming
- Use RGB values (not hex) for alpha channel support
- Semantic color naming (`--text-primary`, `--increase`, etc.)
- Distinct colors for profit/loss visualization

### 2. **Card Design**
- Large, prominent cards for top KOLs
- Blurred background images for visual interest
- Blue accent borders on hover
- Clear hierarchy: Name → Stats → Metrics

### 3. **Data Presentation**
- Color-coded win/loss metrics (green/red)
- Large numbers with small labels
- Inline breakdowns (25 wins | 21 losses)
- Right-aligned numeric columns in tables

### 4. **Interactions**
- Fast, snappy animations (65ms-135ms)
- Custom cubic-bezier easing
- Scale-down on click (`active:scale-[0.96]`)
- Smooth color transitions

### 5. **Typography**
- Medium weight for most UI
- Clear size hierarchy (12px → 24px)
- Muted colors for secondary text
- White for primary content

### 6. **Spacing**
- Consistent 8px grid (8, 16, 24)
- Generous padding in cards
- Tight spacing for related elements
- Breathing room between sections

---

## 🛠️ Implementation Recommendations

1. **Create CSS variables** matching Axiom's system
2. **Build card component** with blur background effect
3. **Implement color-coded metrics** (green/red for P&L)
4. **Add smooth transitions** with custom easing
5. **Use RemixIcon** for consistent iconography
6. **Design mobile-first** with desktop enhancements
7. **Add hover states** with scale and glow effects
8. **Create tab navigation** with active state styling

---

## 📸 Visual Reference

See screenshots in project root:
- Image 1: KOL card layout with stats
- Image 2: Traders table view
- Image 3: Lower-ranked traders (sparse data handling)

---

*Analysis completed: March 14, 2026*
