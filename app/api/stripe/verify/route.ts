import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfillment";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const authSession = await auth();
    const access = await getAccessByEmail(authSession?.user?.email);
    if (!access.userId) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId.startsWith("cs_")) return NextResponse.json({ error: "Invalid Checkout Session." }, { status: 400 });

    const checkout = await getStripe().checkout.sessions.retrieve(sessionId);
    if (checkout.metadata?.userId !== access.userId) {
      return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 });
    }
    if (checkout.payment_status !== "paid") {
      return NextResponse.json({ error: "Stripe has not confirmed this payment yet." }, { status: 409 });
    }

    await fulfillCheckoutSession(checkout);
    const updatedAccess = await getAccessByEmail(authSession?.user?.email);
    return NextResponse.json({ active: updatedAccess.active, expiresAt: updatedAccess.expiresAt?.toISOString() ?? null });
  } catch (error) {
    console.error("Stripe Checkout verification failed", error);
    return NextResponse.json({ error: "Payment verification failed. Please refresh and try again." }, { status: 500 });
  }
}
