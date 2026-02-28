# BLOODHOUND — New Machine Setup
# How to pick up this project with full context on another device

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/JupiterTrading/bloodhound
cd bloodhound
```

---

## Step 2 — Install Claude Code (if not already installed)

```bash
npm install -g @anthropic/claude-code
```

Then authenticate:
```bash
claude
```
Follow the login prompt to connect your Anthropic account.

---

## Step 3 — Load the memory files so Claude has full context

Claude Code stores project memory in a specific local folder keyed to the project path.
You need to copy the planning files there so the AI loads them automatically on every session.

**On Windows** — run this in Git Bash or PowerShell from inside the `bloodhound` folder:

```bash
# Get the encoded project path (run this to find it)
pwd
```

The memory folder path will be:
```
C:\Users\[YourUsername]\.claude\projects\C--Users-[YourUsername]-[path-to-bloodhound]\memory\
```

For example if you cloned to `C:\Users\John\CascadeProjects\bloodhound`, the path is:
```
C:\Users\John\.claude\projects\C--Users-John-CascadeProjects-bloodhound\memory\
```

Create the folder and copy the files:
```bash
mkdir -p ~/.claude/projects/C--Users-[YourUsername]-CascadeProjects-bloodhound/memory/
cp planning/MEMORY.md ~/.claude/projects/C--Users-[YourUsername]-CascadeProjects-bloodhound/memory/
cp planning/architecture.md ~/.claude/projects/C--Users-[YourUsername]-CascadeProjects-bloodhound/memory/
cp planning/roadmap.md ~/.claude/projects/C--Users-[YourUsername]-CascadeProjects-bloodhound/memory/
```

> Replace `[YourUsername]` with your actual Windows username.
> If you cloned to a different path, adjust accordingly.

---

## Step 4 — Open the project in Windsurf (or your editor)

Open the `bloodhound` folder in Windsurf. Start a new Claude Code session.

---

## Step 5 — Orient the new session

Paste this as your first message to any new Claude session on this project:

```
You are PLAN — project manager and prompt engineer for BLOODHOUND, a Solana
on-chain intelligence platform. Read planning/MEMORY.md, planning/architecture.md,
and planning/roadmap.md for full project context. Then read QUESTIONS.md to see
the current state of answered and unanswered requirements. Do not start any work
until you confirm you've read all four files.
```

That's it. The session will have full context and pick up exactly where the last one left off.

---

## What's in this repo right now

```
bloodhound/
├── SETUP.md                  ← this file
├── QUESTIONS.md              ← 90 pre-build questions (partially answered)
├── message.txt               ← core product descriptor and positioning
├── content.png               ← visual reference (Nexus site)
├── planning/
│   ├── MEMORY.md             ← project context, confirmed decisions, key facts
│   ├── architecture.md       ← full stack research (APIs, frontend, backend/AI)
│   └── roadmap.md            ← phase breakdown and sprint structure
└── [logo reference images]
```

---

## Current project state (as of last session)

- Product defined: BLOODHOUND — Solana on-chain intelligence platform
- Stack researched and decided (see planning/architecture.md)
- Feature list complete (see planning/MEMORY.md)
- Design decisions partially locked (see QUESTIONS.md Section A — answered)
- AI rules, feature scope, user stories still need answers (QUESTIONS.md Sections B–E)

**Next action:** Finish filling in QUESTIONS.md, then PLAN agent generates the three agent briefs:
- `DESIGN_BRIEF.md` → for UI/UX agent
- `BUILD_SPEC.md` → for BUILD agent
- `QA_PLAN.md` → for QA agent

---

## Team structure

| Agent | Role |
|---|---|
| **PLAN** | Project manager + prompt engineer. Writes briefs, manages sprints, defines rules |
| **BUILD** | Builds features and tech stack. Handles all backend, AI pipeline, database |
| **UI/UX** | All visual design, component design, site structure and UX |
| **QA** | Site testing, user story validation, feature verification |
