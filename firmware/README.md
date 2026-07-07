# 작가시계 펌웨어 (ESP32-S3)

콘센트에 꽂아두면 계속 켜지는 하드웨어 작가시계. 매분 그 시각에 해당하는 한국 문학
문장을 컬러 LCD에 표시하고, 문장 속 시각 표현을 금색으로 강조한다.

## 대상 보드

**JC3248W535** (ESP32-S3, 3.5인치 320x480 IPS 정전식 터치, 16MB 플래시 + 8MB PSRAM).
동급 대체: Waveshare ESP32-S3 3.5" Touch LCD (N16R8), 기타 ESP32-S3 320x480 QSPI LCD 보드.
전원: USB-C 5V 상시 급전 = 항상 켜짐(자동 절전/꺼짐 없음). 5V/1A 충전기면 충분.

## 왜 되는가 (실측)

- 정확 시각 문장 데이터 `data/quotes_min.json` = 431KB (1440분, 1497개, 시간대 근사 문장 제외).
- 데이터에 실제 쓰인 한글 1,275자뿐 -> subset 폰트가 작다.
- LVGL 폰트(2bpp): 28px 1.06MB + 44px 1.88MB, subset TTF 498KB.
- 합계 약 3.4MB -> 16MB 플래시에 여유. LVGL 버퍼는 8MB PSRAM 사용.

## 빌드 파이프라인 (보드 없이도 생성됨)

```bash
cd firmware/tools
python3 build_data.py      # -> ../data/quotes_min.json, ../data/glyphs.txt
bash   build_fonts.sh      # OFL 나눔명조 받아 subset -> font_ko_28.c, font_ko_44.c
```

생성물 중 원본 TTF와 대용량 `font_ko_*.c`는 gitignore(스크립트로 재생성). 데이터와
`glyphs.txt`, subset 스크립트는 커밋된다.

## 펌웨어 (LVGL) 구성 예정

- 시간: NTP(WiFi) 또는 보드 RTC. 매분 경계에서 그 분의 문장 갱신.
- 문장 선택: `quotes_min.json`을 LittleFS에서 로드, "HH:MM" 키로 조회. 그 분에 여러
  개면 원문(kind=원문) 우선, 터치하면 다른 문장(2개 이상일 때).
- 렌더: 문장 본문(28px) + 출처(작게) + 시각 표현 금색 강조. 긴 문장은 화면에 맞게
  자동 축소 또는 페이지네이션.
- 밝기: 주간/야간 백라이트 조절(PWM). 상시 켜둠, sleep 없음.

## 라이선스

코드 MIT. 폰트는 나눔명조(SIL OFL). 인용문은 웹앱과 동일(공개저작 원문 + 번역).
