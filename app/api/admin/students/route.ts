import { NextResponse } from "next/server";
import { and, desc, eq, gt, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  adminActivity,
  moduleAccessGrants,
  payments,
  testAttempts,
  users,
  userSubscriptions,
} from "@/lib/db/schema";
import {
  adminError,
  AdminError,
  readBody,
  requireAdmin,
} from "@/lib/admin/auth";
import { isModule } from "@/lib/admin/types";
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const db = getDb();
    if (id) {
      if (!uuid(id)) throw new AdminError("Invalid student.");
      const now = new Date();
      const [grants, subscriptions, attempts] = await Promise.all([
        db
          .select()
          .from(moduleAccessGrants)
          .where(
            and(
              eq(moduleAccessGrants.userId, id),
              isNull(moduleAccessGrants.revokedAt),
            ),
          )
          .orderBy(desc(moduleAccessGrants.createdAt)),
        db
          .select({
            status: userSubscriptions.status,
            startsAt: userSubscriptions.startsAt,
            expiresAt: userSubscriptions.expiresAt,
          })
          .from(userSubscriptions)
          .where(
            and(
              eq(userSubscriptions.userId, id),
              eq(userSubscriptions.status, "active"),
              lte(userSubscriptions.startsAt, now),
              gt(userSubscriptions.expiresAt, now),
            ),
          ),
        db
          .select({
            status: testAttempts.status,
            percentage: testAttempts.percentage,
            startedAt: testAttempts.startedAt,
          })
          .from(testAttempts)
          .where(eq(testAttempts.userId, id))
          .orderBy(desc(testAttempts.startedAt))
          .limit(100),
      ]);
      return NextResponse.json(
        { grants, subscriptions, attempts },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const search = (params.get("q") || "").slice(0, 100).replace(/[%_\\]/g, "");
    const offset = Math.max(0, Number(params.get("offset")) || 0);
    const payer = params.get("payer") || "all";
    const conditions = [eq(users.role, "student")];
    const paidStudent = sql`exists (select 1 from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} = 'paid')`;
    if (payer === "paying") conditions.push(paidStudent);
    if (payer === "unpaid") conditions.push(sql`not (${paidStudent})`);
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(ilike(users.email, term), ilike(users.name, term))!);
    }
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        country: users.country,
        phone: users.phone,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(51)
      .offset(offset);
    return NextResponse.json(
      { students: rows.slice(0, 50), hasMore: rows.length > 50 },
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
    const db = getDb();
    if (!uuid(body.userId)) throw new AdminError("Choose a student.");
    const [student] = await db
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, body.userId));
    if (!student || student.role !== "student")
      throw new AdminError("Student not found.", 404);
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${body.userId}))`,
      );
      if (body.action === "status") {
        if (!["active", "suspended"].includes(body.status))
          throw new AdminError("Invalid status.");
        await tx
          .update(users)
          .set({ status: body.status, updatedAt: new Date() })
          .where(eq(users.id, body.userId));
      } else if (body.action === "revoke") {
        if (!uuid(body.grantId))
          throw new AdminError("Choose an access grant.");
        const rows = await tx
          .update(moduleAccessGrants)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(moduleAccessGrants.id, body.grantId),
              eq(moduleAccessGrants.userId, body.userId),
              isNull(moduleAccessGrants.revokedAt),
            ),
          )
          .returning({ id: moduleAccessGrants.id });
        if (!rows.length)
          throw new AdminError("This grant has already been removed.", 409);
      } else if (body.action === "grant") {
        if (
          !Array.isArray(body.modules) ||
          !body.modules.length ||
          body.modules.length > 4 ||
          !body.modules.every(isModule) ||
          !["grant", "deny"].includes(body.kind)
        )
          throw new AdminError("Choose modules and an access action.");
        if (!reason)
          throw new AdminError("Add a reason for the access change.");
        const startsAt = new Date();
        const hours = Number(body.hours);
        if (
          body.hours !== null &&
          (!Number.isFinite(hours) || hours < 1 || hours > 876000)
        )
          throw new AdminError("Use at least one hour or choose lifetime.");
        const expiresAt =
          body.hours === null
            ? null
            : new Date(startsAt.getTime() + hours * 3600000);
        for (const module of new Set<string>(body.modules)) {
          // A new decision replaces previous active overrides for the selected module.
          await tx
            .update(moduleAccessGrants)
            .set({ revokedAt: startsAt })
            .where(
              and(
                eq(moduleAccessGrants.userId, body.userId),
                eq(
                  moduleAccessGrants.module,
                  module as typeof moduleAccessGrants.$inferInsert.module,
                ),
                isNull(moduleAccessGrants.revokedAt),
              ),
            );
          await tx
            .insert(moduleAccessGrants)
            .values({
              userId: body.userId,
              module: module as typeof moduleAccessGrants.$inferInsert.module,
              kind: body.kind,
              startsAt,
              expiresAt,
              reason,
              actorId: admin.id,
            });
        }
      } else throw new AdminError("Unknown action.");
      await tx
        .insert(adminActivity)
        .values({
          actorId: admin.id,
          action:
            body.action === "status"
              ? `Student ${body.status}`
              : body.action === "revoke"
                ? "Access override removed"
                : body.kind === "deny"
                  ? "Module access blocked"
                  : "Free access granted",
          detail: `${student.email}${body.modules ? ` · ${body.modules.join(", ")}` : ""}${reason ? ` · ${reason}` : ""}`,
        });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminError(e);
  }
}
