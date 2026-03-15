"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trendingApi, trackedApi } from "@/lib/api";

interface PriceTick {
  symbol: string;
  price: string;
  change: number;
  volume?: string;
}

interface WalletAlert {
  id: string;
  label: string;
  action: "BUY" | "SELL";
  token: string;
  amount: string;
  time: string;
}

const MAJOR_TOKENS = ["SOL", "BTC", "ETH", "BONK", "WIF", "JUP"];

export function BloombergNav() {
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch trending tokens for price data
  const { data: trendingData } = useQuery({
    queryKey: ["bloomberg-prices"],
    queryFn: () => trendingApi.tokens(20),
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 15000,
  });

  // Fetch tracked wallet feed for alerts
  const { data: feedData } = useQuery({
    queryKey: ["wallet-alerts"],
    queryFn: () => trackedApi.feed(10, 0),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Build price tickers from trending data
  const priceTicks: PriceTick[] = trendingData?.tokens?.slice(0, 8).map(t => ({
    symbol: t.symbol,
    price: t.price_usd < 0.01 
      ? `$${t.price_usd.toFixed(6)}` 
      : t.price_usd < 1 
        ? `$${t.price_usd.toFixed(4)}`
        : `$${t.price_usd.toFixed(2)}`,
    change: t.price_change_pct,
    volume: t.volume_24h_usd ? formatVolume(t.volume_24h_usd) : undefined,
  })) || [];

  // Build wallet alerts from feed
  const walletAlerts: WalletAlert[] = feedData?.feed?.slice(0, 5).map((t, i) => ({
    id: t.tx_signature,
    label: t.from_known?.label || t.from_address.slice(0, 6),
    action: "BUY" as const,
    token: t.token_mint === "SOL" ? "SOL" : t.token_mint.slice(0, 4),
    amount: formatUsd(t.amount_usd),
    time: timeAgo(t.block_time),
  })) || [];

  // Cycle through alerts
  useEffect(() => {
    if (walletAlerts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAlertIndex(i => (i + 1) % walletAlerts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [walletAlerts.length]);

  const currentAlert = walletAlerts[currentAlertIndex];

  if (!isClient) return null;

  return (
    <div className="bloomberg-nav fixed top-0 left-0 right-0 h-8 bg-[#0c0a0a] border-b border-[var(--border-subtle)] z-[300] flex items-center overflow-hidden">
      {/* Price Ticker - scrolling marquee */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
          {/* Double the items for seamless loop */}
          {[...priceTicks, ...priceTicks].map((tick, i) => (
            <PriceTickItem key={`${tick.symbol}-${i}`} tick={tick} />
          ))}
          {priceTicks.length === 0 && (
            <>
              <PlaceholderTick symbol="SOL" />
              <PlaceholderTick symbol="BTC" />
              <PlaceholderTick symbol="ETH" />
              <PlaceholderTick symbol="BONK" />
              <PlaceholderTick symbol="WIF" />
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--border)] mx-2" />

      {/* Wallet Alerts Section */}
      <div className="shrink-0 flex items-center gap-2 px-3 min-w-[280px]">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] animate-pulse">
          LIVE
        </span>
        {currentAlert ? (
          <div className="flex items-center gap-2 text-[11px] font-mono animate-fade-in" key={currentAlert.id}>
            <span className="text-[var(--text-secondary)]">{currentAlert.label}</span>
            <span className={currentAlert.action === "BUY" ? "text-[var(--success)]" : "text-[var(--error)]"}>
              {currentAlert.action}
            </span>
            <span className="text-[var(--text-primary)] font-medium">{currentAlert.amount}</span>
            <span className="text-[var(--text-muted)]">{currentAlert.token}</span>
            <span className="text-[var(--text-faint)]">{currentAlert.time}</span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Watching tracked wallets...
          </span>
        )}
      </div>
    </div>
  );
}

function PriceTickItem({ tick }: { tick: PriceTick }) {
  const isPositive = tick.change >= 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1 group cursor-pointer hover:bg-[var(--bg-hover)] transition-colors rounded">
      <span className="text-[11px] font-bold text-[var(--text-primary)]">{tick.symbol}</span>
      <span className="text-[11px] font-mono text-[var(--text-secondary)]">{tick.price}</span>
      <span className={`text-[10px] font-mono font-medium ${isPositive ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
        {isPositive ? "+" : ""}{tick.change.toFixed(2)}%
      </span>
      {tick.volume && (
        <span className="text-[9px] font-mono text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
          Vol {tick.volume}
        </span>
      )}
    </div>
  );
}

function PlaceholderTick({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="text-[11px] font-bold text-[var(--text-muted)]">{symbol}</span>
      <span className="text-[11px] font-mono text-[var(--text-faint)]">--</span>
    </div>
  );
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
