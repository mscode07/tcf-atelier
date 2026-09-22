import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminActivity, pricingPlans } from "@/lib/db/schema";
import {
  getPricingPlan,
  getStripe,
  isStripePlanCode,
  STRIPE_CATALOG_CURRENCY,
  stripePlans,
  StripePlanCode,
} from "@/lib/stripe";
import { AdminError } from "./errors";

const MIN_AMOUNT_MINOR = 100; // $1.00
const MAX_AMOUNT_MINOR = 500_000; // $5,000.00

export async function listPricingPlans(db = getDb()) {
  return Promise.all(
    (Object.keys(stripePlans) as StripePlanCode[]).map((code) =>
      getPricingPlan(code, db),
    ),
  );
}

export async function updatePricingPlanPrice(
  code: unknown,
  amountMinor: unknown,
  actorId: string,
  db = getDb(),
) {
  if (!isStripePlanCode(code)) throw new AdminError("Choose a plan.");
  const amount = Number(amountMinor);
  if (
    !Number.isInteger(amount) ||
    amount < MIN_AMOUNT_MINOR ||
    amount > MAX_AMOUNT_MINOR
  )
    throw new AdminError("Enter a price between $1.00 and $5,000.00.");
  const current = await getPricingPlan(code, db);
  if (!current.stripeProductId)
    throw new AdminError(
      "This plan has no Stripe product on file. Fix it in the Stripe Dashboard first.",
      409,
    );
  const stripe = getStripe();
  const created = await stripe.prices.create({
    product: current.stripeProductId,
    unit_amount: amount,
    currency: STRIPE_CATALOG_CURRENCY,
    nickname: stripePlans[code].label,
  });
  if (current.stripePriceId && current.stripePriceId !== created.id)
    await stripe.prices
      .update(current.stripePriceId, { active: false })
      .catch(() => {});
  const [updated] = await db
    .update(pricingPlans)
    .set({
      priceMinor: amount,
      currency: STRIPE_CATALOG_CURRENCY.toUpperCase(),
      stripePriceId: created.id,
      updatedAt: new Date(),
    })
    .where(eq(pricingPlans.code, code))
    .returning();
  await db.insert(adminActivity).values({
    actorId,
    action: "Module price updated",
    detail: `${stripePlans[code].label} → $${(amount / 100).toFixed(2)}`,
  });
  return updated;
}
