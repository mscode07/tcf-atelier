import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminSessions } from "@/lib/db/schema";
import { ADMIN_COOKIE } from "@/lib/admin/password";
import { sessionHash } from "@/lib/admin/session-store";
import AdminGate from "./AdminGate";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (token)
    await getDb()
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, sessionHash(token)));
  return <AdminGate />;
}
