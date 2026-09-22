import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { studentFeedback, users } from "@/lib/db/schema";
import { isModule } from "@/lib/admin/types";

const CATEGORIES = ["bug", "content", "payment", "other"] as const;
type Category = (typeof CATEGORIES)[number];
const isCategory = (v: unknown): v is Category =>
  typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);

export async function POST(request: Request) {
  try {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email)
      return NextResponse.json(
        { error: "Please sign in to send feedback." },
        { status: 401 },
      );
    const body = (await request.json().catch(() => null)) as {
      category?: unknown;
      message?: unknown;
      module?: unknown;
    } | null;
    const category = isCategory(body?.category) ? body.category : null;
    const message =
      typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!category)
      return NextResponse.json(
        { error: "Choose what kind of problem this is." },
        { status: 400 },
      );
    if (message.length < 5)
      return NextResponse.json(
        { error: "Tell us a bit more about the problem." },
        { status: 400 },
      );
    const db = getDb();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!user)
      return NextResponse.json(
        { error: "Your account could not be found. Please sign in again." },
        { status: 404 },
      );
    await db.insert(studentFeedback).values({
      userId: user.id,
      category,
      message,
      module: isModule(body?.module) ? body.module : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not send your feedback. Please try again." },
      { status: 500 },
    );
  }
}
