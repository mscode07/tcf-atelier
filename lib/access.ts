import { and, desc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userSubscriptions, users } from "@/lib/db/schema";

export type AccessResult = {
  userId: string | null;
  active: boolean;
  expiresAt: Date | null;
};

export async function getAccessByEmail(rawEmail: string | null | undefined): Promise<AccessResult> {
  const email = rawEmail?.trim().toLowerCase();
  if (!email) return { userId: null, active: false, expiresAt: null };

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) return { userId: null, active: false, expiresAt: null };

  const now = new Date();
  // Keep persisted status accurate as well as enforcing the timestamp at read time.
  await db.update(userSubscriptions).set({ status: "expired", updatedAt: now }).where(and(
    eq(userSubscriptions.userId, user.id),
    eq(userSubscriptions.status, "active"),
    lte(userSubscriptions.expiresAt, now),
  ));

  const [subscription] = await db.select({ expiresAt: userSubscriptions.expiresAt })
    .from(userSubscriptions)
    .where(and(
      eq(userSubscriptions.userId, user.id),
      eq(userSubscriptions.status, "active"),
      gt(userSubscriptions.expiresAt, now),
    ))
    .orderBy(desc(userSubscriptions.expiresAt))
    .limit(1);

  return { userId: user.id, active: Boolean(subscription), expiresAt: subscription?.expiresAt ?? null };
}
