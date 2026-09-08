import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeImport,
  parseDocumentText,
  questionIssues,
} from "../lib/admin/import";
import { evaluateAccess } from "../lib/admin/access-policy";
import { legacyContent } from "../lib/admin/legacy";
import { MODULES } from "../lib/admin/types";
import { checkPasscode, createAdminSession, verifyAdminSession, SESSION_SECONDS } from "../lib/admin/passcode";
import { limitedLogin } from "../lib/admin/login-limit";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("passcode sessions reject incorrect codes, tampering, expiry and rotated secrets", () => {
  const previousPin = process.env.ADMIN_PASSCODE;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  try {
    process.env.ADMIN_PASSCODE = "0286";
    process.env.ADMIN_SESSION_SECRET = "test-only-secret".repeat(4);
    assert.equal(checkPasscode("0286"), true);
    assert.equal(checkPasscode("286"), false);
    assert.equal(checkPasscode("1111"), false);
    assert.equal(checkPasscode(286), false);
    const now = Date.now();
    const token = createAdminSession(now);
    assert.equal(verifyAdminSession(token, now), true);
    assert.equal(verifyAdminSession(token + "x", now), false);
    assert.equal(verifyAdminSession(undefined, now), false);
    assert.equal(verifyAdminSession(token, now + SESSION_SECONDS * 1000), false);
    process.env.ADMIN_PASSCODE = "1234";
    assert.equal(verifyAdminSession(token, now), false);
  } finally {
    if (previousPin === undefined) delete process.env.ADMIN_PASSCODE; else process.env.ADMIN_PASSCODE = previousPin;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
test("ten wrong passcodes cause a persistent lockout which expires after fifteen minutes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcf-pin-test-"));
  const now = Date.now();
  for (let i = 0; i < 10; i++) assert.equal(await limitedLogin(() => false, directory, now), false);
  await assert.rejects(limitedLogin(() => true, directory, now), /Too many/);
  assert.equal(await limitedLogin(() => true, directory, now + 15 * 60 * 1000), true);
});
const now = new Date("2026-09-08T12:00:00Z");
const future = new Date(now.getTime() + 3600000);
const past = new Date(now.getTime() - 3600000);
test("free module access expires at the exact boundary and never unlocks other modules", () => {
  const grant = {
    module: "listening" as const,
    kind: "grant",
    startsAt: past,
    expiresAt: future,
    revokedAt: null,
  };
  const active = evaluateAccess("active", "student", null, [grant], now);
  assert.equal(active.listening.active, true);
  assert.equal(active.reading.active, false);
  assert.equal(
    evaluateAccess("active", "student", null, [grant], future).listening.active,
    false,
  );
});
test("lifetime, future, revoked, denied, paid and suspended access behave correctly", () => {
  const grant = {
    module: "speaking" as const,
    kind: "grant",
    startsAt: past,
    expiresAt: null,
    revokedAt: null,
  };
  assert.equal(
    evaluateAccess("active", "student", null, [grant], now).speaking.active,
    true,
  );
  assert.equal(
    evaluateAccess("suspended", "admin", future, [grant], now).speaking.active,
    false,
  );
  assert.equal(
    evaluateAccess(
      "active",
      "student",
      null,
      [{ ...grant, startsAt: future }],
      now,
    ).speaking.active,
    false,
  );
  assert.equal(
    evaluateAccess(
      "active",
      "student",
      null,
      [{ ...grant, revokedAt: past }],
      now,
    ).speaking.active,
    false,
  );
  const blocked = evaluateAccess(
    "active",
    "student",
    future,
    [{ ...grant, kind: "deny" }],
    now,
  );
  assert.equal(blocked.speaking.active, false);
  assert.equal(blocked.reading.active, true);
});
test("writing client export maps to editable questions without losing documents or correction", () => {
  const [t] = normalizeImport(
    {
      questions: [
        {
          id: "1",
          taskType: "tache_3",
          prompt: "Comparez les avis",
          correction: "Exemple",
          document1: "Premier",
          document2: "Second",
          broadCategory: "Travel",
        },
      ],
    },
    "writing",
  );
  assert.equal(t.questions[0].task, 3);
  assert.equal(t.questions[0].document2, "Second");
  assert.equal(t.questions[0].referenceAnswer, "Exemple");
  assert.deepEqual(questionIssues(t.questions[0], "writing"), []);
});
test("invalid network captures, empty documents and duplicate tests cannot replace content", () => {
  assert.throws(
    () =>
      normalizeImport(
        { "/api/speaking": { status: 404, data: "HTML" } },
        "speaking",
      ),
    /No questions/,
  );
  assert.throws(
    () =>
      parseDocumentText("TCF Listening — Test 2\n39 Questions", "listening"),
    /No question bodies/,
  );
  assert.throws(
    () =>
      normalizeImport(
        {
          tests: [
            { test: 1, questions: [{ prompt: "A" }] },
            { test: 1, questions: [{ prompt: "B" }] },
          ],
        },
        "reading",
      ),
    /duplicate/,
  );
});
test("documents parse multiple tests, options, answer keys and audio links", () => {
  const tests = parseDocumentText(
    "Test 2\nQuestion 1\nOù va-t-il ?\nA. Paris\nB. Lyon\nAnswer: B\nAudio: https://example.com/q1.mp3\nTest 3\nQuestion 1\nQue fait-il ?\nA. Lire\nB. Dormir\nAnswer: A\nAudio: https://example.com/q2.mp3",
    "listening",
  );
  assert.equal(tests.length, 2);
  assert.equal(tests[0].testNumber, 2);
  assert.equal(tests[1].questions[0].correct, "A");
  assert.deepEqual(questionIssues(tests[0].questions[0], "listening"), []);
});
test("malicious media schemes are removed and missing answers cannot publish", () => {
  const [t] = normalizeImport(
    {
      questions: [
        {
          prompt: "Bonjour",
          options: ["A", "B"],
          audioUrl: "javascript:alert(1)",
          imageUrl: "//evil.example/img",
        },
      ],
    },
    "listening",
  );
  assert.equal(t.questions[0].audioUrl, "");
  assert.equal(t.questions[0].imageUrl, "");
  assert.equal(questionIssues(t.questions[0], "listening").length, 2);
});
test("existing materials are preserved and incomplete listening answer keys stay draft", async () => {
  const all = (await Promise.all(MODULES.map(legacyContent))).flat();
  assert.equal(all.length, 82);
  assert.equal(all.filter((t) => t.status === "draft").length, 4);
  const issues = all
    .filter((t) => t.status === "published")
    .flatMap((t) =>
      t.questions.flatMap((q, i) =>
        questionIssues(q, t.module).map(
          (issue) => `${t.title} Q${i + 1}: ${issue}`,
        ),
      ),
    );
  assert.deepEqual(issues, []);
  assert.equal(
    all
      .filter((t) => t.module === "listening")
      .reduce((s, t) => s + t.questions.length, 0),
    1560,
  );
});

