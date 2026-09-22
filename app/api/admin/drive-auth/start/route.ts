import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { DRIVE_SCOPE, newOAuthClient } from "@/lib/google-drive";

export const STATE_COOKIE = "tcf-drive-oauth-state";

export async function GET() {
  await requireAdmin();
  const state = randomBytes(24).toString("hex");
  const client = newOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE],
    state,
  });
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
