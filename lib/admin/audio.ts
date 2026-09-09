import { getDb } from "@/lib/db";
import { materialAudio } from "@/lib/db/schema";
import { AdminError } from "./errors";
import { ModuleKey } from "./types";
export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "aac",
  "webm",
  "flac",
];
export function audioMime(bytes: Buffer): string | null {
  if (
    bytes.subarray(0, 3).toString() === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 6) !== 0)
  )
    return "audio/mpeg";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WAVE"
  )
    return "audio/wav";
  if (bytes.subarray(0, 4).toString() === "OggS") return "audio/ogg";
  if (bytes.subarray(4, 8).toString() === "ftyp") return "audio/mp4";
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return "audio/aac";
  if (bytes.subarray(0, 4).toString("hex") === "1a45dfa3") return "audio/webm";
  if (bytes.subarray(0, 4).toString() === "fLaC") return "audio/flac";
  return null;
}
export async function storeAudio(file: File, module: ModuleKey) {
  if (!file.size || file.size > 10_000_000)
    throw new AdminError("Choose an audio file up to 10 MB.", 413);
  if (
    !AUDIO_EXTENSIONS.includes(file.name.split(".").pop()?.toLowerCase() || "")
  )
    throw new AdminError(
      "Choose MP3, WAV, OGG, M4A, AAC, WebM, or FLAC audio.",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = audioMime(bytes);
  if (!mime)
    throw new AdminError("This file is not a supported audio recording.");
  const [stored] = await getDb()
    .insert(materialAudio)
    .values({ module, mime, data: bytes.toString("base64") })
    .returning({ id: materialAudio.id });
  return `/api/audio/${stored.id}`;
}
