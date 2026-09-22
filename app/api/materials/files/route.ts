import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { driveFiles } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const files = await getDb()
    .select({
      id: driveFiles.id,
      name: driveFiles.name,
      description: driveFiles.description,
      module: driveFiles.module,
      mimeType: driveFiles.mimeType,
      driveUrl: driveFiles.driveUrl,
      createdAt: driveFiles.createdAt,
    })
    .from(driveFiles)
    .orderBy(desc(driveFiles.createdAt));
  return NextResponse.json(
    { files },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
