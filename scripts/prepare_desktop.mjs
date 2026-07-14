#!/usr/bin/env node
/** Stage the minimal, offline web bundle consumed by Tauri. */
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "desktop", "dist");
const files = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "LICENSE",
  "NOTICE.md",
  "DATA_LICENSE.md",
  "assets",
  "docs",
];

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "data"), { recursive: true });
await mkdir(join(out, "firmware"), { recursive: true });
for (const source of files) {
  await cp(join(root, source), join(out, source), { recursive: true });
}
await cp(join(root, "data", "ko_quotes.js"), join(out, "data", "ko_quotes.js"));
await cp(join(root, "data", "ko_coverage.json"), join(out, "data", "ko_coverage.json"));
await cp(
  join(root, "data", "LITERATURE_CLOCK_LICENSE.md"),
  join(out, "data", "LITERATURE_CLOCK_LICENSE.md"),
);
await cp(join(root, "firmware", "OFL.txt"), join(out, "firmware", "OFL.txt"));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.name !== ".build-manifest.json") result.push(path);
  }
  return result;
}

const manifest = {};
for (const path of (await walk(out)).sort()) {
  const bytes = await readFile(path);
  manifest[relative(out, path).replaceAll("\\", "/")] = createHash("sha256").update(bytes).digest("hex");
}
await writeFile(join(out, ".build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Prepared desktop/dist with ${Object.keys(manifest).length} files.`);
