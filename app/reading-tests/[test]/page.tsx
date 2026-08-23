import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ReadingTestClient from "./ReadingTestClient";

export default async function ReadingTestPage({ params, searchParams }: { params: Promise<{ test: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { test } = await params;
  const { mode } = await searchParams;
  if (!/^\d{2}$/.test(test) || Number(test) < 1 || Number(test) > 40) notFound();
  const file = await readFile(path.join(process.cwd(), "public", "data", "reading-tests", `test-${test}.json`), "utf8");
  const data = JSON.parse(file);
  return <ReadingTestClient test={Number(test)} questions={data.questions} mode={mode === "exam" ? "exam" : "review"}/>;
}
