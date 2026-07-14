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
assert.equal(data.meta?.schema_version, 3, "dataset schema version is stale");
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
const allowedPeriodReviewStatuses = new Set([
  "period_explicit",
  "period_contextual",
  "period_ambiguous",
  "period_unreviewed",
]);
const allowedSourceMatchBases = new Set([
  "translated_pair",
  "translated_title_author",
  "translated_title",
  "translated_author",
]);
const allowedCanonicalReviewBases = new Set([
  "alias_translation_review",
  "title_author_body_review",
  "translated_title_body_review",
  "same_work_body_disambiguation",
]);
const allowedReviewStatuses = new Set([
  "machine_checked",
  "source_row_matched",
  "source_row_alias_matched",
  "source_row_reviewed",
  "primary_source_verified",
]);
let entryCount = 0;
let originalCount = 0;
let translatedCount = 0;
let translatedSourceExcerptCount = 0;
let translatedCanonicalSourceRowCount = 0;
let translatedExternalSourceCount = 0;
let translatedPrimarySourceCount = 0;
let translatedSourceRefCount = 0;
const translationReviewCounts = {};
const translationPeriodReviewCounts = {};
const translationSourceReviewBasisCounts = {};
const translationSourceMatchBasisCounts = {};

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
      if (!allowedPeriodReviewStatuses.has(item.period_review_status)) {
        failAt(key, index, "translated entries require a recognized period_review_status");
      }
      translationReviewCounts[item.review_status] =
        (translationReviewCounts[item.review_status] || 0) + 1;
      translationPeriodReviewCounts[item.period_review_status] =
        (translationPeriodReviewCounts[item.period_review_status] || 0) + 1;
      if (!item.source_q) failAt(key, index, "translated entries require a source excerpt");
      if (item.source_q) {
        translatedSourceExcerptCount += 1;
        for (const field of ["source_t", "source_title", "source_author"]) {
          if (typeof item[field] !== "string" || !item[field].trim()) {
            failAt(key, index, `${field} is required when source_q is present`);
          }
        }
      }
      if (item.source_ref) translatedSourceRefCount += 1;
      if (
        item.review_status === "source_row_alias_matched"
      ) {
        if (!allowedSourceMatchBases.has(item.source_match_basis)) {
          failAt(key, index, "alias source rows require a recognized source_match_basis");
        }
      } else if (item.source_match_basis) {
        failAt(key, index, "source_match_basis is reserved for alias-matched source rows");
      }
      if (item.source_match_basis) {
        translationSourceMatchBasisCounts[item.source_match_basis] =
          (translationSourceMatchBasisCounts[item.source_match_basis] || 0) + 1;
      }
      if (item.review_status === "source_row_reviewed") {
        if (!allowedCanonicalReviewBases.has(item.source_review_basis)) {
          failAt(key, index, "reviewed canonical source row requires a recognized source_review_basis");
        }
      } else if (item.review_status === "primary_source_verified") {
        if (item.source_review_basis !== "primary_source_excerpt_review") {
          failAt(key, index, "verified primary source requires its review basis");
        }
      } else if (item.source_review_basis) {
        failAt(key, index, "source_review_basis is reserved for reviewed source entries");
      }
      if (item.source_review_basis) {
        translationSourceReviewBasisCounts[item.source_review_basis] =
          (translationSourceReviewBasisCounts[item.source_review_basis] || 0) + 1;
      }
      const matches = (sourceCorpus[key] || []).filter(
        (row) =>
          row.t === item.source_t &&
          row.q === item.source_q &&
          row.title === item.source_title &&
          row.author === item.source_author,
      );
      if (item.review_status === "primary_source_verified") {
        for (const field of ["source_t", "source_q", "source_title", "source_author", "source_url"]) {
          if (typeof item[field] !== "string" || !item[field].trim()) {
            failAt(key, index, `verified primary source requires ${field}`);
          }
        }
        if (!item.source_url.startsWith("https://")) {
          failAt(key, index, "verified primary source URL must use HTTPS");
        }
        if (item.source_ref) failAt(key, index, "verified primary source must not use source_ref");
        if (matches.length !== 0) {
          failAt(key, index, "verified external primary source unexpectedly duplicates a canonical row");
        }
        translatedPrimarySourceCount += 1;
        translatedExternalSourceCount += 1;
      } else {
        const checkedExternalSource =
          item.review_status === "machine_checked" &&
          matches.length === 0 &&
          typeof item.source_url === "string" &&
          item.source_url.startsWith("https://");
        if (matches.length !== 1 && !checkedExternalSource) {
          failAt(
            key,
            index,
            `source row must match exactly one canonical row at ${key}; got ${matches.length}`,
          );
        }
        if (checkedExternalSource) translatedExternalSourceCount += 1;
        else translatedCanonicalSourceRowCount += 1;
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
assert.equal(coverage.schema_version, 3, "coverage schema version is stale");
assert.equal(coverage.minute_keys, 1440, "coverage minute_keys must equal 1440");
assert.equal(coverage.exact_minute_keys, 1440, "every minute must have an exact entry");
assert.deepEqual(coverage.approximate_only_keys, [], "no minute may rely on an approximate entry");
assert.equal(coverage.precise_entries, entryCount, "coverage precise entry count is stale");
assert.equal(coverage.compilation_license, "CC BY-NC-SA 2.5", "coverage compilation license is missing");
assert.equal(coverage.original_precise_entries, originalCount, "coverage original count is stale");
assert.equal(coverage.translated_entries, translatedCount, "coverage translation count is stale");
assert.equal(
  coverage.translated_source_excerpt_entries,
  translatedSourceExcerptCount,
  "coverage translated source-excerpt count is stale",
);
assert.equal(
  coverage.translated_canonical_source_row_entries,
  translatedCanonicalSourceRowCount,
  "coverage translated canonical source-row count is stale",
);
assert.equal(
  coverage.translated_primary_source_entries,
  translatedPrimarySourceCount,
  "coverage translated primary-source count is stale",
);
assert.equal(
  coverage.translated_external_source_entries,
  translatedExternalSourceCount,
  "coverage translated external-source count is stale",
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
assert.deepEqual(
  coverage.translation_period_review_counts,
  Object.fromEntries(Object.entries(translationPeriodReviewCounts).sort()),
  "coverage translation period review counts are stale",
);
assert.deepEqual(
  coverage.translation_source_match_basis_counts,
  Object.fromEntries(Object.entries(translationSourceMatchBasisCounts).sort()),
  "coverage translation source match-basis counts are stale",
);
assert.deepEqual(
  coverage.translation_source_review_basis_counts,
  Object.fromEntries(Object.entries(translationSourceReviewBasisCounts).sort()),
  "coverage translation source review-basis counts are stale",
);
assert.equal(translatedSourceRefCount, 0, "legacy source_ref entries must be fully resolved");
assert.equal(translatedCanonicalSourceRowCount, 1428, "all canonical translation rows must remain mapped");
assert.equal(translatedExternalSourceCount, 12, "all external source excerpts must remain cited");
assert.equal(translatedPrimarySourceCount, 8, "all supplemental rows must have verified primary sources");
assert.equal(
  translatedCanonicalSourceRowCount + translatedExternalSourceCount,
  translatedSourceExcerptCount,
  "every translated source excerpt must be classified",
);
assert.deepEqual(
  Object.fromEntries(Object.entries(translationReviewCounts).sort()),
  {
    machine_checked: 17,
    primary_source_verified: 8,
    source_row_alias_matched: 118,
    source_row_matched: 678,
    source_row_reviewed: 619,
  },
  "translation review status distribution changed unexpectedly",
);
assert.deepEqual(
  Object.fromEntries(Object.entries(translationPeriodReviewCounts).sort()),
  {
    period_ambiguous: 204,
    period_contextual: 7,
    period_explicit: 128,
    period_unreviewed: 1101,
  },
  "translation period review distribution changed unexpectedly",
);
assert.deepEqual(
  Object.fromEntries(Object.entries(translationSourceMatchBasisCounts).sort()),
  { translated_pair: 115, translated_title_author: 3 },
  "translation alias match-basis distribution changed unexpectedly",
);
assert.deepEqual(
  Object.fromEntries(Object.entries(translationSourceReviewBasisCounts).sort()),
  {
    alias_translation_review: 338,
    primary_source_excerpt_review: 8,
    same_work_body_disambiguation: 11,
    title_author_body_review: 236,
    translated_title_body_review: 34,
  },
  "translation source review-basis distribution changed unexpectedly",
);

console.log(
  `Data audit passed: ${actualKeys.length} minute keys, ${entryCount} entries ` +
    `(${originalCount} original, ${translatedCount} translated).`,
);
