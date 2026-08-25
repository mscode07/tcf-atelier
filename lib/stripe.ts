import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is missing.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export const stripePlans = {
  "7-days": { priceEnv: "STRIPE_PRICE_7_DAYS", durationDays: 7, label: "7 days" },
  "15-days": { priceEnv: "STRIPE_PRICE_15_DAYS", durationDays: 15, label: "15 days" },
  "30-days": { priceEnv: "STRIPE_PRICE_30_DAYS", durationDays: 30, label: "30 days" },
} as const;

export type StripePlanCode = keyof typeof stripePlans;

export function isStripePlanCode(value: unknown): value is StripePlanCode {
  return typeof value === "string" && value in stripePlans;
}
