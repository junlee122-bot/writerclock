#!/usr/bin/env python3
"""Build data/quotes.json, data/quotes.js, data/coverage.json from litclock_annotated.csv.

Data source (canonical, see SPEC.md):
https://raw.githubusercontent.com/JohannesNE/literature-clock/master/litclock_annotated.csv

Format: pipe-delimited, 6 fields, no header:
time|time_string|quote|title|author|sfw

Assumption (per SPEC.md): quote itself contains no literal pipe characters in the
common case, but if a line splits into more than 6 fields, the leftmost 2 fields
(time, time_string) and the rightmost 3 fields (title, author, sfw) are fixed and
everything in between is rejoined with "|" to reconstruct the quote.
"""

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

CSV_URL = "https://raw.githubusercontent.com/JohannesNE/literature-clock/master/litclock_annotated.csv"
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
CSV_CACHE = DATA_DIR / "litclock_annotated.csv"
QUOTES_JSON = DATA_DIR / "quotes.json"
QUOTES_JS = DATA_DIR / "quotes.js"
COVERAGE_JSON = DATA_DIR / "coverage.json"

TIME_RE = re.compile(r"^([0-9]{1,2}):([0-9]{1,2})$")


def fetch_csv(force_refresh):
    if CSV_CACHE.exists() and not force_refresh:
        sys.stdout.write("Using cached CSV: %s\n" % CSV_CACHE)
        return CSV_CACHE.read_text(encoding="utf-8")

    sys.stdout.write("Downloading CSV from %s\n" % CSV_URL)
    try:
        with urllib.request.urlopen(CSV_URL, timeout=60) as response:
            raw = response.read()
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        raise RuntimeError(
            "Failed to download litclock CSV from %s: %s" % (CSV_URL, exc)
        ) from exc

    text = raw.decode("utf-8")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CSV_CACHE.write_text(text, encoding="utf-8")
    return text


def normalize_time(raw_time):
    match = TIME_RE.match(raw_time.strip())
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    return "%02d:%02d" % (hour, minute)


def parse_line(line):
    """Return (hhmm, entry_dict) or None if the line must be skipped."""
    parts = line.split("|")
    if len(parts) < 6:
        return None

    time_raw = parts[0]
    time_string = parts[1]
    sfw = parts[-1].strip()
    author = parts[-2]
    title = parts[-3]
    quote = "|".join(parts[2:-3])

    hhmm = normalize_time(time_raw)
    if hhmm is None:
        return None

    entry = {
        "t": time_string,
        "q": quote,
        "title": title,
        "author": author,
        "sfw": sfw,
    }
    return hhmm, entry


def build(force_refresh):
    csv_text = fetch_csv(force_refresh)

    quotes_by_minute = {}
    counts = {"sfw": 0, "unknown": 0, "nsfw": 0}
    skipped = 0
    total_lines = 0

    for raw_line in csv_text.splitlines():
        line = raw_line.rstrip("\r\n")
        if not line.strip():
            continue
        total_lines += 1

        parsed = parse_line(line)
        if parsed is None:
            skipped += 1
            continue

        hhmm, entry = parsed
        sfw_value = entry["sfw"]
        if sfw_value not in counts:
            skipped += 1
            continue

        counts[sfw_value] += 1
        quotes_by_minute.setdefault(hhmm, []).append(entry)

    sys.stdout.write(
        "Parsed %d data lines, skipped %d malformed lines\n" % (total_lines, skipped)
    )

    quotes_all_sorted = dict(sorted(quotes_by_minute.items()))

    quotes_js_data = {}
    for hhmm, entries in quotes_all_sorted.items():
        kept = [e for e in entries if e["sfw"] != "nsfw"]
        if kept:
            quotes_js_data[hhmm] = kept
    quotes_js_data = dict(sorted(quotes_js_data.items()))

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    QUOTES_JSON.write_text(
        json.dumps(quotes_all_sorted, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    js_content = "window.AUTHOR_CLOCK_QUOTES = %s;\n" % json.dumps(
        quotes_js_data, ensure_ascii=False, indent=2, sort_keys=True
    )
    QUOTES_JS.write_text(js_content, encoding="utf-8")

    all_minutes = ["%02d:%02d" % (h, m) for h in range(24) for m in range(60)]
    missing = [m for m in all_minutes if m not in quotes_js_data]
    total_quotes = counts["sfw"] + counts["unknown"] + counts["nsfw"]

    coverage = {
        "total_minutes_with_quotes": len(quotes_js_data),
        "missing": sorted(missing),
        "counts": counts,
        "total_quotes": total_quotes,
    }
    COVERAGE_JSON.write_text(
        json.dumps(coverage, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return quotes_all_sorted, quotes_js_data, coverage


def main():
    force_refresh = "--refresh" in sys.argv[1:]
    quotes_all_sorted, quotes_js_data, coverage = build(force_refresh)

    sys.stdout.write("Wrote %s\n" % QUOTES_JSON)
    sys.stdout.write("Wrote %s\n" % QUOTES_JS)
    sys.stdout.write("Wrote %s\n" % COVERAGE_JSON)
    sys.stdout.write(
        "Coverage: %d/1440 minutes with quotes (js, sfw+unknown), %d missing\n"
        % (coverage["total_minutes_with_quotes"], len(coverage["missing"]))
    )
    sys.stdout.write("Counts: %s\n" % coverage["counts"])
    sys.stdout.write("Total quotes: %d\n" % coverage["total_quotes"])


if __name__ == "__main__":
    main()
