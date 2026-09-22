import { hash } from "bcryptjs";
import { getDb } from "../db";
import { users } from "../db/schema";
import { validateSignupEmail } from "./email-policy";
import { RegistrationError } from "./errors";
export { RegistrationError } from "./errors";

export function validatePassword(value: unknown, minimum = 8): string {
  if (
    typeof value !== "string" ||
    value.length < minimum ||
    Buffer.byteLength(value, "utf8") > 72
  )
    throw new RegistrationError(
      `Use at least ${minimum} characters and no more than 72 bytes for your password.`,
    );
  return value;
}
export function validateName(value: unknown, label: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name))
    throw new RegistrationError(`Enter your ${label} (up to 100 characters).`);
  return name;
}
export async function requestRegistration(
  input: Record<string, unknown>,
  db = getDb(),
) {
  const email = validateSignupEmail(input.email);
  const firstName = validateName(input.firstName, "first name");
  const lastName = validateName(input.lastName, "last name");
  const password = validatePassword(input.password);
  const [created] = await db
    .insert(users)
    .values({
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      passwordHash: await hash(password, 12),
      primaryProvider: "credentials",
      // Domain screening does not prove inbox ownership.
      emailVerifiedAt: null,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ email: users.email });
  if (!created)
    throw new RegistrationError(
      "An account already uses this email. Please sign in instead.",
      409,
    );
  return created;
}
