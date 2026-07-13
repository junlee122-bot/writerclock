# literature-clock 데이터 편집물 고지

## 원 출처와 표시

- 작품명: `literature-clock`, 특히 `litclock_annotated.csv` 데이터 편집물
- 편집자: Johs Enevoldsen과 `literature-clock` 기여자
- 원 프로젝트: <https://github.com/JohsEnevoldsen/literature-clock>
- 원 데이터: <https://github.com/JohsEnevoldsen/literature-clock/blob/master/litclock_annotated.csv>
- 개념 원안: Jaap Meijers의 Literature Clock
- 원 라이선스 고지: <https://github.com/JohsEnevoldsen/literature-clock/blob/master/LICENCE.md>
- 라이선스: [Creative Commons Attribution-NonCommercial-ShareAlike 2.5
  Generic](https://creativecommons.org/licenses/by-nc-sa/2.5/)

원 프로젝트의 라이선스 고지는 다음과 같습니다.

> This work is licensed under a Creative Commons
> Attribution-NonCommercial-ShareAlike 2.5 Generic License.

## WriterClock의 변경

WriterClock은 `litclock_annotated.csv`를 저장소에 캐시하고 다음과 같이
변형했습니다.

1. 파이프 구분 행을 파싱하고 시각을 24시간제 `HH:MM` 키로 정규화했습니다.
2. 행을 분별 배열로 재구성해 `quotes.json`과 `quotes.js`로 직렬화했습니다.
   `quotes.json`은 인식된 모든 안전성 분류를 보존하고, 웹용 `quotes.js`는
   `nsfw` 행을 제외합니다.
3. 분별로 선택한 영문 시간 표현과 인용문, 작품명, 저자명을 한국어로 번역·
   교정했으며, 정확한 시각을 말하지 않는 오탐 행을 다른 원문 행으로 교체하고
   출전 링크, 안전성, 검토 상태와 매핑 근거를 추가했습니다.
4. 번역 항목을 별도로 추출한 한국어 위키문헌 원문 항목과 결합하고 웹 및
   ESP32 펌웨어용 형식으로 다시 직렬화했습니다.

따라서 원 CSV를 재배포하는 파일뿐 아니라 원 편집물의 선택·배열을 개작한
산출물에는, 라이선스 제공자가 그 권리를 보유하는 범위에서 CC BY-NC-SA 2.5가
계속 적용됩니다. 저작자 표시와 이 라이선스 링크 및 위 변경 사실을 유지하고,
비영리로만 이용하며, 개작물을 공유할 때 같은 라이선스를 적용해야 합니다.
라이선스가 허용한 행위를 법률조건이나 기술적 조치로 추가 제한해서도 안 됩니다.

## 개별 인용문의 권리

CC BY-NC-SA 2.5 편집물 라이선스는 데이터의 선택·배열 등 편집물에 관해
라이선스 제공자가 가진 권리에 대한 허락입니다. CSV와 파생 데이터에 수록된
개별 문학 인용문, 해당 번역문 및 작품 자체의 저작권은 각 원 권리자에게 남을
수 있습니다. 이 고지는 그러한 권리를 허락하거나 퍼블릭 도메인으로 선언하지
않습니다. 재배포자는 해당 관할권의 인용·공정 이용 요건 또는 별도 허락을
독립적으로 확인해야 합니다.

이 파일은 원 프로젝트나 Creative Commons가 WriterClock을 보증한다는 뜻이
아닙니다. 충돌이 있을 때에는 링크된 CC BY-NC-SA 2.5 법률문이 우선합니다.
