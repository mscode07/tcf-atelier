import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { payments, userSubscriptions, users } from "@/lib/db/schema";
import { getPricingPlan, getStripe, isStripePlanCode } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email)
      return NextResponse.json(
        { error: "Please sign in before choosing a plan." },
        { status: 401 },
      );
    const body = (await request.json().catch(() => null)) as {
      plan?: unknown;
    } | null;
    if (!isStripePlanCode(body?.plan))
      return NextResponse.json(
        { error: "That plan is not available." },
        { status: 400 },
      );

    // Hosting proxies can expose an internal address in request.url.
    const publicUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    if (!publicUrl && process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_URL must be configured with the public HTTPS site URL.",
      );
    }
    const siteUrl = new URL(publicUrl || request.url);
    if (
      !["http:", "https:"].includes(siteUrl.protocol) ||
      (process.env.NODE_ENV === "production" &&
        (siteUrl.protocol !== "https:" ||
          ["0.0.0.0", "localhost", "127.0.0.1", "[::]", "[::1]"].includes(
            siteUrl.hostname,
          )))
    ) {
      throw new Error(
        "AUTH_URL must be a public HTTPS site URL in production.",
      );
    }
    const origin = siteUrl.origin;

    const planCode = body.plan;
    const db = getDb();
    const plan = await getPricingPlan(planCode, db);
    if (!plan.stripePriceId)
      return NextResponse.json(
        { error: "This plan is not currently available." },
        { status: 409 },
      );
    const stripe = getStripe();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user)
      return NextResponse.json(
        { error: "Your account could not be found. Please sign in again." },
        { status: 404 },
      );
    const now = new Date();
    const [subscription] = await db
      .insert(userSubscriptions)
      .values({ userId: user.id, planId: plan.id })
      .returning({ id: userSubscriptions.id });
    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        subscriptionId: subscription.id,
        provider: "stripe",
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        metadata: { planCode },
      })
      .returning({ id: payments.id });

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?payment=cancelled#pricing`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        paymentId: payment.id,
        subscriptionId: subscription.id,
        planCode,
        durationDays: String(plan.durationDays),
        userId: user.id,
      },
      payment_intent_data: {
        metadata: {
          paymentId: payment.id,
          subscriptionId: subscription.id,
          planCode,
          userId: user.id,
        },
      },
    });
    await db
      .update(payments)
      .set({ providerOrderId: checkout.id, updatedAt: now })
      .where(eq(payments.id, payment.id));
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 500 },
    );
  }
}
