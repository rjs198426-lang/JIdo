# 개인 여행의 장소 검색과 비용

장소 추가·이름 검색은 먼저 기기에 등록된 가볼 곳을 보여줍니다. 내장 가이드와 기존 여행의 직접 등록 장소가 대상이며 입력 중 외부 검색 요청을 보내지 않습니다. 결과가 없으면 `새 장소 추가`가 표시되고 검색어를 입력 폼으로 넘깁니다.

새 장소 입력 화면의 기본 **지도 검색**은 OpenStreetMap 기반 Photon 공용 API입니다. API 키·결제 등록·별도 J★Do 서버 없이 이름·주소·좌표를 받아 앱 안에서 선택하고 일정에 저장합니다. Google은 검색 서비스에서 직접 선택했을 때만 호출하며 무료 검색 실패를 Google 유료 호출로 자동 전환하지 않습니다.

## 실사용에서 발견한 가장 큰 문제

가이드 밖의 숙소·음식점·장소를 추가할 때 Google API 키가 없으면 검색이 막혔습니다. 여러 도시 자유여행에서 대부분의 개인 장소를 다루기 어렵게 만드는 문제라 우선 개선했습니다. 이름·주소·도시를 바꾼 뒤 이전 검색의 좌표와 장소 ID가 남아 잘못된 위치로 길찾기하는 문제도 수정했습니다. 실패한 재검색 자체는 이미 선택한 위치를 지우지 않습니다.

무료 검색 결과는 명시적으로 찾기를 눌렀을 때만 요청합니다. 지원하는 국가 이름·국가 코드에 맞춰 결과를 제한하고, 가이드가 있는 도시는 위치를 우선합니다. 같은 검색은 기기에 저장한 결과로 재사용합니다. 최근 80개 결과를 보관하며 연결된 상태에서는 30일 동안 재사용하고 오프라인에서는 저장된 결과를 사용합니다. 요청은 직렬 처리하고 시작 간격을 최소 1.1초로 제한합니다. 늦게 도착한 결과는 바뀐 입력이나 서비스 선택을 덮어쓰지 않습니다.

검색 누락·통신 실패 때도 주소나 위도·경도로 직접 추가할 수 있습니다. 위도·경도는 모두 입력해야 하고 빈 값을 0으로 바꾸지 않습니다. 부분 입력도 초안에 보관합니다. Google·OSM 검색 ID는 구분해 저장하고 기존 여행·사진·경비를 유지합니다.

## 대안과 사용 조건

| 방식 | 비용·설정 | 확인한 조건과 한계 |
| --- | --- | --- |
| Photon 공용 서버 | 공개 API, 키·결제 등록 없이 호출 | 공식 프로젝트가 적당한 요청량의 프로젝트 사용을 허용. 과다 요청 차단 가능, 서비스 가동 보장 없음. 업체 누락과 한글 검색 품질 한계가 있어 영문·현지명·주소 입력이 유리 |
| Google Places | Google Cloud 프로젝트·키·결제 설정 필요, 사용량과 요청 필드에 따른 과금 가능 | 기본값에서 제외. 사용자가 선택할 때만 호출. Text Search Pro의 월 무료 한도 5,000건, 첫 유료 구간 1,000건당 $32(USD, 공식 글로벌 표 기준) |
| 공개 Nominatim | 공개 서비스이나 강한 사용 제한 | 공식 정책에 1초당 최대 1요청, 앱 전체 합산 제한, 식별·출처·캐시·서비스 전환 요건, 자동완성 금지와 자동 생성 플랫폼 사용 제한이 있어 이번 기본 서비스로 선택하지 않음 |
| 직접 입력 | 검색 API 비용 없음 | 주소나 좌표를 직접 확인. 검색에 실패하거나 오프라인인 경우 사용 |

외부 Google 지도 앱·웹으로 길찾기 링크를 여는 것과 Google Places 검색 API를 호출하는 것은 별개입니다. 길찾기 링크에는 개발자 API 키를 넣지 않으며 무료 검색에서 Google 검색 API를 호출하지 않습니다. OSM 이름은 Google 공식 장소명이 아니고 Google 리뷰·사진·영업시간도 제공하지 않습니다.

Photon은 본인·동행자의 적은 요청량을 전제로 선택했습니다. 공개 대규모 서비스의 안정성을 보장하는 대안으로 설명하지 않습니다. 검색 결과와 저장된 장소에 `© OpenStreetMap contributors · ODbL`을 표시합니다. 기기의 정확한 현재 위치나 여행 메모·예약·개인 첨부 파일은 검색 요청에 넣지 않습니다.

## 조사 근거와 검증 범위

2026-10-14에 공식 프로젝트의 문서를 읽었습니다.

- [Photon 공용 서버 사용 조건](https://github.com/komoot/photon#demo-server): “welcome to use the API for your project as long as the number of requests stay in a reasonable limit”, “do not give guarantees for availability”.
- [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md): 검색어·국가·위치 우선·결과 GeoJSON 형식을 확인했습니다.
- [Nominatim 공식 정책 원본](https://github.com/openstreetmap/owg-website/blob/master/policies/nominatim.md).
- [Google 공식 클라이언트의 프로젝트·API 키 요구사항](https://github.com/googlemaps/js-api-loader#requirements), [Google 최신 요금표](https://developers.google.com/maps/billing-and-pricing/pricing).

네트워크 제한 해소 후 Google 공식 글로벌 가격표와 Photon 공용 서버의 HTTP 200 응답을 확인했습니다. Photon에서 Eiffel Tower의 실제 이름·주소·좌표를 받았습니다. 요금 표는 2026-10-14 확인 기준이며 월 SKU별 무료 한도와 구간별 1,000건당 USD 요금입니다. 계약·국가·세금·요청 필드에 따라 실제 청구는 달라질 수 있습니다. 정확한 계정 청구나 Google API 실호출을 검증한 것은 아닙니다.

기본 Google Android 지도(Map ID 없는 Maps SDK SKU)는 무료 사용 한도가 Unlimited입니다. 반면 웹 Dynamic Maps는 월 무료 한도 10,000건, 첫 유료 구간 1,000건당 $7입니다. Android도 Map ID를 쓰는 지도·Street View는 별도 SKU가 발생할 수 있습니다. [공식 SKU 설명](https://developers.google.com/maps/billing-and-pricing/sku-details)을 확인했습니다. 트리플의 내부 계약·실제 SDK·청구액은 이 공개 요금표로 단정하지 않습니다.

앱 흐름·오프라인 검색 재사용·위치 수정·오류 처리와 Android HTTP 호출은 명시적인 응답 모형으로 검증합니다. 공용 서버의 실제 검색 품질·가동 여부, Google 실제 과금·요청, Android 실기기 연결은 모형 테스트와 구분합니다.
