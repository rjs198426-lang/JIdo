# Android 새 서명 키 관리

사용자가 2026-10-17 새 키 생성을 승인했습니다. 1.26부터 아래 설치 식별자와 키를 유지합니다.

- 설치 패키지: `com.jido.travel.next`
- 앱 표시 이름: `J★Do` (1.27부터; 1.26의 임시 이름은 `J★Do 새버전`)
- Java namespace: `com.jido.travel` (설치 식별자와 별개)
- 인증서 SHA-256: `0d1b1f20dae73d00626d9ebb4f460943c4f16c2266bc7bc58d124d13b32494ac`
- 알고리즘: RSA 4096비트, PKCS12, 발급 시 유효기간 10,000일

기존 `com.jido.travel`과 함께 설치됩니다. 기존 앱을 삭제하지 말고 전체 ZIP 백업을 새 앱에서 복원한 후 여행·사진·첨부 자료를 확인합니다. 구버전의 서명 개인 키를 복구한 것은 아닙니다.

## 비공개 백업

작업 공간의 `/workspace/.jido-signing`에 키와 설정이 있습니다. 디렉터리는 700, 개인 키·설정·ZIP은 600 권한으로 만들었습니다. `JDo-signing-backup.zip`에는 개인 키, 비밀번호가 포함된 `signing.properties`, 공개 인증서, 복원 안내가 함께 들어 있습니다. **비공개 파일이며 공개 GitHub나 APK에 넣으면 안 됩니다.**

백업 파일은 `/workspace/.jido-signing/JDo-signing-backup.zip`과 다운로드용 `/tmp/JDo-signing-backup.zip`에 있습니다. 같은 클라우드의 두 사본만으로 영구 보관을 보장하지 않습니다. 사용자가 별도로 다운로드해 개인 보관해야 합니다. 최신 비공개 다운로드 사본은 `/tmp/JDo-signing-backup-2026-10-17.zip`이며 기존 키 백업과 바이트가 동일하고 ZIP CRC·공개 인증서 지문 일치를 확인했습니다. 사용자에게 전달할 다운로드 링크를 준비했지만 실제 다운로드 완료를 확인한 것은 아닙니다. 키나 비밀번호를 채팅에 붙여넣지 않습니다.

## 복원과 다음 업데이트

1. 비공개 ZIP을 `/workspace/.jido-signing`에 복원합니다. 디렉터리 권한은 700, 파일은 600으로 제한합니다.
2. 다른 머신에서는 `signing.properties`의 `storeFile`을 복원한 키의 실제 절대 경로로 수정합니다. 다른 설정 파일은 `JIDO_SIGNING_PROPERTIES`로 선택합니다.
3. `npm run android:build`를 실행합니다. 키가 없으면 빌드가 중단됩니다. 기존 키를 대신하는 새 키를 자동 생성하지 않습니다.
4. 생성물 `artifacts/JDo-android.apk`의 서명은 `android/signing-certificate.sha256`과 일치해야 합니다. 이 파일은 공개 인증서 지문이며 개인 키가 아닙니다. 빌드가 성공하게 하려고 이 지문을 다른 키로 교체하지 않습니다.
5. 이후 업데이트는 같은 패키지·인증서를 유지하고 versionCode를 올립니다.

백업을 별도 임시 디렉터리에 실제 복원하고 APK를 재서명해 동일 인증서 검증에 성공했습니다. 새 키는 공개 브랜치와 APK에 포함하지 않았습니다. 실제 휴대폰 설치·제조사별 동작 검증은 별도입니다.
