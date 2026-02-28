export const metadata = {
  title: "API — BLOODHOUND",
  description: "BLOODHOUND public API reference.",
};

export default function ApiDocsPage() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "64px 32px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "16px",
          letterSpacing: "-0.02em",
        }}
      >
        Public API
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        The BLOODHOUND public API is under development. Programmatic access to wallet
        intelligence, signals, and relationship data will be available to Pro subscribers.
      </p>
    </div>
  );
}
