import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser, checkGenerationLimit } from "@/lib/supabase-helpers";
import { DEMO_GENERATION_LIMIT } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getOrCreateUser(userId);
    const { used, limit, unlimited } = checkGenerationLimit(user);
    return NextResponse.json({ used, limit, unlimited });
  } catch (err) {
    // Supabase not configured yet — return safe defaults so the UI doesn't break
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("[/api/user/status]", msg);
    return NextResponse.json(
      { used: 0, limit: DEMO_GENERATION_LIMIT, dbError: true },
      { status: 200 }
    );
  }
}
