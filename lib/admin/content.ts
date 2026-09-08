import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  adminActivity,
  courseModules,
  materialContent,
  materialRevisions,
  practiceTests,
} from "@/lib/db/schema";
import { MaterialTest, ModuleKey } from "./types";
import { questionIssues } from "./import";
import { AdminError } from "./errors";
export async function publishedContent(module: ModuleKey) {
  return getDb()
    .select()
    .from(materialContent)
    .where(
      and(
        eq(materialContent.module, module),
        eq(materialContent.status, "published"),
      ),
    )
    .orderBy(materialContent.testNumber);
}
export async function saveTests(
  actorId: string,
  tests: MaterialTest[],
  mode: "append" | "replace",
  versions: Record<string, number> = {},
  database = getDb(),
) {
  if (!tests.length || tests.length > 500)
    throw new AdminError("Select between 1 and 500 tests.");
  if (
    new Set(tests.map((t) => `${t.module}:${t.testNumber}`)).size !==
    tests.length
  )
    throw new AdminError("Duplicate test numbers in the update.");
  for (const t of tests) {
    if (t.status === "published") {
      if (!t.questions.length)
        throw new AdminError(
          `${t.title}: add at least one question before publishing.`,
        );
      const problem = t.questions.flatMap((q, i) =>
        questionIssues(q, t.module).map((s) => `Question ${i + 1}: ${s}`),
      );
      if (problem.length) throw new AdminError(`${t.title}: ${problem[0]}`);
    }
  }
  return database.transaction(async (tx) => {
    // Serialize content operations so replacements and concurrent imports cannot lose edits.
    await tx.execute(sql`select pg_advisory_xact_lock(781903)`);
    for (const test of tests) {
      const [old] = await tx
        .select()
        .from(materialContent)
        .where(
          and(
            eq(materialContent.module, test.module),
            eq(materialContent.testNumber, test.testNumber),
          ),
        );
      const expected = versions[`${test.module}:${test.testNumber}`];
      if (old && expected !== old.version)
        throw new AdminError(
          `${test.title} changed since you opened it. Reload before saving.`,
          409,
        );
      if (!old && expected)
        throw new AdminError(
          "This test no longer exists. Reload before saving.",
          409,
        );
      if (old) {
        await tx
          .insert(materialRevisions)
          .values({
            contentId: old.id,
            version: old.version,
            snapshot: old,
            actorId,
          });
        const questions =
          mode === "append"
            ? [
                ...old.questions,
                ...test.questions.map((q) => ({
                  ...q,
                  id: crypto.randomUUID(),
                })),
              ]
            : test.questions;
        if (test.status === "published") {
          const issue = questions.flatMap((q) =>
            questionIssues(q, test.module),
          )[0];
          if (issue) throw new AdminError(`${test.title}: ${issue}`);
        }
        if (questions.length > 1000)
          throw new AdminError("A test can contain at most 1,000 questions.");
        await tx
          .update(materialContent)
          .set({
            ...test,
            questions,
            version: old.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(materialContent.id, old.id));
      } else await tx.insert(materialContent).values(test);
      const [module] = await tx
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(eq(courseModules.type, test.module))
        .limit(1);
      if (module)
        await tx
          .insert(practiceTests)
          .values({
            moduleId: module.id,
            testNumber: test.testNumber,
            title: test.title,
            isPublished: test.status === "published",
            totalPoints: test.questions.length,
          })
          .onConflictDoUpdate({
            target: [practiceTests.moduleId, practiceTests.testNumber],
            set: {
              title: test.title,
              isPublished: test.status === "published",
              totalPoints: test.questions.length,
              updatedAt: new Date(),
            },
          });
    }
    await tx.insert(adminActivity).values({
      actorId,
      action: mode === "append" ? "Questions added" : "Content updated",
      detail: `${tests.length} test(s): ${tests
        .slice(0, 8)
        .map((t) => t.title)
        .join(", ")}${tests.length > 8 ? "…" : ""}`,
    });
    return { saved: tests.length };
  });
}
