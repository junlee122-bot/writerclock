import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "data", "ko_quotes.json");
const jsPath = path.join(root, "data", "ko_quotes.js");
const coveragePath = path.join(root, "data", "ko_coverage.json");
const sourceCorpusPath = path.join(root, "data", "quotes.json");

function expectedMinuteKeys() {
  const keys = [];
  for (let minute = 0; minute < 24 * 60; minute += 1) {
    keys.push(
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    );
  }
  return keys;
}

function failAt(key, index, message) {
  throw new Error(`data/ko_quotes.json precise[${JSON.stringify(key)}][${index}]: ${message}`);
}

const jsonText = await readFile(jsonPath, "utf8");
const data = JSON.parse(jsonText);
const sourceCorpus = JSON.parse(await readFile(sourceCorpusPath, "utf8"));

assert.ok(data && typeof data === "object" && !Array.isArray(data), "dataset must be an object");
assert.ok(data.precise && typeof data.precise === "object", "dataset.precise must be an object");
assert.ok(data.buckets && typeof data.buckets === "object", "dataset.buckets must be an object");
assert.ok(data.bucketMeta && typeof data.bucketMeta === "object", "dataset.bucketMeta must be an object");
assert.equal(data.meta?.compilation_license, "CC BY-NC-SA 2.5", "dataset compilation license is missing");
assert.equal(
  data.meta?.compilation_license_file,
  "data/LITERATURE_CLOCK_LICENSE.md",
  "dataset compilation license file is missing",
);

const expectedKeys = expectedMinuteKeys();
const actualKeys = Object.keys(data.precise).sort();
assert.deepEqual(actualKeys, expectedKeys, "precise must contain every HH:MM key exactly once");

const allowedKinds = new Set(["원문", "역"]);
const allowedPeriods = new Set(["am", "pm"]);
const allowedSafetyLabels = new Set(["sfw", "nsfw", "unknown"]);
const allowedSourceMatchBases = new Set([
  "translated_pair",
  "translated_title_author",
  "translated_title",
  "translated_author",
]);
const allowedReviewStatuses = new Set([
  "machine_checked",
  "source_row_matched",
  "source_row_alias_matched",
  "source_row_alias_candidate",
  "needs_source_row_mapping",
  "needs_primary_source",
]);
let entryCount = 0;
let originalCount = 0;
let translatedCount = 0;
let translatedSourceRowCount = 0;
let translatedSourceRefCount = 0;
const translationReviewCounts = {};

for (const key of expectedKeys) {
  const entries = data.precise[key];
  assert.ok(Array.isArray(entries) && entries.length > 0, `precise[${key}] must be a non-empty array`);

  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) failAt(key, index, "entry must be an object");

    for (const field of ["t", "q", "title", "author", "kind", "ampm"]) {
      if (typeof item[field] !== "string" || item[field].trim() === "") {
        failAt(key, index, `${field} must be a non-empty string`);
      }
    }

    if (!item.q.includes(item.t)) failAt(key, index, "t must be a literal substring of q");
    if (item.match !== "exact") failAt(key, index, "precise entries must be reviewed as exact");
    if (!allowedKinds.has(item.kind)) failAt(key, index, `kind must be one of ${[...allowedKinds].join(", ")}`);
    if (!allowedPeriods.has(item.ampm)) failAt(key, index, `ampm must be one of ${[...allowedPeriods].join(", ")}`);

    const hour = Number(key.slice(0, 2));
    const expectedPeriod = hour < 12 ? "am" : "pm";
    if (item.ampm !== expectedPeriod) {
      failAt(key, index, `ampm must be '${expectedPeriod}' for the 24-hour key ${key}`);
    }

    entryCount += 1;
    if (item.kind === "원문") originalCount += 1;
    if (item.kind === "원문" && (!item.source_page || !item.source_url)) {
      failAt(key, index, "original entries require source_page and source_url");
    }
    if (item.kind === "역") {
      translatedCount += 1;
      if (!item.review_status) failAt(key, index, "translated entries require review_status");
      if (!allowedReviewStatuses.has(item.review_status)) {
        failAt(key, index, `unknown review_status '${item.review_status}'`);
      }
      if (!allowedSafetyLabels.has(item.sfw)) {
        failAt(key, index, `sfw must be one of ${[...allowedSafetyLabels].join(", ")}`);
      }
      translationReviewCounts[item.review_status] =
        (translationReviewCounts[item.review_status] || 0) + 1;
      if (!item.source_q && !item.source_ref) {
        failAt(key, index, "translated entries require source_q or an explicit source_ref");
      }
      if (item.source_q) {
        translatedSourceRowCount += 1;
        for (const field of ["source_t", "source_title", "source_author"]) {
          if (typeof item[field] !== "string" || !item[field].trim()) {
            failAt(key, index, `${field} is required when source_q is present`);
          }
        }
      }
      if (item.source_ref) translatedSourceRefCount += 1;
      if (
        item.review_status === "source_row_alias_matched" ||
        item.review_status === "source_row_alias_candidate"
      ) {
        if (!allowedSourceMatchBases.has(item.source_match_basis)) {
          failAt(key, index, "alias source rows require a recognized source_match_basis");
        }
      } else if (item.source_match_basis) {
        failAt(key, index, "source_match_basis is reserved for alias-matched source rows");
      }
      if (item.review_status.startsWith("source_row_")) {
        const matches = (sourceCorpus[key] || []).filter(
          (row) =>
            row.t === item.source_t &&
            row.q === item.source_q &&
            row.title === item.source_title &&
            row.author === item.source_author,
        );
        if (matches.length !== 1) {
          failAt(
            key,
            index,
            `source row must match exactly one canonical row at ${key}; got ${matches.length}`,
          );
        }
      }
    }
  }
}

const jsText = await readFile(jsPath, "utf8");
const prefix = "window.AUTHOR_CLOCK_QUOTES_KO = ";
assert.ok(jsText.startsWith(prefix), "data/ko_quotes.js must assign window.AUTHOR_CLOCK_QUOTES_KO");
const jsData = JSON.parse(jsText.slice(prefix.length).replace(/;\s*$/, ""));
assert.deepEqual(jsData, data, "ko_quotes.js and ko_quotes.json must contain identical data");

const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
assert.equal(coverage.minute_keys, 1440, "coverage minute_keys must equal 1440");
assert.equal(coverage.exact_minute_keys, 1440, "every minute must have an exact entry");
assert.deepEqual(coverage.approximate_only_keys, [], "no minute may rely on an approximate entry");
assert.equal(coverage.precise_entries, entryCount, "coverage precise entry count is stale");
assert.equal(coverage.compilation_license, "CC BY-NC-SA 2.5", "coverage compilation license is missing");
assert.equal(coverage.original_precise_entries, originalCount, "coverage original count is stale");
assert.equal(coverage.translated_entries, translatedCount, "coverage translation count is stale");
assert.equal(
  coverage.translated_source_row_entries,
  translatedSourceRowCount,
  "coverage translated source-row count is stale",
);
assert.equal(
  coverage.translated_source_ref_entries,
  translatedSourceRefCount,
  "coverage translated source-ref count is stale",
);
assert.deepEqual(
  coverage.translation_review_counts,
  Object.fromEntries(Object.entries(translationReviewCounts).sort()),
  "coverage translation review counts are stale",
);

console.log(
  `Data audit passed: ${actualKeys.length} minute keys, ${entryCount} entries ` +
    `(${originalCount} original, ${translatedCount} translated).`,
);
