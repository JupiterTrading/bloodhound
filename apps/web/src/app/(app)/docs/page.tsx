export const metadata = {
  title: "Docs — BLOODHOUND",
  description: "BLOODHOUND documentation and guides.",
};

export default function DocsPage() {
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
        Documentation
      </h1>
      <p style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: 1.6 }}>
        Full documentation is coming soon. In the meantime, explore the app to discover
        wallet intelligence, relationship mapping, and Bloodhound AI.
      </p>
    </div>
  );
}
