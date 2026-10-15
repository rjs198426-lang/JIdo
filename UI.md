# J★Do 화면 구성

- 홈은 실제 여행 요약, 바로가기, 준비물·예약·경비, 선택한 날짜의 일정, 도시와 후보 장소로 구성합니다. 여행이 없을 때는 첫 여행 만들기와 내장 가이드를 표시하고 가짜 여행·예산·예약 수치를 만들지 않습니다.
- 앱 신규 실행·재실행과 Android 런처 아이콘으로 다시 열기는 항상 홈에서 시작합니다. 활성 여행·여행별 날짜·작업 탭 기록은 보존하고 내 여행을 선택했을 때 복원합니다. 첨부 자료·파일 선택기·외부 지도에서 돌아오는 것만으로 홈으로 이동하지 않습니다.
- 여행지 탭 이동은 검색 입력창을 자동 선택하지 않습니다. 사용자가 입력창을 눌러 검색합니다.
- 사진 원본·촬영자·라이선스는 모든 화면에서 접근할 수 있는 상단 정보 버튼의 **사진 출처**에 모읍니다. 개인 사진에 Commons 출처를 붙이지 않습니다. 사용 중인 과거 가이드의 사진 출처도 보존합니다.
- 도시·장소 카드는 같은 이미지 비율과 제목·설명 영역을 사용합니다. 같은 행의 높이를 맞추고 카드 사이에 12–20px 간격을 둡니다. 저장 버튼과 주요 동작은 44px 이상의 터치 영역을 사용합니다.
- 하단 메뉴는 실제 높이와 Android 안전 여백을 측정해 콘텐츠 마지막 부분을 가리지 않게 합니다.
- 내 여행은 외곽 테두리와 12–16px 안쪽 여백을 두고 여행 정보·작업 탭·날짜·도시·공유·일정을 같은 폭의 카드로 나눕니다. 도시 선택과 도시 추가는 같은 행에서 높이 48px로 맞추며, 휴대폰의 방문 시간 입력은 순서 변경 버튼과 줄을 나누어 잘리지 않게 합니다. 관련 배치는 `src/trip-layout.css`와 `tests/trip-layout.spec.ts`에서 관리합니다.

## 참고한 Android UI

2026-10-14에 다음 공식 자료와 Android 화면을 확인했습니다. 참고 화면을 앱 이미지로 복제하지 않습니다.

- [Organic Maps 공식 Android 화면](https://github.com/organicmaps/organicmaps/tree/master/android/app/src/fdroid/play/listings/en-US/graphics/phone-screenshots): 자주 쓰는 기능의 아이콘 구분, 주 동작과 보조 정보의 분리, 불필요한 안내를 줄이는 구성.
- [Skyscanner Backpack Android](https://github.com/Skyscanner/backpack-android): 관련 정보를 분리하는 카드 구조와 일정한 카드 모서리, 독립적인 저장 버튼. 공식 카드·저장 버튼 화면과 `BpkCardView` 구현을 확인했습니다.
- [Material Components Android 카드 가이드](https://github.com/material-components/material-components-android/blob/master/docs/components/Card.md): 카드별 단일 주제, 이미지·제목·내용·동작 영역의 일관된 구조, 카드 외부 여백.

TripIt·Booking·Airbnb 공식 페이지는 이 환경의 네트워크에서 차단되어 직접 확인하지 못했습니다.

## 확인

`tests/home-ui.spec.ts`는 여행 없는 홈, 실제 기록과 기능 연결, 자동 포커스, 전체 사진 출처, 320/393/768/1440px 카드 정렬, 큰 금액·긴 제목·하단 안전 여백을 확인합니다. Android 실제 기기의 글꼴 배율·키보드·제스처 확인은 별도입니다.
