"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function SubmitKolPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  
  const [formData, setFormData] = useState({
    wallet_address: "",
    twitter_handle: "",
    display_name: "",
    evidence_text: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/v1/kol/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to submit");
      }

      setSuccess(true);
      setTimeout(() => router.push("/kols"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <div className="container py-20 text-center">
        <div className="animate-pulse text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  // Require sign in
  if (!isSignedIn) {
    return (
      <div className="container py-20 text-center">
        <div className="text-[48px] mb-4">🔐</div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Sign In Required
        </h2>
        <p className="text-[var(--text-muted)] mb-6">
          You need to be signed in to submit a KOL wallet
        </p>
        <Link href="/sign-in" className="btn btn-primary">
          Sign In
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="container py-20 text-center">
        <div className="text-[48px] mb-4">✅</div>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Submission Received!
        </h2>
        <p className="text-[var(--text-muted)] mb-6">
          Your KOL submission is pending review. We'll add it to the database once verified.
        </p>
        <Link href="/kols" className="btn btn-secondary">
          Browse KOLs
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Submit a KOL Wallet
        </h1>
        <p className="text-[14px] text-[var(--text-muted)]">
          Help grow the KOL database by submitting wallets with evidence. 
          Submissions are reviewed before being added.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6">
        {error && (
          <div className="mb-6 p-4 bg-[var(--error-subtle)] border border-[var(--error)] rounded-lg text-[var(--error)] text-[14px]">
            {error}
          </div>
        )}

        {/* Wallet Address */}
        <div className="mb-6">
          <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
            Wallet Address <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={formData.wallet_address}
            onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
            placeholder="Enter Solana wallet address..."
            className="input w-full font-mono"
            required
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            The primary wallet address for this KOL
          </p>
        </div>

        {/* Twitter Handle */}
        <div className="mb-6">
          <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
            Twitter/X Handle
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">@</span>
            <input
              type="text"
              value={formData.twitter_handle}
              onChange={(e) => setFormData({ ...formData, twitter_handle: e.target.value.replace("@", "") })}
              placeholder="username"
              className="input w-full pl-8"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            The KOL's Twitter/X handle (if known)
          </p>
        </div>

        {/* Display Name */}
        <div className="mb-6">
          <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g. punk6529"
            className="input w-full"
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            How this KOL should be displayed (defaults to Twitter handle)
          </p>
        </div>

        {/* Evidence */}
        <div className="mb-6">
          <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
            Evidence / Notes
          </label>
          <textarea
            value={formData.evidence_text}
            onChange={(e) => setFormData({ ...formData, evidence_text: e.target.value })}
            placeholder="How do you know this wallet belongs to this KOL? Include links to tweets, transactions, or other evidence..."
            className="input w-full min-h-[120px] resize-y"
            rows={5}
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Help us verify this submission by providing evidence
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <Link href="/kols" className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            ← Back to KOLs
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !formData.wallet_address}
            className="btn btn-primary"
          >
            {isSubmitting ? "Submitting..." : "Submit for Review"}
          </button>
        </div>
      </form>

      {/* Info box */}
      <div className="mt-6 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
        <h3 className="font-medium text-[var(--text-primary)] mb-2 text-[14px]">
          📋 Submission Guidelines
        </h3>
        <ul className="text-[13px] text-[var(--text-muted)] space-y-1.5">
          <li>• Only submit wallets you're confident belong to a specific person/entity</li>
          <li>• Provide evidence like tweets, Discord messages, or transaction patterns</li>
          <li>• Don't submit your own wallet unless you're a known KOL</li>
          <li>• Submissions are reviewed manually and may take 24-48 hours</li>
        </ul>
      </div>
    </div>
  );
}
