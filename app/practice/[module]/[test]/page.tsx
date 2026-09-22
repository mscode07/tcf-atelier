import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { publishedTest } from "@/lib/admin/content";
import ReadingTestClient from "@/app/reading-tests/[test]/ReadingTestClient";
export const dynamic = "force-dynamic";
export default async function PracticePage({
  params,
}: {
  params: Promise<{ module: string; test: string }>;
}) {
  const { module, test } = await params;
  if (module !== "reading" && module !== "listening") notFound();
  if (!/^\d+$/.test(test)) notFound();
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email, module);
  if (!access.active) redirect("/?access=subscription_required");
  const data = await publishedTest(module, Number(test));
  if (!data || !data.questions.length) notFound();
  return (
    <ReadingTestClient
      key={`${data.id}:${data.version}`}
      module={module}
      version={data.version}
      test={data.testNumber}
      questions={data.questions.map((q, i) => ({
        ...q,
        number: i + 1,
        question: q.prompt,
      }))}
      mode="review"
    />
  );
}
