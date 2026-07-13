# WriterClock Desktop

Tauri 2 셸은 원격 사이트를 열지 않고 `desktop/dist/`의 웹 자산을 앱 안에
포함합니다. `dist/`는 생성물이므로 직접 수정하지 않습니다.

```bash
npm ci
npm run icons
npm run check
npm run build
```

`npm run prepare`는 저장소 루트의 앱 셸, 아이콘, 생성된 한국어 데이터와
권리 문서만 복사하며 각 파일의 SHA-256을 `.build-manifest.json`에 기록합니다.
Wi-Fi 없이도 시계와 시간 탐색, 즐겨찾기가 동작해야 합니다.

Windows 설치 파일은 서명되지 않은 CI 산출물일 수 있고 macOS DMG도 공증되지
않을 수 있습니다. 공개 릴리스 전 코드 서명 인증서와 Apple notarization을
별도로 구성해야 합니다.
