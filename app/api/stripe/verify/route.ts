import { NextResponse } from "next/server";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfillment";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId.startsWith("cs_")) return NextResponse.json({ error: "Invalid Checkout Session." }, { status: 400 });

    const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
    if (checkout.payment_status !== "paid") {
      return NextResponse.json({ error: "Stripe has not confirmed this payment yet." }, { status: 409 });
    }

    const fulfillment = await fulfillCheckoutSession(checkout);
    return NextResponse.json({ active: true, expiresAt: fulfillment.expiresAt.toISOString() });
  } catch (error) {
    console.error("Stripe Checkout verification failed", error);
    return NextResponse.json({ error: "Payment verification failed. Please refresh and try again." }, { status: 500 });
  }
}
