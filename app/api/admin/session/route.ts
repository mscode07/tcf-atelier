import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { hash } from "bcryptjs";
import { getDb } from "@/lib/db";
import { adminSessions, adminSettings, users } from "@/lib/db/schema";
import {
  checkStoredPasscode,
  sessionHash,
  sessionExpiry,
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
  passcodeConfigured,
  SESSION_SECONDS,
} from "@/lib/admin/passcode";
import { limitedLogin } from "@/lib/admin/login-limit";
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
    if (!passcodeConfigured())
      throw new AdminError("Admin sign-in is not configured yet.", 503);
    const raw = await request.text();
    if (raw.length > 100) throw new AdminError("Enter a four-digit passcode.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Enter a four-digit passcode.");
    }
    if (!(await limitedLogin(() => checkStoredPasscode(body?.passcode))))
      throw new AdminError("Incorrect passcode. Please try again.", 401);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    const token = createAdminSession();
    await getDb()
      .insert(users)
      .values({
        id: "a5c2fda9-4189-4862-a9fd-38853a946b51",
        name: "Administrator",
        email: "passcode-admin@tcf.internal.invalid",
        role: "admin",
        primaryProvider: "passcode",
      })
      .onConflictDoNothing();
    await getDb()
      .insert(adminSessions)
      .values({ tokenHash: sessionHash(token), expiresAt: sessionExpiry() });
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
    if (raw.length > 300) throw new AdminError("Invalid passcode request.");
    const body = JSON.parse(raw);
    if (
      !/^\d{4}$/.test(body.newPasscode) ||
      body.newPasscode !== body.confirmPasscode
    )
      throw new AdminError("Enter and confirm a four-digit passcode.");
    if (!(await limitedLogin(() => checkStoredPasscode(body.currentPasscode))))
      throw new AdminError("Current passcode is incorrect.", 401);
    const passcodeHash = await hash(body.newPasscode, 12);
    await getDb().transaction(async (tx) => {
      await tx
        .insert(adminSettings)
        .values({ id: "main", passcodeHash })
        .onConflictDoUpdate({
          target: adminSettings.id,
          set: { passcodeHash },
        });
      await tx.delete(adminSessions);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminError(e);
  }
}
