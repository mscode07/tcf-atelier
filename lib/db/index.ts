import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing. Add the Supabase PostgreSQL pooler connection string to the environment.",
    );
  }

  client ??= postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
  });
  database ??= drizzle(client, { schema });
  return database;
}
