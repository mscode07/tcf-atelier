import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { isModule } from "@/lib/admin/types";
import { publishedContent } from "@/lib/admin/content";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  const { module } = await params;
  if (!isModule(module))
    return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email, module);
  if (!access.active)
    return NextResponse.json(
      { error: "Module access required" },
      { status: 403 },
    );
  const tests = await publishedContent(module);
  if (new URL(request.url).searchParams.get("catalog") === "1")
    return NextResponse.json(
      {
        tests: tests.map((t) => ({
          testNumber: t.testNumber,
          title: t.title,
          questionCount: t.questions.length,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const questions = tests.flatMap((t) =>
    t.questions.map((q, i) =>
      module === "writing"
        ? {
            id: t.testNumber === 1 ? q.id : `${t.id}:${q.id}`,
            taskType: `tache_${q.task}`,
            prompt: q.prompt,
            correction: q.referenceAnswer,
            topic: q.extra.title || q.category,
            broadCategory: q.category,
            topicHeading: q.extra.topicHeading || "",
            document1: q.document1,
            document2: q.document2,
            variantCount: 1,
          }
        : module === "speaking"
          ? {
              id: t.testNumber === 1 && /^\d+$/.test(q.id) ? Number(q.id) : `${t.id}:${q.id}`,
              number: i + 1,
              coverageMode: "quick",
              tache: q.task,
              category: q.category,
              titleFr: q.extra.title || q.category,
              promptFr: q.prompt,
              durationSeconds: q.durationSeconds,
              referenceAnswer: { text: q.referenceAnswer },
              quickSetSupport: q.extra.quickSetSupport,
            }
          : { ...q, number: i + 1, question: q.prompt },
    ),
  );
  return NextResponse.json(
    { questions },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
