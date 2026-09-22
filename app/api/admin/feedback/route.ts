import { NextResponse } from "next/server";
import { adminError, readBody, requireAdmin } from "@/lib/admin/auth";
import { listFeedback, setFeedbackStatus } from "@/lib/admin/feedback";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listFeedback(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return adminError(e);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await readBody(request);
    const row = await setFeedbackStatus(body?.id, body?.status, admin.id);
    return NextResponse.json({ feedback: row });
  } catch (e) {
    return adminError(e);
  }
}
