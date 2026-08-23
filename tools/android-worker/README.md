# Yellow Android worker

This directory builds the fail-closed OnePlus fleet worker from Orders 028–030. One
arm64 APK serves the verified OnePlus 10R, OnePlus 11R and OnePlus Nord 5. It embeds
the official pinned `llama.cpp` Android library and can prepare a hash-pinned model,
but intentionally does not accept remote jobs or run repository code yet.

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
The owner can start the 14B→7B Q6→7B Q4→1.5B preparation ladder from the app.
Downloads resume only under the idle/charging/Wi-Fi safety constraints, stay in
app-private storage, and must pass exact byte-count, SHA-256, native-load and thermal
benchmark gates. Inference limits remain per-device runtime profiles and are not fixed
by packaging. Persisted attempt markers skip models that already failed on that phone,
and v0.5 deletes those failed weights before advancing while retaining the markers so
they cannot be downloaded again. Active and unattempted model files remain untouched.

For the first founder-controlled OnePlus 10R measurement, D-95 also exposes an
explicit **Run model test now** action. It temporarily holds the charging, idle,
screen-off and unmetered-network gates while retaining connected-network,
battery/storage health, sticky pause, integrity and fail-closed thermal protection.
