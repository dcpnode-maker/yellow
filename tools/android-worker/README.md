# Yellow Android worker

This directory builds the fail-closed OnePlus fleet worker foundation from Orders 028
and 029. One arm64 APK serves the verified OnePlus 10R, OnePlus 11R and OnePlus Nord 5.
It embeds the official pinned `llama.cpp` Android library but intentionally does not
load a model or accept jobs yet.

## Build

From the repository root, initialize the pinned submodule and use its Gradle wrapper:

```bash
git submodule update --init --recursive
vendor/llama.cpp/examples/llama.android/gradlew \
  -p tools/android-worker \
  --no-daemon \
  :app:testDebugUnitTest \
  :app:assembleDebug
```

The debug APK is written to
`tools/android-worker/app/build/outputs/apk/debug/app-debug.apk`.

Required build packages are pinned in `.github/workflows/android-worker.yml`. The APK
contains arm64 native code only and is intended for the three verified OnePlus phones.
Inference limits remain per-device runtime profiles and are not fixed by packaging.
