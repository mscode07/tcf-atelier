import { notFound, redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import ReadingTestClient from "./ReadingTestClient";

export default async function ReadingTestPage({ params }: { params: Promise<{ test: string }> }) {
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email);
  if (!access.active) redirect(`/?access=${session?.user?.email ? "subscription_required" : "signin_required"}`);
  const { test } = await params;
  if (!/^\d{2}$/.test(test) || Number(test) < 1 || Number(test) > 40) notFound();
  const file = await readFile(path.join(process.cwd(), "public", "data", "reading-tests", `test-${test}.json`), "utf8");
  const data = JSON.parse(file);
  return <ReadingTestClient test={Number(test)} questions={data.questions} mode="review"/>;
}
