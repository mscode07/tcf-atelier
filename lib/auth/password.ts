import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";

export async function authenticatePassword(
  emailValue: unknown,
  passwordValue: unknown,
  db = getDb(),
) {
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    password.length < 6 ||
    password.length > 128
  )
    return null;
  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (
    !existing ||
    existing.status !== "active" ||
    !existing.passwordHash ||
    !(await compare(password, existing.passwordHash))
  )
    return null;
  const now = new Date();
  await db
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, existing.id));
  return { id: existing.id, email: existing.email, name: existing.name };
}
