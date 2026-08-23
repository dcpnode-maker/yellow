# Android idle worker — safe model preparation

Status: **model preparation enabled; remote jobs and code execution disabled**.

The OnePlus fleet worker is one native Kotlin APK for the verified OnePlus 10R,
OnePlus 11R and OnePlus Nord 5, backed by the official `llama.cpp` Android library.
It exists to prove that Yellow can package a local engine without granting access to
personal data or allowing arbitrary code execution.

## What this APK does

- starts in a durable manual-pause state;
- lets the owner arm, pause, or resume work;
- schedules one unique job only while charging, on unmetered Wi-Fi, with battery and
  storage healthy, and with Android reporting the device idle;
- rechecks screen use, charging, and thermal state before native work;
- keeps normal idle work blocked at thermal status `MODERATE` or above and fails closed
  when status is unknown;
- shows a foreground notification with an immediate **Pause now** action;
- offers one explicit **Run model test now** action;
- downloads only the four immutable Order 030 Qwen model resources, resuming through
  a `.part` file and preserving valid progress when Android stops the work;
- keeps at least 8 GiB free beyond the remaining download, then verifies exact length
  and SHA-256 before an in-directory rename;
- attempts Qwen2.5 Coder 14B Q4_K_M first, then advances through 7B Q6_K,
  lower-memory 7B Q4_K_M and a final 1.5B Q8_0 engine diagnostic after interrupted
  or failed loads/benchmarks;
- activates a model only after the pinned native engine loads it and a bounded
  on-device benchmark passes the selected idle/manual thermal profile.

The 10R hash-verified all four candidates, and the fit-safe 1.5B model still failed
with 5.90 GiB available RAM. That control falsified memory pressure as the common
cause. D-98 traced the actual integration defect: Yellow packaged llama.cpp's dynamic
ARM64 CPU modules but omitted the upstream sample's required native-library extraction
setting, leaving the JNI engine unable to enumerate a backend. v0.6 restores that
contract and rearms only the final 1.5B marker once, so the updated 10R downloads just
1,894,532,160 bytes for the repaired proof instead of retrying the deleted larger
weights. If it fails again, the marker remains terminal and cannot loop. Under D-97,
cleanup stays per-device: a 10R failure does not remove or disqualify a model on the
11R or Nord 5.

The next 10R run exposed a separate gate issue: OxygenOS repeatedly reported
`MODERATE` while the founder observed that the phone was cool, preventing the repaired
engine from being tested. v0.7 records and displays Android's platform thermal level
and sticky battery-temperature reading. D-99 allows only the explicit manual test to
continue at `MODERATE`, only below Yellow's conservative 40.0 °C diagnostic ceiling;
`SEVERE`, unknown thermal state, or a hot reading still blocks. The idle scheduler's
strict below-`MODERATE` rule is unchanged.

That repaired v0.7 path subsequently loaded and benchmarked Qwen2.5 Coder 1.5B Q8_0
on the 10R's Dimensity 8100-MAX in 10,939 ms, with 4.71 GiB available immediately
before load. Because the three larger failures predated the shared backend repair,
v0.8 offers one owner-triggered **Test stronger 7B model** action for only the 4.68 GB
7B Q4_K_M candidate. The verified 1.5B GGUF stays active and visible during download,
load and benchmark. A per-device sentinel prevents a second promotion; failure or an
interrupted load deletes only the 7B final/partial weight and restores the ready 1.5B
state without looping. A passing result displays parsed prompt and generation
tokens/second on its first evidence line.

### Temporary founder-controlled 10R test mode

The explicit **Run model test now** action starts the Order 030 preparation ladder
without waiting for charging, screen-off, device-idle or unmetered-network status.
It is a narrow physical-phone diagnostic authorized by D-95, not the production
scheduler. It still requires a connected network, healthy battery and storage,
retains the 8 GiB reserve, fails closed at an unknown thermal status, and can be
stopped immediately with **Pause now**. At `MODERATE`, it proceeds only with a measured
battery temperature below 40.0 °C; `SEVERE` or hotter always blocks. A
determinate progress bar mirrors the foreground download notification, and the screen
shows the latest thermal level and battery reading. **Arm when idle** keeps the original
full gates and still blocks at `MODERATE`.

## What it cannot do

It cannot read media, storage, contacts, messages, calls, microphone, camera, location,
notifications, app usage, or accessibility data. It does not start at boot. It has no
coordinator URL, GitHub token, shell, repository checkout, remote prompt, arbitrary
model URL, or repository-code execution path.

The APK uses app-private storage with backup disabled. Model weights live under the
app's private `files/models/` directory; expanded RAM is not treated as real memory
capacity. One package does not mean one performance profile: model, throughput and
thermals remain measured per phone, with the physical 12 GB devices as conservative
cases.

## Owner controls

Android requires one explicit APK-install approval. The first arm/resume also requests
notification permission; work remains paused if that permission is denied so the
visible pause control cannot disappear. **Pause now** is sticky and cancels both the
preparation and ordinary unique WorkManager jobs. The worker never silently installs,
roots, or enrolls the phone.

## Next gates

Order 031 separately defines signed jobs, ephemeral context, and draft-PR output. That
trust boundary is not present: a prepared model still cannot receive a coding task.
