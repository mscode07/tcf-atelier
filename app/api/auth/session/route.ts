import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
export async function GET(request: NextRequest) { const session = readSession(request.cookies.get(SESSION_COOKIE)?.value); return NextResponse.json({ user: session ? { email: session.email } : null }); }
