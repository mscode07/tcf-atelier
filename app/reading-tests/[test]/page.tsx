import { redirect } from "next/navigation";
export default async function ReadingTestPage({
  params,
}: {
  params: Promise<{ test: string }>;
}) {
  const { test } = await params;
  redirect(`/practice/reading/${encodeURIComponent(test)}`);
}
