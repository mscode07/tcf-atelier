import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminActivity, materialContent, users } from "@/lib/db/schema";
import { adminError, requireAdmin } from "@/lib/admin/auth";
export async function GET() {
  try {
    await requireAdmin();
    const db = getDb();
    const [activity, students, content] = await Promise.all([
      db
        .select({
          id: adminActivity.id,
          action: adminActivity.action,
          detail: adminActivity.detail,
          createdAt: adminActivity.createdAt,
          actor: users.email,
        })
        .from(adminActivity)
        .innerJoin(users, eq(users.id, adminActivity.actorId))
        .orderBy(desc(adminActivity.createdAt))
        .limit(50),
      db
        .select({ status: users.status, count: count() })
        .from(users)
        .where(eq(users.role, "student"))
        .groupBy(users.status),
      db
        .select({
          module: materialContent.module,
          status: materialContent.status,
          count: count(),
        })
        .from(materialContent)
        .groupBy(materialContent.module, materialContent.status),
    ]);
    return NextResponse.json(
      { activity, students, content },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}
