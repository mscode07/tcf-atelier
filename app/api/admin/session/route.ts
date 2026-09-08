import { NextResponse } from "next/server";
import {
  adminError,
  AdminError,
  checkAdminOrigin,
  hasAdminSession,
} from "@/lib/admin/auth";
import {
  ADMIN_COOKIE,
  checkPasscode,
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
    if (!(await limitedLogin(() => checkPasscode(body?.passcode))))
      throw new AdminError("Incorrect passcode. Please try again.", 401);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
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
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
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
