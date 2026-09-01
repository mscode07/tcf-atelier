import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email);
  if (access.active) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    response.headers.set("Permissions-Policy", "display-capture=(), clipboard-read=(), clipboard-write=()");
    return response;
  }

  const destination = new URL("/", request.url);
  destination.searchParams.set("access", session?.user?.email ? "subscription_required" : "signin_required");
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/listening-tests/:path*",
    "/reading-tests/:path*",
    "/listening-player.css",
    "/listening-progress.js",
    "/data/reading-tests/:path*",
  ],
};
