import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { listStudents } from "../lib/admin/students";
import * as schema from "../lib/db/schema";

test("plan filters match the displayed current plan across pagination, expiry, search and payment filters", async () => {
  const client = new PGlite();
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await client.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    const db = drizzle(client, { schema });
    const queryDb = db as unknown as ReturnType<
      typeof import("../lib/db").getDb
    >;
    const [week, month, retired] = await db
      .insert(schema.pricingPlans)
      .values([
        {
          code: "filter-week",
          name: "7 days",
          durationDays: 7,
          priceMinor: 1000,
        },
        {
          code: "filter-month",
          name: "30 days",
          durationDays: 30,
          priceMinor: 2500,
        },
        {
          code: "filter-retired",
          name: "Retired plan",
          durationDays: 60,
          priceMinor: 4000,
          isActive: false,
        },
      ])
      .returning();
    const now = Date.now();
    const past = new Date(now - 60_000),
      future = new Date(now + 86_400_000);
    const emails = [
      "week",
      "month",
      "expired",
      "scheduled",
      "cancelled",
      "overlap",
      "lifetime",
    ];
    const students = await db
      .insert(schema.users)
      .values(
        emails.map((name) => ({
          name,
          email: `${name}@test.invalid`,
          createdAt: past,
        })),
      )
      .returning();
    const [weekly, monthly, expired, scheduled, cancelled, overlap, lifetime] =
      students;
    await db.insert(schema.userSubscriptions).values([
      {
        userId: weekly.id,
        planId: week.id,
        status: "active",
        startsAt: past,
        expiresAt: future,
      },
      {
        userId: monthly.id,
        planId: month.id,
        status: "active",
        startsAt: past,
        expiresAt: future,
      },
      {
        userId: expired.id,
        planId: week.id,
        status: "active",
        expiresAt: past,
      },
      {
        userId: scheduled.id,
        planId: week.id,
        status: "active",
        startsAt: future,
      },
      {
        userId: cancelled.id,
        planId: week.id,
        status: "cancelled",
        expiresAt: future,
      },
      {
        userId: overlap.id,
        planId: week.id,
        status: "active",
        expiresAt: future,
      },
      {
        userId: overlap.id,
        planId: month.id,
        status: "active",
        expiresAt: new Date(now + 2 * 86_400_000),
      },
      { userId: lifetime.id, planId: retired.id, status: "active" },
    ]);
    await db.insert(schema.payments).values({
      userId: weekly.id,
      provider: "stripe",
      providerOrderId: "cs_live_filter_test",
      amountMinor: 1000,
      currency: "USD",
      status: "paid",
    });
    await db.insert(schema.users).values(
      Array.from({ length: 55 }, (_, i) => ({
        email: `none${i}@test.invalid`,
        createdAt: new Date(now),
      })),
    );
    const list = (params: Record<string, string> = {}) =>
      listStudents(new URLSearchParams(params), queryDb);
    const all = await list();
    assert.equal(all.students.length, 50);
    assert.equal(all.hasMore, true);
    const result = await list({ plan: `name:${week.name}` });
    assert.deepEqual(
      result.students.map((s) => s.id),
      [weekly.id],
      "filter applies before pagination and excludes old/expired plans",
    );
    assert.equal(result.students[0].planName, "7 days");
    assert.equal(result.students[0].planActive, true);
    assert.equal(result.hasMore, false);
    assert.equal(
      result.plans.filter((p) => p.name === "7 days").length,
      1,
      "same named legacy and current plans share one option",
    );
    const months = await list({ plan: `name:${month.name}` });
    assert.deepEqual(
      new Set(months.students.map((s) => s.id)),
      new Set([monthly.id, overlap.id]),
    );
    assert.equal((await list({ plan: "active" })).students.length, 4);
    assert.equal(
      (await list({ plan: `name:${retired.name}` })).students[0].id,
      lifetime.id,
    );
    assert.ok(result.plans.some((p) => p.name === retired.name));
    const none = await list({ plan: "none" });
    const nextNone = await list({ plan: "none", offset: "50" });
    assert.equal(none.students.length, 50);
    assert.equal(nextNone.students.length, 8);
    assert.equal(none.hasMore, true);
    assert.equal(nextNone.hasMore, false);
    assert.ok(
      [...none.students, ...nextNone.students].every(
        (s) => !s.planActive && s.planName === null,
      ),
    );
    assert.equal(
      new Set([...none.students, ...nextNone.students].map((s) => s.id)).size,
      58,
    );
    assert.equal(
      (await list({ plan: `name:${month.name}`, q: "overlap" })).students
        .length,
      1,
    );
    assert.equal(
      (await list({ plan: `name:${week.name}`, payer: "paying" })).students
        .length,
      1,
    );
    assert.equal(
      (await list({ plan: `name:${week.name}`, payer: "unpaid" })).students
        .length,
      0,
    );
    await assert.rejects(list({ plan: "not-a-plan" }), /valid plan filter/);
  } finally {
    await client.close();
  }
});
