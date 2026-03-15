# Bloodhound Design System

> Premium crypto intelligence platform - Design quality matching Axiom

## 🎨 Bloodhound Color Palette

### Brand Identity
Bloodhound = **Tracking, Hunting, Intelligence** → Dark, sleek, predatory aesthetic

```css
:root {
  /* === BACKGROUNDS === */
  --bg-primary: #0A0E14;        /* Deep navy-black (darker than Axiom) */
  --bg-secondary: #12161D;      /* Card backgrounds */
  --bg-tertiary: #1A1F28;       /* Elevated elements */
  --bg-elevated: #222831;       /* Hover states, modals */
  
  /* === BLOODHOUND BRAND === */
  --bloodhound-red: #E63946;    /* Primary brand - hunting red */
  --bloodhound-red-hover: #FF4757;
  --bloodhound-red-glow: rgba(230, 57, 70, 0.3);
  
  --bloodhound-orange: #F77F00; /* Secondary accent - alert orange */
  --bloodhound-orange-hover: #FF8C1A;
  
  --bloodhound-cyan: #06FFF0;   /* Tertiary - tracking cyan */
  --bloodhound-cyan-hover: #33FFF5;
  --bloodhound-cyan-glow: rgba(6, 255, 240, 0.2);
  
  /* === TEXT HIERARCHY === */
  --text-primary: #F8F9FA;      /* Pure white */
  --text-secondary: #CED4DA;    /* Light gray */
  --text-tertiary: #868E96;     /* Muted gray */
  --text-disabled: #495057;     /* Disabled state */
  
  /* === BORDERS & STROKES === */
  --stroke-primary: #2A3039;    /* Main borders */
  --stroke-secondary: #3D4451;  /* Subtle dividers */
  --stroke-accent: #4A5568;     /* Emphasized borders */
  
  /* === DATA VISUALIZATION === */
  --profit-green: #10B981;      /* Emerald green */
  --profit-green-bright: #34D399;
  --profit-green-glow: rgba(16, 185, 129, 0.25);
  
  --loss-red: #EF4444;          /* Bright red */
  --loss-red-bright: #F87171;
  --loss-red-glow: rgba(239, 68, 68, 0.25);
  
  --neutral-yellow: #F59E0B;    /* Amber */
  --neutral-blue: #3B82F6;      /* Blue */
  
  /* === CHART COLORS === */
  --chart-up: #059669;          /* Dark green */
  --chart-down: #DC2626;        /* Dark red */
  --chart-neutral: #6B7280;     /* Gray */
  
  /* === SPECIAL EFFECTS === */
  --glow-red: 0 0 20px var(--bloodhound-red-glow);
  --glow-cyan: 0 0 20px var(--bloodhound-cyan-glow);
  --glow-green: 0 0 15px var(--profit-green-glow);
  --glow-loss: 0 0 15px var(--loss-red-glow);
}
```

---

## 🎭 Animation System

### Timing Functions
```css
:root {
  /* Custom easing curves */
  --ease-bloodhound: cubic-bezier(0.25, 0.1, 0.25, 1);
  --ease-sharp: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.6, 1);
  
  /* Duration tokens */
  --duration-instant: 50ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
}
```

### Animation Patterns
```css
/* Micro-interactions */
.btn-interactive {
  transition: all var(--duration-fast) var(--ease-bloodhound);
}

.btn-interactive:active {
  transform: scale(0.96);
}

.btn-interactive:hover {
  transform: translateY(-1px);
  box-shadow: var(--glow-red);
}

/* Card hover lift */
.card-lift {
  transition: all var(--duration-normal) var(--ease-smooth);
}

.card-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), var(--glow-cyan);
}

/* Glow pulse animation */
@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.glow-pulse {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Slide in from bottom */
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up var(--duration-normal) var(--ease-smooth);
}
```

---

## 📐 Spacing & Layout

### Spacing Scale (8px base)
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
}
```

### Border Radius
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;
}
```

### Container Widths
```css
:root {
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1440px;
}
```

