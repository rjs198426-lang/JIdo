# 괌·사이판 및 사진 보강 준비

**Android 1.7에서는 두 휴양지와 명소 각 20곳을 실제 앱에 반영했습니다.** 최종 앱 자료는 `src/resort-guides.json`이며 이 폴더의 `guam.json`·`saipan.json`은 최초 조사 초안을 보존한 파일입니다. 새 명소 40곳은 한국어 편집 가이드이고 아직 정확한 좌표·현재 운영을 검증하지 않았습니다. `reviewSources`를 임의로 붙이거나 모르는 좌표를 0·섬 중심으로 채우지 않습니다. 위치 미확인 장소는 지도 핀을 생략하고 지도에서 이름으로 찾기·일정 추가·백업을 지원합니다.

사이판 전경 후보는 미러의 명시적인 작가·Public domain 표시와 실제 이미지 확인을 근거로 `/images/saipan-coast.jpg`에 포함했습니다. 앱의 사진 출처에서 원본·작가·이용 조건을 열 수 있으며 `public/photo-sources.json`에는 미러 메타데이터와 원본 페이지 직접 열람이 차단된 사실도 기록합니다. 이 사진을 마나가하섬 등 개별 장소의 사진으로 돌려쓰지 않습니다. 괌 대표 사진과 전체 장소 사진 보강은 아직 미완료입니다.

## 사진 범위와 실제 확인

요청의 「사진은 다 반영」은 괌·사이판뿐 아니라 기존 내장 여행지·장소도 포함하는 것으로 해석합니다. 현재 자료의 지역별 사진 누락은 `photo-coverage.json`에 저장했습니다. 이 보고서는 사용자의 개인 사진이나 여행 기록을 읽지 않고 내장 사진과 출처 메타데이터·실제 파일 형식만 검사합니다.

```bash
node --experimental-strip-types scripts/audit-photo-coverage.mjs --output research/resorts/photo-coverage.json
node --experimental-strip-types scripts/audit-photo-coverage.mjs --complete
```

`--complete`는 아직 사진이 누락되어 실패하는 것이 정상입니다. 사진 반영 완료를 선언하려면 모든 여행지와 장소에 적합한 사진·이용 조건·실제 파일이 있어야 합니다. 기존 사진을 다른 장소에 재사용하거나 생성 이미지를 실물 사진으로 표시하지 않습니다.

허용된 GitHub 자료에서도 대안을 조사했습니다. 다수의 사진 메타데이터는 `Flickr (verify license)`로만 표시되어 사용에서 제외했습니다. 사이판 전경 한 장은 미러 메타데이터가 Public domain, 작가 P. Miller로 표시하며 실제 이미지가 사이판 전경임을 시각적으로 확인했습니다. 원본 Commons 페이지는 차단되어 직접 확인하지 못했습니다. 미러 파일명은 `managaha-island.webp`이지만 실제 바이트는 JPEG이며 원본 제목은 `Saipan.jpg`입니다. 마나가하섬 개별 사진으로 사용하지 않습니다.

## 현재 외부 차단

2026-10-15에 아래 요청이 HTTP 403으로 실패했습니다.

- 괌 관광청: `www.visitguam.com`
- 마리아나 관광청: `www.mymarianas.com`
- 사진 원본·이용 조건: `commons.wikimedia.org`
- 사진 다운로드에는 `upload.wikimedia.org`도 필요합니다.

필요한 주소는 기존 주소를 보존한 환경 설정 초안에 추가했습니다. 초안 저장은 실행 환경에 적용되지 않습니다. **환경 설정에서 검토·저장 후 Publish**하여 적용해야 원본 자료 조사와 전체 사진 다운로드를 진행할 수 있습니다. 기존 소스·서명키를 지우거나 별도 초기화하지 않습니다.
