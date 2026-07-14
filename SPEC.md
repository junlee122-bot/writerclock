# Author Clock, 상류 Build Spec (보존 문서)

> **상태: 상류 설계 기록, 현재 구현 계약 아님.** 가장 가까운 분 폴백과 초기 SFW
> 정책 등 아래 요구사항은 원본 스냅숏을 설명합니다. WriterClock의 현재 구현은
> 다른 분으로 폴백하지 않는 24시간 exact-only 계약을 사용합니다. 실제 계약은
> `README.md`, `DATA_LICENSE.md`, `data/ko_coverage.json`,
> `scripts/audit_data.mjs`를 따릅니다.

문학 인용구로 시각을 표시하는 로컬 웹앱. Guardian 유래 `litclock_annotated.csv` 데이터 기반.
참고 구현: ambercaravalho/open-author-clock (GPL-3.0), cdmoro/literature-clock (MIT).

## 데이터 소스 (canonical)
- URL: https://raw.githubusercontent.com/JohannesNE/literature-clock/master/litclock_annotated.csv
- 형식: 파이프(`|`) 구분, 6필드. 헤더 없음.
  1. `time` , "HH:MM" (24h)
  2. `time_string`, 인용문 안에 그대로 등장하는 시각 표현 (예: "midnight", "quarter to three")
  3. `quote`, 인용문 (내부에 `<br/>` 줄바꿈, 유니코드 이탤릭 등 포함 가능)
  4. `title`, 책 제목
  5. `author`, 저자
  6. `sfw`, `sfw` | `nsfw` | `unknown`
- 주의: quote 안에 콤마·따옴표는 있으나 파이프(`|`)는 없다고 가정. `split('|')` 시 필드가 6개 초과면 3~끝을 재조립하지 말고, maxsplit로 앞 2필드 + 뒤 3필드를 고정 파싱 (time, time_string, ...quote..., title, author, sfw). 안전하게: 왼쪽 2개 rsplit 아님, 왼쪽 2 split + 오른쪽 3 rsplit, 가운데가 quote.

## 산출물 스키마 (contract)
### data/quotes.js  (프론트가 file:// 로 바로 로드, 이게 primary)
```js
window.AUTHOR_CLOCK_QUOTES = {
  "00:00": [
    { "t": "midnight", "q": "While they were drinking...midnight...", "title": "The 101 Dalmatians", "author": "Dodie Smith", "sfw": "sfw" },
    ...
  ],
  "00:01": [ ... ],
  ...
};
```
- 키: "HH:MM" 문자열. 값: 해당 분의 인용구 배열.
- `sfw` 값 그대로 보존(sfw/nsfw/unknown). 프론트가 필터링.
- 기본 quotes.js 에는 sfw + unknown 포함, nsfw 제외. (nsfw 별도 파일 불필요)

### data/quotes.json  (동일 데이터의 순수 JSON, 재사용·검증용)
### data/coverage.json  { "total_minutes_with_quotes": N, "missing": ["08:21", ...], "counts": {"sfw":..,"unknown":..,"nsfw":..} }
### scripts/build_quotes.py, CSV 다운로드→파싱→위 3파일 생성 (idempotent, 재실행 가능)

## 프론트엔드 요구사항 (assets/, index.html)
- **자기완결**: 외부 CDN·폰트·네트워크 금지. 시스템 serif 폰트 스택 사용. `index.html` 을 더블클릭(file://)해서 바로 동작해야 함 → 데이터는 `data/quotes.js` 를 `<script>` 태그로 로드(fetch 금지, CORS 회피).
- **시각 로직**: 매 분 현재 "HH:MM" 인용구 중 랜덤 1개 표시. 해당 분에 인용구 없으면(gap) 가장 가까운 이전 분으로 폴백, 없으면 이후 분. 폴백 시에도 자연스럽게.
- **하이라이트**: quote 안에서 `time_string` 을 대소문자 무시 부분일치로 찾아 `<strong class="tp">` 로 감싼다. 매치 실패 시 하이라이트 없이 표시(에러 아님).
- **렌더링**: `<br/>` 는 줄바꿈으로 렌더. 나머지는 텍스트로 이스케이프(XSS 방지, time_string 래핑과 br 치환만 허용).
- **출처 표기**: 인용문 아래 "- {title}, {author}".
- **틱**: 다음 분 경계에 정확히 정렬해서 갱신(setTimeout to next :00 second). 화면 상단/구석에 실제 디지털 시계(HH:MM) 작게 표시(옵션, 은은하게).
- **인터랙션**: 클릭/스페이스바 → 같은 분의 다른 인용구로 교체(새로고침).
- **테마**: 라이트/다크 + 시스템 자동(`prefers-color-scheme`), 우측 상단 토글. 페이지 페이드 전환. 종이책 느낌의 따뜻한 라이트, 차분한 다크.
- **SFW 필터**: 기본 sfw+unknown 표시. 설정 토글로 nsfw 포함은 불필요(데이터에서 이미 제외). unknown 숨김 토글만 옵션으로.
- **반응형**: 모바일~데스크탑. 인용문은 중앙 정렬, 읽기 좋은 max-width(약 40em), 큰 글씨.
- **접근성**: 충분한 대비, 키보드 조작 가능.

## 파일 소유 (충돌 방지)
- 데이터 에이전트: `data/*`, `scripts/build_quotes.py` 만 수정.
- 프론트 에이전트: `index.html`, `assets/*`, `README.md` 만 수정. 데이터는 위 스키마의 `window.AUTHOR_CLOCK_QUOTES` 를 신뢰하고, 개발 중엔 작은 샘플 stub 을 assets 밖이 아닌 임시로 가정. **실제 data/quotes.js 는 데이터 에이전트 산출물을 사용**.

## 라이선스
- 코드: MIT. 데이터는 원 저작권(문학 인용) 및 Guardian/기여자 유래임을 README 에 명시.
