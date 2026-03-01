import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Generates a short-lived Ably token for the authenticated user.
 * The client subscribes to alerts:{userId} using this token.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ablyKey = process.env.ABLY_API_KEY;
  if (!ablyKey) {
    return NextResponse.json({ error: "Ably not configured" }, { status: 503 });
  }

  try {
    // Ably REST token request — scoped to subscribe only on alerts:{userId}
    const [keyName, keySecret] = ablyKey.split(":", 2);
    const tokenRequest = {
      keyName,
      ttl: 3600 * 1000, // 1 hour in ms
      clientId: userId,
      capability: JSON.stringify({ [`alerts:${userId}`]: ["subscribe"] }),
      timestamp: Date.now(),
      nonce: Math.random().toString(36).slice(2),
    };

    // Sign the token request
    const signatureString = [
      tokenRequest.keyName,
      tokenRequest.ttl,
      tokenRequest.capability,
      tokenRequest.clientId,
      tokenRequest.timestamp,
      tokenRequest.nonce,
      "",
    ].join("\n");

    const { createHmac } = await import("crypto");
    const mac = createHmac("sha256", keySecret)
      .update(signatureString)
      .digest("base64");

    return NextResponse.json({ ...tokenRequest, mac });
  } catch (err) {
    console.error("[ably-token]", err);
    return NextResponse.json({ error: "Token generation failed" }, { status: 500 });
  }
}
