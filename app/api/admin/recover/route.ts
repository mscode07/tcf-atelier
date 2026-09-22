import { NextResponse } from "next/server";
import { adminError, AdminError, checkAdminOrigin } from "@/lib/admin/auth";
import { adminSessionConfigured, checkAdminPassword } from "@/lib/admin/password";
import { replaceAdminPassword } from "@/lib/admin/session-store";
import { checkSecurityAnswers } from "@/lib/admin/security-questions";
import { limitedLogin } from "@/lib/admin/login-limit";
import {
  ADMIN_PASSWORD_HELP,
  isStrongAdminPassword,
} from "@/lib/admin/password-policy";

// A forgotten admin password is recovered one of two ways:
//  - security question answers, set up in advance from inside the panel
//  - the ADMIN_PASSWORD / ADMIN_PASSCODE environment variable, the
//    deploy-time secret only the hosting owner controls — a fallback that
//    always works even if security questions were never set up. Whoever can
//    set that env var already has full server access, so this adds no new
//    attack surface, and neither path needs email infrastructure.
export async function POST(request: Request) {
  try {
    checkAdminOrigin(request);
    if (!adminSessionConfigured())
      throw new AdminError("Admin sign-in is not configured yet.", 503);
    const raw = await request.text();
    if (raw.length > 2048) throw new AdminError("Invalid recovery request.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Invalid recovery request.");
    }
    if (!isStrongAdminPassword(body?.newPassword))
      throw new AdminError(ADMIN_PASSWORD_HELP);
    if (body.newPassword !== body.confirmPassword)
      throw new AdminError("The new passwords do not match.");
    const usingQuestions =
      typeof body?.answer1 === "string" || typeof body?.answer2 === "string";
    const authorized = await limitedLogin(() =>
      usingQuestions
        ? checkSecurityAnswers({ answer1: body?.answer1, answer2: body?.answer2 })
        : checkAdminPassword(body?.recoveryKey),
    );
    if (!authorized)
      throw new AdminError(
        usingQuestions
          ? "Those answers don't match."
          : "Incorrect recovery key.",
        401,
      );
    await replaceAdminPassword(body.newPassword);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}
