import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { getDb } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_OAUTH_STATE_COOKIE = "tcf-drive-oauth-state";

export function driveRedirectUri() {
  const origin =
    process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/api/admin/drive-auth/callback`;
}

export function newOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing.");
  return new google.auth.OAuth2(clientId, clientSecret, driveRedirectUri());
}

export async function getDriveConnection(db = getDb()) {
  const [row] = await db
    .select({
      refreshToken: adminSettings.driveRefreshToken,
      accountEmail: adminSettings.driveAccountEmail,
    })
    .from(adminSettings)
    .where(eq(adminSettings.id, "main"));
  return row?.refreshToken
    ? { refreshToken: row.refreshToken, accountEmail: row.accountEmail }
    : null;
}

export async function saveDriveConnection(
  refreshToken: string,
  accountEmail: string | null,
  db = getDb(),
) {
  await db
    .insert(adminSettings)
    .values({
      id: "main",
      driveRefreshToken: refreshToken,
      driveAccountEmail: accountEmail,
    })
    .onConflictDoUpdate({
      target: adminSettings.id,
      set: { driveRefreshToken: refreshToken, driveAccountEmail: accountEmail },
    });
}

async function getDrive(db = getDb()) {
  const connection = await getDriveConnection(db);
  if (!connection)
    throw new Error("Connect Google Drive from the admin panel first.");
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: connection.refreshToken });
  return google.drive({ version: "v3", auth: client });
}

// Creates a file in the shared resources folder. Caller decides visibility.
async function createDriveFile(
  { name, mimeType, buffer }: { name: string; mimeType: string; buffer: Buffer },
  parentFolderId: string,
  db = getDb(),
) {
  const drive = await getDrive(db);
  const { data } = await drive.files.create({
    requestBody: { name, parents: [parentFolderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });
  if (!data.id) throw new Error("Drive upload did not return a file id.");
  return {
    id: data.id,
    url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view`,
  };
}

export async function uploadToDrive(
  file: { name: string; mimeType: string; buffer: Buffer },
  db = getDb(),
) {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing.");
  const created = await createDriveFile(file, folderId, db);
  // Students need to open the link without a Google sign-in of their own.
  await (await getDrive(db)).permissions.create({
    fileId: created.id,
    requestBody: { role: "reader", type: "anyone" },
  });
  return created;
}

export async function deleteFromDrive(fileId: string, db = getDb()) {
  await (await getDrive(db)).files.delete({ fileId });
}

// A separate, never-publicly-shared subfolder for content backups (these
// snapshots include correct answers, so they must not get an "anyone with
// the link" permission the way student-facing resource files do).
async function getBackupFolderId(db = getDb()) {
  const [row] = await db
    .select({ id: adminSettings.driveBackupFolderId })
    .from(adminSettings)
    .where(eq(adminSettings.id, "main"));
  if (row?.id) return row.id;
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!parentFolderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing.");
  const drive = await getDrive(db);
  const { data } = await drive.files.create({
    requestBody: {
      name: "Content Backups (private)",
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });
  if (!data.id) throw new Error("Could not create the Drive backup folder.");
  await db
    .update(adminSettings)
    .set({ driveBackupFolderId: data.id })
    .where(eq(adminSettings.id, "main"));
  return data.id;
}

// Private, best-effort content sync: creates the backup on first save, then
// updates the same file in place on every later edit (stable file id/link).
export async function syncPrivateFileToDrive(
  {
    name,
    mimeType,
    buffer,
    existingFileId,
  }: {
    name: string;
    mimeType: string;
    buffer: Buffer;
    existingFileId: string | null;
  },
  db = getDb(),
) {
  const drive = await getDrive(db);
  if (existingFileId) {
    await drive.files.update({
      fileId: existingFileId,
      media: { mimeType, body: Readable.from(buffer) },
    });
    return { id: existingFileId };
  }
  const folderId = await getBackupFolderId(db);
  return createDriveFile({ name, mimeType, buffer }, folderId, db);
}
