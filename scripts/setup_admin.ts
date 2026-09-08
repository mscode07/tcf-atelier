import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as query } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { legacyContent } from "../lib/admin/legacy";
import { MODULES } from "../lib/admin/types";
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("Add DATABASE_URL to .env before running setup.");
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  try {
    {
      const material = (await Promise.all(MODULES.map(legacyContent))).flat();
      await db.transaction(async (tx) => {
        await tx.execute(query`select pg_advisory_xact_lock(781903)`);
        for (const t of material)
          await tx
            .insert(schema.materialContent)
            .values(t)
            .onConflictDoNothing({
              target: [
                schema.materialContent.module,
                schema.materialContent.testNumber,
              ],
            });
      });
      console.log(
        `Imported ${material.length} collections. Existing edited collections were preserved. ${material.filter((t) => t.status === "draft").length} incomplete collections are drafts pending answer-key corrections.`,
      );
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Setup failed");
  process.exitCode = 1;
});
