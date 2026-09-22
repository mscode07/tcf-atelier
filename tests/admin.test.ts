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
import {
  checkAdminPassword,
  createAdminSession,
  verifyAdminSession,
  SESSION_SECONDS,
} from "../lib/admin/password";
import {
  isStrongAdminPassword,
  isAdminPasswordInput,
} from "../lib/admin/password-policy";
import { limitedLogin } from "../lib/admin/login-limit";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("password sessions reject incorrect passwords, tampering, expiry and rotated secrets", () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  try {
    process.env.ADMIN_PASSWORD = "Example@124";
    process.env.ADMIN_SESSION_SECRET = "test-only-secret".repeat(4);
    assert.equal(checkAdminPassword("Example@124"), true);
    assert.equal(checkAdminPassword("example@124"), false);
    assert.equal(checkAdminPassword("Example@124 "), false);
    assert.equal(checkAdminPassword("1234"), false);
    assert.equal(checkAdminPassword(124), false);
    const now = Date.now();
    const token = createAdminSession(now);
    assert.equal(verifyAdminSession(token, now), true);
    assert.equal(verifyAdminSession(token + "x", now), false);
    assert.equal(verifyAdminSession(undefined, now), false);
    assert.equal(
      verifyAdminSession(token, now + SESSION_SECONDS * 1000),
      false,
    );
    process.env.ADMIN_SESSION_SECRET = "rotated-test-secret".repeat(4);
    assert.equal(verifyAdminSession(token, now), false);
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
test("new admin passwords require mixed characters and respect bcrypt byte limits", () => {
  assert.equal(isStrongAdminPassword("Password@124"), true);
  assert.equal(isStrongAdminPassword("Mixed #Words 124"), true);
  for (const value of [
    null,
    1234,
    "1234",
    "lowercase@123",
    "UPPERCASE@123",
    "NoNumbers@",
    "NoSymbols123",
    "Aa1!" + "é".repeat(35),
  ]) {
    assert.equal(isStrongAdminPassword(value), false);
  }
  assert.equal(isStrongAdminPassword("Aa1!" + "x".repeat(68)), true);
  assert.equal(isAdminPasswordInput("Aa1!" + "x".repeat(69)), false);
});
test("legacy PIN fallback supports migration but ADMIN_PASSWORD takes precedence", () => {
  const previous = {
    password: process.env.ADMIN_PASSWORD,
    pin: process.env.ADMIN_PASSCODE,
    secret: process.env.ADMIN_SESSION_SECRET,
  };
  try {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSCODE = "0286";
    process.env.ADMIN_SESSION_SECRET = "test-only-secret".repeat(4);
    assert.equal(checkAdminPassword("0286"), true);
    process.env.ADMIN_PASSWORD = "NewPassword@124";
    assert.equal(checkAdminPassword("0286"), false);
    assert.equal(checkAdminPassword("NewPassword@124"), true);
    process.env.ADMIN_PASSWORD = "1234";
    assert.equal(checkAdminPassword("1234"), false);
  } finally {
    for (const [key, value] of Object.entries({
      ADMIN_PASSWORD: previous.password,
      ADMIN_PASSCODE: previous.pin,
      ADMIN_SESSION_SECRET: previous.secret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("ten wrong passwords cause a persistent lockout which expires after fifteen minutes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcf-pin-test-"));
  const now = Date.now();
  for (let i = 0; i < 10; i++)
    assert.equal(await limitedLogin(() => false, directory, now), false);
  await assert.rejects(
    limitedLogin(() => true, directory, now),
    /Too many/,
  );
  assert.equal(
    await limitedLogin(() => true, directory, now + 15 * 60 * 1000),
    true,
  );
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
    const {
      validSession,
      sessionHash,
      checkStoredPassword,
      replaceAdminPassword,
    } = await import("../lib/admin/session-store");
    const { hash } = await import("bcryptjs");
    const sessionDb = db as unknown as ReturnType<
      typeof import("../lib/db").getDb
    >;
    const sessionToken = "test-session-token";
    await db
      .insert(schema.adminSessions)
      .values({ tokenHash: sessionHash(sessionToken), expiresAt: future });
    assert.equal(await validSession(sessionToken, sessionDb, now), true);
    assert.equal(await validSession("wrong-token", sessionDb, now), false);
    assert.equal(await validSession(sessionToken, sessionDb, future), false);
    await db
      .insert(schema.adminSettings)
      .values({ id: "main", passcodeHash: await hash("9876", 4) });
    assert.equal(await checkStoredPassword("9876", sessionDb), true);
    assert.equal(await checkStoredPassword("1234", sessionDb), false);
    await assert.rejects(replaceAdminPassword("1234", sessionDb), /at least 8/);
    assert.equal(
      await validSession(sessionToken, sessionDb, now),
      true,
      "invalid new password must not revoke sessions",
    );
    await replaceAdminPassword("NewPassword@124", sessionDb);
    assert.equal(await checkStoredPassword("NewPassword@124", sessionDb), true);
    assert.equal(
      await checkStoredPassword("newpassword@124", sessionDb),
      false,
    );
    assert.equal(
      await checkStoredPassword("9876", sessionDb),
      false,
      "old PIN must stop working",
    );
    assert.equal(
      await validSession(sessionToken, sessionDb, now),
      false,
      "changing the password revokes all sessions",
    );
    const [passwordSetting] = await db.select().from(schema.adminSettings);
    assert.notEqual(
      passwordSetting.passcodeHash,
      "NewPassword@124",
      "only a hash is stored",
    );

    const { storeAdminSession } = await import("../lib/admin/session-store");
    const { adminSummary } = await import("../lib/admin/summary");
    const emptySummary = await adminSummary(sessionDb);
    assert.deepEqual(emptySummary, { activity: [], students: [], content: [] });
    await storeAdminSession("first-login", sessionDb);
    await storeAdminSession("second-login", sessionDb);
    assert.equal(await validSession("first-login", sessionDb), true);
    assert.equal(await validSession("second-login", sessionDb), true);
    assert.equal(
      (await db.select().from(schema.users)).length,
      1,
      "repeat logins reuse the admin actor",
    );
    await assert.rejects(
      storeAdminSession("second-login", sessionDb),
      (error: unknown) =>
        (error as { cause?: { code?: string } }).cause?.code === "23505",
    );
    await db.delete(schema.adminSessions);
    assert.equal(await validSession(sessionToken, sessionDb, now), false);
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
    await db
      .insert(schema.users)
      .values({ email: "student@summary.test", role: "student" });
    const summary = await adminSummary(sessionDb);
    assert.equal(summary.activity.length, 4);
    assert.equal(summary.activity[0].actor, "admin@test.invalid");
    assert.ok(!Number.isNaN(Date.parse(summary.activity[0].createdAt)));
    assert.deepEqual(summary.students, [{ status: "active", count: 1 }]);
    assert.deepEqual(summary.content, [
      { module: "reading", status: "archived", count: 1 },
    ]);
  } finally {
    await client.close();
  }
});

test("audio validation recognizes supported headers and rejects renamed documents", async () => {
  const { audioMime } = await import("../lib/admin/audio");
  assert.equal(audioMime(Buffer.from("ID3test")), "audio/mpeg");
  assert.equal(audioMime(Buffer.from("RIFF1234WAVE")), "audio/wav");
  assert.equal(audioMime(Buffer.from("OggSrecording")), "audio/ogg");
  assert.equal(audioMime(Buffer.from("%PDF-audio.mp3")), null);
  assert.equal(audioMime(Buffer.from("<script>bad</script>")), null);
  assert.equal(audioMime(Buffer.alloc(0)), null);
});
test("asynchronous incorrect passwords count toward rate limiting", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcf-async-pin-"));
  for (let i = 0; i < 10; i++)
    assert.equal(await limitedLogin(async () => false, directory), false);
  await assert.rejects(
    limitedLogin(async () => true, directory),
    /Too many/,
  );
});
