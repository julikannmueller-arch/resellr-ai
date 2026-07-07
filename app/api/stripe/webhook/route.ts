import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import {
  grantCredits,
  markStripeEventProcessed,
  getUserByClerkId,
  getUserByStripeCustomer,
  setSubscription,
} from "@/lib/supabase-helpers";

// Stripe needs the RAW body for signature verification — never parse it first.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get("stripe-signature");
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    console.error("[stripe/webhook] signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotency: atomic first-writer-wins. Duplicate/replayed deliveries skip.
  let fresh: boolean;
  try {
    fresh = await markStripeEventProcessed(event.id, event.type);
  } catch (err) {
    console.error("[stripe/webhook] idempotency check failed:", err);
    return NextResponse.json({ error: "temporary" }, { status: 503 }); // let Stripe retry
  }
  if (!fresh) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerk_user_id;
        if (session.mode === "payment") {
          // One-time credit pack → grant now (subscriptions grant via invoice.paid).
          const credits = parseInt(session.metadata?.credits ?? "0", 10);
          if (clerkId && credits > 0) {
            const user = await getUserByClerkId(clerkId);
            if (user) await grantCredits(user.id, credits);
          }
        } else if (session.mode === "subscription") {
          // Mark the subscription active; the first invoice.paid grants the credits.
          if (clerkId) {
            const user = await getUserByClerkId(clerkId);
            if (user) {
              await setSubscription(user.id, {
                status: "active",
                plan: session.metadata?.plan_key ?? null,
                subscriptionId: session.subscription ? String(session.subscription) : null,
              });
            }
          }
        }
        break;
      }

      case "invoice.paid": {
        // First payment + every monthly renewal → grant the plan's credits.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer ? String(invoice.customer) : null;
        if (!customerId) break;
        const user = await getUserByStripeCustomer(customerId);
        if (!user) break;

        // Sum credits across invoice lines, mapped by our own price → plan table
        // (robust: doesn't depend on metadata being present in the payload).
        let credits = 0;
        let planKey: string | null = null;
        for (const line of invoice.lines?.data ?? []) {
          const priceId = line.pricing?.price_details?.price;
          if (!priceId) continue;
          const plan = planForPriceId(String(priceId));
          if (plan) {
            credits += plan.credits;
            planKey = plan.key;
          }
        }
        if (credits > 0) await grantCredits(user.id, credits);
        await setSubscription(user.id, { status: "active", plan: planKey });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer ? String(sub.customer) : null;
        const user = customerId ? await getUserByStripeCustomer(customerId) : null;
        if (user) await setSubscription(user.id, { status: "canceled" });
        break;
      }

      default:
        // Unhandled event types are fine — acknowledged and ignored.
        break;
    }
  } catch (err) {
    // Loud log with the event id for manual reconciliation. The event is already
    // marked processed (dedup), so we do NOT re-grant on Stripe's retry.
    console.error(`[stripe/webhook] handler error for ${event.id} (${event.type}):`, err);
    return NextResponse.json({ error: "handler failed", eventId: event.id }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
