# WriterClock · 작가시계

현재 시각을 실제 문학 작품의 시각 표현이 들어간 문장으로 보여주는 한국어 문학시계입니다. 웹, 설치형 PWA, Windows/macOS 데스크톱 앱, ESP32-S3 펌웨어를 한 저장소에서 관리합니다.

권리 승인 후 배포 예정 주소: <https://junlee122-bot.github.io/writerclock/>

GitHub Pages 배포는 현대 작품 인용·번역의 권리 검토가 끝난 뒤에만 켜지도록
보호되어 있습니다. 저장소 변수 `PUBLISH_QUOTE_DATA=approved`를 명시적으로
설정해야 Pages 워크플로가 사이트 배포를 시작합니다.

## 주요 기능

- 24시간 1,440분을 분 단위 문장으로 표시
- 문장 안에서 현재 시각 표현을 강조하고 작품·저자·원문/번역 구분을 함께 표시
- 같은 분의 다른 문장 보기, 시각 직접 탐색, 즐겨찾기와 공유
- 자동/밝은/어두운 테마, 글자 크기, 거치 모드, 화면 켜짐 유지
- 키보드 조작, 반응형 레이아웃, 동작 줄이기와 고대비 환경 지원
- 서비스 워커 기반 오프라인 PWA
- 웹 자산을 내부에 포함하는 Tauri 데스크톱 앱

## 바로 실행하기

`index.html`을 브라우저에서 열면 서버 없이도 기본 시계가 동작합니다. PWA 설치, 서비스 워커, 전체화면과 Wake Lock을 함께 시험하려면 저장소 루트에서 정적 서버를 실행하세요.

```bash
python -m http.server 4173
```

이후 `http://localhost:4173`을 엽니다. Android Chrome과 iOS Safari에서는 브라우저 메뉴의 홈 화면 추가 또는 앱 설치 기능을 사용할 수 있습니다.

## 데스크톱 앱

데스크톱 빌드는 원격 웹사이트를 불러오지 않습니다. `scripts/prepare_desktop.mjs`가 릴리스에 필요한 웹 파일만 `desktop/dist/`로 복사하고 SHA-256 빌드 명세를 만든 뒤, Tauri가 그 디렉터리를 앱에 포함합니다.

```bash
cd desktop
npm ci
npm run icons
npm run check
npm run build
```

Windows에서는 Visual Studio Build Tools와 WebView2, macOS에서는 Xcode Command Line Tools가 필요합니다. 자세한 내용은 [desktop/README.md](desktop/README.md)를 확인하세요.

## 데이터 구성

- `kind=원문`: 한국어 공개저작 원문에서 발췌하고 원문 캐시와 부분 문자열 일치 여부를 확인한 항목
- `kind=역`: 외국 문학의 시각 문장을 한국어로 옮긴 항목
- `precise`: 특정 `HH:MM`에 대응하는 문장
- `buckets`: 새벽·아침·저녁처럼 시간대에 대응하는 한국어 원문

정밀 데이터는 24시간 키를 사용합니다. 화면에서는 12시간 표기를 선택할 수 있지만 오전과 오후는 서로 다른 데이터 키로 유지합니다. 오전·오후를 확정할 문맥 단서가 없는 한국어 원문은 정밀 데이터에서 제외하며, 번역 항목은 상류 24시간 키의 시간대를 보존합니다. 부분 문자열 검증은 텍스트가 원문에 존재함을 확인할 뿐, 시각 의미·권리 상태까지 자동으로 증명하지는 않습니다. 데이터 변경에는 별도의 의미 검토와 권리 검토가 필요합니다.

현재 번역 1,440개 가운데 1,151개는 `data/quotes.json`의 개별 영어 원문 행 또는 별도 확인 원문에 연결되어 있습니다. 이 중 813개는 직접·복합 별칭 규칙으로 확인했고, 저자 또는 제목 하나만으로 연결된 338개는 명시적으로 `source_row_alias_candidate` 후보 상태를 유지합니다. 나머지 289개는 상류 스냅숏 참조만 보존되어 개별 원문 행·1차 출전 매핑이 더 필요합니다. 상태별 수치는 `data/ko_coverage.json`의 `translation_review_counts`에 기록하며, 후보나 미연결 항목을 1차 출전까지 검증됐다고 표시하지 않습니다.

영문 데이터 편집물과 그 파생 데이터에는 [CC BY-NC-SA 2.5](data/LITERATURE_CLOCK_LICENSE.md)가 적용되며, 인용문과 번역문에는 코드의 MIT 라이선스가 적용되지 않습니다. 배포나 재사용 전 반드시 [DATA_LICENSE.md](DATA_LICENSE.md)를 읽으세요.

## 데이터 도구

- `scripts/build_quotes.py`: canonical literature-clock CSV를 파싱해 영어 원본 데이터 산출물을 생성
- `data/ko_translations.json`: 1,440분 번역 항목의 생성 정본
- `scripts/curate_translation_corpus.mjs`: 번역 정본의 오탐 교체·출전 메타데이터 정리
- `scripts/build_ko_quotes.py`: 캐시된 한국어 위키문헌 원문을 보수적으로 추출하고 번역 정본과 병합
- `scripts/audit_data.mjs`: 1,440키, 필드, 오전/오후와 정밀 일치 계약 검사
- `data/ko_coverage.json`: 한국어 원문의 작품별 출처와 추출 통계
- `data/ko_sources/`: 검증에 사용한 원문 캐시

기본 빌드는 네트워크를 사용하지 않습니다. 위키문헌 캐시를 새로 받는
`--refresh`는 검토되지 않은 upstream 변경을 가져올 수 있습니다. 릴리스에서는
`python scripts/build_ko_quotes.py --check`로 커밋된 입력과 생성 결과가
바이트 단위로 일치하는지 확인합니다.

## 저장소 구조

- `index.html`, `assets/`, `manifest.webmanifest`, `sw.js`: 웹/PWA
- `data/`: 인용문 데이터, 출처 캐시와 커버리지 보고서
- `scripts/`: 데이터 및 데스크톱 번들 생성 도구
- `desktop/`: Tauri 2 데스크톱 앱
- `firmware/`: Waveshare ESP32-S3-RLCD-4.2용 ESP-IDF/PlatformIO 펌웨어
- `.github/workflows/`: 검증, Pages 배포, 데스크톱 빌드 자동화

## 품질 원칙

문장을 새로 지어 인용문처럼 넣지 않습니다. 새 항목은 작품명, 저자, 정확한 출처 URL, 원문 시각 표현, `HH:MM` 해석, 원문/번역 구분과 권리 근거가 있어야 합니다. 자동 검사는 오탐을 줄이는 첫 단계이며, 최종 반영에는 사람이 문맥을 확인해야 합니다.

기여 절차는 [CONTRIBUTING.md](CONTRIBUTING.md), 보안 문제는 [SECURITY.md](SECURITY.md), 출처와 제3자 고지는 [NOTICE.md](NOTICE.md)를 따릅니다.

## 라이선스

저장소의 자체 코드에는 [MIT License](LICENSE)가 적용됩니다. 인용문, 번역문, 데이터베이스, 폰트, 이미지 등 제3자 자료는 각각의 권리 조건을 따르며 MIT 라이선스 범위 밖입니다. 자세한 구분은 [DATA_LICENSE.md](DATA_LICENSE.md)와 [NOTICE.md](NOTICE.md)에 있습니다.
