/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for subscription management.
 * Returns { url } — the hosted portal URL. Client redirects immediately.
 *
 * Requires the user to have stripe_customer_id set in Supabase (set at checkout).
 * Portal lets users: cancel, update payment method, view invoices.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-02-24.acacia",
});

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabase();
  const { data: user } = await db
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
