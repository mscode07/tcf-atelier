import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AdminError } from "./errors";
// Shared across workers on this server, including restarts. No IP headers are trusted.
export async function limitedLogin(
  check: () => boolean | Promise<boolean>,
  directory?: string,
  now = Date.now(),
) {
  const scope = createHash("sha256")
    .update(process.cwd())
    .digest("hex")
    .slice(0, 20);
  const root = directory || path.join(tmpdir(), `tcf-admin-login-${scope}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const lock = path.join(root, "lock");
  try {
    await mkdir(lock);
  } catch {
    throw new AdminError(
      "Another sign-in is being checked. Try again shortly.",
      429,
    );
  }
  try {
    let state = { count: 0, until: now + 15 * 60 * 1000 };
    try {
      state = JSON.parse(
        await readFile(path.join(root, "attempts.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (now >= state.until) state = { count: 0, until: now + 15 * 60 * 1000 };
    if (state.count >= 10)
      throw new AdminError(
        "Too many incorrect attempts. Please try again in 15 minutes.",
        429,
      );
    const valid = await check();
    state.count = valid ? 0 : state.count + 1;
    await writeFile(path.join(root, "attempts.json"), JSON.stringify(state), {
      mode: 0o600,
    });
    return valid;
  } finally {
    await rmdir(lock);
  }
}
