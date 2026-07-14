import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addUniqueAlias,
  aliasedSource,
  assertReviewedPrimarySource,
  reviewedCanonicalSource,
  trustedSourceAliases,
} from "../scripts/curate_translation_corpus.mjs";
import { extractTranslatedCorpus } from "../scripts/split_translation_corpus.mjs";

function emptyAliases() {
  return { pair: new Map(), title: new Map(), author: new Map() };
}

function row(overrides = {}) {
  return {
    t: "1:23",
    q: "It was 1:23.",
    title: "English Title",
    author: "English Author",
    sfw: "sfw",
    ...overrides,
  };
}

test("a conflicting pair alias vetoes weaker author fallback", () => {
  const aliases = emptyAliases();
  const pairKey = "한국 제목\u0000한국 작가";
  addUniqueAlias(aliases.pair, pairKey, "English Title\u0000English Author");
  addUniqueAlias(aliases.pair, pairKey, "Other Title\u0000English Author");
  addUniqueAlias(aliases.author, "한국 작가", "English Author");

  assert.equal(
    aliasedSource(
      { "01:23": [row()] },
      "01:23",
      { title: "한국 제목", author: "한국 작가" },
      aliases,
    ),
    null,
  );
});

test("an absent trusted pair does not fall back to an author-only row", () => {
  const aliases = emptyAliases();
  aliases.pair.set("한국 제목\u0000한국 작가", "Expected Title\u0000English Author");
  aliases.author.set("한국 작가", "English Author");

  assert.equal(
    aliasedSource(
      { "01:23": [row({ title: "Different Title" })] },
      "01:23",
      { title: "한국 제목", author: "한국 작가" },
      aliases,
    ),
    null,
  );
});

test("duplicate canonical rows are never accepted as a unique alias match", () => {
  const aliases = emptyAliases();
  aliases.pair.set("한국 제목\u0000한국 작가", "English Title\u0000English Author");
  const duplicate = row();

  assert.equal(
    aliasedSource(
      { "01:23": [duplicate, { ...duplicate }] },
      "01:23",
      { title: "한국 제목", author: "한국 작가" },
      aliases,
    ),
    null,
  );
});

test("trusted alias seeds must exactly match one row at the same minute", () => {
  const translations = {
    "01:23": [{
      title: "한국 제목",
      author: "한국 작가",
      source_t: "1:23",
      source_q: "A mismatched quote.",
      source_title: "English Title",
      source_author: "English Author",
      review_status: "source_row_matched",
    }],
  };

  assert.throws(
    () => trustedSourceAliases(translations, { "01:23": [row()] }),
    /trusted source-row seed must still match exactly one canonical row/,
  );
});

test("alias-derived rows never seed later inference", () => {
  const translations = {
    "01:23": [{
      title: "한국 제목",
      author: "한국 작가",
      source_title: "English Title",
      source_author: "English Author",
      review_status: "source_row_alias_matched",
    }],
    "02:34": [{
      title: "다른 제목",
      author: "다른 작가",
      source_title: "Other Title",
      source_author: "Other Author",
      review_status: "source_row_alias_candidate",
    }],
  };
  const aliases = trustedSourceAliases(translations, {});

  assert.equal(aliases.pair.size, 0);
  assert.equal(aliases.title.size, 0);
  assert.equal(aliases.author.size, 0);
});

test("independent title and author aliases must identify the same unique row", () => {
  const aliases = emptyAliases();
  aliases.title.set("한국 제목", "English Title");
  aliases.author.set("한국 작가", "English Author");
  const result = aliasedSource(
    { "01:23": [row(), row({ title: "Other Title", author: "Other Author" })] },
    "01:23",
    { title: "한국 제목", author: "한국 작가" },
    aliases,
  );

  assert.equal(result?.basis, "translated_title_author");
  assert.deepEqual(result?.source, row());
});

test("reviewed canonical tuples require one complete exact source row", () => {
  const source = row();
  const reviewed = {
    source_t: source.t,
    source_q: source.q,
    source_title: source.title,
    source_author: source.author,
    source_review_basis: "title_author_body_review",
  };
  assert.deepEqual(reviewedCanonicalSource({ "01:23": [source] }, "01:23", reviewed), source);
  assert.throws(
    () => reviewedCanonicalSource({ "01:23": [source] }, "01:23", { ...reviewed, source_q: "Changed" }),
    /must match exactly one canonical row/,
  );
});

test("verified primary sources require an HTTPS excerpt citation", () => {
  const primary = {
    source_t: "6:44 p.m.",
    source_q: "6:44 p.m., Wednesday, October 30",
    source_title: "Riley Thorn and the Blast from the Past",
    source_author: "Lucy Score",
    source_url: "https://www.lucyscore.net/sample/example",
    source_review_basis: "primary_source_excerpt_review",
  };
  assert.doesNotThrow(() => assertReviewedPrimarySource("18:44", primary));
  assert.throws(
    () => assertReviewedPrimarySource("18:44", { ...primary, source_url: "" }),
    /requires 'source_url'/,
  );
});

test("translation split round trip preserves provenance and period review fields", () => {
  const translated = {
    ...row(),
    kind: "역",
    review_status: "source_row_reviewed",
    source_review_basis: "same_work_body_disambiguation",
    period_review_status: "period_ambiguous",
    source_url: "https://example.com/source",
    content_warning: "example",
  };
  const result = extractTranslatedCorpus({ precise: { "01:23": [{ kind: "원문" }, translated] } });
  assert.deepEqual(result, { "01:23": [translated] });
});

test("18:44 uses an explicit PM primary excerpt and no longer duplicates The Deaths", async () => {
  const corpus = JSON.parse(await readFile(new URL("../data/ko_translations.json", import.meta.url), "utf8"));
  const entry = corpus["18:44"][0];
  assert.equal(entry.review_status, "primary_source_verified");
  assert.equal(entry.period_review_status, "period_explicit");
  assert.match(entry.source_q, /6:44 p\.m\./);
  assert.equal(entry.source_title, "Riley Thorn and the Blast from the Past");
  assert.notEqual(entry.source_title, "The Deaths");
});
