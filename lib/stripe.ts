import Stripe from "stripe";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pricingPlans } from "@/lib/db/schema";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is missing.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export const STRIPE_CATALOG_CURRENCY = "usd";
export const STRIPE_LIVE_CHECKOUT_PREFIX = "cs_live_";

// The same server can run against a test or live secret key depending on the
// environment (e.g. sk_test_ on localhost, sk_live_ in production). Dashboard
// links and admin-facing data should follow whichever mode is actually active.
export function getStripeMode(): "live" | "test" {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
    ? "live"
    : "test";
}
export const stripePlans = {
  "7-days": { priceEnv: "STRIPE_PRICE_7_DAYS", durationDays: 7, label: "7 days" },
  "30-days": { priceEnv: "STRIPE_PRICE_30_DAYS", durationDays: 30, label: "30 days" },
  "60-days": { priceEnv: "STRIPE_PRICE_60_DAYS", durationDays: 60, label: "60 days" },
} as const;

export type StripePlanCode = keyof typeof stripePlans;

export function isStripePlanCode(value: unknown): value is StripePlanCode {
  return typeof value === "string" && value in stripePlans;
}

// The Stripe price is the source of truth. The DB row is a cache the admin
// can repoint (via updatePricingPlanPrice) without redeploying env vars.
//
// The DB is shared across environments (e.g. local dev and production), but
// each one talks to Stripe with its own key (test vs live). A price id
// cached by one environment is meaningless to the other's key — Stripe
// rejects cross-mode lookups outright — so a cache miss here isn't treated
// as fatal: fall back to this environment's own STRIPE_PRICE_* env var and
// let this environment re-cache its own working id. Without this, whichever
// environment wrote to the DB last would break the other's checkout.
export async function getPricingPlan(code: StripePlanCode, db = getDb()) {
  const config = stripePlans[code];
  const [existing] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.code, code))
    .limit(1);
  const envPriceId = process.env[config.priceEnv];
  let priceId = existing?.stripePriceId || envPriceId;
  if (!priceId) throw new Error(`${config.priceEnv} is missing.`);
  let price: Stripe.Price;
  try {
    price = await getStripe().prices.retrieve(priceId);
  } catch (error) {
    if (!envPriceId || envPriceId === priceId) throw error;
    priceId = envPriceId;
    price = await getStripe().prices.retrieve(priceId);
  }
  if (!price.active || price.unit_amount == null || !price.currency)
    throw new Error(`The Stripe price for ${config.label} is not active.`);
  const productId =
    typeof price.product === "string" ? price.product : price.product?.id;
  const amountMinor = price.unit_amount;
  const currency = price.currency.toUpperCase();
  if (
    existing &&
    existing.stripePriceId === priceId &&
    existing.priceMinor === amountMinor &&
    existing.currency === currency &&
    existing.stripeProductId === (productId ?? null)
  )
    return existing;
  const [row] = await db
    .insert(pricingPlans)
    .values({
      code,
      name: config.label,
      durationDays: config.durationDays,
      priceMinor: amountMinor,
      currency,
      isActive: true,
      stripePriceId: priceId,
      stripeProductId: productId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pricingPlans.code,
      set: {
        name: config.label,
        durationDays: config.durationDays,
        priceMinor: amountMinor,
        currency,
        isActive: true,
        stripePriceId: priceId,
        stripeProductId: productId ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

// A DB-only read for public, high-traffic pages: no Stripe round-trip on the
// happy path, so it stays fast and never gets rate-limited by page views.
// Bootstraps from Stripe only for a code that has never been synced yet.
export async function getCachedPricingPlans(db = getDb()) {
  const codes = Object.keys(stripePlans) as StripePlanCode[];
  const rows = await db
    .select()
    .from(pricingPlans)
    .where(inArray(pricingPlans.code, codes));
  const byCode = new Map(rows.map((row) => [row.code as StripePlanCode, row]));
  const results = await Promise.all(
    codes.map(async (code) => {
      const cached = byCode.get(code);
      if (cached) return cached;
      try {
        return await getPricingPlan(code, db);
      } catch {
        return null;
      }
    }),
  );
  return results.filter((row): row is NonNullable<typeof row> => row !== null);
}
