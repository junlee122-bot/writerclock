# 한국어 작가시계, 초기 Build Spec (보존 문서)

> **상태: 상류 설계 기록, 현재 구현 계약 아님.** 이 문서는 초기 한국어 공개저작
> 실험의 요구사항을 보존합니다. 현재 앱은 24시간 exact-only 데이터, 번역 항목의
> 검토 상태와 권리 게이트를 포함하도록 확장됐습니다. 실제 계약은 `README.md`,
> `DATA_LICENSE.md`, `data/ko_coverage.json`, `scripts/audit_data.mjs`를 따릅니다.

Threads @gojaehyun.go 참고. 한국 공개저작 문학 문장으로 현재 시각을 표시하는 로컬 웹앱.
영어 Author Clock(SPEC.md) 개념을 한국어로. **차이**: 한국 문학은 분 단위 정밀 시각 표현이 드물다 → 시간대(daypart)/시/분 3단 입도로 설계.

## 절대 원칙: 인용문 날조 금지
- 모든 인용문은 **실제 fetch한 공개저작 원문의 부분 문자열**이어야 한다. 손으로 지어내거나 번역·각색 금지.
- 각 출력 문장은 fetch한 소스 텍스트에 substring으로 존재함을 코드로 검증한 것만 채택.
- 저작권: **저자 사후 70년 경과(퍼블릭 도메인) 작품만**. 예: 현진건(d.1943), 김동인(d.1951→borderline, 제외 안전빵은 d.≤1953), 나도향(d.1926), 이상(d.1937), 김유정(d.1937), 이효석(d.1942), 최서해(d.1932), 전영택, 나혜석(d.1948), 계용묵, 주요섭, 방정환(d.1931), 심훈(d.1936), 채만식(d.1950), 이광수(d.1950), 염상섭(d.1963→아직 70년 미만, 제외). 애매하면 제외.

## 데이터 소스
- ko.wikisource 원문. raw wikitext: `https://ko.wikisource.org/w/index.php?title=<제목_url>&action=raw`
- 확인됨: 「운수 좋은 날」, 「메밀꽃 필 무렵」 등 본문 존재·fetch 가능.

## 시각 표현 매핑 (daypart + 시/분)
정규식으로 문장에서 시각 표현을 추출하고 아래로 매핑.

### 시간대(daypart) 버킷 → 대표시각 + 커버 범위(현재시각 매칭용)
| 표현(정규식 키워드) | bucket | 대표 | 커버 범위 |
|---|---|---|---|
| 자정, 한밤중, 밤중, 한밤 | 자정 | 00:00 | 23:30-00:29 |
| 새벽, 동트기, 동틀, 먼동 | 새벽 | 04:30 | 03:00-05:59 |
| 아침, 동틀녘, 아침나절, 조반 | 아침 | 07:30 | 06:00-08:59 |
| 오전 | 오전 | 10:00 | 09:00-11:29 |
| 정오, 한낮, 한나절, 대낮, 낮 | 정오 | 12:00 | 11:30-13:29 |
| 오후 | 오후 | 15:00 | 13:30-16:59 |
| 저녁, 해질, 해 질, 황혼, 땅거미, 저물, 어스름, 노을 | 저녁 | 18:30 | 17:00-19:29 |
| 밤, 야밤, 초저녁 | 밤 | 21:30 | 19:30-23:29 |

- daypart는 여러 개 매치될 수 있으니 우선순위: 정밀(시/분) > 자정 > 정오 > 새벽/아침/오전/오후/저녁/밤. 한 문장에서 가장 구체적인 표현 1개 채택.

### 시/분 정밀 표현
- 시: 네이티브 수사 + "시". `(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두)\s*시` → 1~12시.
  - AM/PM: 같은 문장/근처에 새벽·아침·오전 있으면 AM, 오후·저녁·밤 있으면 PM. 단서 없으면 **낮(HH+12는 하지 않고 그대로 1~12를 오전으로) 기본은 ambiguous → key를 HH:MM(오전)과 (오후) 둘 다 등록하지 말고, 단서 없으면 daypart 미상으로 'both'** 처리: 정밀시각 엔트리에 `ampm: "am"|"pm"|"unknown"`. unknown이면 프론트에서 오전/오후 양쪽 시간대에 매칭 허용.
