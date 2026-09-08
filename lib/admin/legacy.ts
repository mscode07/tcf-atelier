import { readFile } from "node:fs/promises";
import path from "node:path";
import { MaterialTest, ModuleKey } from "./types";
import { normalizeImport, questionIssues } from "./import";
export async function legacyContent(
  module: ModuleKey,
): Promise<MaterialTest[]> {
  if (module === "writing" || module === "speaking") {
    const raw = JSON.parse(
      await readFile(
        path.join(process.cwd(), "public/data", `${module}-questions.json`),
        "utf8",
      ),
    );
    return normalizeImport(raw, module).map((t) => ({
      ...t,
      title: `${module === "writing" ? "Writing" : "Speaking"} question bank`,
      status: "published",
    }));
  }
  return Promise.all(
    Array.from({ length: 40 }, async (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      let raw;
      if (module === "reading")
        raw = JSON.parse(
          await readFile(
            path.join(
              process.cwd(),
              "public/data/reading-tests",
              `test-${n}.json`,
            ),
            "utf8",
          ),
        );
      else {
        const html = await readFile(
          path.join(process.cwd(), "public/listening-tests", `test-${n}.html`),
          "utf8",
        );
        const match = html.match(
          /(?:const|let|var)\s+[Qq][Uu][Ee][Ss][Tt][Ii][Oo][Nn][Ss]\s*=\s*(\[[\s\S]*?\]);/,
        );
        if (!match) throw new Error(`Cannot read Listening Test ${n}`);
        raw = { test: i + 1, questions: JSON.parse(match[1]) };
      }
      const [test] = normalizeImport(raw, module, i + 1);
      // Original audio-only choices use A/B/C/D as their visible labels.
      test.questions.forEach((q) => {
        q.options = q.options.map(
          (o, j) => o || `Option ${String.fromCharCode(65 + j)}`,
        );
      });
      return {
        ...test,
        status: test.questions.some((q) => questionIssues(q, module).length)
          ? ("draft" as const)
          : ("published" as const),
      };
    }),
  );
}
