import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminActivity, studentFeedback, users } from "@/lib/db/schema";
import { AdminError } from "./errors";

const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function listFeedback(db = getDb()) {
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: studentFeedback.id,
        category: studentFeedback.category,
        message: studentFeedback.message,
        module: studentFeedback.module,
        status: studentFeedback.status,
        createdAt: studentFeedback.createdAt,
        studentName: users.name,
        studentEmail: users.email,
      })
      .from(studentFeedback)
      .innerJoin(users, eq(users.id, studentFeedback.userId))
      .orderBy(desc(studentFeedback.createdAt))
      .limit(300),
    db
      .select({
        open: sql<number>`count(*) filter (where ${studentFeedback.status} = 'open')::integer`,
        resolved: sql<number>`count(*) filter (where ${studentFeedback.status} = 'resolved')::integer`,
      })
      .from(studentFeedback),
  ]);
  return {
    feedback: rows,
    totals: totals[0] ?? { open: 0, resolved: 0 },
  };
}

export async function setFeedbackStatus(
  id: unknown,
  status: unknown,
  actorId: string,
  db = getDb(),
) {
  if (!uuid(id)) throw new AdminError("Choose a feedback item.");
  if (status !== "open" && status !== "resolved")
    throw new AdminError("Invalid status.");
  const [row] = await db
    .update(studentFeedback)
    .set({ status })
    .where(eq(studentFeedback.id, id))
    .returning();
  if (!row) throw new AdminError("Feedback not found.", 404);
  await db.insert(adminActivity).values({
    actorId,
    action: status === "resolved" ? "Feedback resolved" : "Feedback reopened",
    detail: row.message.slice(0, 200),
  });
  return row;
}
