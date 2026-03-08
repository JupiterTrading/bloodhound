/**
 * GET  /api/keys — list the signed-in user's active API keys
 * POST /api/keys — generate a new API key (Pro only)
 *
 * Uses Clerk auth() server-side — no token forwarding needed.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,name,key_prefix,created_at,last_used_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();

  // Pro gate — check tier in users table
  const { data: user } = await supabase
    .from("users")
    .select("tier")
    .eq("id", userId)
    .single();

  if (!user || !["pro", "enterprise"].includes(user.tier ?? "free")) {
    return NextResponse.json(
      { error: "API key access requires a Pro subscription." },
      { status: 403 }
    );
  }

  // Max 5 active keys per user
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);

  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Maximum of 5 active API keys allowed. Revoke an existing key first." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name: string = (body.name as string)?.slice(0, 60) || "Default";

  // Generate key: bh_ + 32 hex chars (35 chars total)
  const rawKey = "bh_" + crypto.randomBytes(16).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12); // "bh_" + 9 chars

  const { data, error } = await supabase
    .from("api_keys")
    .insert({ user_id: userId, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select("id,name,key_prefix,created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create key" }, { status: 500 });

  // Return the plaintext key exactly once — never stored
  return NextResponse.json({ ...data, key: rawKey });
}
