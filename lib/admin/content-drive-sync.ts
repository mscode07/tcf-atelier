import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { materialContent } from "@/lib/db/schema";
import { syncPrivateFileToDrive } from "@/lib/google-drive";
import { MaterialTest } from "./types";

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Best-effort: a Content Library save must never fail because Drive is
// unreachable or not yet connected. Errors here are swallowed on purpose.
export async function syncTestToDrive(
  contentId: string,
  test: MaterialTest,
  existingDriveFileId: string | null,
  db = getDb(),
) {
  try {
    const name = `${label(test.module)} Test ${String(test.testNumber).padStart(2, "0")}.json`;
    const buffer = Buffer.from(
      JSON.stringify(
        {
          module: test.module,
          testNumber: test.testNumber,
          title: test.title,
          status: test.status,
          questions: test.questions,
        },
        null,
        2,
      ),
    );
    const result = await syncPrivateFileToDrive(
      { name, mimeType: "application/json", buffer, existingFileId: existingDriveFileId },
      db,
    );
    if (!existingDriveFileId) {
      await db
        .update(materialContent)
        .set({
          driveFileId: result.id,
          driveUrl: `https://drive.google.com/file/d/${result.id}/view`,
        })
        .where(eq(materialContent.id, contentId));
    }
  } catch (e) {
    console.error("Drive content sync failed (non-fatal)", e);
  }
}
