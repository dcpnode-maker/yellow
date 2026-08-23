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

The 10R's fit-safe 1.5B result exposed a shared engine integration defect rather than a
RAM limit: Yellow had omitted the upstream sample's native-library extraction setting,
so llama.cpp could not enumerate its packaged CPU backend modules. v0.6 restores that
setting and rearms only the final 1.5B marker once. An updated 10R therefore downloads
only the 1,894,532,160-byte diagnostic again; its three larger failure markers remain.

v0.7 corrects a real-device diagnostic gate exposed by OxygenOS reporting `MODERATE`
while the 10R is cool. Only **Run model test now** may proceed at `MODERATE`, and only
with an independent Android battery reading below Yellow's 40.0 °C test ceiling. It
still stops at `SEVERE`, an unknown thermal state, or a hot battery, and shows the
actual platform level and battery reading in the activity. Normal idle mode remains
blocked at `MODERATE`.

The repaired v0.7 engine then loaded and benchmarked the 1.5B Q8_0 model on the
Dimensity 8100-MAX in 10,939 ms with 4.71 GiB available before load. v0.8 therefore
offers one explicit **Test stronger 7B model** promotion. It clears only the old 7B
Q4_K_M pre-repair marker, preserves the verified 1.5B GGUF throughout the test, and
uses a sentinel to prevent a second promotion. A failed or interrupted 7B test deletes
only its own weight and returns to the ready 1.5B fallback. Promotion progress remains
visible beside the retained fallback, and a passing benchmark exposes prompt and
generation tokens/second in the activity.

For the first founder-controlled OnePlus 10R measurement, D-95 also exposes an
explicit **Run model test now** action. It temporarily holds the charging, idle,
screen-off and unmetered-network gates while retaining connected-network,
battery/storage health, sticky pause, integrity and fail-closed thermal protection.
