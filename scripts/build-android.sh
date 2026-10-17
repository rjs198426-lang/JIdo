#!/usr/bin/env bash
set -euo pipefail
JIDO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/.cache/android-sdk}"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-/workspace/.cache/android-user}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.cache/gradle}"
if [[ -x /workspace/.cache/jido-jdk-21/bin/javac ]]; then
  export JAVA_HOME=/workspace/.cache/jido-jdk-21
  export PATH="$JAVA_HOME/bin:$PATH"
fi
cd "$JIDO_ROOT"
export JIDO_SIGNING_PROPERTIES="${JIDO_SIGNING_PROPERTIES:-/workspace/.jido-signing/signing.properties}"
if [[ ! -f "$JIDO_SIGNING_PROPERTIES" ]]; then
  printf '%s\n' 'Signing configuration is missing. Restore the existing private signing backup; do not generate a replacement key.' >&2
  exit 1
fi
python3 scripts/configure-gradle-proxy.py
if [[ ! -d "$ANDROID_HOME/platforms/android-36" || ! -x "$ANDROID_HOME/build-tools/35.0.0/aapt2" || ! -x "$ANDROID_HOME/build-tools/36.0.0/apksigner" ]]; then
  printf '%s\n' 'Android API 36 SDK or build tools are missing. Run python3 scripts/setup-android.py first.' >&2
  exit 1
fi
npm run build
npx cap sync android
cd android
./gradlew assembleRelease --no-daemon --max-workers=2
cd "$JIDO_ROOT"
mkdir -p artifacts
JIDO_RELEASE_APK=android/app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs "$JIDO_RELEASE_APK" > artifacts/apk-signature.txt
JIDO_EXPECTED_CERT="$(tr -d '[:space:]' < android/signing-certificate.sha256)"
JIDO_ACTUAL_CERT="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' artifacts/apk-signature.txt)"
if [[ "$JIDO_ACTUAL_CERT" != "$JIDO_EXPECTED_CERT" ]]; then
  printf '%s\n' 'Signing certificate does not match the established JDo key. APK was not copied for distribution.' >&2
  exit 1
fi
install -m 644 "$JIDO_RELEASE_APK" artifacts/jido-release.apk
install -m 644 artifacts/jido-release.apk artifacts/JDo-android.apk
printf '%s\n' "APK: $JIDO_ROOT/artifacts/jido-release.apk"
