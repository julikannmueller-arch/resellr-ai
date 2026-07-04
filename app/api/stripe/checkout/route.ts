import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe, STRIPE_PRICES } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tier } = (await request.json()) as { tier: "pro" | "unlimited" };
  const priceId = STRIPE_PRICES[tier];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const stripe = getStripe();
  const supabase = getSupabase();

  const { data: user } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("clerk_user_id", userId)
    .single();

  let customerId = user?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;
    await supabase
      .from("users")
      .upsert({ clerk_user_id: userId, stripe_customer_id: customerId }, { onConflict: "clerk_user_id" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { clerk_user_id: userId },
    subscription_data: { metadata: { clerk_user_id: userId } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