test("content transactions retain revisions, reject stale edits, and roll back entire batches", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("../lib/db/schema");
  const { saveTests } = await import("../lib/admin/content");
  const { readFile } = await import("node:fs/promises");
  const client = new PGlite();
  try {
    // Apply the project's actual migrations in an isolated in-memory PostgreSQL instance.
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await client.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    const db = drizzle(client, { schema });
    const [admin] = await db
      .insert(schema.users)
      .values({ email: "admin@test.invalid", role: "admin" })
      .returning();
    const [course] = await db
      .insert(schema.courses)
      .values({ slug: "test-course", title: "Test" })
      .returning();
    await db
      .insert(schema.courseModules)
      .values({
        courseId: course.id,
        type: "reading",
        title: "Reading",
        position: 1,
      })
      .onConflictDoNothing();
    const [initial] = normalizeImport(
      {
        test: 101,
        questions: [
          { prompt: "Original", options: ["Oui", "Non"], correct: "A" },
        ],
      },
      "reading",
    );
    initial.status = "published";
    const database = db as unknown as Parameters<typeof saveTests>[4];
    await saveTests(admin.id, [initial], "replace", {}, database);
    await saveTests(
      admin.id,
      [
        {
          ...initial,
          questions: initial.questions.map((q) => ({
            ...q,
            prompt: "Updated",
          })),
        },
      ],
      "replace",
      { "reading:101": 1 },
      database,
    );
    const revisions = await db.select().from(schema.materialRevisions);
    assert.equal(revisions.length, 1);
    assert.equal(
      (revisions[0].snapshot as { questions: { prompt: string }[] })
        .questions[0].prompt,
      "Original",
    );
    await assert.rejects(
      saveTests(admin.id, [initial], "replace", { "reading:101": 1 }, database),
      /changed since/,
    );
    const second = { ...initial, testNumber: 102, title: "Second test" };
    await assert.rejects(
      saveTests(
        admin.id,
        [second, initial],
        "replace",
        { "reading:101": 1 },
        database,
      ),
      /changed since/,
    );
    assert.equal(
      (await db.select().from(schema.materialContent)).length,
      1,
      "new test must roll back with stale batch",
    );
    await saveTests(
      admin.id,
      [initial],
      "append",
      { "reading:101": 2 },
      database,
    );
    const [appended] = await db.select().from(schema.materialContent);
    assert.equal(appended.questions.length, 2);
    assert.notEqual(appended.questions[0].id, appended.questions[1].id);
    await assert.rejects(
      saveTests(
        admin.id,
        [{ ...initial, questions: [{ ...initial.questions[0], correct: "" }] }],
        "replace",
        { "reading:101": 3 },
        database,
      ),
      /correct answer/,
    );
    await saveTests(
      admin.id,
      [{ ...initial, status: "archived" }],
      "replace",
      { "reading:101": 3 },
      database,
    );
    assert.equal(
      (await db.select().from(schema.materialContent))[0].status,
      "archived",
    );
    assert.equal((await db.select().from(schema.adminActivity)).length, 4);
  } finally {
    await client.close();
  }
});
