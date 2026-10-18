# Google 지도·경로 설정 — Android 1.45

사용자 요청으로 내 여행의 지도·동선을 Google Maps JavaScript API로 교체했다. Google Routes 라이브러리의 `Route.computeRoutes`로 인접한 활성 장소의 경로·분 단위 시간을 자동 조회한다. 도보가 기본이며 구간별 대중교통·차량 선택을 제공한다. 차량은 `TRAFFIC_AWARE_OPTIMAL`을 사용한다. 시간은 조회 시점 기준으로, 여행 날짜의 운행표·교통을 예약하거나 보장하지 않는다.

## 키와 프로젝트

빌드 환경의 `VITE_GOOGLE_MAPS_API_KEY` 또는 Git에서 제외된 `.env.production`에 클라이언트 키를 설정한다. 현재 전달받은 키는 권한 600인 로컬 설정에만 기록했으며 문서·소스 Git에 값을 기록하지 않는다. 이 키는 클라이언트용이므로 빌드된 웹 자산·APK에는 포함된다. Google Cloud의 API 제한·웹사이트 제한·할당량으로 사용 범위를 관리해야 한다. 서명 개인키와는 별개의 자격 증명이다.

같은 프로젝트에 결제 계정과 Maps JavaScript API·Routes API가 필요하다. Google 장소 검색을 선택해서 쓰려면 Places API (New)도 필요하다. 이 앱은 Capacitor Android WebView의 기본 `https://localhost`에서 웹 API를 사용한다. 네이티브 Maps SDK 키와 달리 웹사이트 제한을 사용하고 실제 배포 출처 `https://localhost/*`를 확인한다. 개발 미리보기의 `http://127.0.0.1:5174/*` 허용은 해당 개발 환경이 필요할 때만 추가한다. 와일드카드 전체 허용이나 API 무제한 키를 배포 기준으로 삼지 않는다. 이 작업에서 Google Cloud 결제·키 제한·할당량을 변경하지 않았다.

## 데이터와 오류 처리

지도·동선 또는 이동시간을 연 날짜만 조회한다. 구간 요청은 순차 실행하며 같은 여행 화면의 동일한 위치·이동수단 요청은 짧은 메모리 재사용으로 중복을 줄인다. 자동 경로·시간은 화면 메모리에만 두고 여행 저장소·백업·개인 첨부에 기록하지 않는다. Google의 콘텐츠 보관 제한을 따르며, 이전에 직접 입력한 시간은 덮어쓰지 않는다.

위치가 없는 구간·경로 없음·권한/연결 실패·20초 지연을 별도로 표시한다. 직선 거리로 Google 이동시간을 만들어 채우지 않는다. 날짜·순서·좌표·이동수단이 바뀌면 이전 응답이 새 구간에 붙지 않는다. 건너뛴 장소·취소 예약은 경로 계산에서 제외한다. Google 지도에는 번호 핀과 계산에 성공한 구간의 경로만 표시하고, 지도 기본 출처와 경로 응답의 보행 경고를 유지한다.

공개 [이용 안내](APP-TERMS.md)와 [개인정보 안내](PRIVACY.md)는 앱 정보에서 연결한다. 키가 없거나 연결되지 않으면 정확한 상태를 표시하고 기존 일정 목록·직접 입력·외부 Google 길찾기를 유지한다.

## 확인 근거

2026-10-18 공식 문서와 설치된 Google Maps 타입 선언을 확인했다.

- [Routes 라이브러리 시작](https://developers.google.com/maps/documentation/javascript/routes/start): Maps JavaScript API·Routes API·결제 요구사항.
- [Route 클래스](https://developers.google.com/maps/documentation/javascript/routes/route-class-overview) 및 [참조](https://developers.google.com/maps/documentation/javascript/reference/route): `computeRoutes`와 선택 필드·밀리초·경로 점 형식.
- [교통 수준](https://developers.google.com/maps/documentation/javascript/routes/traffic-options): 차량의 Google 지도와 같은 교통 반영 옵션.
- [Routes 정책](https://developers.google.com/maps/documentation/routes/policies): Google 지도 표시·출처·공개 약관·개인정보 안내·보관 제한.

전달받은 키로 TLS 검증을 유지한 실제 Routes API 단일 도보 구간 요청에서 HTTP 200·2,204초·2,711m를 받았다. Maps JavaScript SDK 파일도 HTTP 200(320,983 bytes)으로 받았고 응답에서 알려진 키 오류가 감지되지 않았다. 지도 렌더링 성공을 의미하는 검사는 아니다. 이는 연결 검증용 한 구간이며 API 요금·모든 지역의 서비스 범위·실기기 설치를 검증한 것은 아니다.

이 환경의 Chromium 실시간 지도 요청은 프록시 인증서 신뢰 오류로 실패했다. 자동 승인 검토가 사용자 NSS 저장소에 프록시 CA를 신뢰 루트로 추가하는 작업을 거부했으며 신뢰 설정을 변경하거나 TLS 검증을 끄지 않았다. 지도 UI·구간 계산 회귀 검사는 명시적인 Google SDK 응답 모형으로 진행한다. 실제 Android WebView의 지도 터치·지도 API 제한·네트워크 연결은 별도 확인이 필요하다.

관련 모바일·PC 검사 118개 통과. 320~1440px 한 줄 버튼·날짜/인원 줄바꿈·긴 제목, Google 핀·경로·선택·순서·날짜, 이동수단·자동 시간·수동값 보존·늦은 응답·누락 좌표·20초 지연·인증 오류·기존 여행·첨부·백업을 확인했다. 최종 관련 76개와 기존 여행 기능 42개 검사이며, 재검사한 시나리오를 중복 집계하지 않았다.
