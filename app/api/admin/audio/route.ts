import { NextResponse } from "next/server";
import { requireAdmin, AdminError, adminError } from "@/lib/admin/auth";
import { storeAudio } from "@/lib/admin/audio";
import { isModule } from "@/lib/admin/types";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 10_500_000)
      throw new AdminError("Choose a file up to 10 MB.", 413);
    const form = await request.formData();
    const file = form.get("file"),
      module = form.get("module");
    if (!(file instanceof File) || !isModule(module))
      throw new AdminError("Choose a module and audio file.");
    return NextResponse.json({ audioUrl: await storeAudio(file, module) });
  } catch (e) {
    return adminError(e);
  }
}
