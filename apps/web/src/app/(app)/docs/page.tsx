import Link from "next/link";

export const metadata = {
  title: "Docs — BLOODHOUND",
  description: "BLOODHOUND documentation — getting started, key concepts, and feature guides.",
};

// ── Section data ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "getting-started",       label: "Getting Started" },
  { id: "key-concepts",          label: "Key Concepts",       parent: true },
  { id: "wallet-classification", label: "Wallet Classification" },
  { id: "side-wallets",          label: "Side Wallet Detection" },
  { id: "signals",               label: "Signals" },
  { id: "bloodhound-ai",         label: "Bloodhound AI" },
  { id: "feature-guides",        label: "Feature Guides",     parent: true },
  { id: "explorer",              label: "Explorer" },
  { id: "wallet-pages",          label: "Wallet Pages" },
  { id: "intelligence",          label: "Intelligence" },
  { id: "graph-view",            label: "Graph View" },
  { id: "tracked-wallets",       label: "Tracked Wallets" },
  { id: "portfolio",             label: "Portfolio" },
  { id: "events",                label: "Events" },
  { id: "faq",                   label: "FAQ" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "40px 32px",
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: "48px",
        alignItems: "start",
      }}
    >
      {/* Sidebar */}
      <nav
        style={{
          position: "sticky",
          top: "72px",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Documentation
        </div>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              fontSize: s.parent ? "11px" : "12px",
              fontWeight: s.parent ? 600 : 400,
              color: s.parent ? "var(--text-secondary)" : "var(--text-muted)",
              textDecoration: "none",
              padding: s.parent ? "8px 0 2px" : "4px 0 4px 10px",
              display: "block",
              transition: "color 80ms",
              marginTop: s.parent ? "8px" : 0,
            }}
          >
            {s.label}
          </a>
        ))}
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <Link
            href="/api-docs"
            style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", display: "block", marginBottom: "8px" }}
          >
            API Reference →
          </Link>
          <a
            href="mailto:support@bloodhound.xyz"
            style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none" }}
          >
            Get help
          </a>
        </div>
      </nav>

      {/* Content */}
      <main style={{ minWidth: 0 }}>

        {/* ── Getting Started ─────────────────────────────────────────────── */}
        <Section id="getting-started" title="Getting Started">
          <P>
            BLOODHOUND is an on-chain intelligence platform for Solana. It combines a block explorer,
            wallet intelligence layer, and AI query interface into a single tool built for serious
            on-chain analysts, traders, and researchers.
          </P>
          <P>No account is needed to explore. Sign up for free to track wallets, set alerts, and
          run Bloodhound AI queries.</P>

          <H3>Quick start</H3>
          <OL>
            <li>Paste any wallet address, token mint, transaction signature, or program ID into the search bar.</li>
            <li>Navigate to the wallet page to see classification labels, token holdings, NFTs, transaction history, and the AI intelligence summary.</li>
            <li>Click <strong>Open Graph</strong> to visualise the wallet's on-chain relationships.</li>
            <li>Use <strong>Bloodhound AI</strong> to ask natural-language questions: <em>"Does this wallet send to Binance?"</em>, <em>"Who funded this address?"</em>, <em>"What tokens are KOLs accumulating?"</em></li>
            <li>Sign in and click <strong>Track</strong> on any wallet to receive real-time alerts.</li>
          </OL>

          <H3>What BLOODHOUND indexes</H3>
          <UL>
            <li>All Solana mainnet transfers and swaps (via Helius webhooks)</li>
            <li>Token trades from Raydium, Orca, Jupiter, Pump.fun, and Meteora</li>
            <li>SOL balances and SPL token holdings (live via Birdeye)</li>
            <li>NFT holdings (via Helius DAS)</li>
            <li>~56 known wallets (exchanges, funds, KOLs) with human-readable labels</li>
          </UL>
        </Section>

        {/* ── Key Concepts ────────────────────────────────────────────────── */}
        <Section id="key-concepts" title="Key Concepts" label />

        <Section id="wallet-classification" title="Wallet Classification">
          <P>
            Every wallet is automatically classified by a parallel heuristic engine. Labels are
            applied when confidence exceeds a threshold and are cached for 24 hours.
          </P>
          <Table
            headers={["Label", "Trigger", "Confidence"]}
            rows={[
              ["whale_wallet", "Portfolio ≥ $50k USD or 30d SOL volume ≥ 2,000 SOL", "0.80–0.90"],
              ["smart_money", "Win rate > 60% on ≥ 20 closed token positions", "0.65–0.95"],
              ["deployer", "Created token mints or deployed programs", "1.00"],
              ["sniper", "Bought a token when fewer than 100 trades existed", "0.85"],
              ["bot", "≥ 300 txs in 24h, or one program used > 80% of the time", "0.70"],
              ["bundler", "Jito bundle usage ≥ 3 times", "0.80"],
              ["lp_provider", "ADD/REMOVE_LIQUIDITY or CREATE_POOL interactions", "0.90"],
              ["wash_trader", "≥ 3 tokens with ≥ 3 buys AND ≥ 3 sells in opposite directions", "0.75"],
              ["exchange", "≥ 1,000 unique counterparties in 24h", "0.70"],
              ["KOL / FUND / EXCHANGE", "Matched against the known_wallets database", "1.00"],
            ]}
          />
          <P>Multiple labels can apply to a single wallet simultaneously.</P>
        </Section>

        <Section id="side-wallets" title="Side Wallet Detection">
          <P>
            BLOODHOUND uses behavioral fingerprinting to detect suspected side wallets — addresses
            controlled by the same entity. Five signals are weighted and summed:
          </P>
          <Table
            headers={["Signal", "Weight", "Description"]}
            rows={[
              ["fund_flow", "0.40", "Direct SOL transfers between the two addresses"],
              ["common_funder", "0.35", "Both wallets funded by the same source address"],
              ["token_overlap", "0.25", "High overlap in tokens traded within the same time window"],
              ["timing_sync", "0.20", "Transactions within seconds of each other across both wallets"],
              ["dex_preference", "0.15", "Same DEX used for ≥ 80% of trades"],
            ]}
          />
          <P>
            Pairs with a combined confidence ≥ 0.50 are surfaced in the Side Wallets panel.
            Pairs ≥ 0.60 receive a Claude-generated explanation. Signed-in users can dispute
            incorrect relationships — each dispute reduces confidence by 0.05.
          </P>
          <P>
            The full identity cluster for a wallet (all suspected side wallets, combined holdings,
            combined events) is available at <code>/entity/{"{address}"}</code>.
          </P>
        </Section>

        <Section id="signals" title="Signals">
          <P>
            Signals are automatically generated intelligence events detected from on-chain activity.
            Each signal has a type, confidence level, and wallet address.
          </P>
          <Table
            headers={["Signal Type", "Confidence", "Description"]}
            rows={[
              ["kol_pre_buy", "CONFIRMED", "Known KOL bought a token before tweeting about it"],
              ["abnormal_inflow", "PROBABLE", "Large SOL or token inflow relative to wallet history"],
              ["new_token_deploy", "CONFIRMED", "Wallet deployed a new token mint"],
              ["smart_money_entry", "PROBABLE", "Smart money wallet entered a new position"],
              ["wash_trade_detected", "SUSPECTED", "Rapid buy/sell cycling of the same token"],
              ["sniper_active", "CONFIRMED", "Known sniper wallet bought within first 100 trades of a token"],
              ["bundle_detected", "SUSPECTED", "Jito bundle activity on a new token launch"],
            ]}
          />
          <P>
            Signals are generated in real-time as transactions arrive via Helius webhooks and are
            also triggered during the 5-minute background wallet polling cycle.
            The Signals feed supports filtering by type, confidence level, and specific wallet.
          </P>
        </Section>

        <Section id="bloodhound-ai" title="Bloodhound AI">
          <P>
            Bloodhound AI is a natural language interface backed by Claude. It can answer questions
            about any Solana wallet, token, or on-chain relationship — and take actions on your behalf.
          </P>
          <H3>What you can ask</H3>
          <UL>
            <li>Wallet analysis: <em>"Summarise wallet 5tzF…"</em>, <em>"Who funded this address?"</em></li>
            <li>Relationship queries: <em>"Does this wallet send to Binance?"</em>, <em>"What wallets does it interact with most?"</em></li>
            <li>Token intelligence: <em>"Which KOLs hold $WIF?"</em>, <em>"Is there wash trading on this token?"</em></li>
            <li>Leaderboard queries: <em>"Who are the top performing traders this week?"</em></li>
            <li>Current events: <em>"What was the $TRUMP launch?"</em> (uses web search)</li>
          </UL>
          <H3>Agentic actions</H3>
          <P>
            The AI can also take actions: track a wallet, add a label, create an alert rule, or open
            the relationship graph — directly from the response.
          </P>
          <H3>Confidence levels</H3>
          <UL>
            <li><strong>CONFIRMED</strong> — deterministic on-chain evidence (e.g. direct transfer found)</li>
            <li><strong>PROBABLE</strong> — strong circumstantial evidence (e.g. behavioral overlap)</li>
            <li><strong>SUSPECTED</strong> — weak signal, possible false positive</li>
            <li><strong>UNKNOWN</strong> — insufficient data</li>
          </UL>
          <P>Free accounts get 10 AI queries per day. Pro accounts get unlimited queries.</P>
        </Section>

        {/* ── Feature Guides ──────────────────────────────────────────────── */}
        <Section id="feature-guides" title="Feature Guides" label />

        <Section id="explorer" title="Explorer">
          <P>
            The Explorer is the universal search entry point. It accepts wallet addresses, token
            mints, transaction signatures, program IDs, and Twitter handles (prefixed with @).
          </P>
          <P>
            Smart routing: if the query is a valid Solana address, it routes directly to the wallet
            or token page. Otherwise it falls back to full-text search across the known wallet
            and token databases.
          </P>
          <P>
            Autocomplete suggestions appear after 2 characters. Recent searches are stored locally
            (up to 6 items, cleared on browser data reset).
          </P>
        </Section>

        <Section id="wallet-pages" title="Wallet Pages">
          <P>Every wallet page at <code>/wallet/{"{address}"}</code> shows:</P>
          <UL>
            <li><strong>Header</strong> — Classification labels, known wallet identity (if in DB), SOL balance, portfolio USD, total txs, volume, first/last active</li>
            <li><strong>Intelligence Summary</strong> — AI-generated narrative (Claude Sonnet), cached 24h</li>
            <li><strong>Token Holdings</strong> — Live Birdeye portfolio, sorted by USD value</li>
            <li><strong>NFT Holdings</strong> — Helius DAS, image grid with Magic Eden links</li>
            <li><strong>Transaction History</strong> — Paginated, filterable by type and direction</li>
            <li><strong>KOL Twitter Card</strong> — Profile + last 3 tweets (known wallets with twitter_handle only)</li>
            <li><strong>Event Involvement</strong> — Historical events this wallet participated in</li>
            <li><strong>Top Counterparties</strong> — Highest-volume on-chain counterparties</li>
            <li><strong>Potential Side Wallets</strong> — Behavioral clustering results with confidence scores</li>
          </UL>
        </Section>

        <Section id="intelligence" title="Intelligence">
          <P>
            The Intelligence page (<code>/intelligence</code>) is for rapid wallet analysis.
            Enter any address for an instant AI summary with classification and key stats.
          </P>
          <P>It also surfaces:</P>
          <UL>
            <li><strong>KOL Leaderboard</strong> — Top KOLs and traders ranked by 1d/7d/30d PnL (Birdeye data)</li>
            <li><strong>Trending Tokens</strong> — Tokens with highest trade count in the last 24h</li>
            <li><strong>Event Timeline</strong> — Chronological view of known historical on-chain events</li>
            <li><strong>Notable Addresses</strong> — Featured known wallets from the database</li>
          </UL>
        </Section>

        <Section id="graph-view" title="Graph View">
          <P>
            The Graph view at <code>/graph/{"{address}"}</code> renders the wallet's on-chain
            relationship network. Each node is a wallet; each edge represents value flow with
            weight proportional to interaction count and volume.
          </P>
          <UL>
            <li><strong>Free tier</strong> — 2 hops from the seed wallet</li>
            <li><strong>Pro</strong> — Up to 5 hops</li>
            <li>Nodes are colour-coded by classification label</li>
            <li>Known wallets (exchanges, KOLs, etc.) are labelled</li>
            <li>Graph data can be exported as CSV or SVG</li>
          </UL>
        </Section>

        <Section id="tracked-wallets" title="Tracked Wallets">
          <P>
            Track up to 50 wallets on the free tier (unlimited on Pro). Each tracked wallet can have
            a custom label, tags, and group membership.
          </P>
          <H3>Alert rules</H3>
          <P>Set alerts on any tracked wallet for:</P>
          <UL>
            <li><strong>any_tx</strong> — any incoming or outgoing transaction</li>
            <li><strong>sends_to</strong> — sends to a specific address</li>
            <li><strong>receives_from</strong> — receives from a specific address</li>
            <li><strong>balance_threshold</strong> — SOL balance crosses a threshold</li>
          </UL>
          <P>
            Alert delivery: in-app toast (Ably real-time) and email (Resend) on free tier.
            Pro adds Telegram and webhook delivery.
          </P>
          <H3>Portfolio wallets</H3>
          <P>
            Mark any tracked wallet as <strong>is_own</strong> to include it in your Portfolio view,
            which aggregates holdings across all own wallets and shows KOL overlap per holding.
          </P>
        </Section>

        <Section id="portfolio" title="Portfolio">
          <P>
            The Portfolio page (<code>/portfolio</code>) aggregates all wallets you've marked as
            own into a single holdings view. It shows:
          </P>
          <UL>
            <li>Combined token holdings with live USD values</li>
            <li>KOL overlap per holding — how many known KOL wallets also hold the same token</li>
            <li>Total portfolio value across all own wallets</li>
            <li><strong>AI Report</strong> — Claude generates a narrative analysis of your holdings, KOL overlap signals, and recent on-chain activity</li>
          </UL>
        </Section>

        <Section id="events" title="Events">
          <P>
            The Events system tracks significant historical on-chain events: token launches, hacks,
            airdrops, and protocol collapses. Each event has a significance score (1–10) and a
            list of wallets that participated.
          </P>
          <P>
            Events are surfaced in three places:
          </P>
          <UL>
            <li><strong>Event Timeline</strong> — on the Intelligence page</li>
            <li><strong>Wallet Event Panel</strong> — on each wallet page, showing events that wallet was involved in</li>
            <li><strong>Entity Profile</strong> — combined events across all cluster members</li>
          </UL>
          <P>
            New events can be automatically detected by the AI pipeline when a cluster of signals
            on a new token reaches a confidence threshold. CONFIRMED events are auto-published;
            PROBABLE events go to the admin review queue.
          </P>
        </Section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <Section id="faq" title="FAQ">
          <FAQ q="How fresh is the data?">
            Top 25 known wallets are updated in real-time via Helius webhooks. All other tracked
            wallets are polled every 5 minutes via a background worker. Token prices are live
            (Birdeye, 60s cache). Classification labels are cached for 24 hours.
          </FAQ>
          <FAQ q="How far back does transaction history go?">
            Free and anonymous users see the last 90 days. Pro subscribers have access to full
            history. The underlying ClickHouse database stores all indexed transactions indefinitely.
          </FAQ>
          <FAQ q="Can I search by Twitter handle?">
            Yes — search <code>@handle</code> in the Explorer. BLOODHOUND maps Twitter handles to
            on-chain addresses for known wallets in the database.
          </FAQ>
          <FAQ q="How does the AI confidence work?">
            CONFIRMED means deterministic on-chain evidence (e.g. a direct transfer was found).
            PROBABLE means strong circumstantial evidence. SUSPECTED means a weak signal with
            possible false positives. UNKNOWN means insufficient data was available.
          </FAQ>
          <FAQ q="What is KOL overlap?">
            KOL (Key Opinion Leader) overlap shows how many known influencer wallets also hold a
            given token. High KOL overlap is a signal that influential traders are positioned in
            that token — often before they tweet about it.
          </FAQ>
          <FAQ q="How do I get an API key?">
            Upgrade to Pro on the{" "}
            <Link href="/pricing" style={{ color: "var(--accent)", textDecoration: "none" }}>Pricing page</Link>,
            then go to{" "}
            <Link href="/billing" style={{ color: "var(--accent)", textDecoration: "none" }}>Billing</Link>{" "}
            and generate a key. API keys give you 10,000 requests per day against all public endpoints.
            See the <Link href="/api-docs" style={{ color: "var(--accent)", textDecoration: "none" }}>API Reference</Link> for details.
          </FAQ>
          <FAQ q="Is BLOODHOUND only for Solana?">
            Yes — Solana mainnet only for v1. The architecture is chain-aware and EVM support is
            on the roadmap.
          </FAQ>
          <FAQ q="How do I report a mis-classified wallet or incorrect side-wallet link?">
            On any wallet page, use the <strong>Dispute</strong> button next to a suspected side
            wallet entry. Each dispute reduces the confidence score by 0.05. For known wallet
            label corrections, email{" "}
            <a href="mailto:data@bloodhound.xyz" style={{ color: "var(--accent)", textDecoration: "none" }}>
              data@bloodhound.xyz
            </a>.
          </FAQ>
        </Section>

      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  id,
  title,
  label,
  children,
}: {
  id: string;
  title: string;
  label?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: label ? "8px" : "48px", scrollMarginTop: "80px" }}>
      {label ? (
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            paddingTop: "32px",
            paddingBottom: "8px",
            borderBottom: "1px solid var(--border)",
            marginBottom: "24px",
          }}
        >
          {title}
        </div>
      ) : (
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: "16px",
          }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--text-primary)",
        marginTop: "20px",
        marginBottom: "8px",
      }}
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "14px",
        color: "var(--text-secondary)",
        lineHeight: 1.7,
        marginBottom: "12px",
      }}
    >
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul
      style={{
        paddingLeft: "20px",
        marginBottom: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {children}
    </ul>
  );
}

function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol
      style={{
        paddingLeft: "20px",
        marginBottom: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        fontSize: "14px",
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}
    >
      {children}
    </ol>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-base)" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  padding: "9px 14px",
                  textAlign: "left",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "9px 14px",
                    fontSize: "12px",
                    color: ci === 0 ? "var(--text-primary)" : "var(--text-secondary)",
                    fontFamily: ci === 0 ? "JetBrains Mono, monospace" : undefined,
                    fontWeight: ci === 0 ? 500 : 400,
                    background: "var(--bg-surface)",
                    verticalAlign: "top",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: "6px",
        }}
      >
        {q}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </div>
  );
}
