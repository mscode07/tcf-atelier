import { NextResponse } from "next/server";
import { adminError, readBody, requireAdmin } from "@/lib/admin/auth";
import { listPricingPlans, updatePricingPlanPrice } from "@/lib/admin/pricing";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      { plans: await listPricingPlans() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await readBody(request);
    const plan = await updatePricingPlanPrice(
      body.code,
      body.amountMinor,
      admin.id,
    );
    return NextResponse.json({ plan });
  } catch (e) {
    return adminError(e);
  }
}
