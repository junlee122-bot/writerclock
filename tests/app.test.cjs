"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/app.js");

test("HTML rendering escapes content and highlights only the time phrase", () => {
  const rendered = core.renderQuoteHtml(
    '<script>alert("x")</script><br>새벽 한 시였다.',
    "새벽 한 시",
  );

  assert.equal(
    rendered,
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br><strong class="time-phrase">새벽 한 시</strong>였다.',
  );
  assert.equal(core.escapeHtml("<&\"'>"), "&lt;&amp;&quot;&#39;&gt;");
});

test("24-hour keys are strictly validated and converted", () => {
  for (const value of ["00:00", "01:01", "12:59", "23:59"]) {
    assert.equal(core.isValidHHMM(value), true, value);
  }
  for (const value of [null, "", "1:01", "24:00", "12:60", "noon"]) {
    assert.equal(core.isValidHHMM(value), false, String(value));
  }

  assert.equal(core.minutesOf("00:00"), 0);
  assert.equal(core.minutesOf("23:59"), 1439);
  assert.equal(Number.isNaN(core.minutesOf("24:00")), true);
  assert.equal(core.formatHHMM(new Date(2026, 0, 1, 7, 5)), "07:05");
});

test("minute navigation wraps at midnight", () => {
  assert.equal(core.adjacentTime("00:00", -1), "23:59");
  assert.equal(core.adjacentTime("23:59", 1), "00:00");
  assert.equal(core.adjacentTime("12:30", 90), "14:00");
  assert.equal(core.adjacentTime("invalid", 1), null);
});

test("Korean display time handles noon and midnight", () => {
  assert.equal(core.formatKoreanTime("00:01"), "오전 12:01");
  assert.equal(core.formatKoreanTime("12:59"), "오후 12:59");
  assert.equal(core.formatKoreanTime("23:07"), "오후 11:07");
  assert.equal(core.formatKoreanTime("invalid"), "--:--");
});

test("exact quote selection never falls back to another minute or wrong period", () => {
  const original = {
    time: "01:01",
    t: "한 시 일 분",
    q: "새벽 한 시 일 분이었다.",
    title: "원문 작품",
    author: "작가",
    ampm: "am",
    kind: "원문",
  };
  const translated = {
    time: "01:01",
    t: "한 시 일 분",
    q: "시계가 한 시 일 분을 가리켰다.",
    title: "번역 작품",
    author: "Writer",
    ampm: "am",
    kind: "역",
    period_review_status: "period_ambiguous",
  };
  const wrongPeriod = { ...translated, title: "오후 작품", ampm: "pm" };
  const ambiguousPeriod = { ...translated, title: "모호한 작품", ampm: "unknown" };
  const missingPeriod = { ...translated, title: "미기록 작품", ampm: "" };
  const data = { precise: { "01:01": [translated, wrongPeriod, ambiguousPeriod, missingPeriod, original] } };

  assert.deepEqual(core.exactPool(data, "01:01"), [translated, original]);
  assert.equal(
    core.pickExactQuote(data, "01:01", { preferOriginal: true, randomIndex: 0 }),
    original,
  );
  assert.equal(core.pickExactQuote(data, "01:02"), null);
  assert.equal(core.pickExactQuote(null, "01:01"), null);
});

