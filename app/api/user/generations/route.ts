import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser, getUserGenerations } from "@/lib/supabase-helpers";

export async function GET() {
  // Auth via Clerk server-side — user identity never comes from the request
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getOrCreateUser(userId);
    const generations = await getUserGenerations(user.id);
    return NextResponse.json({ generations });
  } catch (err) {
    console.error("[/api/user/generations]", err);
    return NextResponse.json({ generations: [], dbError: true });
  }
}
