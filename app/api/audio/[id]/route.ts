import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getAccessByEmail } from "@/lib/access";
import { getDb } from "@/lib/db";
import { materialAudio } from "@/lib/db/schema";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const [meta] = await getDb()
    .select({ module: materialAudio.module })
    .from(materialAudio)
    .where(eq(materialAudio.id, id));
  if (!meta) return new Response(null, { status: 404 });
  const session = await auth();
  if (!(await getAccessByEmail(session?.user?.email, meta.module)).active)
    return new Response(null, { status: 403 });
  const [record] = await getDb()
    .select()
    .from(materialAudio)
    .where(eq(materialAudio.id, id));
  if (!record) return new Response(null, { status: 404 });
  const bytes = Buffer.from(record.data, "base64");
  const headers = new Headers({
    "Content-Type": record.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");
  let start = 0,
    end = bytes.length - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${bytes.length}` },
      });
    start = match[1]
      ? Number(match[1])
      : Math.max(0, bytes.length - Number(match[2]));
    end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= bytes.length
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${bytes.length}` },
      });
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
    status: range ? 206 : 200,
    headers,
  });
}
