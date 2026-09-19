import { NextResponse } from "next/server";
import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { payments, pricingPlans, users, userSubscriptions } from "@/lib/db/schema";
import { adminError, requireAdmin } from "@/lib/admin/auth";
import { STRIPE_CATALOG_CURRENCY, STRIPE_LIVE_CHECKOUT_PREFIX } from "@/lib/stripe";

type PaymentStatus = "paid" | "created" | "failed" | "refunded";
const paymentStatuses: readonly PaymentStatus[] = ["paid", "created", "failed", "refunded"];

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const requestedStatus = params.get("status") || "all";
    const status = paymentStatuses.includes(requestedStatus as PaymentStatus)
      ? (requestedStatus as PaymentStatus)
      : "all";
    const search = (params.get("q") || "").slice(0, 100).replace(/[%_\\]/g, "");
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const db = getDb();
    const liveCurrency = sql`${payments.currency} ilike ${STRIPE_CATALOG_CURRENCY}`;
    const liveCheckout = like(
      payments.providerOrderId,
      `${STRIPE_LIVE_CHECKOUT_PREFIX}%`,
    );
    const conditions = [eq(users.role, "student"), liveCurrency, liveCheckout];
    if (status !== "all") conditions.push(eq(payments.status, status));
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(users.email, term), ilike(users.name, term))!);
    }
    const [transactions, totals, payingStudents] = await Promise.all([
      db.select({ id: payments.id, amountMinor: payments.amountMinor, currency: payments.currency, status: payments.status, provider: payments.provider, paidAt: payments.paidAt, createdAt: payments.createdAt, name: users.name, email: users.email, planName: pricingPlans.name })
        .from(payments).innerJoin(users, eq(payments.userId, users.id))
        .leftJoin(userSubscriptions, eq(payments.subscriptionId, userSubscriptions.id))
        .leftJoin(pricingPlans, eq(userSubscriptions.planId, pricingPlans.id))
        .where(and(...conditions)).orderBy(desc(payments.paidAt), desc(payments.createdAt)).limit(51).offset(offset),
      db.select({ currency: sql<string>`upper(${payments.currency})`, amountMinor: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::integer`, count: sql<number>`count(*)::integer` })
        .from(payments).innerJoin(users, eq(payments.userId, users.id))
        .where(and(eq(payments.status, "paid"), eq(users.role, "student"), liveCurrency, liveCheckout)).groupBy(sql`upper(${payments.currency})`),
      db.select({ count: sql<number>`count(distinct ${payments.userId})::integer` })
        .from(payments).innerJoin(users, eq(payments.userId, users.id))
        .where(and(eq(payments.status, "paid"), eq(users.role, "student"), liveCurrency, liveCheckout)),
    ]);
    return NextResponse.json({ transactions: transactions.slice(0, 50), hasMore: transactions.length > 50, totals, payingStudents: payingStudents[0]?.count || 0 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return adminError(e);
  }
}
