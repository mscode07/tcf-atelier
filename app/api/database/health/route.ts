import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: false,
      error: "missing_environment_variables",
      missing: ["DATABASE_URL"],
      hint: "Add the Supabase PostgreSQL pooler connection string in Hostinger.",
    }, { status: 503 });
  }

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    await db.select({ id: users.id }).from(users).limit(1);

    return NextResponse.json({ ok: true, database: "connected", orm: "drizzle", appUsersTable: "ready" });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json({
      ok: false,
      error: "database_unreachable_or_schema_missing",
      hint: "Verify DATABASE_URL and run npm run db:migrate.",
    }, { status: 502 });
  }
}
