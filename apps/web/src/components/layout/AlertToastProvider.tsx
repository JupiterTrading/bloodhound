"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import * as Ably from "ably";

interface AlertToast {
  id: string;
  wallet: string;
  alertType: string;
  txCount?: number;
}

/**
 * Subscribes to Ably alerts:{userId} channel when signed in.
 * Renders a toast stack in the bottom-right corner.
 */
export function AlertToastProvider() {
  const { user, isSignedIn } = useUser();
  const [toasts, setToasts] = useState<AlertToast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;

    let client: Ably.Realtime | null = null;

    async function connect() {
      try {
        client = new Ably.Realtime({
          authUrl: "/api/ably-token",
          authMethod: "POST",
          clientId: user!.id,
        });

        const channel = client.channels.get(`alerts:${user!.id}`);

        channel.subscribe("alert", (message) => {
          const data = message.data as {
            alert_type?: string;
            wallet?: string;
            tx_count?: number;
          };
          const toast: AlertToast = {
            id: Math.random().toString(36).slice(2),
            wallet: data.wallet ?? "",
            alertType: data.alert_type ?? "alert",
            txCount: data.tx_count,
          };
          setToasts((prev) => [...prev.slice(-4), toast]); // max 5 toasts
          // Auto-dismiss after 8 seconds
          setTimeout(() => dismiss(toast.id), 8000);
        });
      } catch (err) {
        console.warn("[AlertToastProvider] Ably connection failed:", err);
      }
    }

    connect();

    return () => {
      client?.close();
    };
  }, [isSignedIn, user?.id, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "48px", // above status bar
        right: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 200,
        maxWidth: "320px",
      }}
    >
      {toasts.map((toast) => (
        <AlertToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function AlertToastCard({
  toast,
  onDismiss,
}: {
  toast: AlertToast;
  onDismiss: (id: string) => void;
}) {
  const ALERT_LABELS: Record<string, string> = {
    any_tx: "Transaction detected",
    sends_to: "Outgoing transfer",
    receives_from: "Incoming transfer",
    balance_threshold: "Large transfer",
    token_trade: "Token trade",
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: "8px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        animation: "fadeSlideIn 150ms ease-out",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "var(--accent)",
          flexShrink: 0,
          marginTop: "3px",
          animation: "pulse 2s infinite",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "2px",
          }}
        >
          {ALERT_LABELS[toast.alertType] ?? "Alert triggered"}
        </div>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          {toast.wallet.slice(0, 8)}...{toast.wallet.slice(-6)}
          {toast.txCount && toast.txCount > 1 ? ` · ${toast.txCount} txs` : ""}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "14px",
          padding: "0",
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
