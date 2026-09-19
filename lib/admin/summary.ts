import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminActivity, materialContent, users } from "@/lib/db/schema";
import { ModuleKey } from "./types";

type Activity = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
};

// Aggregate on one connection. No question bodies are transferred for the overview.
export async function adminSummary(db = getDb()) {
  const [summary] = await db
    .select({
      activity: sql<Activity[]>`coalesce((
      select jsonb_agg(recent order by recent."createdAt" desc) from (
        select a.id as id, a.action as action,
          a.detail as detail, a.created_at as "createdAt",
          u.email as actor
        from ${adminActivity} a inner join ${users} u on u.id = a.actor_id
        order by a.created_at desc limit 50
      ) recent
    ), '[]'::jsonb)`,
      students: sql<{ status: string; count: number }[]>`coalesce((
      select jsonb_agg(totals) from (
        select ${users.status} as status, count(*)::integer as count
        from ${users} where ${users.role} = 'student' group by ${users.status}
      ) totals
    ), '[]'::jsonb)`,
      content: sql<
        { module: ModuleKey; status: string; count: number }[]
      >`coalesce((
      select jsonb_agg(totals) from (
        select ${materialContent.module} as module, ${materialContent.status} as status,
          count(*)::integer as count from ${materialContent}
        group by ${materialContent.module}, ${materialContent.status}
      ) totals
    ), '[]'::jsonb)`,
    })
    .from(sql`(select 1) as singleton`);
  return summary;
}
