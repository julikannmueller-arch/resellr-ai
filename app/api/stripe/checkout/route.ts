import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe, priceIdForKey } from "@/lib/stripe";
import { planByKey } from "@/lib/pricing";
import { getOrCreateUser, setStripeCustomerId } from "@/lib/supabase-helpers";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  // ── Validate the requested plan (server-authoritative — never trust a price
  //    or amount from the client, only the plan key) ────────────────────────
  let key: string;
  try {
    key = (await request.json()).key;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const plan = planByKey(key);
  const priceId = priceIdForKey(key);
  if (!plan || !priceId) {
    return NextResponse.json({ error: "Unknown or unconfigured plan" }, { status: 400 });
  }

  const stripe = getStripe();

  // ── Resolve user + Stripe customer (create once, reuse after) ──────────────
  let customerId: string;
  try {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress ?? undefined;
    const user = await getOrCreateUser(userId, email ?? null);

    if (user.stripe_customer_id) {
      customerId = user.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerk_user_id: userId },
      });
      customerId = customer.id;
      await setStripeCustomerId(user.id, customerId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database error";
    console.error("[/api/stripe/checkout] customer setup failed:", msg);
    return NextResponse.json({ error: "Could not start checkout", code: "DB_ERROR" }, { status: 503 });
  }

  // Absolute URLs for Stripe redirects — prefer the request origin so it works
  // on localhost and prod without a hardcoded domain.
  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://resellr-ai-rho.vercel.app";

  // Metadata the webhook reads to know WHO to credit and HOW MUCH.
  const meta = { clerk_user_id: userId, plan_key: plan.key, credits: String(plan.credits) };

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: plan.kind === "subscription" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: meta,
      ...(plan.kind === "subscription"
        ? { subscription_data: { metadata: meta } }
        : {}),
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
      allow_promotion_codes: true,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/checkout]", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
