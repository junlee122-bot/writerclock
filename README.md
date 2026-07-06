# 작가시계 (Author Clock, Korean edition)

한국어 문학 인용문으로 현재 시각을 보여주는 로컬 단일 페이지 앱.

## 실행

`index.html`을 브라우저에서 더블클릭으로 바로 열면 된다(서버 불필요).
`data/ko_quotes.js`를 일반 `<script>` 태그로 불러오므로 `file://` 환경에서도
CORS 없이 동작한다. `data/ko_quotes.js`가 아직 없으면 안내 문구만 표시된다.

## 파일 구성

- `index.html` - 마크업 및 스크립트 include
- `assets/app.js` - 클라이언트 로직 전체(시각 매칭, 안전한 HTML 렌더링,
  테마 토글, 매분 갱신)
- `assets/style.css` - 라이트/다크 테마, 레이아웃, 반응형 규칙
- `assets/_sample_ko.js` - 개발용 스텁 데이터, `index.html`에서는 미사용
- `data/ko_quotes.js` - 생성된 한국어 인용문 데이터셋(데이터 빌드 단계 소유)
- `scripts/build_ko_quotes.py` - 데이터 빌드 스크립트(ko.wikisource fetch, 추출, 검증)
- `data/ko_sources/` - fetch한 원문 캐시(재현·검증용)
- `data/ko_coverage.json` - 출처 목록, 시간대별 커버리지, 검증 통계

## 데이터 생성

`python3 scripts/build_ko_quotes.py` 로 재생성한다(캐시 재사용, `--refresh`로 강제 재fetch).

동작: ko.wikisource의 한국 근대문학 공개저작 원문을 내려받아, 시각 표현(자정·새벽·
아침·정오·저녁·밤 등 시간대와 "N시/N시 반" 정밀 표현)이 들어간 문장을 정규식으로
추출한다. **모든 인용문은 내려받은 원문의 부분 문자열임을 코드로 검증**하여 날조를
차단한다(현재 882문장, substring 검증 100%). 한국 근대문학은 분 단위 시각을 거의
쓰지 않으므로 커버리지는 시간대·시(hour) 단위가 중심이고, 프론트는 정밀 분 → 시간대
버킷 → 인접 순으로 폴백해 하루 24시간을 빈틈없이 채운다.

## 데이터 출처와 저작권

인용문은 모두 저자 사후 70년이 지나 저작권이 만료된 한국 근대문학 작품에서 발췌했다.
출처: ko.wikisource.org. 사용 작가(사망연도): 현진건(1943), 김동인(1951),
나도향(1926), 이상(1937), 김유정(1937), 이효석(1942), 최서해(1932),
심훈(1936), 이광수(1950), 채만식(1950), 나혜석(1948). 작품별 출처는
`data/ko_coverage.json` 참고.

개념 원안은 Jaap Meijers의 literature clock 및 Author Clock 프로젝트.

## License

코드: MIT. 인용문 텍스트는 위 공개저작(퍼블릭 도메인) 작품에서 발췌한 것이다.
