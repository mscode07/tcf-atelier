import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/admin/auth";
import { deleteFile } from "@/lib/admin/files";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    await deleteFile(id, admin.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return adminError(e);
  }
}
