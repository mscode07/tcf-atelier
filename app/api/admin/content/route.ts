import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { materialContent } from "@/lib/db/schema";
import {
  adminError,
  AdminError,
  readBody,
  requireAdmin,
} from "@/lib/admin/auth";
import { normalizeImport } from "@/lib/admin/import";
import { saveTests } from "@/lib/admin/content";
import { isModule, MaterialTest } from "@/lib/admin/types";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const module = new URL(request.url).searchParams.get("module");
    if (!isModule(module)) throw new AdminError("Choose a module.");
    return NextResponse.json(
      {
        tests: await getDb()
          .select()
          .from(materialContent)
          .where(eq(materialContent.module, module))
          .orderBy(materialContent.testNumber),
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
    const body = await readBody(request);
    if (!isModule(body.module) || !["append", "replace"].includes(body.mode))
      throw new AdminError("Choose a valid module and import mode.");
    if (!Array.isArray(body.tests) || !body.tests.length)
      throw new AdminError("Select tests to save.");
    // Empty drafts/archives are allowed, while every nonempty question is normalized server-side.
    const tests: MaterialTest[] = body.tests.map((t: MaterialTest) => {
      if (t.module !== body.module)
        throw new AdminError("All tests must belong to the selected module.");
      if (
        !["draft", "published", "archived"].includes(t.status) ||
        !Array.isArray(t.questions)
      )
        throw new AdminError("Invalid test status or questions.");
      if (
        !Number.isInteger(t.testNumber) ||
        t.testNumber < 1 ||
        t.testNumber > 10000 ||
        typeof t.title !== "string" ||
        !t.title.trim() ||
        t.title.length > 200
      )
        throw new AdminError(
          "Use a title of 1–200 characters and a test number of 1–10,000.",
        );
      const normalized = t.questions.length
        ? normalizeImport({ ...t, test: t.testNumber }, body.module)[0]
        : {
            module: body.module,
            testNumber: t.testNumber,
            title: t.title,
            questions: [],
          };
      return { ...normalized, status: t.status };
    });
    const result = await saveTests(
      admin.id,
      tests,
      body.mode,
      body.versions || {},
    );
    return NextResponse.json(result);
  } catch (e) {
    return adminError(e);
  }
}
