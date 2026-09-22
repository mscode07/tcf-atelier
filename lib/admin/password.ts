import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isAdminPasswordInput, isStrongAdminPassword } from "./password-policy";

export const ADMIN_COOKIE = "tcf-admin-session";
export const SESSION_SECONDS = 5 * 60;
function configuration() {
  const password =
    process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSCODE || "";
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET || "";
  return secret.length >= 32 ? { password, secret } : null;
}
export const adminSessionConfigured = () => Boolean(configuration());
export function checkAdminPassword(input: unknown) {
  const config = configuration();
  if (!config || !isAdminPasswordInput(input)) return false;
  // Keep the old environment PIN usable only to migrate to a new password.
  const validBootstrap = process.env.ADMIN_PASSWORD
    ? isStrongAdminPassword(config.password)
    : isStrongAdminPassword(config.password) || /^\d{4}$/.test(config.password);
  if (!validBootstrap) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(config.password).digest(),
  );
}
function signature(payload: string) {
  const config = configuration();
  if (!config) throw new Error("Admin session secret is not configured.");
  return createHmac("sha256", config.secret)
    .update(`${config.password}:${payload}`)
    .digest("hex");
}
export function createAdminSession(now = Date.now()) {
  const payload = `${now + SESSION_SECONDS * 1000}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}
export function verifyAdminSession(
  token: string | undefined,
  now = Date.now(),
) {
  if (!configuration() || !token || token.length > 160) return false;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    !/^\d+$/.test(parts[0]) ||
    !/^[a-f0-9]{48}$/.test(parts[1]) ||
    !/^[a-f0-9]{64}$/.test(parts[2])
  )
    return false;
  const expiry = Number(parts[0]);
  if (expiry <= now || expiry > now + SESSION_SECONDS * 1000) return false;
  return timingSafeEqual(
    Buffer.from(parts[2], "hex"),
    Buffer.from(signature(`${parts[0]}.${parts[1]}`), "hex"),
  );
}
