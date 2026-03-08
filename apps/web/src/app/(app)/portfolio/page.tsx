"use client";

import { useUser, SignInButton } from "@clerk/nextjs";
import { PortfolioView } from "@/components/portfolio/PortfolioView";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PortfolioPage() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
        <Skeleton style={{ height: "24px", width: "180px", marginBottom: "24px" }} />
        <Skeleton style={{ height: "80px", borderRadius: "8px", marginBottom: "20px" }} />
        <Skeleton style={{ height: "320px", borderRadius: "8px" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div style={{ maxWidth: "500px", margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
          Sign in to view your portfolio
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "24px" }}>
          Track your own wallets to see combined holdings, KOL overlap, and AI analysis.
        </p>
        <SignInButton mode="modal">
          <button
            style={{
              padding: "10px 24px",
              background: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  return <PortfolioView />;
}
