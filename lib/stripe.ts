import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is missing.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export const stripePlans = {
  "7-days": { priceEnv: "STRIPE_PRICE_7_DAYS", durationDays: 7, label: "7 days", amountMinor: 1000, currency: "usd" },
  "30-days": { priceEnv: "STRIPE_PRICE_30_DAYS", durationDays: 30, label: "30 days", amountMinor: 2500, currency: "usd" },
  "60-days": { priceEnv: "STRIPE_PRICE_60_DAYS", durationDays: 60, label: "60 days", amountMinor: 4000, currency: "usd" },
} as const;

export type StripePlanCode = keyof typeof stripePlans;

export function isStripePlanCode(value: unknown): value is StripePlanCode {
  return typeof value === "string" && value in stripePlans;
}
