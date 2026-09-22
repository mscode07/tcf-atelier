import { getStripe, getStripeMode } from "@/lib/stripe";

export async function getStripeOverview() {
  const stripe = getStripe();
  const mode = getStripeMode();
  const [balance, charges] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.charges.list({ limit: 10 }),
  ]);
  const dashboardBase = `https://dashboard.stripe.com/${mode === "test" ? "test/" : ""}`;
  return {
    mode,
    dashboardUrl: `${dashboardBase}payments`,
    available: balance.available.map((b) => ({
      amountMinor: b.amount,
      currency: b.currency.toUpperCase(),
    })),
    pending: balance.pending.map((b) => ({
      amountMinor: b.amount,
      currency: b.currency.toUpperCase(),
    })),
    charges: charges.data.map((charge) => ({
      id: charge.id,
      amountMinor: charge.amount,
      currency: charge.currency.toUpperCase(),
      status: charge.status,
      email: charge.billing_details?.email || charge.receipt_email || null,
      createdAt: new Date(charge.created * 1000).toISOString(),
      dashboardUrl: `${dashboardBase}payments/${
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.id
      }`,
    })),
  };
}
