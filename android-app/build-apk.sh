#!/usr/bin/env bash
# 把记账网页打包成安卓 APK（WebView 壳）。不依赖 Gradle/Android Studio，
# 只用 JDK + Android SDK build-tools（aapt2 / d8 / zipalign / apksigner）。
#
# 依赖（一次性）：
#   brew install openjdk@17
#   brew install --cask android-commandlinetools
#   sdkmanager --sdk_root=$HOME/android-sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"
#
# 用法： bash build-apk.sh   → 生成 zhulaicai-ledger.apk
set -euo pipefail
cd "$(dirname "$0")"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
STOREPASS="${ANDROID_KEYSTORE_PASS:-zhulaicai}"

ANDROID_JAR="$ANDROID_HOME/platforms/android-34/android.jar"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
AAPT2="$BT/aapt2"; D8="$BT/d8"; ZIPALIGN="$BT/zipalign"; APKSIGNER="$BT/apksigner"

echo "==> build-tools: $BT"
rm -rf build && mkdir -p build/compiled build/dex build/classes

echo "==> 1/6 compile resources"
"$AAPT2" compile --dir res -o build/compiled/res.zip

echo "==> 2/6 link resources + manifest"
"$AAPT2" link -o build/app-unsigned.apk -I "$ANDROID_JAR" \
  --manifest AndroidManifest.xml build/compiled/res.zip

echo "==> 3/6 javac"
"$JAVA_HOME/bin/javac" --release 8 -classpath "$ANDROID_JAR" \
  -d build/classes java/com/zhulaicai/ledger/MainActivity.java

echo "==> 4/6 d8 -> classes.dex"
"$D8" --min-api 21 --lib "$ANDROID_JAR" --output build/dex build/classes/com/zhulaicai/ledger/*.class
( cd build/dex && zip -q ../app-unsigned.apk classes.dex )

echo "==> 5/6 zipalign"
"$ZIPALIGN" -f -p 4 build/app-unsigned.apk build/app-aligned.apk

echo "==> 6/6 sign"
KS=build/release.jks
if [ ! -f "$KS" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$KS" \
    -storepass "$STOREPASS" -keypass "$STOREPASS" -alias zhulaicai \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Zhulaicai Ledger, O=Zhulaicai, C=CN" >/dev/null 2>&1
fi
"$APKSIGNER" sign --ks "$KS" --ks-pass "pass:$STOREPASS" --key-pass "pass:$STOREPASS" \
  --out zhulaicai-ledger.apk build/app-aligned.apk
"$APKSIGNER" verify zhulaicai-ledger.apk && echo "✅ 生成: $(pwd)/zhulaicai-ledger.apk"
