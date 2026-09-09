import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export const ADMIN_COOKIE = "tcf-admin-session";
export const SESSION_SECONDS = 5 * 60;
function configuration() {
  const pin = process.env.ADMIN_PASSCODE || "";
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET || "";
  return /^\d{4}$/.test(pin) && secret.length >= 32 ? { pin, secret } : null;
}
export const passcodeConfigured = () => Boolean(configuration());
export function checkPasscode(input: unknown) {
  const config = configuration();
  if (!config || typeof input !== "string" || !/^\d{4}$/.test(input))
    return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(config.pin).digest(),
  );
}
function signature(payload: string) {
  const config = configuration();
  if (!config) throw new Error("Admin passcode is not configured.");
  return createHmac("sha256", config.secret)
    .update(`${config.pin}:${payload}`)
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
