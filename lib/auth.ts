import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tcf-session";
export const OAUTH_STATE_COOKIE = "tcf-oauth-state";
type Session = { email: string; exp: number };

function secret() {
  const value = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!value) throw new Error("Missing AUTH_SECRET or GOOGLE_CLIENT_SECRET");
  return value;
}
function signature(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 7 * 86400000 } satisfies Session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function readSession(value?: string): Session | null {
  if (!value) return null;
  const [payload, supplied] = value.split(".");
  if (!payload || !supplied) return null;
  const provided = Buffer.from(supplied); const expected = Buffer.from(signature(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try { const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session; return session.email && session.exp > Date.now() ? session : null; }
  catch { return null; }
}
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
