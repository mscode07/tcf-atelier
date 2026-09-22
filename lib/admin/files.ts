import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adminActivity, driveFiles } from "@/lib/db/schema";
import { deleteFromDrive, uploadToDrive } from "@/lib/google-drive";
import { isModule } from "./types";
import { AdminError } from "./errors";

const MAX_SIZE = 25_000_000;
const uuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

export async function listFiles(db = getDb()) {
  return db.select().from(driveFiles).orderBy(desc(driveFiles.createdAt));
}

export async function createFile(
  {
    file,
    name,
    description,
    module,
  }: { file: File; name: unknown; description: unknown; module: unknown },
  actorId: string,
  db = getDb(),
) {
  if (!file.size || file.size > MAX_SIZE)
    throw new AdminError("Choose a file up to 25 MB.", 413);
  const label =
    typeof name === "string" && name.trim()
      ? name.trim().slice(0, 200)
      : file.name.slice(0, 200);
  const note =
    typeof description === "string" ? description.trim().slice(0, 1000) : "";
  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadToDrive({ name: label, mimeType, buffer }, db);
  const [row] = await db
    .insert(driveFiles)
    .values({
      name: label,
      description: note || null,
      module: isModule(module) ? module : null,
      mimeType,
      sizeBytes: file.size,
      driveFileId: uploaded.id,
      driveUrl: uploaded.url,
      uploadedBy: actorId,
    })
    .returning();
  await db.insert(adminActivity).values({
    actorId,
    action: "File uploaded",
    detail: label,
  });
  return row;
}

export async function deleteFile(id: unknown, actorId: string, db = getDb()) {
  if (!uuid(id)) throw new AdminError("Choose a file.");
  const [row] = await db
    .select()
    .from(driveFiles)
    .where(eq(driveFiles.id, id));
  if (!row) throw new AdminError("File not found.", 404);
  // Best-effort: don't let a Drive-side hiccup (e.g. already removed there
  // manually) block clearing the record from our own list.
  await deleteFromDrive(row.driveFileId, db).catch(() => {});
  await db.delete(driveFiles).where(eq(driveFiles.id, id));
  await db.insert(adminActivity).values({
    actorId,
    action: "File deleted",
    detail: row.name,
  });
}
