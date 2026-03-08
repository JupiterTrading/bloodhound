/**
 * DELETE /api/keys/[id] — revoke an API key (soft-delete).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", userId); // scoped to owner

  if (error) return NextResponse.json({ error: "Failed to revoke key" }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
