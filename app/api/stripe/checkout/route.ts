import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { payments, pricingPlans, userSubscriptions, users } from "@/lib/db/schema";
import { getStripe, isStripePlanCode, stripePlans } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Please sign in before choosing a plan." }, { status: 401 });
    const body = await request.json().catch(() => null) as { plan?: unknown } | null;
    if (!isStripePlanCode(body?.plan)) return NextResponse.json({ error: "That plan is not available." }, { status: 400 });

    const planCode = body.plan;
    const planConfig = stripePlans[planCode];
    const priceId = process.env[planConfig.priceEnv];
    if (!priceId) throw new Error(`${planConfig.priceEnv} is missing.`);
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.unit_amount == null || !price.currency) return NextResponse.json({ error: "This plan is not currently available." }, { status: 409 });

    const db = getDb();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) return NextResponse.json({ error: "Your account could not be found. Please sign in again." }, { status: 404 });
    const now = new Date();
    const [plan] = await db.insert(pricingPlans).values({ code: planCode, name: planConfig.label, durationDays: planConfig.durationDays, priceMinor: price.unit_amount, currency: price.currency.toUpperCase(), isActive: true, updatedAt: now }).onConflictDoUpdate({
      target: pricingPlans.code,
      set: { name: planConfig.label, durationDays: planConfig.durationDays, priceMinor: price.unit_amount, currency: price.currency.toUpperCase(), isActive: true, updatedAt: now },
    }).returning({ id: pricingPlans.id });
    const [subscription] = await db.insert(userSubscriptions).values({ userId: user.id, planId: plan.id }).returning({ id: userSubscriptions.id });
    const [payment] = await db.insert(payments).values({ userId: user.id, subscriptionId: subscription.id, provider: "stripe", amountMinor: price.unit_amount, currency: price.currency.toUpperCase(), metadata: { planCode } }).returning({ id: payments.id });

    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: { paymentId: payment.id, subscriptionId: subscription.id, planCode, durationDays: String(planConfig.durationDays), userId: user.id },
      payment_intent_data: { metadata: { paymentId: payment.id, subscriptionId: subscription.id, planCode, userId: user.id } },
    });
    await db.update(payments).set({ providerOrderId: checkout.id, updatedAt: now }).where(eq(payments.id, payment.id));
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json({ error: "Checkout could not be started. Please try again." }, { status: 500 });
  }
}
