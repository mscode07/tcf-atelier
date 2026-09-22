import { NextResponse } from "next/server";
import {
  adminError,
  AdminError,
  checkAdminOrigin,
  hasAdminSession,
} from "@/lib/admin/auth";
import {
  getSecurityQuestions,
  setSecurityQuestions,
} from "@/lib/admin/security-questions";
import { checkStoredPassword } from "@/lib/admin/session-store";
import { limitedLogin } from "@/lib/admin/login-limit";

// Public: the Forgot password screen needs the question text while signed out.
// Only the question wording is exposed here, never the answers.
export async function GET() {
  try {
    return NextResponse.json(
      { questions: await getSecurityQuestions() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}

export async function POST(request: Request) {
  try {
    checkAdminOrigin(request);
    if (!(await hasAdminSession())) throw new AdminError("Panel locked.", 401);
    const raw = await request.text();
    if (raw.length > 2048) throw new AdminError("Invalid request.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Invalid request.");
    }
    if (!(await limitedLogin(() => checkStoredPassword(body?.currentPassword))))
      throw new AdminError("Current password is incorrect.", 401);
    await setSecurityQuestions(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminError(e);
  }
}