test("preferred pool and canonical favorite resolution preserve exact dataset entries", () => {
  const canonical = {
    t: "여덟 시 오 분",
    q: "아침 여덟 시 오 분이었다.",
    title: "확인된 작품",
    author: "확인된 작가",
    ampm: "am",
    kind: "역",
    match: "exact",
  };
  const original = {
    ...canonical,
    q: "여덟 시 오 분에 문을 열었다.",
    title: "원문 작품",
    author: "원문 작가",
    kind: "원문",
  };
  const data = { precise: { "08:05": [canonical, original] } };
  const saved = { ...canonical, time: "08:05", savedAt: 1234 };

  assert.deepEqual(core.preferredExactPool(data, "08:05", false), [canonical, original]);
  assert.deepEqual(core.preferredExactPool(data, "08:05", true), [original]);
  assert.deepEqual(core.resolveCanonicalFavorite(data, saved), saved);

  assert.equal(
    core.resolveCanonicalFavorite(data, { ...saved, q: "지어낸 문장이다." }),
    null,
  );
  assert.equal(core.resolveCanonicalFavorite(data, { ...saved, time: "20:05" }), null);

  const restored = core.resolveCanonicalFavorite(data, {
    ...saved,
    t: "조작된 시간 표현",
    kind: "원문",
  });
  assert.equal(restored.t, canonical.t);
  assert.equal(restored.kind, canonical.kind);

  const ambiguousData = {
    precise: { "08:05": [{ ...canonical, ampm: "unknown" }] },
  };
  assert.equal(core.resolveCanonicalFavorite(ambiguousData, saved), null);
});

test("global shortcuts identify interactive targets", () => {
  assert.equal(core.isInteractiveShortcutTarget({ tagName: "BUTTON" }), true);
  assert.equal(core.isInteractiveShortcutTarget({ tagName: "INPUT" }), true);
  assert.equal(core.isInteractiveShortcutTarget({ isContentEditable: true }), true);
  assert.equal(core.isInteractiveShortcutTarget({
    tagName: "SPAN",
    closest: () => ({ tagName: "A" }),
  }), true);
  assert.equal(core.isInteractiveShortcutTarget({
    tagName: "DIV",
    closest: () => null,
  }), false);
});

test("recent tracking rotates duplicate-free choices before resetting", () => {
  const first = { t: "한 시", q: "한 시 A", title: "A", author: "A", ampm: "am" };
  const second = { t: "한 시", q: "한 시 B", title: "B", author: "B", ampm: "am" };
  const data = { precise: { "01:00": [first, second] } };
  const recent = new Set();

  assert.equal(core.pickExactQuote(data, "01:00", { recent, randomIndex: 0 }), first);
  assert.equal(core.pickExactQuote(data, "01:00", { recent, randomIndex: 0 }), second);
  assert.equal(core.pickExactQuote(data, "01:00", { recent, randomIndex: 0 }), first);
});

test("favorites toggle immutably and keep the fields needed for restoration", () => {
  const item = {
    time: "12:34",
    t: "열두 시 삼십사 분",
    q: "열두 시 삼십사 분이었다.",
    title: "작품",
    author: "작가",
    kind: "역",
    ampm: "pm",
    review_status: "source_row_reviewed",
    source_review_basis: "alias_translation_review",
    period_review_status: "period_ambiguous",
    content_warning: "납치 상황",
  };
  const initial = [];
  const added = core.toggleFavoriteList(initial, item);

  assert.deepEqual(initial, []);
  assert.equal(added.length, 1);
  assert.equal(added[0].time, "12:34");
  assert.equal(added[0].q, item.q);
  assert.equal(added[0].review_status, item.review_status);
  assert.equal(added[0].source_review_basis, item.source_review_basis);
  assert.equal(added[0].period_review_status, item.period_review_status);
  assert.equal(added[0].content_warning, item.content_warning);
  assert.equal(typeof added[0].savedAt, "number");
  assert.deepEqual(core.toggleFavoriteList(added, item), []);
  assert.equal(added.length, 1);
});

test("source and period review labels distinguish provenance from AM/PM certainty", () => {
  assert.equal(
    core.reviewStatusText({ kind: "역", review_status: "source_row_reviewed" }),
    "개별 원문 행 검토 완료",
  );
  assert.equal(
    core.reviewStatusText({ kind: "역", review_status: "primary_source_verified" }),
    "1차 출전 원문 확인",
  );
  assert.equal(
    core.periodReviewStatusText({ kind: "역", period_review_status: "period_ambiguous" }),
    "원문만으로 오전·오후 미확정",
  );
  assert.equal(
    core.periodReviewStatusText({ kind: "역", period_review_status: "period_unreviewed" }),
    "시간대 근거 검토 미완료",
  );
});
