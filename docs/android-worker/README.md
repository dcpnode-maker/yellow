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
- offers one explicit **Prepare best coding model** action;
- downloads only the two immutable Order 030 Qwen model resources, resuming through
  a `.part` file and preserving valid progress when Android stops the work;
- keeps at least 8 GiB free beyond the remaining download, then verifies exact length
  and SHA-256 before an in-directory rename;
- attempts Qwen2.5 Coder 14B Q4_K_M first and moves to the 7B Q6_K fallback after an
  interrupted or failed 14B load/benchmark;
- activates a model only after the pinned native engine loads it and a bounded
  on-device benchmark finishes below `MODERATE` thermal status.

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
