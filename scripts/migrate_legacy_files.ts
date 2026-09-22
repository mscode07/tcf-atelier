import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../lib/db";
import { adminActivity, driveFiles } from "../lib/db/schema";
import { uploadToDrive } from "../lib/google-drive";

// One-time migration: push the legacy reading-test PDFs and listening-test
// HTML pages into the admin's connected Drive, as student-facing resources.
const ACTOR_ID = "a5c2fda9-4189-4862-a9fd-38853a946b51"; // fixed admin actor id

async function main() {
  const db = getDb();
  const jobs: { dir: string; file: string; label: string; mimeType: string }[] = [];

  const readingDir = path.join(process.cwd(), "public/reading-tests");
  for (const file of (await readdir(readingDir)).sort()) {
    const match = file.match(/reading-test-(\d+)\.pdf$/);
    if (!match) continue;
    jobs.push({
      dir: readingDir,
      file,
      label: `Reading Test ${match[1]}`,
      mimeType: "application/pdf",
    });
  }

  const listeningDir = path.join(process.cwd(), "public/listening-tests");
  for (const file of (await readdir(listeningDir)).sort()) {
    const match = file.match(/test-(\d+)\.html$/);
    if (!match) continue;
    jobs.push({
      dir: listeningDir,
      file,
      label: `Listening Test ${match[1]}`,
      mimeType: "text/html",
    });
  }

  console.log(`Uploading ${jobs.length} files to Drive...`);
  let done = 0;
  for (const job of jobs) {
    const buffer = await readFile(path.join(job.dir, job.file));
    const uploaded = await uploadToDrive({
      name: job.file,
      mimeType: job.mimeType,
      buffer,
    });
    await db.insert(driveFiles).values({
      name: job.label,
      description: null,
      mimeType: job.mimeType,
      sizeBytes: buffer.length,
      driveFileId: uploaded.id,
      driveUrl: uploaded.url,
      uploadedBy: ACTOR_ID,
    });
    done += 1;
    console.log(`  [${done}/${jobs.length}] ${job.label}`);
  }

  await db.insert(adminActivity).values({
    actorId: ACTOR_ID,
    action: "Files uploaded",
    detail: `Bulk migration: ${done} legacy reading/listening files`,
  });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
