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
python3 scripts/configure-gradle-proxy.py
if [[ ! -d "$ANDROID_HOME/platforms/android-36" || ! -x "$ANDROID_HOME/build-tools/35.0.0/aapt2" ]]; then
  printf '%s\n' 'Android API 36 SDK or build tools are missing. Run python3 scripts/setup-android.py first.' >&2
  exit 1
fi
npm run build
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon --max-workers=2
cd "$JIDO_ROOT"
mkdir -p artifacts
install -m 644 android/app/build/outputs/apk/debug/app-debug.apk artifacts/jido-debug.apk
install -m 644 artifacts/jido-debug.apk artifacts/JDo-android.apk
printf '%s\n' "APK: $JIDO_ROOT/artifacts/jido-debug.apk"
