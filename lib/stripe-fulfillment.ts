import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, userSubscriptions } from "@/lib/db/schema";

export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;
  const subscriptionId = session.metadata?.subscriptionId;
  const durationDays = Number(session.metadata?.durationDays);
  if (!paymentId || !subscriptionId || !Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error("Checkout Session is missing fulfillment metadata.");
  }
  if (session.payment_status !== "paid") throw new Error("Checkout Session has not been paid.");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 86_400_000);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const db = getDb();
  const [existingPayment] = await db.select({ status: payments.status }).from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!existingPayment) throw new Error("Payment record was not found.");
  if (existingPayment.status === "paid") return;

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "paid", providerPaymentId: paymentIntentId ?? null, paidAt: now, updatedAt: now }).where(eq(payments.id, paymentId));
    await tx.update(userSubscriptions).set({ status: "active", startsAt: now, expiresAt, updatedAt: now }).where(eq(userSubscriptions.id, subscriptionId));
  });
}
