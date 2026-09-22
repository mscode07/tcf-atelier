import { authenticatePassword } from "../lib/auth/password";
import { validateSignupEmail } from "../lib/auth/email-policy";
import {
  requestRegistration,
  validateName,
  validatePassword,
} from "../lib/auth/registration";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

test("rejects disposable domains, subdomains, reserved domains and placeholder variants", () => {
  for (const email of [
    "ada@mailinator.com",
    "ada@guerrillamail.com",
    "ada@yopmail.com",
    "ada@10minutemail.com",
    "ada@sub.mailinator.com",
    "test@gmail.com",
    "TEST123@GMAIL.COM",
    "t.e.s.t+course@gmail.com",
    "test_user99@yahoo.com",
    "dummy@gmail.com",
    "fake123@outlook.com",
    "ada@example.com",
    "ada@mail.example.org",
    "ada@domain.invalid",
  ]) {
    assert.throws(() => validateSignupEmail(email), { name: "Error" }, email);
  }
});

test("allows regular personal, custom-domain and plus addresses without broad substring blocks", () => {
  for (const email of [
    "ada.lovelace@gmail.com",
    "person+test@outlook.com",
    "testerman@gmail.com",
    "contesto@yahoo.com",
    "ada@mybusiness.co.uk",
    "ada@mailinator.com.real-business.co.uk",
  ])
    assert.equal(validateSignupEmail(email), email);
  assert.equal(
    validateSignupEmail(" Ada.Lovelace@Gmail.com "),
    "ada.lovelace@gmail.com",
  );
});

test("rejects malformed addresses and validates names and bcrypt byte limits", () => {
  for (const value of [
    null,
    "fake",
    "one@@gmail.com",
    "a b@gmail.com",
    ".ada@gmail.com",
    "ada..lovelace@gmail.com",
    "ada@-gmail.com",
    "ada@gmail..com",
    "ada@gmail.com.",
  ])
    assert.throws(() => validateSignupEmail(value));
  assert.equal(validateName(" Élodie ", "first name"), "Élodie");
  assert.throws(() => validateName(" ", "last name"));
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("é".repeat(37)));
});

test("sign-up creates a usable account without email delivery and never overwrites existing accounts", async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const authDb = db as unknown as ReturnType<typeof import("../lib/db").getDb>;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("No network request is allowed during registration");
  };
  try {
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    for (const entry of journal.entries)
      await client.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
    const input = {
      email: "ada.lovelace@gmail.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "safe-password",
    };
    for (const email of ["test@gmail.com", "ada@mailinator.com"])
      await assert.rejects(requestRegistration({ ...input, email }, authDb));
    assert.equal(
      await authenticatePassword(input.email, input.password, authDb),
      null,
    );
    assert.equal(
      (await db.select().from(schema.users)).length,
      0,
      "sign-in never creates an account",
    );
    await requestRegistration(input, authDb);
    const [user] = await db.select().from(schema.users);
    assert.equal(user.firstName, "Ada");
    assert.equal(user.lastName, "Lovelace");
    assert.equal(
      user.emailVerifiedAt,
      null,
      "screening must not claim inbox verification",
    );
    assert.notEqual(user.passwordHash, input.password);
    assert.equal(
      (await authenticatePassword(input.email, input.password, authDb))?.email,
      input.email,
    );
    assert.equal(
      await authenticatePassword(input.email, "wrong-password", authDb),
      null,
    );
    await assert.rejects(
      requestRegistration(
        {
          ...input,
          email: "ADA.LOVELACE@GMAIL.COM",
          password: "attacker-password",
        },
        authDb,
      ),
      /already uses/,
    );
    assert.equal((await db.select().from(schema.users)).length, 1);
    assert.equal(
      await authenticatePassword(input.email, "attacker-password", authDb),
      null,
    );
    await db
      .update(schema.users)
      .set({ status: "suspended" })
      .where(eq(schema.users.id, user.id));
    assert.equal(
      await authenticatePassword(input.email, input.password, authDb),
      null,
    );
  } finally {
    globalThis.fetch = oldFetch;
    await client.close();
  }
});
