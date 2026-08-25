import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";

export async function proxy(request: NextRequest) {
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email);
  if (access.active) return NextResponse.next();

  const destination = new URL("/", request.url);
  destination.searchParams.set("access", session?.user?.email ? "subscription_required" : "signin_required");
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/listening-tests/:path*",
    "/listening-player.css",
    "/listening-progress.js",
    "/data/reading-tests/:path*",
  ],
};
