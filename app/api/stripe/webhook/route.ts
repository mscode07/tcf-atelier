import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, userSubscriptions } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfillment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") await fulfillCheckoutSession(session);
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const db = getDb();
      if (session.metadata?.paymentId) await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, session.metadata.paymentId));
      if (session.metadata?.subscriptionId) await db.update(userSubscriptions).set({ status: "cancelled", updatedAt: new Date() }).where(eq(userSubscriptions.id, session.metadata.subscriptionId));
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed", error);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
