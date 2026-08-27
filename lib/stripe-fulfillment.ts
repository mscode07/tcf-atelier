import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, userSubscriptions } from "@/lib/db/schema";
import { isStripePlanCode, stripePlans } from "@/lib/stripe";

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;
  const subscriptionId = session.metadata?.subscriptionId;
  const planCode = session.metadata?.planCode;
  if (!paymentId || !subscriptionId || !isStripePlanCode(planCode)) {
    throw new Error("Checkout Session is missing fulfillment metadata.");
  }
  const plan = stripePlans[planCode];
  const durationDays = Number(session.metadata?.durationDays);
  if (durationDays !== plan.durationDays) throw new Error("Checkout duration does not match the purchased package.");
  if (session.amount_total !== plan.amountMinor || session.currency?.toLowerCase() !== plan.currency) {
    throw new Error("Checkout amount or currency does not match the purchased package.");
  }
  if (session.payment_status !== "paid") throw new Error("Checkout Session has not been paid.");

  const now = new Date();
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const db = getDb();
  const [existingPayment] = await db.select({
    status: payments.status,
    paidAt: payments.paidAt,
    userId: payments.userId,
    subscriptionId: payments.subscriptionId,
    amountMinor: payments.amountMinor,
    currency: payments.currency,
    checkoutSessionId: payments.providerOrderId,
  }).from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!existingPayment) throw new Error("Payment record was not found.");
  const [subscription] = await db.select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.id, subscriptionId))
    .limit(1);
  if (!subscription) throw new Error("Subscription record was not found.");
  if (
    existingPayment.subscriptionId !== subscriptionId ||
    existingPayment.userId !== subscription.userId ||
    session.metadata?.userId !== existingPayment.userId ||
    existingPayment.checkoutSessionId !== session.id ||
    existingPayment.amountMinor !== plan.amountMinor ||
    existingPayment.currency.toLowerCase() !== plan.currency
  ) {
    throw new Error("Checkout does not match the stored payment and subscription records.");
  }

  // Derive the expiry from the original payment time so retries repair access
  // without extending it. Stripe may call this concurrently from the webhook
  // and the success-page verifier.
  const paidAt = existingPayment.paidAt ?? now;
  const expiresAt = new Date(paidAt.getTime() + durationDays * 86_400_000);

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "paid", providerPaymentId: paymentIntentId ?? null, paidAt, updatedAt: now }).where(eq(payments.id, paymentId));
    await tx.update(userSubscriptions).set({ status: "active", startsAt: paidAt, expiresAt, updatedAt: now }).where(eq(userSubscriptions.id, subscriptionId));
  });

  return { expiresAt };
}
