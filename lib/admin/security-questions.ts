import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { getDb } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { AdminError } from "./errors";

// Case/whitespace-insensitive so a remembered answer still matches.
const normalize = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export async function getSecurityQuestions(db = getDb()) {
  const [row] = await db
    .select({
      question1: adminSettings.securityQuestion1,
      question2: adminSettings.securityQuestion2,
    })
    .from(adminSettings)
    .where(eq(adminSettings.id, "main"));
  if (!row?.question1 || !row?.question2) return null;
  return { question1: row.question1, question2: row.question2 };
}

export async function setSecurityQuestions(
  input: {
    question1?: unknown;
    answer1?: unknown;
    question2?: unknown;
    answer2?: unknown;
  },
  db = getDb(),
) {
  const question1 =
    typeof input.question1 === "string" ? input.question1.trim().slice(0, 200) : "";
  const question2 =
    typeof input.question2 === "string" ? input.question2.trim().slice(0, 200) : "";
  const answer1 = normalize(input.answer1);
  const answer2 = normalize(input.answer2);
  if (!question1 || !question2)
    throw new AdminError("Choose both security questions.");
  if (question1 === question2)
    throw new AdminError("Choose two different questions.");
  if (answer1.length < 2 || answer2.length < 2)
    throw new AdminError("Answers must be at least 2 characters.");
  const [securityAnswer1Hash, securityAnswer2Hash] = await Promise.all([
    hash(answer1, 12),
    hash(answer2, 12),
  ]);
  await db
    .insert(adminSettings)
    .values({
      id: "main",
      securityQuestion1: question1,
      securityAnswer1Hash,
      securityQuestion2: question2,
      securityAnswer2Hash,
    })
    .onConflictDoUpdate({
      target: adminSettings.id,
      set: {
        securityQuestion1: question1,
        securityAnswer1Hash,
        securityQuestion2: question2,
        securityAnswer2Hash,
      },
    });
}

export async function checkSecurityAnswers(
  input: { answer1?: unknown; answer2?: unknown },
  db = getDb(),
) {
  const [row] = await db
    .select()
    .from(adminSettings)
    .where(eq(adminSettings.id, "main"));
  if (!row?.securityAnswer1Hash || !row?.securityAnswer2Hash) return false;
  const answer1 = normalize(input.answer1);
  const answer2 = normalize(input.answer2);
  if (!answer1 || !answer2) return false;
  const [ok1, ok2] = await Promise.all([
    compare(answer1, row.securityAnswer1Hash),
    compare(answer2, row.securityAnswer2Hash),
  ]);
  return ok1 && ok2;
}