- 분: "반"→30분. `(\d+|한|두|...)\s*분` 시노/네이티브 혼용 방어적으로. 없으면 :00.
- 예: "여섯 시 반"→06:30/18:30(ampm), "세 시경"→03:00/15:00.

## 산출물 (data/)
### data/ko_quotes.js  (프론트 primary, file:// 로드)
```js
window.AUTHOR_CLOCK_QUOTES_KO = {
  "precise": {                     // 시/분 정밀. key는 대표 HH:MM 문자열(ampm 반영). unknown ampm은 두 시간(am/pm) 각각 키에 넣거나 ampm 필드로.
    "18:30": [ { "t": "여섯 시 반", "q": "...문장...", "title": "메밀꽃 필 무렵", "author": "이효석", "ampm": "pm" } ]
  },
  "buckets": {                     // 시간대. daypart 이름별.
    "저녁": [ { "t": "해 질 무렵", "q": "...", "title": "...", "author": "..." } ],
    "밤":   [ ... ]
  },
  "bucketMeta": {                  // 프론트가 현재시각→bucket 매칭에 사용
    "자정": {"rep":"00:00","start":"23:30","end":"00:29"},
    "새벽": {"rep":"04:30","start":"03:00","end":"05:59"},
    ... (위 표 전체)
  }
};
```
### data/ko_quotes.json  (동일, 순수 JSON)
### data/ko_coverage.json  { "sources":[{title,author,page,url,fetched_chars,extracted}], "precise_keys":[...], "bucket_counts":{"저녁":n,...}, "total_quotes":n, "substring_verified": true }
### scripts/build_ko_quotes.py, fetch→추출→검증→위 파일 생성. idempotent. 원문은 data/ko_sources/*.txt 로 캐시.

## 프론트엔드 (index.html, assets/)
- 기존 영어 author-clock 프론트를 **한국어 primary**로 전환. `data/ko_quotes.js` 로드(fetch 금지, script 태그).
- **매칭 로직** (현재 HH:MM → 인용구):
  1. precise에서 현재 HH:MM(±0) 정확 매치(ampm 고려: unknown은 시(hour)만 맞으면 허용). 있으면 랜덤 표시.
  2. 없으면 현재 시각이 속하는 bucket을 bucketMeta로 찾아 buckets[bucket]에서 랜덤.
  3. bucket도 비면 인접 bucket 또는 전체에서 랜덤. 절대 크래시 금지, 비면 안내문.
- **하이라이트**: q 안에서 t를 부분일치로 `<strong class="tp">`. XSS 방지(이스케이프 후 br 복원 후 래핑), 영어판 로직 재사용.
- **출처**: 문장 아래 "{title} · {author}" (저작권 만료 표기 README).
- **타이포**: 명조 감성 시스템 폰트 스택. `'Apple SD Gothic Neo'` 아님(고딕). 명조: `'AppleMyungjo', 'Apple Myungjo', 'Batang', '바탕', 'Nanum Myeongjo', serif`. 없으면 serif 폴백. 외부 폰트 로드 금지.
- **디지털 시계**: 구석에 한국어 표기. 예 "오후 3:07" 또는 "15:07"(24h). 은은하게.
- **UI 한국어**: 테마 토글(자동/밝게/어둡게), 클릭·스페이스=다른 문장, 안내 툴팁 한국어.
- **테마**: 라이트=한지/미색 종이, 다크=먹빛. prefers-color-scheme + localStorage.
- **틱**: 다음 분 :00초 정렬. 인터랙션·반응형·접근성 영어판과 동일 수준.

## 파일 소유
- 데이터 에이전트: `scripts/build_ko_quotes.py`, `data/ko_*` 만.
- 프론트 에이전트: `index.html`, `assets/*`, `README.md` 만. data 건드리지 말 것.

## 라이선스
- 코드 MIT. 데이터는 공개저작(저자 사후 70년 경과) 한국 문학 원문 발췌, 출처(작품·저자·wikisource) README 명시.
