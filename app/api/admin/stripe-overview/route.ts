import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin/auth";
import { getStripeOverview } from "@/lib/admin/stripe-overview";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getStripeOverview(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return adminError(e);
  }
}
