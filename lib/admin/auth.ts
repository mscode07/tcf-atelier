import { validSession } from "./session-store";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ADMIN_COOKIE } from "./passcode";
import { NextResponse } from "next/server";
import { AdminError } from "./errors";
export { AdminError } from "./errors";
export async function hasAdminSession() {
  return validSession((await cookies()).get(ADMIN_COOKIE)?.value);
}
export function checkAdminOrigin(request: Request) {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    const expected = new URL(process.env.AUTH_URL || request.url).origin;
    if (!origin || origin !== expected)
      throw new AdminError("Invalid request origin.", 403);
  }
}
export async function requireAdmin(request?: Request) {
  if (request) checkAdminOrigin(request);
  if (!(await hasAdminSession()))
    throw new AdminError("Enter the admin passcode to continue.", 401);
  const actor = {
    id: "a5c2fda9-4189-4862-a9fd-38853a946b51",
    name: "Administrator",
    email: "passcode-admin@tcf.internal.invalid",
  };
  if (request && request.method !== "GET") {
    await getDb()
      .insert(users)
      .values({ ...actor, role: "admin", primaryProvider: "passcode" })
      .onConflictDoNothing({ target: users.id });
  }
  return actor;
}
export function adminError(error: unknown) {
  if (error instanceof AdminError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(
    "Admin operation failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    {
      error:
        "The operation could not be completed. Check the database connection and migrations, then retry.",
    },
    { status: 500 },
  );
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 12_000_000)
    throw new AdminError(
      "This update is too large. Split it into smaller batches.",
      413,
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new AdminError("Invalid JSON request.");
  }
}
