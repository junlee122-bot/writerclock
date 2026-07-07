#!/usr/bin/env bash
# Build the subset Korean font and LVGL C fonts for the author-clock firmware.
# Requires: curl, pyftsubset (fonttools), node + npx (lv_font_conv).
# Run build_data.py first so ../data/glyphs.txt exists.
set -euo pipefail
cd "$(dirname "$0")"

FONT_URL="https://github.com/google/fonts/raw/main/ofl/nanummyeongjo/NanumMyeongjo-Regular.ttf"
SRC_TTF="NanumMyeongjo-Regular.ttf"     # OFL, redistributable
SUBSET_TTF="NanumMyeongjo-subset.ttf"
GLYPHS="../data/glyphs.txt"

[ -f "$SRC_TTF" ] || curl -sL -o "$SRC_TTF" "$FONT_URL"

pyftsubset "$SRC_TTF" --text-file="$GLYPHS" --output-file="$SUBSET_TTF" \
  --layout-features='' --no-hinting --desubroutinize

# non-ASCII glyphs (hangul + specials), whitespace stripped, for lv_font_conv --symbols
python3 -c "
s=open('$GLYPHS',encoding='utf-8').read()
non=sorted({c for c in s if ord(c)>=128 and not c.isspace()})
open('hangul_symbols.txt','w',encoding='utf-8').write(''.join(non))
"

# ASCII via --range, hangul/specials via --symbols. 2bpp = smooth enough, compact.
npx --yes lv_font_conv --font "$SUBSET_TTF" --size 28 --bpp 2 --format lvgl \
  --range 0x20-0x7E --symbols "$(cat hangul_symbols.txt)" -o font_ko_28.c
npx --yes lv_font_conv --font "$SUBSET_TTF" --size 44 --bpp 2 --format lvgl \
  --range 0x20-0x7E --symbols "$(cat hangul_symbols.txt)" -o font_ko_44.c

echo "done: $SUBSET_TTF, font_ko_28.c, font_ko_44.c"
