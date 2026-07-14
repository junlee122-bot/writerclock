#!/usr/bin/env node
/**
 * One-way maintenance helper: extract the translated minute corpus from a
 * hybrid ko_quotes.json into its canonical, reviewable input file.
 *
 * The builder never reads its own output, so a normal rebuild cannot erase or
 * silently mutate the 1,440 translated entries.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "data", "ko_quotes.json");
const outputPath = join(root, "data", "ko_translations.json");
export function extractTranslatedCorpus(data) {
  const translated = {};
  for (const [time, entries] of Object.entries(data.precise || {})) {
    const items = entries
      .filter((entry) => entry.kind === "역")
      // Preserve the complete provenance and review contract. Dropping fields
      // here would make a maintenance round trip silently erase source audits.
      .map((entry) => ({ ...entry }));
    if (items.length) translated[time] = items;
  }
  return translated;
}

async function main() {
  const data = JSON.parse(await readFile(sourcePath, "utf8"));
  const translated = extractTranslatedCorpus(data);
  if (Object.keys(translated).length !== 1440) {
    throw new Error(`Expected 1440 translated minute keys, got ${Object.keys(translated).length}`);
  }

  await writeFile(outputPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath} (${Object.keys(translated).length} minute keys)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
