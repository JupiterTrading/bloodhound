/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro subscription.
 * Returns { url } — the hosted Stripe checkout page URL.
 * Client redirects to this URL immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    client_reference_id: userId,          // Clerk user ID — used in webhook to update tier
    metadata: { clerk_user_id: userId },
    success_url: `${appUrl}/billing?upgraded=true`,
    cancel_url: `${appUrl}/pricing`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { clerk_user_id: userId },
    },
  });

  return NextResponse.json({ url: session.url });
}
