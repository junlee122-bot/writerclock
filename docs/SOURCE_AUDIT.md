# 번역 출전·시간대 전수 감사

2026-07-13 기준 `data/ko_translations.json`의 번역 1,440개를 전수 검사한 결과입니다.
이 문서에서 “검토 완료”는 원문 발췌와 데이터 행의 대응을 뜻하며, 저작권 이용
허락이나 모든 오전·오후 해석의 확정을 뜻하지 않습니다.

## 결과

| 항목 | 수 | 판정 |
|---|---:|---|
| 기존 직접 원문 행 | 678 | canonical 행 exact tuple |
| 기존 복합 별칭 원문 행 | 118 | 같은 분의 canonical 행 exact tuple |
| 출전 후보 전수 검토 | 338 | 오탐 0, `source_row_reviewed`로 확정 |
| 미매핑 전수 검토 | 281 | 오탐 0, `source_row_reviewed`로 확정 |
| 기존 별도 교체 행 | 17 | canonical 행 13개, 별도 HTTPS 출전 4개 |
| canonical 밖 1차 출전 | 8 | 원문 발췌와 HTTPS 1차 출전 확인 |
| 합계 | 1,440 | canonical 1,428, 별도 출전 12, `source_q` 1,440, legacy `source_ref` 0 |

619개 수동 검토 행은 배열 인덱스를 저장하지 않습니다. 각 항목의
`HH:MM + source_t + source_q + source_title + source_author`가 같은 분의 canonical
행 정확히 하나와 일치해야 큐레이션과 데이터 감사가 통과합니다. 미매핑 281개는
제목·저자·본문 직접 대조 236개, 번역 제목·본문 대조 34개, 같은 작품의 본문
구별 11개입니다.

## 별도 1차 출전 8개

| 시각 | 작품·저자 | 출전 | 시간대 근거 |
|---|---|---|---|
| 06:07 | *The Dream Hotel* · Laila Lalami | [Penguin Random House](https://www.penguinrandomhouseretail.com/book/?isbn=9780593317600) | 문맥 |
| 06:18 | *History of the United States of America (Volume 7)* · Henry Adams | [Project Gutenberg](https://www.gutenberg.org/cache/epub/72846/pg72846-images.html) | 문맥 |
| 08:21 | *Guarding Hanna* · Miha Mazzini | [Google Books](https://books.google.com/books?id=klYLI2VreRoC&pg=PA117&dq=%228%3A21%22) | `A.M.` 명시 |
| 10:28 | *Stranger in Paradise* · Robert B. Parker | [Google Books](https://books.google.com/books?id=_0Lt1fcZNL8C&pg=PA305&dq=%2210%3A28%22) | 주변 문맥 |
| 11:46 | *Disorientation* · Elaine Hsieh Chou | [Google Books](https://books.google.com/books?id=b10zEAAAQBAJ&pg=PT77&dq=%2211%3A46+a.m.%22) | `a.m.` 명시 |
| 12:31 | *Tuesday at Three* · Gillian Alex | [Google Books](https://books.google.com/books?id=XpqaDQAAQBAJ&pg=PT199&dq=%2212%3A31pm%22) | `pm` 명시 |
| 13:36 | *The Martian* · Andy Weir | [Google Books](https://books.google.com/books?id=EbuPEQAAQBAJ&pg=PA326&dq=%2213%3A36%22) | 24시간 표기 |
| 18:44 | *Riley Thorn and the Blast from the Past* · Lucy Score | [저자 공식 샘플](https://www.lucyscore.net/sample/riley-thorn-and-the-blast-from-the-past-chapter-one-two) | `p.m.` 명시 |

종전 18:44의 *The Deaths* 문장은 원문이 “this morning”인 06:44 항목과 같은
구절이므로 오후 키에서 제거했습니다. 대체 문장은 저자 공식 샘플 첫머리의
`6:44 p.m., Wednesday, October 30`이며 납치·감금 문맥을 앱에 표시합니다.

## 오전·오후 검토

출전 행 매핑과 24시간대 해석은 별도 상태입니다.

| `period_review_status` | 수 | 의미 |
|---|---:|---|
| `period_explicit` | 128 | 원문에 오전·오후 또는 24시간 표기가 직접 있음 |
| `period_contextual` | 7 | 같은 대목의 문맥으로 확인 |
| `period_ambiguous` | 204 | 원문만으로 오전·오후를 확정할 수 없음 |
| `period_unreviewed` | 1,101 | 이번 감사에서 시간대 근거까지 별도 판정하지 않음 |

`period_ambiguous`도 상류가 배정한 24시간 키에는 남아 있으나 웹 앱에서
“오전·오후 미확정”으로 표시합니다. `ampm`은 라우팅 키이고
`period_review_status`는 그 해석의 증거 수준입니다.

## 재현 검사

- `node scripts/curate_translation_corpus.mjs --dry-run`
- `python scripts/build_ko_quotes.py --check`
- `npm run audit:data`

큐레이터는 검토된 canonical tuple의 누락·변경·중복, 1차 출전의 원문 필드나
HTTPS URL 누락, 후보·미해결 상태의 재등장을 실패로 처리합니다. 세부 최신 집계는
`data/ko_coverage.json`에 생성됩니다.
