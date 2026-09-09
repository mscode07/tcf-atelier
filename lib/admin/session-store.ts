import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { compare } from "bcryptjs";
import { getDb } from "@/lib/db";
import { adminSessions, adminSettings } from "@/lib/db/schema";
import { checkPasscode, SESSION_SECONDS } from "./passcode";
export const sessionHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function checkStoredPasscode(pin: unknown, db = getDb()) {
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return false;
  const [setting] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.id, "main"));
  return setting ? compare(pin, setting.passcodeHash) : checkPasscode(pin);
}
export async function validSession(
  token?: string,
  db = getDb(),
  now = new Date(),
) {
  if (!token || token.length > 160) return false;
  const [session] = await db
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, sessionHash(token)),
        gt(adminSessions.expiresAt, now),
      ),
    );
  return Boolean(session);
}
export const sessionExpiry = () =>
  new Date(Date.now() + SESSION_SECONDS * 1000);
