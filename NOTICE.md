# 출처와 제3자 고지

WriterClock은 `gyuminlee-repo/author-clock`의 2026-07-08 커밋
`8b814e3be47b8eede7a11ef5d76797f0639df816`을 출발점으로 삼아
데이터 파이프라인, 검증, 웹 UI, PWA와 데스크톱 패키징을 확장했습니다.
상류 README는 코드 라이선스를 MIT로 표시했습니다. 원안과 기존 구현의
저작자 표시는 이 문서와 Git 기록에서 보존합니다.

상류 커밋의 저자는 Gyu Min Lee로 기록되어 있습니다. 상류 스냅숏에는
독립된 `LICENSE` 파일이 없고 README의 MIT 표기만 있었으므로, 재배포자는
필요에 따라 상류 권리관계를 별도로 확인해야 합니다.

문학시계 개념과 영어 데이터 계보에는 다음 프로젝트가 포함됩니다.

- Jaap Meijers의 Literature Clock 개념
- The Guardian Literary Clock 독자 기고 데이터
- Johs Enevoldsen과 기여자의
  [`JohsEnevoldsen/literature-clock`](https://github.com/JohsEnevoldsen/literature-clock)
  데이터 편집물과 여러 공개 포크
- 한국어 공개저작 원문: 한국어 위키문헌(`ko.wikisource.org`)

`data/litclock_annotated.csv`는 위 `literature-clock` 프로젝트의 동명 데이터
편집물을 캐시한 사본입니다. 원 프로젝트는 이 편집물을
[Creative Commons Attribution-NonCommercial-ShareAlike 2.5 Generic
(CC BY-NC-SA 2.5)](https://creativecommons.org/licenses/by-nc-sa/2.5/)으로
배포합니다. WriterClock은 이를 `HH:MM` 키로 정규화·재배열하고 JSON/JavaScript로
직렬화하며, 영문 기준 산출물 `data/quotes.js`에서 `nsfw` 행을 제외하고,
선택한 행의 시간 표현·문장·
작품명·저자명을 한국어로 번역·교정한 뒤 출전 및 검토 메타데이터와 한국어
위키문헌 항목을 결합했습니다. 이러한 변경 사실을 표시하며, 원 편집물과 그
개작물을 이용할 때는 저작자 표시, 비영리, 동일조건변경허락과 추가 제한 금지
조건을 지켜야 합니다. 이 CC 라이선스는 편집물에 관해 라이선스 제공자가 가진
권리에 적용될 뿐, 편집물 안의 개별 문학 인용문에 대한 원저작권자의 권리까지
허락하거나 소멸시키지 않습니다. 보존 고지와 파일별 범위는
[`data/LITERATURE_CLOCK_LICENSE.md`](https://github.com/junlee122-bot/writerclock/blob/main/data/LITERATURE_CLOCK_LICENSE.md)에
있습니다.

번역 인용문에는 현대 저작물이 포함될 수 있습니다. 코드의 MIT 라이선스는
인용문·번역문·문학 데이터에 적용되지 않습니다. 배포와 재사용 전
[DATA_LICENSE.md](DATA_LICENSE.md)를 확인해야 합니다.

`assets/`의 이미지, `firmware/`의 폰트·보드 SDK 및 빌드 시 내려받는 도구는
각 파일 또는 상류 프로젝트의 라이선스를 따릅니다. 이 저장소에 포함되어
있다는 사실만으로 별도의 권리가 부여되지는 않습니다.

웹·앱 화면의 명조 조판은 The Noto Project Authors의 Noto Serif KR을
UI 문자열과 인용문 데이터에 쓰이는 글자만 남긴 가변 폰트 서브셋
(`assets/fonts/NotoSerifKR-subset.woff2`)으로 포함합니다. Noto Serif KR의
Font Software와 그 변형에는 SIL Open Font License 1.1이 적용되며, 전체
고지와 서브셋 재생성 방법은
[`assets/fonts/OFL.txt`](https://github.com/junlee122-bot/writerclock/blob/main/assets/fonts/OFL.txt)에
보존합니다.

펌웨어 폰트 빌드는 Kil Hyung-jin의 Pretendard를 서브셋·LVGL C 형식으로
변환합니다. Pretendard의 Reserved Font Name은 `Pretendard`이며 Font Software와
그 변형에는 SIL Open Font License 1.1이 적용됩니다. 전체 저작권 고지와
라이선스는
[`firmware/OFL.txt`](https://github.com/junlee122-bot/writerclock/blob/main/firmware/OFL.txt)에
보존합니다.

`firmware/assets/persian.jpg`는 Wikimedia Commons의
[“A white persian cat (4985430014)”](https://commons.wikimedia.org/wiki/File:A_white_persian_cat_(4985430014).jpg),
`kitty.green66`, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/)이며,
펌웨어 아이콘은 이를 자르고 1bpp Bayer 디더링한 파생물입니다.
