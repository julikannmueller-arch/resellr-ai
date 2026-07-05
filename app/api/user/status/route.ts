import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/supabase-helpers";
import { STARTING_CREDITS } from "@/lib/pricing";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getOrCreateUser(userId);
    return NextResponse.json({
      credits: user.credits ?? 0,
      unlimited: user.is_unlimited === true,
    });
  } catch (err) {
    // Supabase not configured yet — return safe defaults so the UI doesn't break
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("[/api/user/status]", msg);
    return NextResponse.json(
      { credits: STARTING_CREDITS, unlimited: false, dbError: true },
      { status: 200 }
    );
  }
}
