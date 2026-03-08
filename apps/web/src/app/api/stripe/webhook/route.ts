/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events to sync subscription state with Supabase.
 *
 * Events handled:
 *   checkout.session.completed          → set users.tier = 'pro', store stripe_customer_id
 *   customer.subscription.deleted       → set users.tier = 'free'
 *   customer.subscription.updated       → sync tier based on subscription status
 *
 * Verify via Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
 * Register this URL in the Stripe dashboard: https://bloodhound.xyz/api/stripe/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-02-24.acacia",
});

// Service-role client — server-only, never shipped to the browser
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerk_user_id ?? session.client_reference_id;
      const customerId = session.customer as string | null;
      if (!clerkUserId) break;

      await db
        .from("users")
        .update({
          tier: "pro",
          ...(customerId ? { stripe_customer_id: customerId } : {}),
        })
        .eq("id", clerkUserId);

      console.log(`[stripe/webhook] upgraded user ${clerkUserId} to pro`);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await db
        .from("users")
        .update({ tier: "free" })
        .eq("stripe_customer_id", customerId);

      console.log(`[stripe/webhook] downgraded customer ${customerId} to free`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const active = sub.status === "active" || sub.status === "trialing";

      await db
        .from("users")
        .update({ tier: active ? "pro" : "free" })
        .eq("stripe_customer_id", customerId);

      break;
    }

    default:
      // Ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}
