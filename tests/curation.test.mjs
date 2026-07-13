import assert from "node:assert/strict";
import test from "node:test";

import {
  addUniqueAlias,
  aliasedSource,
  trustedSourceAliases,
} from "../scripts/curate_translation_corpus.mjs";

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
