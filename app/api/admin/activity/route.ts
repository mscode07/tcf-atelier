import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin/auth";
import { adminSummary } from "@/lib/admin/summary";
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await adminSummary(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return adminError(e);
  }
}
