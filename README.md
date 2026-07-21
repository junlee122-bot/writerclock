# WriterClock · 작가시계

현재 시각을 실제 문학 작품의 시각 표현이 들어간 문장으로 보여주는 한국어 문학시계입니다. 웹, 설치형 PWA, Android, Windows/macOS 데스크톱 앱, ESP32-S3 펌웨어를 한 저장소에서 관리합니다.

운영 주소: <https://writerclock.vercel.app/> · <https://junlee122-bot.github.io/writerclock/>

GitHub Pages 배포는 현대 작품 인용·번역의 권리 검토가 끝난 뒤에만 켜지도록
보호되어 있습니다. 저장소 변수 `PUBLISH_QUOTE_DATA=approved`를 명시적으로
설정해야 Pages 워크플로가 사이트 배포를 시작합니다.

## 주요 기능

- 24시간 1,440분을 분 단위 문장으로 표시
- 문장 안에서 현재 시각 표현을 강조하고 작품·저자·원문/번역 구분을 함께 표시
- 같은 분의 다른 문장 보기, 시각 직접 탐색, 즐겨찾기와 공유
- Noto Serif KR 서브셋을 번들해 모든 플랫폼에서 동일한 명조 활판 조판
- 큰 시각·초·분 진행 표시와 세로/가로 전시형 레이아웃
- 자동/밝은/어두운 테마, 글자 크기, 원터치 거치 모드, 화면 켜짐 유지
- 거치 모드의 몰입형 전체화면, 야간 감광, 번인 방지 미세 이동, 유휴 시 현재 시각 복귀
- 키보드 조작(길게 눌러 연속 이동, Shift 10분 단위), 반응형 레이아웃, 동작 줄이기와 고대비 환경 지원
- 서비스 워커 기반 오프라인 PWA
- 웹 자산을 내부에 포함하는 Tauri 데스크톱 앱

## 바로 실행하기

`index.html`을 브라우저에서 열면 서버 없이도 기본 시계가 동작합니다. PWA 설치, 서비스 워커, 전체화면과 Wake Lock을 함께 시험하려면 저장소 루트에서 정적 서버를 실행하세요.

```bash
python -m http.server 4173
```

이후 `http://localhost:4173`을 엽니다. Android Chrome과 iOS Safari에서는 브라우저 메뉴의 홈 화면 추가 또는 앱 설치 기능을 사용할 수 있습니다.

## Android 앱

Android 앱은 Capacitor 8 네이티브 컨테이너에 검증된 정적 웹 자산을 포함합니다. 원격 사이트가 없어도 모든 분의 문장을 표시하며, 실행 중에는 화면을 켜 둔 채 상태 표시줄과 내비게이션 바를 숨기는 몰입형 시계로 동작합니다. 화면 가장자리에서 스와이프하면 시스템 바를 잠시 다시 열 수 있습니다.

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

설치 가능한 개발 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. GitHub의 `Android build` 워크플로는 저장소 비밀값에 보관한 전용 PKCS#12 키로 release APK를 서명해 `writerclock-android-apk` 아티팩트로 제공합니다. Google Play 배포용 AAB와 Play App Signing 등록은 별도 스토어 설정이 필요합니다.

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

정밀 데이터는 24시간 키를 사용합니다. 화면에서는 12시간 표기를 선택할 수 있지만 오전과 오후는 서로 다른 데이터 키로 유지합니다. 오전·오후를 확정할 문맥 단서가 없는 한국어 원문은 정밀 데이터에서 제외하며, 번역 항목은 상류 24시간 키의 시간대를 보존합니다. 번역의 시간대 근거는 `period_review_status`로 명시·문맥·모호·미검토를 구분하고, 모호한 항목은 앱에도 경고합니다. 부분 문자열 검증은 텍스트가 원문에 존재함을 확인할 뿐, 시각 의미·권리 상태까지 자동으로 증명하지는 않습니다.

현재 번역 1,440개는 모두 실제 영어 원문 발췌를 보존합니다. 1,428개는 `data/quotes.json`의 정확한 개별 행에 고정했고, 별도로 교체한 12개는 출전 URL을 기록했으며 그중 8개는 1차 출전까지 확인했습니다. 종전 후보 338개와 미매핑 281개는 전수 검토해 `source_row_reviewed` 619개로 확정했으며 `needs_*`와 후보 상태는 남아 있지 않습니다. 다만 원문 행 매핑, 오전·오후 확정, 이용 권리는 서로 다른 문제입니다. 전체 결과와 18:44 교체 근거는 [출전 감사 보고서](docs/SOURCE_AUDIT.md), 최신 수치는 `data/ko_coverage.json`에서 확인할 수 있습니다.

영문 데이터 편집물과 그 파생 데이터에는 [CC BY-NC-SA 2.5](data/LITERATURE_CLOCK_LICENSE.md)가 적용되며, 인용문과 번역문에는 코드의 MIT 라이선스가 적용되지 않습니다. 배포나 재사용 전 반드시 [DATA_LICENSE.md](DATA_LICENSE.md)를 읽으세요.

## 데이터 도구

- `scripts/build_quotes.py`: canonical literature-clock CSV를 파싱해 영어 원본 데이터 산출물을 생성
- `data/ko_translations.json`: 1,440분 번역 항목의 생성 정본
- `scripts/curate_translation_corpus.mjs`: 번역 정본의 오탐 교체·출전 메타데이터 정리
- `scripts/build_ko_quotes.py`: 캐시된 한국어 위키문헌 원문을 보수적으로 추출하고 번역 정본과 병합
- `scripts/audit_data.mjs`: 1,440키, 필드, 오전/오후와 정밀 일치 계약 검사
- `data/ko_coverage.json`: 한국어 원문 추출과 번역 출전·시간대 검토 통계
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
- `android/`, `capacitor.config.json`: Capacitor Android 앱
- `firmware/`: Waveshare ESP32-S3-RLCD-4.2용 ESP-IDF/PlatformIO 펌웨어
- `.github/workflows/`: 검증, Pages 배포, Android·데스크톱·펌웨어 빌드 자동화

## 품질 원칙

문장을 새로 지어 인용문처럼 넣지 않습니다. 새 항목은 작품명, 저자, 정확한 출처 URL, 원문 시각 표현, `HH:MM` 해석, 원문/번역 구분과 권리 근거가 있어야 합니다. 자동 검사는 오탐을 줄이는 첫 단계이며, 최종 반영에는 사람이 문맥을 확인해야 합니다.

기여 절차는 [CONTRIBUTING.md](CONTRIBUTING.md), 보안 문제는 [SECURITY.md](SECURITY.md), 출처와 제3자 고지는 [NOTICE.md](NOTICE.md)를 따릅니다.

## 라이선스

저장소의 자체 코드에는 [MIT License](LICENSE)가 적용됩니다. 인용문, 번역문, 데이터베이스, 폰트, 이미지 등 제3자 자료는 각각의 권리 조건을 따르며 MIT 라이선스 범위 밖입니다. 자세한 구분은 [DATA_LICENSE.md](DATA_LICENSE.md)와 [NOTICE.md](NOTICE.md)에 있습니다.
