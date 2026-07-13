#!/usr/bin/env node

/**
 * Curate data/ko_translations.json deterministically.
 *
 * Default: rewrite the corpus in canonical HH:MM order.
 *   node scripts/curate_translation_corpus.mjs
 *
 * Validation without writing:
 *   node scripts/curate_translation_corpus.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TRANSLATIONS_PATH = path.join(REPO_ROOT, "data", "ko_translations.json");
const SOURCE_QUOTES_PATH = path.join(REPO_ROOT, "data", "quotes.json");
const UPSTREAM_SNAPSHOT =
  "https://github.com/gyuminlee-repo/author-clock/commit/8b814e3be47b8eede7a11ef5d76797f0639df816";
const SUPPLEMENTAL_KEYS = new Set([
  "06:07", "06:18", "08:21", "10:28", "11:46", "12:31", "13:36", "18:44",
]);

// Every source selector must identify exactly one row in data/quotes.json.
// source_t/source_q/sfw are copied from that row rather than duplicated here.
const EXACT_REPLACEMENTS = {
  "01:59": {
    source: {
      title: "So Long, and Thanks for All the Fish",
      author: "Douglas Adams",
      t: "One ... fifty-nine",
    },
    t: "1시… 59분",
    q: "그는 20분 동안 앉아서 우주선과 에푼 사이의 간격이 좁혀지는 모습을 지켜보았다. 우주선 컴퓨터는 작은 위성 주위를 한 바퀴 돌아 닫힌 궤도에 들어선 뒤 영원히 이름 없이 그 궤도를 돌게 할 수치들을 주무르고 다듬고 있었다. ‘1시… 59분….’",
    title: "안녕, 그리고 물고기는 고마웠어요",
    author: "더글러스 애덤스",
  },
  "03:01": {
    source: {
      title: "A Filbert is a Nut",
      author: "Rick Raphael",
      t: "3:01 a.m.",
    },
    t: "새벽 3시 1분",
    q: "새벽 3시 1분, 태디어스 펀스턴은 잠결에 몸을 뒤척이다 눈을 떴다. 그는 침대에 일어나 앉아 어두운 병동을 둘러보았다. 함께 잠든 서른 명의 잔잔한 숨소리와 이따금 들리는 코 고는 소리가 방을 채웠다. 펀스턴은 창 쪽으로 돌아서서 버려진 공예관을 둘러싼 검은 언덕 너머를 바라보았다.",
    title: "헤이즐넛은 견과류",
    author: "릭 라파엘",
  },
  "04:56": {
    source: {
      title: "The Point of Honor",
      author: "Joseph Conrad",
      t: "four minutes to five",
    },
    t: "5시 4분 전",
    q: "‘됐군. 자네 시계로는 5시 4분 전이야. 내 시계로는 7분 전이고.’ 그 흉갑기병은 위베르 장군 곁에 남아 손바닥에 든 시계의 하얀 문자판을 외눈으로 꼼짝없이 응시했다. 그는 마지막 초가 뛰기를 한참 전부터 기다리며 입을 크게 벌렸다가 단호하게 외쳤다. ‘전진!’",
    title: "명예의 결투",
    author: "조지프 콘래드",
  },
  "05:29": {
    source: {
      title: "The Girl and the Bill",
      author: "Bannister Merwin",
      t: "twenty-nine minutes past five",
    },
    t: "5시 29분",
    q: "성냥불이 손가락 가까이 타들어 오자, 옴은 시계를 꺼냈다. 5시 29분이었다. 다시 어둠. 옴은 더듬거리며 문으로 가 손잡이를 잡아당겼다. 문은 열리지 않았다. 빈틈없이 밀폐되도록 만들어져 꿈쩍도 하지 않았다.",
    title: "소녀와 지폐",
    author: "배니스터 머윈",
  },
  "05:58": {
    source: {
      title: "The Girl Who Kicked the Hornets' Nest",
      author: "Stieg Larsson",
      t: "5.58 a.m.",
    },
    t: "새벽 5시 58분",
    q: "아니카 지아니니는 화들짝 잠에서 깼다. 새벽 5시 58분이었다.",
    title: "벌집을 발로 찬 소녀",
    author: "스티그 라르손",
  },
  "07:56": {
    source: {
      title: "False Impression",
      author: "Jeffrey Archer",
      t: "7:56",
    },
    t: "7시 56분",
    q: "7시 56분, 애나는 웬트워스 파일을 덮고 몸을 굽혀 책상 맨 아래 서랍을 열었다. 운동화를 벗고 굽 높은 구두로 갈아 신었다. 자리에서 일어나 파일들을 챙긴 뒤 거울을 흘끗 보았다. 머리카락 한 올 흐트러지지 않았다.",
    title: "거짓 인상",
    author: "제프리 아처",
  },
  "14:00": {
    source: {
      title: "Doctor Sleep",
      author: "Stephen King",
      t: "2 p.m.",
    },
    t: "오후 2시",
    q: "평일 오후 2시, 영화관은 거의 텅 비어 있었지만 앤디 스타이너와 데이트 상대의 두 줄 뒤에는 세 사람이 앉아 있었다. 아주 늙은 남자 하나와 중년 문턱에 선 듯한 남자 하나—하지만 겉모습은 사람을 속일 수 있었다—가 눈부시게 아름다운 여자를 양옆에서 에워싸고 있었다. 여자는 광대뼈가 높고 눈은 회색이었으며 피부는 크림처럼 희었다. 풍성한 검은 머리는 넓은 벨벳 리본으로 뒤로 묶어 두었다.",
    title: "닥터 슬립",
    author: "스티븐 킹",
  },
  "14:01": {
    source: {
      title: "Catching the Train",
      author: "Arnold Bennet",
      t: "one minute past two",
    },
    t: "오후 2시 1분",
    q: "급행열차는 버밍엄에서 더없이 정확하게 출발해 왓퍼드까지 영예롭게 달렸지만, 그곳에서 안개를 만나 15분 넘게 지체되었고 아서의 경력까지 망쳐 놓았다. 아서가 런던에 도착한 때는 오후 2시 1분이었다.",
    title: "기차 타기",
    author: "아널드 베넷",
  },
  "16:03": {
    source: {
      title: "What Was Lost",
      author: "Catherine O'Flynn",
      t: "16.03",
    },
    t: "16시 3분",
    q: "그녀는 그 페이지를 꼼꼼히 읽은 다음 말했다. ‘16시 3분—고양이가 앞마당에서 볼일을 본다.’",
    title: "잃어버린 것",
    author: "캐서린 오플린",
  },
  "16:57": {
    source: {
      title: "Mightier Than the Sword",
      author: "Jeffrey Archer",
      t: "Three minutes to five",
    },
    t: "5시 3분 전",
    q: "‘5시 3분 전입니다.’ ‘잠시만 기다려 주시겠습니까, 본 씨. 다른 전화가 들어와서요. 금방이면 됩니다.’ 카우프먼은 검은 수화기를 책상에 내려놓고 빨간 수화기를 들어 번호를 눌렀다.",
    title: "칼보다 강한",
    author: "제프리 아처",
  },
  "18:53": {
    source: {
      title: "Golden Fleece",
      author: "David Graham Phillips",
      t: "seven minutes to seven",
    },
    t: "7시 7분 전",
    q: "‘마음대로 해요. 여긴 자유로운 집이니 규칙 같은 건 없어요.’ 그가 시계를 보았다. ‘벽난로 위 시계는 4분 빨라요. 정확한 시각은 7시 7분 전입니다. 저녁은 7시 30분에 먹지만, 내려오고 싶을 때 언제든 내려와요.’",
    title: "황금 양털",
    author: "데이비드 그레이엄 필립스",
  },
  "22:25": {
    source: {
      title: "Original Sin",
      author: "P.D. James",
      t: "10:25",
    },
    t: "밤 10시 25분",
    q: "달글리시는 에티엔이 방문객을 막는 데 이보다 더 효과적인 방법을 고안하기는 어려웠으리라고 생각했고, 잠시 차의 현가장치가 상할 위험을 감수하느니 800미터를 걸을까 고민했다. 시계를 보니 밤 10시 25분이었다. 정확히 제시간에 도착할 터였다.",
    title: "원죄",
    author: "P.D. 제임스",
  },
  "23:48": {
    source: {
      title: "American Tabloid",
      author: "James Ellroy",
      t: "11.48 pm",
    },
    t: "밤 11시 48분",
    q: "리텔은 개인 전세기를 마련했다. 그는 조종사에게 전속력으로 날라고 말했다. 작은 2인승기는 덜컹거리고 흔들렸다. 켐퍼는 믿을 수가 없었다. 밤 11시 48분이었다. 작전 개시까지는 서른여섯 시간이 남아 있었다.",
    title: "아메리칸 타블로이드",
    author: "제임스 엘로이",
  },
};

// These strict replacements were found outside the older canonical CSV.
// source_q/source_url preserve the exact reviewed excerpt and its discovery
// trail so a later reviewer can reproduce the decision.
const MANUAL_EXACT_REPLACEMENTS = {
  "02:02": {
    t: "2시 2분",
    q: "깜빡 잠이 들었던 모양이다. 눈을 떴을 때 불은 잦아들었고 책은 바닥에 떨어져 있었다. 왜 깼는지 몰라 잠시 눈을 깜빡였다. 그때 문 바로 밖에서 부드럽게 발을 끄는 소리가 났다. 벽난로 쪽을 보니 플로렌스가 바구니에 일어나 앉아 귀를 세우고 이를 드러내고 있었다. ‘쉿.’ 나는 부드럽게 달랬다. 벽난로 위 시계바늘은 2시 2분을 가리켰다. 나는 상황을 신중히 생각했다.",
    title: "성소의 침묵",
    author: "디애나 레이번",
    source_t: "two minutes past two",
    source_q: "I must have dozed, for when I opened my eyes, the fire had burned down and the book had slipped to the floor. I blinked for a moment, uncertain why I had awakened. Then I heard it, a soft slithering footstep just outside my door. I glanced to the hearth and saw Florence, sitting up in her basket, ears pricked up, lips drawn back. ‘Shh,’ I soothed her softly. The hands of the clock on the mantel read two minutes past two. I considered the matter carefully.",
    source_title: "Silent in the Sanctuary",
    source_author: "Deanna Raybourn",
    source_url: "https://yourbookshelf.net/wp-content/uploads/2024/08/Yourbookshelf-1193-Silent-In-The-Sanctuary.pdf",
    sfw: "sfw",
  },
  "13:31": {
    t: "오후 1시 31분",
    q: "오후 1시 31분부터 4시 44분까지, 우리가 아는 생산적인 삶은 멈춘다. 의미 있는 일을 새로 시작하기에는 너무 늦고, 집에 가기에는 너무 이르다.",
    title: "레슨 인 케미스트리",
    author: "보니 가머스",
    source_t: "one thirty-one ... p.m.",
    source_q: "Between the hours of one thirty-one and four forty-four p.m., productive life as we know it ceases to exist. Too late to get anything meaningful done; too early to go home.",
    source_title: "Lessons in Chemistry",
    source_author: "Bonnie Garmus",
    source_url: "https://www.goodreads.com/author/quotes/21370624.Bonnie_Garmus?page=4",
    sfw: "sfw",
  },
  "18:54": {
    t: "밤 6시 54분",
    q: "밤 6시 54분, 9월 7일 화요일. 플라스틱 전자 아기가 울음을 그치지 않는다. 영원한 부모님은 진짜 아기 같은 것이라고 했지만 그렇지 않다.",
    title: "지니 문",
    author: "벤저민 루드비히",
    source_t: "6:54 at Night",
    source_q: "6:54 at Night, Tuesday, September 7th. The plastic electronic baby won't stop crying. My Forever Parents said it's supposed to be like a real baby but it isn't.",
    source_title: "Ginny Moon",
    source_author: "Benjamin Ludwig",
    source_url: "https://www.bookbrowse.com/excerpts/index.cfm/book_number/3672/ginny-moon",
    sfw: "sfw",
  },
  "22:34": {
    t: "밤 10시 34분",
    q: "아니다. 당신의 남편은 그런 방식으로 죽지 않는다. 스물아홉 살인 지금, 11월 끝자락의 느리고 춥고 비 내리는 목요일 밤에 죽는다. 그가 한 번도 좋아한 적 없는 도시 런던에서, 집에서 아주 멀리 떨어진 곳에서 죽는다. 하필 버스 안에서, 밤 10시 34분에 죽는다.",
    title: "당신의 여전히 뛰는 심장",
    author: "타일러 키빌",
    source_t: "ten-thirty-four p.m.",
    source_q: "No – your husband doesn’t die in any of those ways, but now, tonight, on a slow, cold, rainy Thursday at the end of November, when he’s twenty-nine years old. He dies in London, a city he never liked, and very far from home. He dies on a bus, of all places, at ten-thirty-four p.m.",
    source_title: "Your Still Beating Heart",
    source_author: "Tyler Keevil",
    source_url: "https://myriadeditions.com/wp-content/uploads/2019/09/Extract-from-Your-Still-Beating-Heart-by-Tyler-Keevil-published-by-Myriad-Editions.pdf",
    sfw: "sfw",
  },
};

const ENTRY_FIELD_ORDER = [
  "t",
  "q",
  "title",
  "author",
  "ampm",
  "kind",
  "match",
  "source_t",
  "source_q",
  "source_title",
  "source_author",
  "source_url",
  "source_ref",
  "source_match_basis",
  "sfw",
  "review_status",
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${path.relative(REPO_ROOT, filePath)}: ${error.message}`);
  }
}

function minuteKeys() {
  const keys = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      keys.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return keys;
}

function assertCompleteCorpus(corpus) {
  if (!corpus || Array.isArray(corpus) || typeof corpus !== "object") {
    throw new Error("data/ko_translations.json must be an object keyed by HH:MM");
  }

  const expected = minuteKeys();
  const actual = Object.keys(corpus).sort();
  const missing = expected.filter((key) => !Object.hasOwn(corpus, key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (actual.length !== 1440 || missing.length || extra.length) {
    throw new Error(
      `Translation corpus must contain exactly 1440 keys (got ${actual.length}; ` +
        `missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"})`,
    );
  }

  for (const key of expected) {
    if (!Array.isArray(corpus[key]) || corpus[key].length !== 1) {
      throw new Error(`${key}: translation corpus must contain exactly one row`);
    }
  }
}

function expectedAmpm(key) {
  return Number(key.slice(0, 2)) < 12 ? "am" : "pm";
}

function findSelectedSource(sourceCorpus, key, selector) {
  const rows = Array.isArray(sourceCorpus[key]) ? sourceCorpus[key] : [];
  const matches = rows.filter(
    (row) =>
      row.title === selector.title &&
      row.author === selector.author &&
      row.t === selector.t,
  );
  if (matches.length !== 1) {
    throw new Error(
      `${key}: source selector must match exactly one row; matched ${matches.length} ` +
        `(${selector.title} / ${selector.author} / ${selector.t})`,
    );
  }
  return matches[0];
}

function confidentlyMatchedSource(sourceCorpus, key, entry) {
  const rows = Array.isArray(sourceCorpus[key]) ? sourceCorpus[key] : [];
  if (!rows.length) return null;

  if (typeof entry.source_q === "string") {
    const matches = rows.filter((row) => row.q === entry.source_q);
    if (matches.length === 1) return matches[0];
  }

  if (typeof entry.source_title === "string" && typeof entry.source_author === "string") {
    const matches = rows.filter(
      (row) => row.title === entry.source_title && row.author === entry.source_author,
    );
    if (matches.length === 1) return matches[0];
  }

  const exactDisplayMatches = rows.filter(
    (row) => row.title === entry.title && row.author === entry.author,
  );
  if (exactDisplayMatches.length === 1) return exactDisplayMatches[0];

  // With one source row at this minute, its title/author pair is unambiguous.
  if (rows.length === 1) return rows[0];
  return null;
}

function addUniqueAlias(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) {
    map.set(key, value);
  } else if (map.get(key) !== value) {
    // A conflicting translation is never safe to use as an inferred alias.
    map.set(key, null);
  }
}

function trustedSourceAliases(translations, sourceCorpus) {
  const aliases = {
    pair: new Map(),
    title: new Map(),
    author: new Map(),
  };

  for (const [key, entries] of Object.entries(translations)) {
    const entry = Array.isArray(entries) ? entries[0] : null;
    // Only mappings copied directly from data/quotes.json seed inference.
    // Alias-inferred rows never seed later runs, keeping this operation stable.
    if (
      entry?.review_status !== "source_row_matched" ||
      typeof entry.source_title !== "string" ||
      typeof entry.source_author !== "string"
    ) {
      continue;
    }

    const sourceMatches = (sourceCorpus[key] || []).filter(
      (row) =>
        row.t === entry.source_t &&
        row.q === entry.source_q &&
        row.title === entry.source_title &&
        row.author === entry.source_author,
    );
    if (sourceMatches.length !== 1) {
      throw new Error(
        `${key}: trusted source-row seed must still match exactly one canonical row; ` +
          `matched ${sourceMatches.length}`,
      );
    }

    addUniqueAlias(
      aliases.pair,
      `${entry.title}\u0000${entry.author}`,
      `${entry.source_title}\u0000${entry.source_author}`,
    );
    addUniqueAlias(aliases.title, entry.title, entry.source_title);
    addUniqueAlias(aliases.author, entry.author, entry.source_author);
  }
  return aliases;
}

function aliasedSource(sourceCorpus, key, entry, aliases) {
  const rows = Array.isArray(sourceCorpus[key]) ? sourceCorpus[key] : [];
  if (!rows.length) return null;

  const pairKey = `${entry.title}\u0000${entry.author}`;
  const hasPair = aliases.pair.has(pairKey);
  const hasTitle = aliases.title.has(entry.title);
  const hasAuthor = aliases.author.has(entry.author);
  const pair = aliases.pair.get(pairKey);
  const title = aliases.title.get(entry.title);
  const author = aliases.author.get(entry.author);
  let matches;

  // Prefer the translated title+author pair. If a trusted pair exists but is
  // absent or ambiguous at this minute, do not weaken the match.
  if (hasPair) {
    if (!pair) return null;
    const [sourceTitle, sourceAuthor] = pair.split("\u0000");
    matches = rows.filter(
      (row) => row.title === sourceTitle && row.author === sourceAuthor,
    );
    return matches.length === 1 ? { source: matches[0], basis: "translated_pair" } : null;
  }

  // A known alias conflict vetoes weaker fallback matching.
  if ((hasTitle && !title) || (hasAuthor && !author)) return null;

  // When both independent aliases exist, both must agree with the same row.
  if (title && author) {
    matches = rows.filter((row) => row.title === title && row.author === author);
    return matches.length === 1
      ? { source: matches[0], basis: "translated_title_author" }
      : null;
  }

  // A single trusted alias is still usable only when it selects one row from
  // the candidates already assigned to this exact HH:MM key.
  if (title) {
    matches = rows.filter((row) => row.title === title);
    return matches.length === 1 ? { source: matches[0], basis: "translated_title" } : null;
  }
  if (author) {
    matches = rows.filter((row) => row.author === author);
    return matches.length === 1 ? { source: matches[0], basis: "translated_author" } : null;
  }
  return null;
}

function orderedEntry(entry) {
  const ordered = {};
  for (const field of ENTRY_FIELD_ORDER) {
    if (entry[field] !== undefined) ordered[field] = entry[field];
  }
  for (const field of Object.keys(entry).sort()) {
    if (!Object.hasOwn(ordered, field)) ordered[field] = entry[field];
  }
  return ordered;
}

function assertValidEntry(key, entry) {
  if (!entry || Array.isArray(entry) || typeof entry !== "object") {
    throw new Error(`${key}: translation must be one object`);
  }
  for (const field of ["t", "q", "title", "author"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) {
      throw new Error(`${key}: missing non-empty string field '${field}'`);
    }
  }
  if (!entry.q.includes(entry.t)) {
    throw new Error(`${key}: t must be a literal substring of q (${entry.t})`);
  }
  if (entry.ampm !== expectedAmpm(key)) {
    throw new Error(`${key}: ampm must be '${expectedAmpm(key)}', got '${entry.ampm}'`);
  }
  if (entry.kind !== "역") throw new Error(`${key}: kind must be '역'`);
}

function curate(translations, sourceCorpus) {
  assertCompleteCorpus(translations);
  const aliases = trustedSourceAliases(translations, sourceCorpus);
  const output = {};
  const stats = {
    replacements: 0,
    approximate: 0,
    defaultExact: 0,
    sfwPreserved: 0,
    aliasMatched: 0,
    aliasCandidates: 0,
    aliasBasisCounts: {},
    unresolved: 0,
  };

  for (const key of minuteKeys()) {
    const replacement = EXACT_REPLACEMENTS[key];
    const manualReplacement = MANUAL_EXACT_REPLACEMENTS[key];
    let entry;

    if (manualReplacement) {
      entry = {
        ...manualReplacement,
        ampm: expectedAmpm(key),
        kind: "역",
        match: "exact",
        review_status: "machine_checked",
      };
      stats.replacements += 1;
    } else if (replacement) {
      const source = findSelectedSource(sourceCorpus, key, replacement.source);
      entry = {
        t: replacement.t,
        q: replacement.q,
        title: replacement.title,
        author: replacement.author,
        ampm: expectedAmpm(key),
        kind: "역",
        match: "exact",
        source_t: source.t,
        source_q: source.q,
        source_title: source.title,
        source_author: source.author,
        sfw: source.sfw,
        review_status: "machine_checked",
      };
      stats.replacements += 1;
    } else {
      entry = { ...translations[key][0] };
      if (!entry.q.includes(entry.t)) {
        throw new Error(`${key}: cannot default match to exact because t is not in q`);
      }
      entry.match = "exact";
      stats.defaultExact += 1;

      const directSource = confidentlyMatchedSource(sourceCorpus, key, entry);
      const existingAliasStatus =
        entry.review_status === "source_row_alias_matched" ||
        entry.review_status === "source_row_alias_candidate";
      const aliasMatch = !SUPPLEMENTAL_KEYS.has(key) &&
        (!directSource || existingAliasStatus)
        ? aliasedSource(sourceCorpus, key, entry, aliases)
        : null;
      if (existingAliasStatus) {
        if (!aliasMatch || (directSource && aliasMatch.source.q !== directSource.q)) {
          throw new Error(`${key}: alias-matched source row is no longer reproducible`);
        }
      }
      const inferredSource = directSource ? null : aliasMatch?.source;
      const source = directSource || inferredSource;
      if (source) {
        entry.source_t ??= source.t;
        entry.source_q ??= source.q;
        entry.source_title ??= source.title;
        entry.source_author ??= source.author;
        delete entry.source_ref;
        if (typeof source.sfw === "string") {
          entry.sfw = source.sfw;
          stats.sfwPreserved += 1;
        }
        if (inferredSource || existingAliasStatus) {
          const strongAlias =
            aliasMatch.basis === "translated_pair" ||
            aliasMatch.basis === "translated_title_author";
          entry.review_status = strongAlias
            ? "source_row_alias_matched"
            : "source_row_alias_candidate";
          entry.source_match_basis = aliasMatch.basis;
        } else if (!entry.review_status || entry.review_status.startsWith("needs_")) {
          entry.review_status = "source_row_matched";
        }
      } else if (SUPPLEMENTAL_KEYS.has(key)) {
        entry.source_ref ??= `${UPSTREAM_SNAPSHOT} (supplemental literary-clock migration)`;
        entry.review_status ??= "needs_primary_source";
        entry.sfw ??= "unknown";
      } else {
        entry.source_ref ??= `${UPSTREAM_SNAPSHOT} (translated row awaiting canonical source-row mapping)`;
        entry.review_status ??= "needs_source_row_mapping";
        entry.sfw ??= "unknown";
      }
    }

    assertValidEntry(key, entry);
    if (entry.review_status === "source_row_alias_matched") {
      stats.aliasMatched += 1;
    }
    if (entry.review_status === "source_row_alias_candidate") {
      stats.aliasCandidates += 1;
    }
    if (
      entry.review_status === "source_row_alias_matched" ||
      entry.review_status === "source_row_alias_candidate"
    ) {
      stats.aliasBasisCounts[entry.source_match_basis] =
        (stats.aliasBasisCounts[entry.source_match_basis] || 0) + 1;
    }
    if (entry.review_status.startsWith("needs_")) stats.unresolved += 1;
    output[key] = [orderedEntry(entry)];
  }

  if (
    stats.replacements !== 17 ||
    stats.approximate !== 0 ||
    stats.defaultExact !== 1423 ||
    stats.aliasMatched !== 118 ||
    stats.aliasCandidates !== 338 ||
    stats.unresolved !== 289 ||
    stats.aliasBasisCounts.translated_pair !== 115 ||
    stats.aliasBasisCounts.translated_author !== 337 ||
    stats.aliasBasisCounts.translated_title_author !== 3 ||
    stats.aliasBasisCounts.translated_title !== 1 ||
    Object.keys(stats.aliasBasisCounts).length !== 4
  ) {
    throw new Error(`Unexpected curation counts: ${JSON.stringify(stats)}`);
  }
  assertCompleteCorpus(output);
  return { output, stats };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
  if (unknownArgs.length) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }

  const translations = readJson(TRANSLATIONS_PATH);
  const sourceCorpus = readJson(SOURCE_QUOTES_PATH);
  const { output, stats } = curate(translations, sourceCorpus);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;

  if (!dryRun) fs.writeFileSync(TRANSLATIONS_PATH, serialized, "utf8");
  const action = dryRun ? "Validated" : "Curated";
  process.stdout.write(
    `${action} 1440 translations: ${stats.replacements} replaced, ` +
      `${stats.approximate} awaiting exact sources, ${stats.defaultExact} default exact, ` +
      `${stats.aliasMatched} alias-matched source rows, ${stats.aliasCandidates} alias candidates, ` +
      `${stats.unresolved} unresolved sources, ` +
      `${stats.sfwPreserved} inherited sfw labels.\n`,
  );
}

export { addUniqueAlias, aliasedSource, trustedSourceAliases };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}
