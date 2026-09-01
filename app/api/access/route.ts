import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { getDb } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfillment";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ authenticated: false, active: false }, { status: 401 });
  let access = await getAccessByEmail(session.user.email);

  // Recover a paid Checkout if webhook delivery was delayed or unavailable locally.
  if (!access.active && access.userId) {
    const [pendingPayment] = await getDb().select({ checkoutSessionId: payments.providerOrderId })
      .from(payments)
      .where(and(eq(payments.userId, access.userId), eq(payments.provider, "stripe"), eq(payments.status, "created")))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (pendingPayment?.checkoutSessionId?.startsWith("cs_")) {
      try {
        const checkout = await getStripe().checkout.sessions.retrieve(pendingPayment.checkoutSessionId);
        if (checkout.payment_status === "paid" && checkout.metadata?.userId === access.userId) {
          await fulfillCheckoutSession(checkout);
          access = await getAccessByEmail(session.user.email);
        }
      } catch (error) {
        console.error("Pending Stripe payment reconciliation failed", error);
      }
    }
  }

  const [localPart, domain = ""] = session.user.email.toLowerCase().split("@");
  const maskedEmail = `${localPart.slice(0, 2)}${"*".repeat(Math.max(3, localPart.length - 2))}@${domain}`;
  return NextResponse.json({
    authenticated: true,
    active: access.active,
    expiresAt: access.expiresAt?.toISOString() ?? null,
    watermark: `${maskedEmail} · ${access.userId?.slice(0, 8) ?? "unknown"}`,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
