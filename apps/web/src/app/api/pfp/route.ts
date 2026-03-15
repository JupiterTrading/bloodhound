/**
 * PFP image proxy — resolves KOL profile pictures.
 * Tries Twitter API first (via backend), falls back to generating a placeholder.
 * Usage: /api/pfp?handle=notdecu
 */

import { NextRequest, NextResponse } from "next/server";

const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// In-memory cache for resolved PFP URLs (server-side, survives across requests)
const pfpCache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 3600_000; // 1 hour

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ error: "handle required" }, { status: 400 });
  }

  const key = handle.toLowerCase();

  // Check cache
  const cached = pfpCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    if (cached.url) {
      return NextResponse.redirect(cached.url);
    }
    return NextResponse.json({ url: null });
  }

  // Try the backend KOL social endpoint which uses Twitter API
  try {
    const res = await fetch(`${API_URL}/v1/kol/profiles/${handle}/social`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      const pfpUrl = data?.profile?.profile_image_url;
      if (pfpUrl) {
        pfpCache.set(key, { url: pfpUrl, ts: Date.now() });
        return NextResponse.redirect(pfpUrl);
      }
    }
  } catch {
    // Backend unavailable or timeout — fall through
  }

  // No PFP available
  pfpCache.set(key, { url: null, ts: Date.now() });
  return NextResponse.json({ url: null }, { status: 404 });
}
