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
- blocks at thermal status `MODERATE` or above and fails closed when status is unknown;
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
  on-device benchmark finishes below `MODERATE` thermal status.

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

### Temporary founder-controlled 10R test mode

The explicit **Run model test now** action starts the Order 030 preparation ladder
without waiting for charging, screen-off, device-idle or unmetered-network status.
It is a narrow physical-phone diagnostic authorized by D-95, not the production
scheduler. It still requires a connected network, healthy battery and storage,
retains the 8 GiB reserve, fails closed at unknown or `MODERATE` thermal status, and
can be stopped immediately with **Pause now**. A determinate progress bar mirrors the
foreground download notification. **Arm when idle** keeps the original full gates.

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
