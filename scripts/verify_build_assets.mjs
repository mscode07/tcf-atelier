import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";

// Catch deployments whose generated HTML references missing CSS, JS, or fonts.
const buildDirectory = path.resolve(".next");
const assets = new Set();
let pages = 0;

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(filename);
    else if (entry.name.endsWith(".html")) {
      pages++;
      const html = await readFile(filename, "utf8");
      for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)(?:[^" ]*)"/g)) {
        assets.add(match[1]);
      }
    }
  }
}

await inspect(path.join(buildDirectory, "server", "app"));
if (!pages || ![...assets].some((asset) => asset.endsWith(".css"))) {
  throw new Error("Build verification found no generated pages or stylesheets.");
}
const missing = [];
for (const asset of assets) {
  try {
    await access(path.join(buildDirectory, asset.slice("/_next/".length)));
  } catch {
    missing.push(asset);
  }
}
if (missing.length) {
  throw new Error(`Build is missing referenced assets:\n${missing.join("\n")}`);
}
console.log(`Verified ${assets.size} static assets across ${pages} generated pages.`);
