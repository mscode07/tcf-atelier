import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminSessions } from "@/lib/db/schema";
import {
  checkStoredPassword,
  replaceAdminPassword,
  sessionHash,
  sessionExpiry,
  storeAdminSession,
} from "@/lib/admin/session-store";
import { NextResponse } from "next/server";
import {
  adminError,
  AdminError,
  checkAdminOrigin,
  hasAdminSession,
} from "@/lib/admin/auth";
import {
  ADMIN_COOKIE,
  createAdminSession,
  adminSessionConfigured,
  SESSION_SECONDS,
} from "@/lib/admin/password";
import { limitedLogin } from "@/lib/admin/login-limit";
import {
  isStrongAdminPassword,
  ADMIN_PASSWORD_HELP,
} from "@/lib/admin/password-policy";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(
    { authenticated: await hasAdminSession() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    checkAdminOrigin(request);
    if (!adminSessionConfigured())
      throw new AdminError("Admin sign-in is not configured yet.", 503);
    const raw = await request.text();
    if (raw.length > 1024) throw new AdminError("Enter your admin password.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Enter your admin password.");
    }
    if (!(await limitedLogin(() => checkStoredPassword(body?.password))))
      throw new AdminError("Incorrect password. Please try again.", 401);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    const token = createAdminSession();
    await storeAdminSession(token);
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (e) {
    return adminError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    checkAdminOrigin(request);
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (token)
      await getDb()
        .delete(adminSessions)
        .where(eq(adminSessions.tokenHash, sessionHash(token)));
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    return adminError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    checkAdminOrigin(request);
    const token = (await cookies()).get(ADMIN_COOKIE)?.value;
    if (!token) throw new AdminError("Panel locked.", 401);
    const rows = await getDb()
      .update(adminSessions)
      .set({ expiresAt: sessionExpiry() })
      .where(
        and(
          eq(adminSessions.tokenHash, sessionHash(token)),
          gt(adminSessions.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!rows.length) throw new AdminError("Panel locked.", 401);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (e) {
    return adminError(e);
  }
}
export async function PUT(request: Request) {
  try {
    checkAdminOrigin(request);
    if (!(await hasAdminSession())) throw new AdminError("Panel locked.", 401);
    const raw = await request.text();
    if (raw.length > 2048) throw new AdminError("Invalid password request.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Invalid password request.");
    }
    if (!isStrongAdminPassword(body?.newPassword))
      throw new AdminError(ADMIN_PASSWORD_HELP);
    if (body.newPassword !== body.confirmPassword)
      throw new AdminError("The new passwords do not match.");
    if (!(await limitedLogin(() => checkStoredPassword(body.currentPassword))))
      throw new AdminError("Current password is incorrect.", 401);
    await replaceAdminPassword(body.newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminError(e);
  }
}
