import { and, desc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { moduleAccessGrants, userSubscriptions, users } from "@/lib/db/schema";
import { ModuleKey } from "@/lib/admin/types";
import { evaluateAccess } from "@/lib/admin/access-policy";
export type AccessResult = {
  userId: string | null;
  active: boolean;
  expiresAt: Date | null;
  modules: ReturnType<typeof evaluateAccess>;
  isAdmin: boolean;
};
export async function getAccessByEmail(
  rawEmail: string | null | undefined,
  module?: ModuleKey,
): Promise<AccessResult> {
  const empty = {
    userId: null,
    active: false,
    expiresAt: null,
    modules: evaluateAccess("inactive", "student", null, []),
    isAdmin: false,
  };
  const email = rawEmail?.trim().toLowerCase();
  if (!email) return empty;
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return empty;
  const now = new Date();
  await db
    .update(userSubscriptions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(userSubscriptions.userId, user.id),
        eq(userSubscriptions.status, "active"),
        lte(userSubscriptions.expiresAt, now),
      ),
    );
  const [[subscription], grants] = await Promise.all([
    db
      .select({ expiresAt: userSubscriptions.expiresAt })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, user.id),
          eq(userSubscriptions.status, "active"),
          lte(userSubscriptions.startsAt, now),
          gt(userSubscriptions.expiresAt, now),
        ),
      )
      .orderBy(desc(userSubscriptions.expiresAt))
      .limit(1),
    db
      .select()
      .from(moduleAccessGrants)
      .where(eq(moduleAccessGrants.userId, user.id)),
  ]);
  const modules = evaluateAccess(
    user.status,
    user.role,
    subscription?.expiresAt || null,
    grants,
    now,
  );
  return {
    userId: user.id,
    active: module
      ? modules[module].active
      : Object.values(modules).some((m) => m.active),
    expiresAt: module
      ? modules[module].expiresAt
      : subscription?.expiresAt || null,
    modules,
    isAdmin: user.role === "admin" && user.status === "active",
  };
}
