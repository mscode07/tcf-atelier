import { hasAdminSession } from "@/lib/admin/auth";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
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
  if (await hasAdminSession())
    return {
      userId: "a5c2fda9-4189-4862-a9fd-38853a946b51",
      active: true,
      expiresAt: null,
      modules: evaluateAccess("active", "admin", null, []),
      isAdmin: true,
    };
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
  const stillActive = or(
    isNull(userSubscriptions.expiresAt),
    gt(userSubscriptions.expiresAt, now),
  )!;
  const alreadyStarted = or(
    isNull(userSubscriptions.startsAt),
    lte(userSubscriptions.startsAt, now),
  )!;
  const [[subscription], grants] = await Promise.all([
    db
      .select({ expiresAt: userSubscriptions.expiresAt })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, user.id),
          eq(userSubscriptions.status, "active"),
          alreadyStarted,
          stillActive,
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
    subscription
      ? (subscription.expiresAt ?? new Date("9999-12-31T00:00:00.000Z"))
      : null,
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
