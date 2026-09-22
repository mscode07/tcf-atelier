import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../db";
import { payments, pricingPlans, users } from "../db/schema";
import { STRIPE_LIVE_CHECKOUT_PREFIX } from "../stripe";
import { AdminError } from "./errors";

// When subscriptions overlap, the current plan is the active one lasting longest.
// The same selection drives both the Plan column and its filter.
const currentPlanId = sql`(
  select us.plan_id from user_subscriptions us
  where us.user_id = ${users.id} and us.status = 'active'
    and (us.starts_at is null or us.starts_at <= now())
    and (us.expires_at is null or us.expires_at > now())
  order by us.expires_at desc nulls first, us.created_at desc, us.id desc
  limit 1
)`;

export async function listStudents(params: URLSearchParams, db = getDb()) {
  const search = (params.get("q") || "").slice(0, 100).replace(/[%_\\]/g, "");
  const rawOffset = Number(params.get("offset"));
  const offset =
    Number.isSafeInteger(rawOffset) && rawOffset > 0 ? rawOffset : 0;
  const payer = params.get("payer") || "all";
  const plan = params.get("plan") || "all";
  if (
    !["all", "active", "none"].includes(plan) &&
    (!plan.startsWith("name:") || plan.length <= 5 || plan.length > 205)
  )
    throw new AdminError("Choose a valid plan filter.");
  const conditions = [eq(users.role, "student")];
  const paidStudent = sql`exists (select 1 from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} = 'paid' and ${payments.currency} ilike 'usd' and ${payments.providerOrderId} like ${STRIPE_LIVE_CHECKOUT_PREFIX + "%"})`;
  if (payer === "paying") conditions.push(paidStudent);
  if (payer === "unpaid") conditions.push(sql`not (${paidStudent})`);
  if (search)
    conditions.push(
      or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`))!,
    );
  if (plan === "active") conditions.push(isNotNull(pricingPlans.id));
  else if (plan === "none") conditions.push(isNull(pricingPlans.id));
  else if (plan !== "all")
    conditions.push(eq(pricingPlans.name, plan.slice(5)));

  const [rows, plans, totals] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        country: users.country,
        phone: users.phone,
        planName: pricingPlans.name,
        planActive: sql<boolean>`${pricingPlans.id} is not null`,
        planExpiresAt: sql<string | null>`(
        select us.expires_at from user_subscriptions us
        where us.user_id = ${users.id} and us.status = 'active'
          and (us.starts_at is null or us.starts_at <= now())
          and (us.expires_at is null or us.expires_at > now())
        order by us.expires_at desc nulls first, us.created_at desc, us.id desc
        limit 1
      )`,
      })
      .from(users)
      .leftJoin(pricingPlans, eq(pricingPlans.id, currentPlanId))
      .where(and(...conditions))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(51)
      .offset(offset),
    // Include retired plans because existing subscriptions can still use them.
    db
      .selectDistinct({ name: pricingPlans.name })
      .from(pricingPlans)
      .orderBy(asc(pricingPlans.name)),
    // Unfiltered totals for the page overview, regardless of the table's own filters.
    db
      .select({
        total: sql<number>`count(*)::integer`,
        active: sql<number>`count(*) filter (where ${users.status} = 'active')::integer`,
        withPlan: sql<number>`count(*) filter (where ${pricingPlans.id} is not null)::integer`,
        paying: sql<number>`count(distinct ${users.id}) filter (where ${paidStudent})::integer`,
      })
      .from(users)
      .leftJoin(pricingPlans, eq(pricingPlans.id, currentPlanId))
      .where(eq(users.role, "student")),
  ]);
  return {
    students: rows.slice(0, 50),
    hasMore: rows.length > 50,
    plans: plans.sort((a, b) =>
      a.name.localeCompare(b.name, "en", { numeric: true }),
    ),
    totals: totals[0] ?? { total: 0, active: 0, withPlan: 0, paying: 0 },
  };
}
