# 일본 도시 가이드

교토의 기존 5개 장소에 도쿄·오사카·요코하마·나고야·삿포로·후쿠오카·히로시마·고베·센다이 9개 도시와 27개 장소를 추가했습니다. 초기 자료는 일본 10개 도시, 32개 장소였으며, 현재는 여행자 가이드·후기 기반으로 각 도시 50곳 이상, 총 508곳으로 확장했습니다 ([장소 조사](PLACE_REVIEWS.md)). 도시의 기본 이동·하루 동선과 대표 장소를 앱에 포함합니다.

일본정부관광국(JNTO)의 아래 10개 지역 안내 본문을 **2026-10-14**에 읽고, 공항 접근·주요 철도 거점·지역별 하루 동선을 한국어로 정리했습니다. 설치 파일에 가이드와 사진을 포함하므로 가이드 열기·일정 편집에 서버가 필요하지 않습니다. 정확한 최신 영업 시간·운임·입장료·공사·예약 가능 여부는 고정 데이터로 제공하지 않습니다.

지역 안내와 개별 장소 소개를 구분했습니다. 장소의 성격·명칭·주요 좌표는 Wikipedia의 해당 장소 항목과 Commons 사진 설명을 함께 확인했습니다. 출처와 확인일은 `public/japan-guide-sources.json`, 확인 가능한 좌표는 `src/venue-coordinates.ts`에 기록합니다. 지역 단위 좌표는 도보 입구·집합 장소를 의미하지 않으며 Google 공식 장소 검색으로 원하는 시설을 선택할 수 있습니다.

## 확인한 공식 자료

- 도쿄: https://www.japan.travel/en/destinations/kanto/tokyo/
- 오사카: https://www.japan.travel/en/destinations/kansai/osaka/
- 요코하마·가나가와: https://www.japan.travel/en/destinations/kanto/kanagawa/
- 나고야·아이치: https://www.japan.travel/en/destinations/tokai/aichi/
- 삿포로·홋카이도: https://www.japan.travel/en/destinations/hokkaido/hokkaido/
- 후쿠오카: https://www.japan.travel/en/destinations/kyushu/fukuoka/
- 히로시마: https://www.japan.travel/en/destinations/chugoku/hiroshima/
- 고베·효고: https://www.japan.travel/en/destinations/kansai/hyogo/
- 센다이·미야기: https://www.japan.travel/en/destinations/tohoku/miyagi/
- 교토: https://www.japan.travel/en/destinations/kansai/kyoto/

## 장소 사진

일본 32개를 포함한 전체 **49개 장소**에 실제 장소·지역의 사진을 각각 넣었습니다. 도시 대표 이미지는 해당 도시의 대표 장소 사진을 사용하지만, 다른 장소에 같은 사진을 반복하지 않습니다. Commons 원본의 설명·촬영자·라이선스를 확인하고 사진을 직접 검토해 엉뚱한 건물·인접 거리 사진을 제외했습니다.

사진은 Commons가 제공하는 축소 JPEG이며 추가 이미지 편집 없이 저장했습니다. 출처·이용 조건은 앱의 사진에 연결하고 [ASSETS.md](ASSETS.md)와 `public/photo-sources.json`에도 기록합니다. 구체적인 상호가 없는 카페 산책 등은 해당 지역의 실제 거리·카페 사진을 쓰며 특정 Google 업체의 공식 사진으로 표시하지 않습니다.

사용자가 추가한 사진은 해당 일정 장소에만 연결하고 대표 사진으로 선택할 수 있습니다. Google 공식 이름·위치를 불러오는 검색은 별도의 API 키가 필요하지만 개인 사진 추가에는 사진 API나 광범위한 저장소 권한이 필요하지 않습니다.
