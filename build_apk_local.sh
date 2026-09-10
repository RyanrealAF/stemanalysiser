#!/usr/bin/env bash
set -e

WORKSPACE_DIR="$(pwd)"
echo "=== 1. Setting up JDK 21 in ${WORKSPACE_DIR}/.jdk21 ==="
if [ ! -f "${WORKSPACE_DIR}/.jdk21/bin/java" ]; then
  mkdir -p "${WORKSPACE_DIR}/.jdk21"
  curl -sL "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jdk_x64_linux_hotspot_21.0.4_7.tar.gz" | tar -xz -C "${WORKSPACE_DIR}/.jdk21" --strip-components=1
fi
export JAVA_HOME="${WORKSPACE_DIR}/.jdk21"
export PATH="${JAVA_HOME}/bin:${PATH}"
java -version

echo "=== 2. Setting up Android SDK in ${WORKSPACE_DIR}/.android-sdk ==="
export ANDROID_HOME="${WORKSPACE_DIR}/.android-sdk"
mkdir -p "${ANDROID_HOME}/cmdline-tools"

if [ ! -f "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" ]; then
  cd "${ANDROID_HOME}/cmdline-tools"
  curl -sLO "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  unzip -q commandlinetools-linux-11076708_latest.zip
  rm -rf latest
  mv cmdline-tools latest
  rm -f commandlinetools-linux-11076708_latest.zip
  cd "${WORKSPACE_DIR}"
fi

export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

if [ ! -d "${ANDROID_HOME}/platforms/android-36" ]; then
  yes | sdkmanager --licenses > /dev/null 2>&1 || true
  sdkmanager "platform-tools" "platforms;android-36" "platforms;android-35" "build-tools;35.0.0"
fi

echo "=== 3. Writing local.properties ==="
echo "sdk.dir=${ANDROID_HOME}" > "${WORKSPACE_DIR}/android/local.properties"

echo "=== 4. Syncing Web Assets with Capacitor ==="
npm run build
npx cap sync android

echo "=== 5. Building Android Debug APK ==="
chmod +x "${WORKSPACE_DIR}/android/gradlew"
cd "${WORKSPACE_DIR}/android"
./gradlew assembleDebug --no-daemon

echo "=== 6. Copying APK to public and workspace root ==="
mkdir -p "${WORKSPACE_DIR}/public/apk"
cp "${WORKSPACE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk" "${WORKSPACE_DIR}/public/app-debug.apk"
cp "${WORKSPACE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk" "${WORKSPACE_DIR}/public/apk/StemFlow-AI-debug.apk"
cp "${WORKSPACE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk" "${WORKSPACE_DIR}/StemFlow-AI-debug.apk"

ls -lh "${WORKSPACE_DIR}/public/app-debug.apk"
echo "=== APK BUILD COMPLETE! ==="
