import { NextRequest, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE, cookieOptions, createSession } from "@/lib/auth";
type GoogleTokenResponse = { access_token?: string };
type GoogleUser = { email?: string; verified_email?: boolean };

export async function GET(request: NextRequest) {
  const redirect = (status: "success" | "error") => NextResponse.redirect(new URL(`/?auth=${status}`, request.nextUrl.origin));
  const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) return redirect("error");
  try {
    const callback = new URL("/api/auth/google/callback", request.nextUrl.origin);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: callback.toString(), grant_type: "authorization_code" }) });
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) return redirect("error");
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
    const googleUser = await userResponse.json() as GoogleUser;
    if (!userResponse.ok || !googleUser.email || !googleUser.verified_email) return redirect("error");
    const response = redirect("success");
    response.cookies.set(SESSION_COOKIE, createSession(googleUser.email), { ...cookieOptions, maxAge: 7 * 86400 });
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch { return redirect("error"); }
}
