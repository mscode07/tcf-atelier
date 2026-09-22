import { NextResponse } from "next/server";
import { google } from "googleapis";
import { newOAuthClient, saveDriveConnection } from "@/lib/google-drive";
import { STATE_COOKIE } from "../start/route";

function redirectWithNotice(origin: string, notice: string) {
  const response = NextResponse.redirect(
    `${origin}/admin?driveNotice=${encodeURIComponent(notice)}`,
  );
  response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

// No requireAdmin() here: the httpOnly admin-session cookie is SameSite=strict
// and is withheld by the browser on this very redirect back from Google, since
// the navigation's initiator is accounts.google.com. The random `state` value
// (only ever handed out by /start, which does require admin) is what proves
// this callback belongs to an admin-initiated flow.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !cookieState || state !== cookieState)
    return redirectWithNotice(origin, "Could not verify the Drive connection request. Try again.");
  try {
    const client = newOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token)
      return redirectWithNotice(
        origin,
        "Google did not grant lasting access. Remove TCF material from your Google Account's third-party access list, then try connecting again.",
      );
    client.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: client });
    const { data } = await drive.about.get({ fields: "user" });
    await saveDriveConnection(
      tokens.refresh_token,
      data.user?.emailAddress ?? null,
    );
    return redirectWithNotice(origin, "Google Drive connected.");
  } catch {
    return redirectWithNotice(origin, "Could not connect Google Drive. Try again.");
  }
}
