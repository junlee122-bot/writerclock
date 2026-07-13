#!/usr/bin/env node
/**
 * One-way maintenance helper: extract the translated minute corpus from a
 * hybrid ko_quotes.json into its canonical, reviewable input file.
 *
 * The builder never reads its own output, so a normal rebuild cannot erase or
 * silently mutate the 1,440 translated entries.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "data", "ko_quotes.json");
const outputPath = join(root, "data", "ko_translations.json");
const data = JSON.parse(await readFile(sourcePath, "utf8"));
const translated = {};

for (const [time, entries] of Object.entries(data.precise || {})) {
  const items = entries
    .filter((entry) => entry.kind === "역")
    .map((entry) => ({
      t: entry.t,
      q: entry.q,
      title: entry.title,
      author: entry.author,
      ampm: entry.ampm,
      kind: "역",
      ...(entry.sfw ? { sfw: entry.sfw } : {}),
      ...(entry.match ? { match: entry.match } : {}),
    }));
  if (items.length) translated[time] = items;
}

if (Object.keys(translated).length !== 1440) {
  throw new Error(`Expected 1440 translated minute keys, got ${Object.keys(translated).length}`);
}

await writeFile(outputPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath} (${Object.keys(translated).length} minute keys)`);
