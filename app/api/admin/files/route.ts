import { NextResponse } from "next/server";
import { adminError, AdminError, requireAdmin } from "@/lib/admin/auth";
import { createFile, listFiles } from "@/lib/admin/files";
import { getDriveConnection } from "@/lib/google-drive";

export async function GET() {
  try {
    await requireAdmin();
    const [files, drive] = await Promise.all([
      listFiles(),
      getDriveConnection(),
    ]);
    return NextResponse.json(
      {
        files,
        drive: {
          connected: Boolean(drive),
          accountEmail: drive?.accountEmail ?? null,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 26_000_000)
      throw new AdminError("Choose a file up to 25 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AdminError("Choose a file.");
    const row = await createFile(
      {
        file,
        name: form.get("name"),
        description: form.get("description"),
        module: form.get("module"),
      },
      admin.id,
    );
    return NextResponse.json({ file: row });
  } catch (e) {
    return adminError(e);
  }
}
