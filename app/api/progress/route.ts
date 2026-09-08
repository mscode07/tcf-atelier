import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { getAccessByEmail } from "@/lib/access";
import {
  courseModules,
  materialContent,
  practiceTests,
  testAttempts,
} from "@/lib/db/schema";

type ModuleKey = "listening" | "reading";
const MODULES: ModuleKey[] = ["listening", "reading"];

async function currentUserId() {
  const session = await auth();
  const access = await getAccessByEmail(session?.user?.email);
  return access.active ? access.userId : null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await getDb()
    .select({
      module: courseModules.type,
      testNumber: practiceTests.testNumber,
      status: testAttempts.status,
      percentage: testAttempts.percentage,
      score: testAttempts.score,
      maxScore: testAttempts.maxScore,
      updatedAt: testAttempts.updatedAt,
    })
    .from(testAttempts)
    .innerJoin(practiceTests, eq(testAttempts.testId, practiceTests.id))
    .innerJoin(courseModules, eq(practiceTests.moduleId, courseModules.id))
    .where(eq(testAttempts.userId, userId))
    .orderBy(desc(testAttempts.updatedAt));

  const modules = Object.fromEntries(
    MODULES.map((module) => {
      const moduleRows = rows.filter((row) => row.module === module);
      const latestByTest = new Map<number, (typeof moduleRows)[number]>();
      for (const row of moduleRows)
        if (!latestByTest.has(row.testNumber))
          latestByTest.set(row.testNumber, row);
      const tests = Array.from(latestByTest.values()).map((row) => ({
        testNumber: row.testNumber,
        status:
          row.status === "evaluated" || row.status === "submitted"
            ? "completed"
            : "in_progress",
        percentage: row.percentage ?? 0,
      }));
      const completed = moduleRows.filter(
        (row) => row.status === "evaluated" || row.status === "submitted",
      );
      const recentScores = completed
        .slice(0, 5)
        .reverse()
        .map((row) => row.percentage ?? 0);
      const average = completed.length
        ? Math.round(
            completed.reduce((sum, row) => sum + (row.percentage ?? 0), 0) /
              completed.length,
          )
        : 0;
      return [
        module,
        {
          tests,
          attempted: tests.length,
          completed: tests.filter((test) => test.status === "completed").length,
          average,
          best: completed.length
            ? Math.max(...completed.map((row) => row.percentage ?? 0))
            : 0,
          recentScores,
        },
      ];
    }),
  );

  const reading = modules.reading;
  const listening = modules.listening;
  const completedCount = reading.completed + listening.completed;
  const overallAverage = completedCount
    ? Math.round(
        (reading.average * reading.completed +
          listening.average * listening.completed) /
          completedCount,
      )
    : 0;

  return NextResponse.json({
    modules,
    overall: {
      attempted: reading.attempted + listening.attempted,
      completed: completedCount,
      average: overallAverage,
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as null | {
    module?: string;
    contentVersion?: number;
    testNumber?: number;
    status?: "in_progress" | "completed";
    score?: number;
    maxScore?: number;
    answeredCount?: number;
  };
  const module = body?.module?.toLowerCase() as ModuleKey | undefined;
  const testNumber = Number(body?.testNumber);
  if (
    !module ||
    !MODULES.includes(module) ||
    !Number.isInteger(testNumber) ||
    testNumber < 1 ||
    testNumber > 10000 ||
    !body?.status
  ) {
    return NextResponse.json({ error: "invalid_progress" }, { status: 400 });
  }

  const session = await auth();
  if (!(await getAccessByEmail(session?.user?.email, module)).active)
    return NextResponse.json(
      { error: "module_access_required" },
      { status: 403 },
    );
  const db = getDb();
  const [content] = await db
    .select({ version: materialContent.version })
    .from(materialContent)
    .where(
      and(
        eq(materialContent.module, module),
        eq(materialContent.testNumber, testNumber),
        eq(materialContent.status, "published"),
      ),
    )
    .limit(1);
  if (!content || body.contentVersion !== content.version)
    return NextResponse.json(
      {
        error:
          "This test was updated or unpublished. Reload the test before continuing.",
      },
      { status: 409 },
    );
  const [test] = await db
    .select({ id: practiceTests.id, maxAttempts: practiceTests.maxAttempts })
    .from(practiceTests)
    .innerJoin(courseModules, eq(practiceTests.moduleId, courseModules.id))
    .where(
      and(
        eq(courseModules.type, module),
        eq(practiceTests.testNumber, testNumber),
      ),
    )
    .limit(1);
  if (!test)
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });

  const attempts = await db
    .select({
      id: testAttempts.id,
      attemptNumber: testAttempts.attemptNumber,
      status: testAttempts.status,
      contentVersion: testAttempts.contentVersion,
    })
    .from(testAttempts)
    .where(
      and(eq(testAttempts.userId, userId), eq(testAttempts.testId, test.id)),
    )
    .orderBy(desc(testAttempts.attemptNumber));
  const active = attempts.find(
    (attempt) =>
      attempt.status === "in_progress" &&
      attempt.contentVersion === content.version,
  );
  const now = new Date();
  const maxScore = Math.max(1, Math.min(1000, Number(body.maxScore) || 39));
  const score = Math.max(0, Math.min(maxScore, Number(body.score) || 0));
  const answered = Math.max(
    0,
    Math.min(maxScore, Number(body.answeredCount) || 0),
  );

  if (!active) {
    const attemptNumber = (attempts[0]?.attemptNumber ?? 0) + 1;
    if (attemptNumber > test.maxAttempts)
      return NextResponse.json(
        { error: "attempt_limit_reached" },
        { status: 409 },
      );
    const completed = body.status === "completed";
    await db.insert(testAttempts).values({
      userId,
      testId: test.id,
      attemptNumber,
      contentVersion: content.version,
      status: completed ? "evaluated" : "in_progress",
      score,
      maxScore,
      percentage: completed ? Math.round((score / maxScore) * 100) : null,
      tcfScore: completed ? Math.round((score / maxScore) * 699) : null,
      correctCount: completed ? score : 0,
      incorrectCount: completed ? Math.max(0, answered - score) : 0,
      skippedCount: completed ? Math.max(0, maxScore - answered) : 0,
      submittedAt: completed ? now : null,
      evaluatedAt: completed ? now : null,
      updatedAt: now,
    });
  } else {
    const completed = body.status === "completed";
    await db
      .update(testAttempts)
      .set({
        status: completed ? "evaluated" : "in_progress",
        score,
        maxScore,
        percentage: completed ? Math.round((score / maxScore) * 100) : null,
        tcfScore: completed ? Math.round((score / maxScore) * 699) : null,
        correctCount: completed ? score : 0,
        incorrectCount: completed ? Math.max(0, answered - score) : 0,
        skippedCount: completed ? Math.max(0, maxScore - answered) : 0,
        submittedAt: completed ? now : null,
        evaluatedAt: completed ? now : null,
        updatedAt: now,
      })
      .where(eq(testAttempts.id, active.id));
  }

  return NextResponse.json({ ok: true });
}
