import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe, tierFromPriceId } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = getStripe();
  const supabase = getSupabase();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[webhook] Invalid signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[webhook] event:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerk_user_id;
      if (!clerkUserId || !session.subscription) return new Response("OK");

      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const tier = tierFromPriceId(sub.items.data[0].price.id);

      await supabase.from("users").upsert(
        {
          clerk_user_id: clerkUserId,
          subscription_tier: tier,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: sub.id,
        },
        { onConflict: "clerk_user_id" }
      );
      console.log("[webhook] upgraded", clerkUserId, "to", tier);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const tier = tierFromPriceId(sub.items.data[0].price.id);
      await supabase
        .from("users")
        .update({ subscription_tier: tier })
        .eq("stripe_subscription_id", sub.id);
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("users")
        .update({ subscription_tier: "free", stripe_subscription_id: null })
        .eq("stripe_subscription_id", sub.id);
    }
  } catch (err) {
    console.error("[webhook] handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("OK");
}
