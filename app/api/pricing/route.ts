import { NextResponse } from "next/server";
import { getCachedPricingPlans } from "@/lib/stripe";

export async function GET() {
  try {
    const plans = await getCachedPricingPlans();
    return NextResponse.json(
      {
        plans: plans.map((plan) => ({
          code: plan.code,
          durationDays: plan.durationDays,
          priceMinor: plan.priceMinor,
          currency: plan.currency,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ plans: [] });
  }
}
