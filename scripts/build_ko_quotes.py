#!/usr/bin/env python3
"""Build the Writer Clock Korean dataset deterministically.

The canonical inputs are deliberately separate from generated output:

* data/ko_translations.json — one review-status-labeled translated entry for every minute.
* data/ko_sources/*.txt — cached public-domain Korean Wikisource source text.

The builder extracts conservative Korean originals, merges both inputs, verifies
provenance and coverage, and writes ko_quotes.json/js plus ko_coverage.json.
Running with --check never writes; it fails when committed generated files differ.
Networking is opt-in with --refresh. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SOURCE_DIR = DATA_DIR / "ko_sources"
TRANSLATIONS_JSON = DATA_DIR / "ko_translations.json"
QUOTES_JSON = DATA_DIR / "ko_quotes.json"
QUOTES_JS = DATA_DIR / "ko_quotes.js"
COVERAGE_JSON = DATA_DIR / "ko_coverage.json"

RAW_URL = "https://ko.wikisource.org/w/index.php?title=%s&action=raw"
USER_AGENT = "WriterClockBot/2.0 (public-domain corpus; github.com/junlee122-bot/writerclock)"
PD_CUTOFF_YEAR = 1955

WORKS = [
    ("운수 좋은 날", "현진건", 1943, False),
    ("빈처", "현진건", 1943, False),
    ("B사감과 러브레터", "현진건", 1943, False),
    ("술 권하는 사회", "현진건", 1943, False),
    ("고향 (현진건)", "현진건", 1943, False),
    ("감자", "김동인", 1951, False),
    ("배따라기", "김동인", 1951, False),
    ("광염 소나타", "김동인", 1951, False),
    ("발가락이 닮았다", "김동인", 1951, False),
    ("물레방아", "나도향", 1926, False),
    ("뽕", "나도향", 1926, False),
    ("날개", "이상", 1937, False),
    ("봄봄", "김유정", 1937, False),
    ("동백꽃", "김유정", 1937, False),
    ("만무방", "김유정", 1937, False),
    ("메밀꽃 필 무렵", "이효석", 1942, False),
    ("홍염", "최서해", 1932, False),
    ("탈출기", "최서해", 1932, False),
    ("레디메이드 인생", "채만식", 1950, False),
    ("경희", "나혜석", 1948, False),
    ("상록수", "심훈", 1936, True),
    ("무정", "이광수", 1950, True),
    ("태평천하", "채만식", 1950, True),
]

ALL_MINUTES = [f"{hour:02d}:{minute:02d}" for hour in range(24) for minute in range(60)]
DISAMBIG_RE = re.compile(r"\s*\([^)]*\)\s*$")
REDIRECT_RE = re.compile(r"^\s*#(?:넘겨주기|REDIRECT)\s*\[\[([^\]]+)\]\]", re.IGNORECASE)
SUBPAGE_LINK_RE = re.compile(r"\[\[\s*(/?[^\]|#]+?)\s*(?:\||\]\])")
SKIP_LINK_PREFIX = ("분류:", "파일:", "File:", "Image:", "저자:", "글쓴이:", "위키백과", "s:", "w:")


def raw_url(title: str) -> str:
    return RAW_URL % urllib.parse.quote(title)


def cache_path(title: str) -> Path:
    return SOURCE_DIR / (title.replace("/", "_") + ".txt")


def fetch_raw(title: str) -> str | None:
    request = urllib.request.Request(raw_url(title), headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            text = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise RuntimeError(f"HTTP error fetching {title!r}: {error}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error fetching {title!r}: {error}") from error
    return text if text.strip() else None


def resolve_redirect(title: str, text: str) -> str:
    match = REDIRECT_RE.match(text)
    if not match:
        return text
    target = match.group(1).split("|")[0].strip()
    return fetch_raw(target) or text


def find_subpages(title: str, text: str) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for link in SUBPAGE_LINK_RE.findall(text):
        link = link.strip()
        if any(link.startswith(prefix) for prefix in SKIP_LINK_PREFIX) or "/" not in link:
            continue
        if link.startswith("/"):
            resolved = title + "/" + link.strip("/")
        elif link.startswith(title + "/"):
            resolved = link
        else:
            continue
        if resolved not in seen:
            seen.add(resolved)
            found.append(resolved)
    return found


def acquire_raw(title: str, toc: bool, refresh: bool) -> str:
    path = cache_path(title)
    if path.exists() and not refresh:
        return path.read_text(encoding="utf-8")
    if not refresh:
        raise RuntimeError(f"Missing cached source {path}; use --refresh explicitly to fetch")

    text = fetch_raw(title)
    if text is None:
        raise RuntimeError(f"No source returned for {title!r}")
    text = resolve_redirect(title, text)
    if toc:
        parts = []
        for page in find_subpages(title, text):
            body = fetch_raw(page)
            if body:
                parts.append(body)
        if not parts:
            raise RuntimeError(f"TOC source {title!r} contained no readable chapters")
        text = "\n\n".join(parts)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return text


TEMPLATE_RE = re.compile(r"\{\{[^{}]*\}\}")
TABLE_RE = re.compile(r"\{\|.*?\|\}", re.DOTALL)
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
REF_PAIR_RE = re.compile(r"<ref[^>]*>.*?</ref>", re.DOTALL | re.IGNORECASE)
REF_SELF_RE = re.compile(r"<ref[^>]*/>", re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
CAT_LINK_RE = re.compile(r"\[\[(?:분류|파일|File|Image)\s*:[^\]]*\]\]", re.IGNORECASE)
PIPED_LINK_RE = re.compile(r"\[\[[^\]|]*\|([^\]]+)\]\]")
PLAIN_LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
HEADER_LINE_RE = re.compile(r"^\s*=+\s*.*?\s*=+\s*$", re.MULTILINE)
LIST_MARK_RE = re.compile(r"^[\*#:;]+\s*", re.MULTILINE)
WS_RE = re.compile(r"\s+")
SENT_SPLIT_RE = re.compile(r'([.!?…]+["\'”’)\]]*|”)')


def normalize_ws(text: str) -> str:
    return WS_RE.sub(" ", text).strip()


def clean_wikitext(raw: str) -> list[str]:
    text = COMMENT_RE.sub("", raw)
    text = REF_PAIR_RE.sub("", text)
    text = REF_SELF_RE.sub("", text)
    text = TABLE_RE.sub("", text)
    previous = None
    while previous != text:
        previous = text
        text = TEMPLATE_RE.sub("", text)
    text = CAT_LINK_RE.sub("", text)
    text = PIPED_LINK_RE.sub(lambda match: match.group(1), text)
    text = PLAIN_LINK_RE.sub(lambda match: match.group(1), text)
    text = re.sub(r"'{2,5}", "", text)
    text = HEADER_LINE_RE.sub("", text)
    text = TAG_RE.sub("", text)
    text = LIST_MARK_RE.sub("", text)
    return [normalize_ws(block) for block in re.split(r"\n\s*\n", text) if normalize_ws(block)]


def split_sentences(paragraph: str) -> list[str]:
    marked = SENT_SPLIT_RE.sub(lambda match: match.group(1) + "\x00", paragraph)
    return [part.strip() for part in marked.split("\x00") if 12 <= len(part.strip()) <= 220]


HOURS = {
    "한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5, "여섯": 6,
    "일곱": 7, "여덟": 8, "아홉": 9, "열": 10, "열한": 11, "열두": 12,
}
ONES = {"일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9}


def korean_minute_words() -> dict[str, int]:
    words: dict[str, int] = {}
    for minute in range(1, 60):
        tens, ones = divmod(minute, 10)
        value = ("" if tens == 0 else ("십" if tens == 1 else list(ONES)[tens - 1] + "십"))
        if ones:
            value += list(ONES)[ones - 1]
        words[value] = minute
    return words


MINUTE_WORDS = korean_minute_words()
HOUR_PATTERN = "|".join([
    r"열\s*두", r"열\s*한", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "한", "두", "세", "네"
])
MINUTE_PATTERN = "|".join(sorted((re.escape(word) for word in MINUTE_WORDS), key=len, reverse=True))
RIGHT_CONTEXT = (
    r"(?=$|[^가-힣]|(?:에야|에서|에는|에|가|는|은|를|부터|까지|쯤|께|경|나|도|엔|"
    r"이었다|이었고|이었으며|이었는데|였다|였고|였으며|이고|이다|인|이)(?=$|[^가-힣]))"
)
HOUR_RE = re.compile(
    rf"(?<![가-힣])(?P<hour>{HOUR_PATTERN})\s*시"
    rf"(?:(?:\s*(?P<half>반))|(?:\s*(?P<minute>\d{{1,2}}|{MINUTE_PATTERN})\s*분))?"
    + RIGHT_CONTEXT
)
DIRECT_MINUTE_AFTER_RE = re.compile(r"^\s*(?:가|를|는)?\s*(?:한\s*)?(?:\d{1,2}|" + MINUTE_PATTERN + r")\s*분")
APPROXIMATE_RE = re.compile(
    r"쯤|가량|무렵|직전|몇\s*분|되기\s*전|"
    r"(?:한|십|이십|삼십|사십|오십|\d+)여\s*분|"
    r"(?:좀|훨씬)?\s*(?:지나|지났|넘어|넘었|넘긴|넘어서)"
)
NON_TIME_HOUR_RE = re.compile(r"한시\s*(?:\(漢詩\)|한문|맛|공부|와)")
AM_CUE_RE = re.compile(r"새벽|아침|오전")
PM_CUE_RE = re.compile(r"오후|저녁")
MIDNIGHT_RE = re.compile(r"자정")
NOON_RE = re.compile(r"정오")
NIGHT_RE = re.compile(r"(?<![가-힣])(?:한밤중|밤중|한밤|밤)(?!낮|새)")


def hour_number(text: str) -> int:
    return HOURS[re.sub(r"\s+", "", text)]


def minute_number(text: str | None, half: bool) -> int:
    if half:
        return 30
    if not text:
        return 0
    if text.isdigit():
        return int(text)
    return MINUTE_WORDS[text]


def infer_ampm(sentence: str, hour: int) -> str:
    if MIDNIGHT_RE.search(sentence):
        return "am"
    if NOON_RE.search(sentence):
        return "pm"
    if AM_CUE_RE.search(sentence) and not PM_CUE_RE.search(sentence):
        return "am"
    if PM_CUE_RE.search(sentence) and not AM_CUE_RE.search(sentence):
        return "pm"
    if NIGHT_RE.search(sentence):
        return "am" if hour == 12 or hour <= 5 else "pm"
    return "unknown"


def key_for(hour: int, minute: int, ampm: str) -> str:
    if ampm == "am":
        hour24 = 0 if hour == 12 else hour
    elif ampm == "pm":
        hour24 = 12 if hour == 12 else hour + 12
    else:
        raise ValueError("precise entries require an explicit AM/PM cue")
    return f"{hour24:02d}:{minute:02d}"


def extract_precise(sentence: str) -> list[tuple[str, str, str]]:
    if NON_TIME_HOUR_RE.search(sentence):
        return []
    matches = list(HOUR_RE.finditer(sentence))
    if len(matches) != 1:
        return []
    match = matches[0]
    if APPROXIMATE_RE.search(sentence[max(0, match.start() - 8): min(len(sentence), match.end() + 32)]):
        return []
    if not match.group("minute") and not match.group("half"):
        tail = sentence[match.end(): match.end() + 18]
        if DIRECT_MINUTE_AFTER_RE.search(tail):
            return []
    hour = hour_number(match.group("hour"))
    minute = minute_number(match.group("minute"), bool(match.group("half")))
    if minute > 59:
        return []
    ampm = infer_ampm(sentence, hour)
    # A bare Korean 12-hour expression (for example, "세 시") does not prove
    # whether the scene belongs to 03:00 or 15:00. Keep it out of the 24-hour
    # precise corpus instead of duplicating it across both keys.
    if ampm == "unknown":
        return []
    phrase = match.group(0).strip()
    primary = key_for(hour, minute, ampm)
    return [(primary, phrase, ampm)]


BUCKET_ORDER = ["자정", "새벽", "아침", "오전", "정오", "오후", "저녁", "밤"]
BUCKET_META = {
    "자정": {"rep": "00:00", "start": "23:30", "end": "00:29"},
    "새벽": {"rep": "04:30", "start": "03:00", "end": "05:59"},
    "아침": {"rep": "07:30", "start": "06:00", "end": "08:59"},
    "오전": {"rep": "10:00", "start": "09:00", "end": "11:29"},
    "정오": {"rep": "12:00", "start": "11:30", "end": "13:29"},
    "오후": {"rep": "15:00", "start": "13:30", "end": "16:59"},
    "저녁": {"rep": "18:30", "start": "17:00", "end": "19:29"},
    "밤": {"rep": "21:30", "start": "19:30", "end": "23:29"},
}
DAYPART_PATTERNS = {
    "자정": re.compile(r"(?<![가-힣])자정(?![가-힣])"),
    "새벽": re.compile(r"(?<![가-힣])(?:새벽|동틀녘|먼동)(?=$|[^가-힣]|[에이은을])"),
    "아침": re.compile(r"(?<![가-힣])(?:아침|아침나절|조반)(?=$|[^가-힣]|[에이은을])"),
    "오전": re.compile(r"(?<![가-힣])오전(?=$|[^가-힣])"),
    "정오": re.compile(r"(?<![가-힣])(?:정오|한낮|대낮|낮)(?!밤)(?=$|[^가-힣]|[에이은을])"),
    "오후": re.compile(r"(?<![가-힣])오후(?=$|[^가-힣])"),
    "저녁": re.compile(r"(?<![가-힣])(?:저녁|황혼|땅거미|어스름)(?=$|[^가-힣]|[에이은을])"),
    "밤": re.compile(r"(?<![가-힣])(?:초저녁|야밤|밤)(?!낮|새)(?=$|[^가-힣]|[에이은을중])"),
}


def extract_bucket(sentence: str) -> tuple[str, str] | None:
    for name in BUCKET_ORDER:
        match = DAYPART_PATTERNS[name].search(sentence)
        if match:
            return name, match.group(0)
    return None


def load_translations() -> dict[str, list[dict]]:
    if not TRANSLATIONS_JSON.exists():
        raise RuntimeError(f"Missing canonical translation corpus: {TRANSLATIONS_JSON}")
    translations = json.loads(TRANSLATIONS_JSON.read_text(encoding="utf-8"))
    keys = sorted(translations)
    if keys != ALL_MINUTES:
        missing = sorted(set(ALL_MINUTES) - set(keys))
        extra = sorted(set(keys) - set(ALL_MINUTES))
        raise RuntimeError(f"Translation coverage must be exactly 1440 keys; missing={missing}, extra={extra}")
    for time, entries in translations.items():
        if not isinstance(entries, list) or not entries:
            raise RuntimeError(f"Translation minute {time} has no entries")
        for entry in entries:
            for field in ("t", "q", "title", "author"):
                if not isinstance(entry.get(field), str) or not entry[field].strip():
                    raise RuntimeError(f"Translation {time} missing {field}")
            if entry["t"].casefold() not in entry["q"].casefold():
                raise RuntimeError(f"Translation {time} time phrase is not inside quote")
            entry["kind"] = "역"
            entry.setdefault("match", "exact")
    return translations


def extract_korean_originals(refresh: bool) -> tuple[dict[str, list[dict]], dict[str, list[dict]], list[dict]]:
    precise: dict[str, list[dict]] = {}
    buckets: dict[str, list[dict]] = {name: [] for name in BUCKET_ORDER}
    sources: list[dict] = []
    seen_precise: set[tuple[str, str]] = set()
    seen_bucket: set[tuple[str, str]] = set()

    for title, author, death_year, toc in WORKS:
        if death_year > PD_CUTOFF_YEAR:
            raise RuntimeError(f"{title!r} exceeds public-domain cutoff")
        raw = acquire_raw(title, toc, refresh)
        raw_normalized = normalize_ws(raw)
        display_title = DISAMBIG_RE.sub("", title)
        extracted = 0

        for paragraph in clean_wikitext(raw):
            for sentence in split_sentences(paragraph):
                normalized = normalize_ws(sentence)
                if normalized not in raw_normalized:
                    continue
                matches = extract_precise(sentence)
                if matches:
                    for time, phrase, ampm in matches:
                        dedupe = (time, normalized)
                        if dedupe in seen_precise:
                            continue
                        seen_precise.add(dedupe)
                        precise.setdefault(time, []).append({
                            "t": phrase,
                            "q": sentence,
                            "title": display_title,
                            "author": author,
                            "ampm": ampm,
                            "kind": "원문",
                            "match": "exact",
                            "source_page": title,
                            "source_url": raw_url(title),
                        })
                        extracted += 1
                    continue
                bucket = extract_bucket(sentence)
                if bucket:
                    name, phrase = bucket
                    dedupe = (name, normalized)
                    if dedupe in seen_bucket:
                        continue
                    seen_bucket.add(dedupe)
                    buckets[name].append({
                        "t": phrase,
                        "q": sentence,
                        "title": display_title,
                        "author": author,
                        "kind": "원문",
                        "match": "daypart",
                        "source_page": title,
                        "source_url": raw_url(title),
                    })
                    extracted += 1

        sources.append({
            "title": display_title,
            "page": title,
            "author": author,
            "death_year": death_year,
            "url": raw_url(title),
            "fetched_chars": len(raw),
            "extracted": extracted,
        })
    return precise, buckets, sources


def verify_original_provenance(precise: dict, buckets: dict) -> int:
    raw_by_page = {
        title: normalize_ws(cache_path(title).read_text(encoding="utf-8"))
        for title, _author, _death, _toc in WORKS
    }
    verified = 0
    for group in (precise, buckets):
        for entries in group.values():
            for entry in entries:
                source = raw_by_page.get(entry["source_page"], "")
                if normalize_ws(entry["q"]) not in source:
                    raise RuntimeError(f"Original provenance failed: {entry['source_page']} / {entry['q'][:40]}")
                verified += 1
    return verified


def serialized_outputs(obj: dict, coverage: dict) -> tuple[str, str, str]:
    json_text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    js_text = "window.AUTHOR_CLOCK_QUOTES_KO = " + json.dumps(obj, ensure_ascii=False, indent=2) + ";\n"
    coverage_text = json.dumps(coverage, ensure_ascii=False, indent=2) + "\n"
    return json_text, js_text, coverage_text


def build(refresh: bool = False) -> tuple[dict, dict]:
    translations = load_translations()
    originals, buckets, sources = extract_korean_originals(refresh)
    verified_originals = verify_original_provenance(originals, buckets)

    precise: dict[str, list[dict]] = {}
    for time in ALL_MINUTES:
        translated_items = [dict(item) for item in translations[time]]
        original_items = [dict(item) for item in originals.get(time, [])]
        precise[time] = original_items + translated_items

    obj = {
        "meta": {
            "schema_version": 3,
            "minute_keys": 1440,
            "precise_policy": "Entries remain on their curated 24-hour HH:MM key; period_review_status records whether AM/PM evidence is explicit, contextual, ambiguous, or not yet reviewed.",
            "compilation_license": "CC BY-NC-SA 2.5",
            "compilation_license_file": "data/LITERATURE_CLOCK_LICENSE.md",
            "translation_input": "data/ko_translations.json",
            "original_input": "data/ko_sources/*.txt",
        },
        "precise": precise,
        "buckets": {name: buckets[name] for name in BUCKET_ORDER},
        "bucketMeta": BUCKET_META,
    }

    all_precise = [entry for entries in precise.values() for entry in entries]
    all_buckets = [entry for entries in buckets.values() for entry in entries]
    translated = [entry for entry in all_precise if entry.get("kind") == "역"]
    translation_review_counts: dict[str, int] = {}
    translation_source_match_basis_counts: dict[str, int] = {}
    translation_source_review_basis_counts: dict[str, int] = {}
    translation_period_review_counts: dict[str, int] = {}
    for entry in translated:
        status = entry.get("review_status", "missing")
        translation_review_counts[status] = translation_review_counts.get(status, 0) + 1
        basis = entry.get("source_match_basis")
        if basis:
            translation_source_match_basis_counts[basis] = translation_source_match_basis_counts.get(basis, 0) + 1
        review_basis = entry.get("source_review_basis")
        if review_basis:
            translation_source_review_basis_counts[review_basis] = translation_source_review_basis_counts.get(review_basis, 0) + 1
        period_status = entry.get("period_review_status", "missing")
        translation_period_review_counts[period_status] = translation_period_review_counts.get(period_status, 0) + 1
    approximate_keys = sorted({
        time for time, entries in precise.items()
        if not any(entry.get("match", "exact") == "exact" for entry in entries)
    })
    coverage = {
        "schema_version": 3,
        "compilation_license": "CC BY-NC-SA 2.5",
        "compilation_license_file": "data/LITERATURE_CLOCK_LICENSE.md",
        "sources": sources,
        "minute_keys": len(precise),
        "precise_entries": len(all_precise),
        "translated_entries": len(translated),
        "translated_source_excerpt_entries": sum(bool(entry.get("source_q")) for entry in translated),
        "translated_canonical_source_row_entries": sum(
            entry.get("review_status") != "primary_source_verified"
            and not (entry.get("review_status") == "machine_checked" and entry.get("source_url"))
            for entry in translated
        ),
        "translated_external_source_entries": sum(
            entry.get("review_status") == "primary_source_verified"
            or (entry.get("review_status") == "machine_checked" and bool(entry.get("source_url")))
            for entry in translated
        ),
        "translated_primary_source_entries": sum(
            entry.get("review_status") == "primary_source_verified" for entry in translated
        ),
        "translated_source_ref_entries": sum(bool(entry.get("source_ref")) for entry in translated),
        "translation_review_counts": dict(sorted(translation_review_counts.items())),
        "translation_source_match_basis_counts": dict(sorted(translation_source_match_basis_counts.items())),
        "translation_source_review_basis_counts": dict(sorted(translation_source_review_basis_counts.items())),
        "translation_period_review_counts": dict(sorted(translation_period_review_counts.items())),
        "original_precise_entries": sum(entry.get("kind") == "원문" for entry in all_precise),
        "original_bucket_entries": len(all_buckets),
        "substring_verified_original_entries": verified_originals,
        "approximate_only_keys": approximate_keys,
        "exact_minute_keys": 1440 - len(approximate_keys),
        "bucket_counts": {name: len(buckets[name]) for name in BUCKET_ORDER},
    }
    return obj, coverage


def write_outputs(obj: dict, coverage: dict) -> None:
    json_text, js_text, coverage_text = serialized_outputs(obj, coverage)
    QUOTES_JSON.write_text(json_text, encoding="utf-8")
    QUOTES_JS.write_text(js_text, encoding="utf-8")
    COVERAGE_JSON.write_text(coverage_text, encoding="utf-8")


def check_outputs(obj: dict, coverage: dict) -> None:
    expected = serialized_outputs(obj, coverage)
    paths = (QUOTES_JSON, QUOTES_JS, COVERAGE_JSON)
    stale = [str(path.relative_to(ROOT)) for path, text in zip(paths, expected) if not path.exists() or path.read_text(encoding="utf-8") != text]
    if stale:
        raise RuntimeError("Generated files are stale: " + ", ".join(stale) + ". Run scripts/build_ko_quotes.py")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="refresh cached Wikisource inputs over the network")
    parser.add_argument("--check", action="store_true", help="verify committed output without writing")
    args = parser.parse_args()
    if args.refresh and args.check:
        parser.error("--refresh and --check cannot be combined")

    obj, coverage = build(refresh=args.refresh)
    if args.check:
        check_outputs(obj, coverage)
        print("Generated dataset is reproducible and up to date.")
    else:
        write_outputs(obj, coverage)
        print(f"Wrote 1440 minute keys ({coverage['precise_entries']} precise entries).")
        if coverage["approximate_only_keys"]:
            print("Needs exact source:", ", ".join(coverage["approximate_only_keys"]))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