---

## 🔤 Typography System

### Font Stack
```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale
```css
:root {
  /* Font sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;
  
  /* Line heights */
  --leading-tight: 1.2;
  --leading-snug: 1.4;
  --leading-normal: 1.6;
  --leading-relaxed: 1.8;
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### Typography Classes
```css
.heading-1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

.heading-2 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
}

.heading-3 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  color: var(--text-primary);
}

.body-large {
  font-size: var(--text-lg);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}

.body {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
}

.caption {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-snug);
  color: var(--text-tertiary);
}

.label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: var(--leading-tight);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
}
```

---

## 🎯 Component Patterns

### Buttons
```css
/* Primary CTA */
.btn-primary {
  background: linear-gradient(135deg, var(--bloodhound-red), var(--bloodhound-orange));
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-weight: var(--font-semibold);
  transition: all var(--duration-fast) var(--ease-bloodhound);
  box-shadow: 0 4px 12px rgba(230, 57, 70, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow-red);
}

.btn-primary:active {
  transform: scale(0.96);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--stroke-primary);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  transition: all var(--duration-fast) var(--ease-bloodhound);
}

.btn-secondary:hover {
  background: var(--bg-elevated);
  border-color: var(--bloodhound-cyan);
  box-shadow: var(--glow-cyan);
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-3) var(--space-6);
  transition: all var(--duration-fast) var(--ease-bloodhound);
}

.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

### Cards
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--stroke-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  transition: all var(--duration-normal) var(--ease-smooth);
}

.card:hover {
  border-color: var(--bloodhound-cyan);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), var(--glow-cyan);
}

/* Premium card with gradient border */
.card-premium {
  position: relative;
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
}

.card-premium::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-xl);
  padding: 2px;
  background: linear-gradient(135deg, var(--bloodhound-red), var(--bloodhound-cyan));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### Badges
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.badge-profit {
  background: rgba(16, 185, 129, 0.15);
  color: var(--profit-green-bright);
  border: 1px solid var(--profit-green);
}

.badge-loss {
  background: rgba(239, 68, 68, 0.15);
  color: var(--loss-red-bright);
  border: 1px solid var(--loss-red);
}

.badge-rank {
  background: linear-gradient(135deg, var(--bloodhound-red), var(--bloodhound-orange));
  color: white;
  box-shadow: var(--glow-red);
}
```

---

## 🌟 Special Effects

### Glassmorphism
```css
.glass {
  background: rgba(18, 22, 29, 0.7);
  backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, var(--bloodhound-red), var(--bloodhound-cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Scan Line Effect
```css
@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.scan-effect {
  position: relative;
  overflow: hidden;
}

.scan-effect::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--bloodhound-cyan), transparent);
  animation: scan 3s linear infinite;
  opacity: 0.3;
}
```

---

## 🎨 Rank Colors

### Top 3 Special Treatment
```css
.rank-1 {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.rank-2 {
  background: linear-gradient(135deg, #C0C0C0, #A8A8A8);
  color: #000;
  box-shadow: 0 0 15px rgba(192, 192, 192, 0.4);
}

.rank-3 {
  background: linear-gradient(135deg, #CD7F32, #B8860B);
  color: #FFF;
  box-shadow: 0 0 15px rgba(205, 127, 50, 0.4);
}
```

---

## 📱 Responsive Breakpoints

```css
/* Mobile first approach */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

---

## 🎯 Design Principles

1. **Dark & Sleek** - Deep backgrounds, high contrast
2. **Predatory Precision** - Sharp edges, clean lines
3. **Intelligence First** - Data-driven, clear hierarchy
4. **Smooth Interactions** - 100-200ms transitions, custom easing
5. **Glow Effects** - Subtle glows on interactive elements
6. **Color Coding** - Consistent profit/loss visualization
7. **Premium Feel** - Gradient accents, glassmorphism
8. **Performance** - GPU-accelerated animations only

---

*Bloodhound: Track smarter, trade faster* 🐕‍🦺
