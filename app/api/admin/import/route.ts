import { AUDIO_EXTENSIONS, storeAudio } from "@/lib/admin/audio";
import { NextResponse } from "next/server";
import { adminError, AdminError, requireAdmin } from "@/lib/admin/auth";
import { isModule } from "@/lib/admin/types";
import {
  normalizeImport,
  parseDocumentText,
  questionIssues,
} from "@/lib/admin/import";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (Number(request.headers.get("content-length")) > 10_500_000)
      throw new AdminError("Upload files smaller than 10 MB.", 413);
    const form = await request.formData();
    const file = form.get("file");
    const module = form.get("module");
    if (!(file instanceof File) || !isModule(module))
      throw new AdminError("Choose a module and a file.");
    if (file.size > 10_000_000)
      throw new AdminError("Upload files smaller than 10 MB.", 413);
    const number = Number(form.get("testNumber")) || 1;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let tests;
    try {
      if (ext && AUDIO_EXTENSIONS.includes(ext)) {
        const audioUrl = await storeAudio(file, module);
        tests = normalizeImport(
          [
            {
              testNumber: number,
              title: file.name.replace(/\.[^.]+$/, ""),
              questions: [{ audioUrl }],
            },
          ],
          module,
          number,
        );
      } else if (ext === "json")
        tests = normalizeImport(
          JSON.parse(buffer.toString("utf8")),
          module,
          number,
        );
      else {
        let text: string;
        if (ext === "docx") {
          const mammoth = await import("mammoth");
          text = (await mammoth.extractRawText({ buffer })).value;
        } else if (ext === "pdf") {
          const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
          const parsed = await pdf(buffer, { max: 200 });
          if (parsed.numpages > 200)
            throw new Error(
              "Split this PDF into files of no more than 200 pages.",
            );
          text = parsed.text;
        } else throw new Error("Choose a JSON, DOCX, or searchable PDF file.");
        tests = parseDocumentText(text, module, number);
      }
    } catch (e) {
      throw new AdminError(
        e instanceof Error ? e.message : "This file could not be read.",
      );
    }
    return NextResponse.json({
      tests,
      warnings: tests.flatMap((t) =>
        t.questions.flatMap((q, i) =>
          questionIssues(q, module).map(
            (issue) => `${t.title} · Q${i + 1}: ${issue}`,
          ),
        ),
      ),
    });
  } catch (e) {
    return adminError(e);
  }
}
