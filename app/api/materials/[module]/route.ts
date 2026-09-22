import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { isModule } from "@/lib/admin/types";
import { publishedCatalog, publishedContent } from "@/lib/admin/content";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ module: string }> },
) {
  try {
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
  if (new URL(request.url).searchParams.get("catalog") === "1") {
    const tests = await publishedCatalog(module);
    return NextResponse.json(
      { tests },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  }
  const url = new URL(request.url);
  const tests = await publishedContent(module);
  const questions = tests.flatMap((t) =>
    t.questions.map((q, i) =>
      module === "writing"
        ? {
            id: t.testNumber === 1 ? q.id : `${t.id}:${q.id}`,
            audioUrl: q.audioUrl,
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
              audioUrl: q.audioUrl,
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
  // Writing and speaking libraries can be large. Return lightweight cards first,
  // then send the protected prompt and reference answer only when it is opened.
  if (module === "writing" || module === "speaking") {
    const detailId = url.searchParams.get("id");
    if (detailId) {
      const question = questions.find((item) => String(item.id) === detailId);
      if (!question)
        return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
      return NextResponse.json(
        { question },
        { headers: { "Cache-Control": "private, max-age=60" } },
      );
    }
    const limit = Math.min(
      20,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") || "12", 10) || 12),
    );
    const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    const task = url.searchParams.get("task");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search")?.trim().toLocaleLowerCase("fr");
    const filtered = questions.filter((item) => {
      const itemTask = module === "writing" ? item.taskType : item.tache;
      const itemCategory = module === "writing" ? item.broadCategory : item.category;
      const text = module === "writing"
        ? `${item.topic} ${item.topicHeading} ${item.broadCategory}`
        : `${item.category} ${item.titleFr}`;
      return (
        (!task || task === "all" || String(itemTask) === task) &&
        (!category || category === "all" || itemCategory === category) &&
        (!search || text.toLocaleLowerCase("fr").includes(search))
      );
    });
    const summaries = filtered.slice(offset, offset + limit).map((item) =>
      module === "writing"
        ? {
            id: item.id,
            taskType: item.taskType,
            topic: item.topic,
            broadCategory: item.broadCategory,
            topicHeading: item.topicHeading,
          }
        : {
            id: item.id,
            number: item.number,
            tache: item.tache,
            category: item.category,
            titleFr: item.titleFr,
            durationSeconds: item.durationSeconds,
          },
    );
    const categories = Array.from(
      new Set(
        questions.map((item) =>
          module === "writing" ? item.broadCategory : item.category,
        ),
      ),
    ).sort();
    const taskCounts = questions.reduce<Record<string, number>>((counts, item) => {
      const key = String(module === "writing" ? item.taskType : item.tache);
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    return NextResponse.json(
      { questions: summaries, total: filtered.length, categories, taskCounts },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  }
  return NextResponse.json(
    { questions },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  } catch (error) {
    console.error("Materials request failed", error);
    return NextResponse.json(
      { error: "Practice material is taking too long to load. Please retry." },
      { status: 503 },
    );
  }
}
